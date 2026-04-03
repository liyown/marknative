# Formula Rendering Design

## Summary

This document proposes a math-formula rendering architecture for `marknative` that balances capability with rendering stability.

The recommended direction is:

- support block formulas first
- support inline formulas through a dedicated inline math box model
- render formula contents externally with KaTeX to SVG
- let `marknative` remain responsible only for formula box layout, pagination, and painting

The intended pipeline is:

`math markdown -> math AST nodes -> external formula renderer -> SVG + metrics -> marknative layout boxes -> pagination -> paint`

This avoids building a full math typesetting engine inside `marknative` while still allowing both block and inline formulas.

## Goals

- Support block formulas without destabilizing the current renderer.
- Provide a path to inline formulas that preserves predictable layout.
- Keep formula internals out of the core text layout engine.
- Preserve deterministic pagination behavior.
- Gracefully fall back when formula rendering fails.

## Non-Goals

- No in-house math typesetting engine.
- No browser/DOM-based math layout pipeline.
- No attempt to treat formulas as ordinary text runs.
- No automatic semantic editing or AST transformation of LaTeX.
- No rich MathML-first rendering path in the first version.

## Current State

The current parser and document model do not recognize math nodes:

- `parseMarkdown()` only enables CommonMark + GFM extensions.
- `src/document/types.ts` has no `inlineMath` or `blockMath` node types.
- `src/document/from-mdast.ts` has no conversion path for math nodes.
- The inline layout engine only knows text-like runs and hard breaks.
- The block layout engine only knows headings, paragraphs, lists, blockquotes, code, tables, thematic breaks, and images.

This means formula support is not an incremental paint-only feature. It needs parser, document, layout, and paint integration points.

## Recommendation

### Overall Strategy

Use KaTeX as the external formula renderer and consume its SVG output inside `marknative`.

`marknative` should not typeset formulas internally. It should only:

- parse formula nodes
- classify them as block or inline
- compute box placement and wrapping behavior
- paint the resulting SVG resource

This is the best balance between correctness and implementation cost.

### Why not build formula layout directly

A true internal formula layout engine would require:

- a dedicated math AST
- glyph metrics and script sizing rules
- fraction, root, matrix, delimiter, and accent layout
- baseline math alignment rules
- nested box layout semantics

That is a large separate rendering engine. It does not align with the core value of this project, which is deterministic document layout rather than domain-specific math typography.

## Supported Formula Forms

### Block formulas

Block formulas are the safest first step.

Recommended syntax:

- `$$ ... $$`

Behavior:

- parsed as dedicated block math nodes
- rendered to SVG by KaTeX
- laid out as atomic block fragments
- paginated like images or other indivisible blocks

### Inline formulas

Inline formulas should be supported through a dedicated inline math box model, not through plain text layout and not through generic inline image semantics.

Recommended syntax:

- `$...$`

Behavior:

- parsed as dedicated inline math nodes
- rendered to SVG by KaTeX
- treated as inline atomic boxes with explicit width, height, and baseline metrics
- wrapped as indivisible inline units

## Key Design Decision

### Inline formulas are not ordinary text

Inline formulas should not be decomposed into text runs and should not rely on the normal text segmenter.

They need their own inline box type because formulas have different requirements:

- width must be measured from rendered formula output
- baseline alignment matters more than ordinary images
- formulas must not break internally across lines
- very large inline formulas need explicit fallback behavior

### Inline formulas are also not generic inline images

The rendering mechanism may look similar to an inline SVG image, but the layout semantics differ from normal images:

- formulas require baseline alignment
- formulas should have stricter size constraints
- formulas need formula-specific fallback and overflow rules

So the correct abstraction is `inlineMath`, not `inlineImage`.

## Parsing Model

### Markdown extensions

Math parsing should be added through markdown extensions rather than ad hoc regex parsing inside the document conversion layer.

Recommended additions:

- a micromark math extension
- a corresponding mdast math extension

This yields dedicated mdast node types for:

- inline math
- block math

### Internal document model

Extend `src/document/types.ts` with:

```ts
export type BlockNode =
  | ...
  | MathBlockNode

export type InlineNode =
  | ...
  | InlineMathNode

export type MathBlockNode = {
  type: 'mathBlock'
  value: string
}

export type InlineMathNode = {
  type: 'inlineMath'
  value: string
}
```

Then extend `src/document/from-mdast.ts` to convert mdast math nodes into these internal node types.

## Rendering Model

### External renderer boundary

Introduce a dedicated math rendering adapter, for example:

- `src/math/types.ts`
- `src/math/render-math.ts`
- `src/math/katex-adapter.ts`

The adapter output should be owned by `marknative`, not by KaTeX.

Recommended internal type:

```ts
export type RenderedMath = {
  svg: string
  width: number
  height: number
  baseline?: number
}
```

This keeps KaTeX isolated behind a stable boundary.

### Why SVG

SVG is the right output format here because:

- it is deterministic
- it preserves vector sharpness in both PNG and SVG page output
- it can be measured as a self-contained box
- it does not require `marknative` to understand formula internals

## Block Formula Layout

### Layout semantics

Block formulas should be laid out as atomic blocks.

Recommended behavior:

- compute available content width
- render the formula to SVG with that width as a soft constraint
- place the formula box as a single block fragment
- add block margins similar to image or code blocks

### Pagination semantics

Block formulas should be paginated like images:

- they are atomic
- they do not split across pages
- if a single formula exceeds the page content height, the renderer should throw a clear error

