# Marknative Design

## Summary

`marknative` is a native Markdown layout and rendering engine.

It targets:

- CommonMark + GFM compatibility
- Native layout and pagination without a browser engine
- High-quality multi-page rendering for technical documents and articles
- Multiple output formats such as PNG, SVG, and HTML

This is a full product reset. The current repository will no longer be positioned as a Xiaohongshu/card rendering tool. The existing card/story/template architecture is not an acceptable foundation for the new direction and will be removed.

## Why The Current Architecture Fails

The current renderer does not fail because Markdown is inherently too hard. It fails because the rendering pipeline was designed around the wrong abstraction order.

Current pipeline:

```text
Markdown
-> coarse ContentBlock[]
-> block-to-node conversion
-> height measurement
-> block-level pagination
-> rendering
```

This creates structural problems:

1. Content semantics are flattened too early.
   Paragraphs become a single span list, lists become plain strings, code blocks become raw text blobs. Pagination and layout then have to reconstruct structure that should never have been discarded.

2. Pagination happens too late.
   Pagination is treated as a post-processing step after block rendering, instead of being a first-class part of layout.

3. The model is too coarse for browser-level output quality.
   Good rendering depends on inline layout, line boxes, list markers, code line continuation, table cell layout, blockquote rhythm, and pagination-aware fragments. The current `ContentBlock` model cannot represent these well enough.

4. Product direction polluted the renderer architecture.
   The repository accumulated story, template, card, and Xiaohongshu-specific concepts. Those concepts pushed the code toward page decoration and content packaging, not toward native document layout quality.

Because of these issues, the current system is not suitable as the base for a native Markdown rendering engine that aims to compete with browser-quality output.

## Why Marknative Is Feasible Now

Marknative is feasible now for three reasons.

1. Markdown syntax and semantics are stable.
   CommonMark and GFM define the document model clearly. We do not need to invent a Markdown dialect or a parser grammar.

2. Strong parser and AST tooling already exist.
   The unified ecosystem provides mature parsing and syntax tree utilities that preserve structure and positions without forcing us into an HTML-first architecture.

3. `pretext` provides a viable foundation for line layout.
   The missing piece in previous native rendering attempts was reliable inline text layout. With `pretext`, Marknative can base paragraph and inline layout on explicit line results instead of rough height guesses.

Marknative therefore should not reinvent:

- Markdown parsing
- Markdown AST standards
- GFM parsing support
- Low-level 2D graphics APIs

It should focus on the hard parts that are actually the product:

- document normalization
- block and inline layout
- pagination
- fragment continuation
- paint abstraction

## Product Definition

Marknative is not:

- a browser screenshot pipeline
- a card generator
- a theme-first social media template tool
- a Markdown-to-HTML wrapper

Marknative is:

- a native Markdown layout engine
- a pagination engine for long-form documents
- a renderer that can paint Markdown documents into image/vector outputs
- a document-quality system, not a social template system

## Standards Target

The rendering target is:

- CommonMark
- GitHub Flavored Markdown

The parser stack and document model must preserve enough structure to support full rendering of standard Markdown syntax, not a trimmed-down subset.

This includes, at minimum:

- headings
- paragraphs
- emphasis and strong emphasis
- inline code
- links
- block quotes
- fenced and indented code blocks
- bullet lists
- ordered lists
- nested lists
- thematic breaks
- images
- tables
- strikethrough
- task lists
- autolinks
- footnotes if the selected GFM stack supports them cleanly

If a syntax is supported by the chosen parser stack but not yet painted in phase 1, the document model must still preserve the semantic node type instead of flattening it into plain text.

## Technology Stack

Marknative should reuse mature open-source components wherever possible.

### Parsing

Recommended stack:

- `micromark`
- `mdast-util-from-markdown`
- `micromark-extension-gfm`
- `mdast-util-gfm`

Why:

- `micromark` is designed around CommonMark compliance and precise tokenization.
- `mdast` gives Marknative a standard Markdown syntax tree with stable semantics.
- `mdast-util-gfm` extends the tree with GFM structures without forcing HTML rendering.

