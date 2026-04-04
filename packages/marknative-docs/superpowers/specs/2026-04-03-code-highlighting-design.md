# Code Block Syntax Highlighting Design

## Summary

This document proposes a syntax-highlighting architecture for `marknative` code blocks that preserves the project's core guarantees:

- deterministic layout and pagination
- headless native rendering
- no HTML/DOM rendering stage
- graceful fallback when highlighting is unavailable

The recommended implementation uses `shiki` as the default highlighting engine, but only through an internal adapter layer. The rendering pipeline must consume a `marknative`-owned token model rather than any engine-specific output shape.

The intended pipeline is:

`code block source -> highlighter adapter -> normalized code tokens -> layout -> pagination -> paint`

This keeps syntax analysis outside the core layout system while allowing multiple languages and theme-driven token colors.

## Goals

- Add syntax highlighting for fenced code blocks.
- Support many languages and switchable highlighting themes.
- Preserve the existing pagination, line wrapping, and code block continuation behavior.
- Keep the highlighter replaceable without rewriting layout or paint code.
- Preserve current behavior as a fallback when highlighting fails or is unavailable.

## Non-Goals

- No inline-image-like rendering model for code tokens.
- No HTML-based highlighting pipeline.
- No browser-style DOM/CSS code rendering.
- No changes to paragraph, heading, list, table, or inline-code rendering.
- No automatic language detection in the first version.

## Current State

Today, code blocks are rendered as plain monochrome text:

1. Markdown parsing produces `CodeBlockNode`.
2. `layoutCode()` in `src/layout/block/layout-document.ts` splits source into lines.
3. Each source line is laid out through the existing inline layout machinery as plain text.
4. `drawCodeFragment()` in `src/paint/skia-canvas.ts` draws the code block background and then paints all runs using the same foreground style.

This design is simple and stable, but there is no token-level styling information in the code block pipeline.

## Recommended Approach

### Option Chosen

Use `shiki` as the default highlighting engine, but isolate it behind an internal adapter that produces normalized `marknative` code tokens.

This is preferred over directly embedding `shiki` token objects into layout code because:

- the layout engine remains independent from the highlighter
- the paint layer only consumes stable internal types
- future engine replacement remains feasible
- fallback behavior is easy to preserve

### Rejected Alternatives

#### Direct `shiki` integration throughout layout

Rejected because it would leak an external library's data model into core rendering code and make future changes more expensive.

#### HTML-first syntax highlighting

Rejected because it conflicts with the project's headless native pipeline and would force an unnecessary parsing/rendering detour.

#### Lightweight regex or keyword highlighting

Rejected for the main implementation path because it does not satisfy the requirement for broad language and theme support.

## Architecture

### High-Level Data Flow

The new code block pipeline should be:

1. Parse Markdown into `CodeBlockNode` as today.
2. Resolve a code highlighting configuration from render options and theme.
3. Send the code block source and language into a highlighter adapter.
4. Receive normalized highlighted lines.
5. Lay out highlighted tokens into `LineBox` and `LineRun` structures while preserving current wrapping behavior.
6. Paginate using the existing code block pagination logic.
7. Paint each run using token-specific color and optional font traits.

### Ownership Boundaries

#### Highlighter adapter

Responsible for:

- initializing `shiki`
- loading languages and themes
- converting engine output into internal token structures

Not responsible for:

- line wrapping
- pagination
- paint coordinates

#### Layout layer

Responsible for:

- turning normalized code tokens into positioned line runs
- preserving current code wrapping behavior
- rebasing wrapped lines into page fragments

Not responsible for:

- syntax analysis
- theme lookup from external libraries

#### Paint layer

Responsible for:

- drawing token colors and font traits
- preserving the current code block background and border rendering

Not responsible for:

- tokenization
- wrapping decisions

## Internal Data Model

Introduce a highlighter-owned internal model under `src/highlight`.

### Core types

```ts
export type CodeToken = {
  text: string
  color?: string
  fontStyle?: 'normal' | 'italic'
  fontWeight?: 'normal' | 'bold'
}

export type HighlightedCodeLine = {
  tokens: CodeToken[]
}

export type HighlightedCodeBlock = {
  lang: string | null
  lines: HighlightedCodeLine[]
}
```

The key constraint is that this model is owned by `marknative`, not by `shiki`.

### Layout run extension

The current `LineRun` / `PaintLineRun` model only distinguishes broad `styleKind` categories such as `text`, `link`, `inlineCode`, and `delete`.

Code highlighting needs one of these extensions:

1. Add optional foreground/font overrides to all runs.
2. Add a dedicated code-run variant with token style fields.

Recommendation:

Extend the existing run shape with optional render overrides:

```ts
type LineRun = PaintBox & {
  type: 'text'
  text: string
  styleKind: 'text' | 'strong' | 'emphasis' | 'inlineCode' | 'link' | 'delete' | 'inlineImage' | 'codeToken'
  color?: string
  fontStyle?: 'normal' | 'italic'
  fontWeight?: 'normal' | 'bold'
}
```

This keeps the rest of the system simple. The new fields are optional and only used by code-block runs.

## Theme Design

### Theme Extension

The project theme should define its own code-highlighting palette rather than passing raw `shiki` theme objects through rendering layers.