This is consistent with the existing atomic block behavior and keeps the pagination model simple.

## Inline Formula Layout

### Required abstraction

Add a dedicated inline math box to the inline layout system.

This means the inline layout engine needs to understand a new prepared segment or run type that represents an indivisible inline object with:

- width
- height
- baseline
- rendered SVG payload reference

Recommended conceptual type:

```ts
type InlineMathSegment = {
  type: 'inlineMath'
  width: number
  height: number
  baseline: number
  svg: string
}
```

### Wrapping behavior

Inline formulas must behave as indivisible wrap units:

- if the current line has room, place the whole formula
- if the current line does not have room, move the whole formula to the next line
- never split the formula internally across lines

This is the main reason inline formulas need a dedicated box model.

### Baseline behavior

Inline formulas need explicit baseline alignment.

Recommended rule:

- use the baseline metric returned by the math renderer when available
- otherwise derive a fallback baseline ratio from the rendered box height

The line box height should then be expanded only as much as needed to fit the formula above and below the baseline.

### Overflow behavior

Large inline formulas are a real risk.

Recommended strategy:

- define a maximum inline formula height relative to body line height
- define a maximum inline formula width relative to available line width
- if a formula exceeds those thresholds, use one of two explicit fallbacks:
  - promote it to a block formula
  - render a textual fallback marker and expose an error

Recommendation:

Promote oversized inline formulas to block layout only when the markdown syntax is already block math. Do not silently rewrite inline math into block math during layout. For true inline formulas that are too large, fail clearly or use a conservative text fallback.

This avoids surprising pagination and visual jumps.

## Paint Model

### Formula fragments and runs

Block formulas should become block paint fragments.

Inline formulas should become paintable inline runs or inline object runs with SVG payload references.

This requires extending layout and paint types with formula-aware structures.

Recommended shapes:

```ts
type MathFragment = {
  kind: 'math'
  box: PaintBox
  svg: string
}

type LineRun = PaintBox & {
  ...
  styleKind: ... | 'inlineMath'
  svg?: string
  baselineOffset?: number
}
```

The final concrete type shape can vary, but block and inline math should be separate concepts.

### SVG painting

`marknative` already supports image loading, but formula SVG rendering should not be forced through generic remote-image loading.

Recommended approach:

- allow paint structures to carry inline SVG payloads for formulas
- render them directly during paint, or convert them into a cached image resource before draw time

This avoids unnecessary URL indirection and keeps formula rendering self-contained.

## Theme Design

Formula rendering should inherit the current page theme rather than introducing a completely independent palette.

Recommended theme additions:

```ts
type ThemeColors = {
  ...
  math: string
}
```

KaTeX rendering should use this foreground color for formulas, with a transparent background by default.

If needed later, block formulas may also support:

- optional background panel
- border color
- display formula spacing controls

But the first version should keep formula theming minimal.

## Error Handling and Fallback

Formula rendering must not break the whole page silently.

Recommended behavior:

- parser-level invalid syntax should still produce a math node if the markdown extension recognizes it
- render-time KaTeX errors should be caught at the math adapter boundary
- on block formula failure:
  - either throw a clear error
  - or render a visible placeholder block with the original source
- on inline formula failure:
  - prefer a conservative text fallback or explicit error marker

Recommendation:

Use strict rendering for now. Throw clear errors rather than silently substituting malformed formulas. Silent fallback risks hiding content problems in generated documents.

## Performance Strategy

KaTeX rendering is non-trivial but still much cheaper than building a custom formula engine.

Recommended mitigations:

- lazy-load the math renderer
- cache rendered formulas by `(source, displayMode, color)` key
- avoid invoking the renderer when the document has no math nodes

Inline formulas especially benefit from caching because repeated formulas are common in technical documents.

## Testing Strategy

### Parser tests

Add tests for:

- inline math parsing
- block math parsing
- interactions with surrounding markdown text

### Layout tests

Add tests for:

- block formula atomic placement
- inline formula wrap behavior
- baseline alignment effects on line height
- oversized inline formula failure behavior

### Pagination tests

Add tests for:

- block formulas near page boundaries
- block formulas exceeding page height
- documents mixing formulas with code, lists, and paragraphs

### Paint tests

Add tests for:

- block formulas render visible non-background pixels
- inline formulas render in-line with surrounding text
- formula color follows theme

### Smoke tests

Add smoke fixtures for:

- simple inline formulas
- simple display equations
- multi-paragraph technical content with mixed prose and formulas

## Migration Plan

### Phase 1

Add parser support and internal math node types.

### Phase 2

Implement block formula rendering with KaTeX SVG output and atomic block layout.

### Phase 3

Introduce inline math box support in the inline layout and paint systems.

### Phase 4

Add caching, theme support, and smoke tests.

This phase split intentionally gets stable value from block formulas first before introducing inline layout complexity.

## Open Decisions

These decisions should be made before implementation starts:

1. Which math markdown extension to adopt for parsing.
2. Whether strict render failure should be the only initial behavior or whether visible placeholders are acceptable.
3. Whether the first shipped version should include inline formulas or ship block formulas first and gate inline formulas behind a later phase.

## Recommendation

Proceed with:

- KaTeX as the math rendering backend
- internal `MathBlockNode` and `InlineMathNode` types
- block formulas as atomic SVG fragments
- inline formulas as dedicated inline math boxes with explicit metrics
- no custom math layout engine

This is the strongest design for formula support that still respects `marknative`'s architecture and stability goals.