This gives Marknative a strong parser and AST foundation while keeping the system native and layout-oriented.

### Text Layout

Recommended stack:

- `@chenglou/pretext`

Why:

- Marknative needs explicit line layout results, not just text height measurement.
- `pretext` is a strong fit for line generation, line measurement, and inline layout decisions.

Marknative should treat `pretext` as the inline layout engine, not as a document renderer.

### Paint Backend

Recommended default backend:

- `skia-canvas`

Optional future backend:

- `@napi-rs/canvas`

Why:

- Marknative needs a mature drawing backend, not a self-built canvas implementation.
- `skia-canvas` is a better fit for image/vector document rendering and should be the preferred default backend.
- The paint layer must be abstracted so rendering backends can be swapped later.

### Language

- TypeScript

## High-Level Architecture

The new architecture should be:

```text
Markdown
-> Parser
-> MDAST
-> Marknative Document Model
-> Layout Tree
-> Inline Line Layout
-> Pagination Engine
-> Paint Engine
-> Output
```

Each stage has a strict responsibility boundary.

### 1. Parser Layer

Input:

- raw Markdown string

Output:

- `mdast` syntax tree with GFM nodes

Responsibilities:

- parse Markdown
- preserve positions and node structure
- never flatten semantics into coarse block strings

Marknative should not add layout concerns here.

### 2. Document Model Layer

Input:

- `mdast`

Output:

- Marknative document tree

Responsibilities:

- normalize parser-specific details
- preserve all semantic node types needed by layout
- define stable internal node types independent of parser implementation details

This layer exists so the rest of the system depends on Marknative’s own document model, not directly on parser-specific AST node shapes.

### 3. Layout Layer

Input:

- Marknative document tree
- layout theme/style settings
- page constraints

Output:

- layout fragments and page-ready boxes

Responsibilities:

- block formatting
- inline formatting
- list marker layout
- code block layout
- table layout
- image sizing
- quote block layout
- heading spacing rules
- fragment continuation rules

This is the core value layer of the product.

### 4. Inline Line Layout

Input:

- inline content runs
- available width
- typography settings

Output:

- line boxes

Responsibilities:

- line breaking
- mixed Chinese/English flow
- inline style segmentation
- line metrics
- inline code runs
- link/emphasis/strong run composition

This layer should be powered by `pretext`.

### 5. Pagination Engine

Input:

- layout fragments
- page geometry

Output:

- `Page[]`

Responsibilities:

- paginate fragments, not coarse blocks
- manage continuation fragments
- split paragraphs, lists, code blocks, and tables according to fragment rules
- keep page construction deterministic

Pagination must be built into the layout model from the start. It cannot be a late-stage repair step.

### 6. Paint Layer

Input:

- page boxes

Output:

- rendered output data

Responsibilities:

- paint text
- paint images
- paint fills and borders
- paint decoration derived from layout, not from product templates

The painter must not make pagination or semantic decisions.

## Core Internal Models

Marknative should define three distinct model families.

### Document Nodes

These preserve Markdown semantics.

Examples:

- `DocumentNode`
- `ParagraphNode`
- `HeadingNode`
- `ListNode`
- `ListItemNode`
- `CodeBlockNode`
- `BlockquoteNode`
- `TableNode`
- `TableRowNode`
- `TableCellNode`
- `ImageNode`
- `ThematicBreakNode`

Inline examples:

- `TextRun`
- `StrongRun`
- `EmphasisRun`
- `InlineCodeRun`
- `LinkRun`
- `BreakRun`

### Layout Fragments

These represent layout-ready, splittable units.

Examples:

- `ParagraphFragment`
- `ListFragment`
- `CodeBlockFragment`
- `TableFragment`
- `QuoteFragment`
- `ImageFragment`
- `HeadingFragment`

These must support continuation semantics where applicable.

### Paint Boxes

These represent final drawable output.

Examples:

- `TextBox`
- `RectBox`
- `ImageBox`
- `BorderBox`
- `RuleBox`

These should be renderer-facing and semantics-free.