Add a dedicated theme section:

```ts
type CodeHighlightTheme = {
  plain: string
  background?: string
  tokens?: {
    keyword?: string
    string?: string
    function?: string
    type?: string
    constant?: string
    comment?: string
    variable?: string
    punctuation?: string
  }
  shikiTheme?: string
}
```

And mount it under `Theme`, for example:

```ts
type Theme = {
  ...
  codeHighlight: CodeHighlightTheme
}
```

### Why keep both semantic colors and a `shikiTheme` hint

`shiki` can provide token colors directly, but `marknative` should still have an internal theme contract.

Recommended behavior:

- `shikiTheme` selects the external tokenizer theme.
- token colors returned by the adapter are normalized into internal run styles.
- when adapter output is incomplete or unavailable, `marknative` falls back to `codeHighlight.plain` and optional semantic token colors.

This creates a stable API surface while still allowing rich theme support.

## Integration Points

### New files

Recommended additions:

- `src/highlight/types.ts`
- `src/highlight/highlight-code.ts`
- `src/highlight/shiki-adapter.ts`

### Existing files to change

#### `src/layout/block/layout-document.ts`

Change `layoutCode()` so that it:

- obtains highlighted token lines for the code block
- lays out token sequences instead of raw source strings
- preserves `sourceLines` and `lineSourceMap`

The current line-source mapping must remain intact so pagination continuity still works.

#### `src/layout/types.ts`

Extend `LineRun` to carry optional code-token paint overrides.

#### `src/paint/types.ts`

Mirror the run-level additions required for paint.

#### `src/paint/skia-canvas.ts`

Update `drawRun()` so code-token runs can override:

- foreground color
- font style
- font weight

The base font should still come from `theme.typography.code`.

#### `src/theme/default-theme.ts`

Add default code highlighting theme values and keep a safe monochrome fallback.

#### `src/render/render-markdown.ts`

Potentially extend render options with highlighter configuration, for example:

```ts
type RenderMarkdownOptions = {
  ...
  codeHighlighting?: {
    enabled?: boolean
    theme?: string
  }
}
```

This can be deferred if the first version always enables highlighting whenever a language is present.

## Detailed Rendering Rules

### Wrapping

Highlighted tokens must not bypass the existing wrapping logic.

Required behavior:

- wrapping still happens in `marknative`
- a token may be split across wrapped lines only if the current plain-text code path would already split that text
- punctuation and symbols should continue using the current text-measurement and wrap behavior

This keeps code pagination deterministic and consistent with the current renderer.

### Pagination

The existing code block pagination logic should remain authoritative.

Required invariants:

- code blocks continue across pages as they do today
- `lineSourceMap` still maps wrapped visual lines back to original source lines
- blank lines remain preserved
- page-break behavior does not depend on the external highlighter implementation

### Fallback

When highlighting is unavailable, rendering must fall back to current monochrome behavior.

Fallback triggers include:

- unknown or unsupported language
- highlighter initialization failure
- missing theme
- adapter exceptions

Fallback result:

- same code block background and border
- same wrapping and pagination
- code rendered with plain code font and default text color

## Performance Strategy

### Risk

`shiki` has a non-trivial initialization and language-loading cost. If integrated carelessly, it could become the slowest step in the pipeline.

### Mitigations

Recommended mitigations:

- lazy initialization
- process-level singleton cache for the highlighter instance
- cache loaded themes and languages
- do not initialize the highlighter unless a code block exists

### Explicit tradeoff

The first render of a process may become slower. This is acceptable if subsequent renders reuse the initialized highlighter.

## Testing Strategy

### Unit tests

Add tests for:

- adapter normalization from `shiki` output to internal `CodeToken`
- fallback behavior on unknown language
- fallback behavior on adapter failure

### Layout tests

Add tests proving:

- tokenized code still wraps within width constraints
- `lineSourceMap` remains correct after wrapping
- blank lines remain stable with highlighted input

### Paint tests

Add tests proving:

- code token runs preserve their colors into paint structures
- non-code runs remain unaffected

### Smoke tests

Add smoke fixtures for at least:

- TypeScript
- JSON
- Bash
- Markdown fenced code with no language

The smoke tests should verify that highlighted code still renders and paginates deterministically.

## Migration Plan

### Phase 1

Introduce internal highlighting types and a no-op highlighter adapter that returns monochrome tokens.

### Phase 2

Extend code block layout and paint layers to consume tokenized code runs.

### Phase 3

Integrate `shiki` behind the adapter and add theme configuration.

### Phase 4

Add tests, smoke fixtures, and documentation.

This phased approach keeps regressions contained and allows rollback at the adapter boundary.

## Open Decisions

These should be decided before implementation starts:

1. Whether highlighting is enabled by default for all fenced code blocks with a language.
2. Whether render options expose a user-facing `codeHighlighting` toggle in the first version.
3. Whether built-in themes should each define a corresponding syntax-highlighting palette or initially share one default palette.

## Recommendation

Proceed with:

- `shiki` as the default highlighting engine
- an internal `CodeToken` adapter boundary
- token-aware code block layout
- run-level paint overrides for code tokens
- monochrome fallback as a hard requirement

This gives `marknative` broad language and theme support without surrendering its core rendering model to an external highlighter.