## Pagination Model

Pagination must operate on layout fragments, not on document nodes and not on rendered boxes.

Required rules:

- paragraphs split by line boxes
- ordered and bullet lists split by list items and then by paragraph fragments inside items when necessary
- code blocks split by source lines and wrapped line boxes
- block quotes continue as quote fragments
- tables must support row-level continuation, with later cell-level continuation as an extension
- images are atomic unless an explicit crop/split strategy is added in the future

This means continuation is a first-class concept in the layout system.

Examples:

- a paragraph can continue onto the next page
- a list item can continue across pages
- a code block can continue across pages
- a table can continue across pages

The current “measure full block, then try to cut it” model must not survive into Marknative.

## Styling Model

Marknative should support a document-oriented styling system, not the old template/story model.

The first design should use:

- page geometry
- typography scale
- colors
- spacing scale
- code block style
- block quote style
- table style
- heading style
- list marker style

This should be expressed as document theme primitives, not page-template product abstractions.

Examples:

- `DocumentTheme`
- `TypographyTheme`
- `CodeTheme`
- `TableTheme`
- `QuoteTheme`

The system should support theming, but theming must never define the core content model.

## Public API Direction

The public API should be reset to fit the new product.

Recommended phase 1 API:

```ts
parseMarkdown(markdown, options?)
layoutMarkdown(markdown, options?)
renderMarkdown(markdown, options?)
renderDocument(document, options?)
```

Recommended primary API:

```ts
renderMarkdown(markdown, {
  format: 'png' | 'svg' | 'html',
  page: {
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number },
  },
  theme,
})
```

Current APIs that should be removed:

- `renderDoc`
- `renderDocFromBlocks`
- `renderDocFromJson`
- `renderStory`
- all template registry APIs
- all story/page template APIs
- all Xiaohongshu-oriented concepts

## Repository Reset Scope

The repository is being repurposed into a new product. The reset should be explicit.

The following areas should be removed entirely:

- story system
- theme/template registries designed for story pages
- page templates
- Xiaohongshu/card-specific smoke cases
- current coarse `ContentBlock`-based pipeline
- product messaging related to social cards and story templates

The following may be retained only if they still fit the new architecture after review:

- low-level font registration helpers
- low-level drawing helpers
- any backend renderer code that is cleanly reusable under the new painter abstraction

Retention is optional. Reuse is allowed only if it does not force old abstractions into the new system.

## Non-Goals

Marknative phase 1 is not trying to:

- replicate browser CSS fully
- support arbitrary HTML embedding
- provide WYSIWYG editing
- preserve old API compatibility
- preserve old test suite shape
- provide social-media-specific templates

## Phase 1 Success Criteria

Phase 1 should be considered successful when all of the following are true.

1. The repository is clearly a Markdown-native rendering engine, not a card renderer.
2. Parsing is based on CommonMark + GFM using mature ecosystem tools.
3. The system has a real internal document model, not a flattened block list.
4. Pagination works on layout fragments, not coarse content blocks.
5. Technical blog samples produce stable multi-page output with visibly improved quality over the current repository.
6. The architecture is clean enough to extend tables, nested lists, and advanced continuation rules without another rewrite.

## Risks

The main risks are:

1. Underestimating layout complexity.
   Native Markdown rendering is a layout engine problem, not a parser problem.

2. Overfitting to current helper code.
   Trying to preserve old abstractions will slow down the rewrite and contaminate the new design.

3. Treating `pretext` as a full renderer.
   It should power line layout, not replace document layout architecture.

4. Under-scoping GFM structures.
   Tables, task lists, nested lists, and block continuation must be considered from the beginning, even if phase 1 paints some of them more simply.

## Recommendation

Proceed with a full repository reset under the `marknative` product direction.

The implementation should start from:

1. parser and document model
2. inline line layout integration with `pretext`
3. block layout fragments
4. pagination engine
5. painter abstraction
6. renderer outputs

The current repository should not be incrementally evolved into Marknative. It should be intentionally rebuilt as a new product in the same repository.
