# Marknative Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the repository into `marknative`, a native CommonMark + GFM layout and rendering engine, by removing the current card/story product surface and replacing it with a parser -> document -> layout -> pagination -> paint pipeline.

**Architecture:** This plan resets the product in-place. It first removes the current story/card-facing APIs and tests, then establishes a new `marknative` skeleton with `mdast`-based parsing, a normalized document model, a `pretext`-powered inline layout layer, a fragment-based pagination engine, and a renderer backend abstraction with `skia-canvas` as the default paint backend.

**Tech Stack:** TypeScript, micromark, mdast-util-from-markdown, micromark-extension-gfm, mdast-util-gfm, @chenglou/pretext, skia-canvas

---

## File Structure

New product structure:

- `package.json`
  Dependency and script reset for `marknative`
- `README.md`
  Product reset documentation
- `src/index.ts`
  New public API exports
- `src/parser/parse-markdown.ts`
  CommonMark + GFM parse entry
- `src/document/types.ts`
  Marknative document model types
- `src/document/from-mdast.ts`
  AST normalization into Marknative document nodes
- `src/layout/types.ts`
  Layout fragment and page box types
- `src/layout/inline/line-layout.ts`
  `pretext` integration for inline line layout
- `src/layout/block/layout-document.ts`
  Block-level layout entry point
- `src/layout/pagination/paginate.ts`
  Fragment-based pagination
- `src/paint/types.ts`
  Paint backend interfaces
- `src/paint/skia-canvas.ts`
  Default Skia-backed painter
- `src/render/render-markdown.ts`
  Top-level render pipeline
- `src/theme/default-theme.ts`
  Baseline document theme
- `tests/spec/blocks/parse-blocks.test.ts`
  Block-level Markdown syntax and document-model coverage
- `tests/spec/inline/parse-inline.test.ts`
  Inline syntax and run-structure coverage
- `tests/spec/gfm/parse-gfm.test.ts`
  GFM syntax coverage such as tables and task lists
- `tests/layout/inline/line-layout.test.ts`
  `pretext` line layout coverage
- `tests/layout/blocks/layout-blocks.test.ts`
  Block-to-fragment layout coverage
- `tests/layout/pagination/paginate.test.ts`
  Fragment pagination coverage
- `tests/render/png/render-png.test.ts`
  PNG renderer contract and end-to-end output coverage
- `tests/render/svg/render-svg.test.ts`
  SVG renderer contract coverage
- `tests/smoke/articles/technical-blog.test.ts`
  Real technical article smoke outputs
- `tests/smoke/reference/api-doc.test.ts`
  Reference-style document smoke coverage
- `tests/smoke/gfm/table-heavy.test.ts`
  GFM-heavy smoke coverage
- `tests/smoke/regressions/`
  Visual regression fixtures for previously fixed rendering bugs

Files and directories to remove:

- `src/story/`
- `src/themes/`
- `src/templates/`
- `src/content/`
- `src/pipeline/`
- `tests/story/`
- `tests/content/`
- `tests/pipeline/`
- Xiaohongshu/card-oriented smoke expectations in `tests/smoke/production-cases.test.ts`

Reusable code, if it still fits cleanly after review:

- `src/setup.ts`
- renderer helper code only if it can sit behind the new paint abstraction without dragging old types with it

### Task 1: Reset Package Metadata And Product Messaging

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Rewrite `package.json` metadata for the new product**

Replace package metadata so the repository identifies as `marknative`, and add the new parser/render dependencies while removing card-specific assumptions from scripts.

```json
{
  "name": "marknative",
  "module": "index.ts",
  "type": "module",
  "scripts": {
    "typecheck": "bunx tsc --noEmit",
    "test": "bun test",
    "test:smoke": "bun test tests/smoke"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  },
  "dependencies": {
    "@chenglou/pretext": "^0.0.3",
    "micromark": "^4.0.0",
    "mdast-util-from-markdown": "^2.0.0",
    "mdast-util-gfm": "^3.0.0",
    "micromark-extension-gfm": "^3.0.0",
    "skia-canvas": "^2.0.0"
  }
}
```

- [ ] **Step 2: Replace README with marknative positioning**

Write a minimal README that removes story/card language and describes the new product surface.

```md
# marknative

Native Markdown layout and rendering engine.

## Goals

- CommonMark + GFM support
- Native layout and pagination
- PNG, SVG, and HTML outputs
- Technical document quality, not social card templates

## Status

This repository is being rebuilt into a new product architecture.
```

- [ ] **Step 3: Run typecheck to confirm metadata edits did not break tooling**

Run: `bun run typecheck`

Expected: exit code 0

- [ ] **Step 4: Commit package and README reset**

```bash
git add package.json README.md
git commit -m "chore: rename project to marknative"
```

### Task 2: Remove Old Product Surface

**Files:**
- Delete: `src/story/`
- Delete: `src/themes/`
- Delete: `src/templates/`
- Delete: `src/content/`
- Delete: `src/pipeline/`
- Delete: `tests/story/`
- Delete: `tests/content/`
- Delete: `tests/pipeline/`
- Modify: `src/index.ts`

- [ ] **Step 1: Replace public exports with a temporary marknative skeleton**

Replace `src/index.ts` with a minimal export surface that points only to the new API placeholders.

```ts
export { parseMarkdown } from './parser/parse-markdown'
export { renderMarkdown } from './render/render-markdown'
export { defaultTheme } from './theme/default-theme'

export type { MarkdownDocument } from './document/types'
export type { RenderMarkdownOptions, RenderPage } from './render/render-markdown'
```

- [ ] **Step 2: Remove old story/card product directories**

Run:

```bash
rm -rf src/story src/themes src/templates src/content src/pipeline tests/story tests/content tests/pipeline
```

Expected: those directories no longer exist in the worktree

- [ ] **Step 3: Create placeholder modules so `src/index.ts` can compile**

Create these files with minimal placeholders:

`src/parser/parse-markdown.ts`

```ts
import type { MarkdownDocument } from '../document/types'

export function parseMarkdown(_markdown: string): MarkdownDocument {
  return { type: 'document', children: [] }
}
```

`src/document/types.ts`

```ts
export type MarkdownDocument = {
  type: 'document'
  children: unknown[]
}
```

`src/render/render-markdown.ts`

```ts
export type RenderMarkdownOptions = {
  format?: 'png' | 'svg' | 'html'
}

export type RenderPage = {
  format: 'png' | 'svg' | 'html'
  data: string | Buffer
}

export async function renderMarkdown(
  _markdown: string,
  _options: RenderMarkdownOptions = {},
): Promise<RenderPage[]> {
  return []
}
```

`src/theme/default-theme.ts`

```ts
export const defaultTheme = {}
```

- [ ] **Step 4: Run typecheck and fix remaining imports broken by deletion**

Run: `bun run typecheck`

Expected: failures only from stale old imports if any remain; remove or rewrite those references until the command passes

- [ ] **Step 5: Commit old product removal**

```bash
git add src tests
git commit -m "refactor: remove legacy card rendering architecture"
```

### Task 3: Introduce CommonMark + GFM Parsing

**Files:**
- Create: `src/parser/parse-markdown.ts`
- Create: `tests/spec/blocks/parse-blocks.test.ts`
- Create: `tests/spec/inline/parse-inline.test.ts`
- Create: `tests/spec/gfm/parse-gfm.test.ts`
- Create: `src/document/types.ts`

- [ ] **Step 1: Write block syntax tests for headings, paragraphs, lists, code blocks, and block quotes**

Create `tests/spec/blocks/parse-blocks.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { parseMarkdown } from '../../src/parser/parse-markdown'

describe('parseMarkdown block syntax', () => {
  test('parses headings, paragraphs, lists, code blocks, and block quotes', () => {
    const markdown = [
      '# Title',
      '',
      'Paragraph with **strong** and `code`.',
      '',
      '- item a',
      '- item b',
      '',
      '> quoted',
      '',
      '```ts',
      'const x = 1',
      '```',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '- [x] done',
    ].join('\\n')

    const doc = parseMarkdown(markdown)

    expect(doc.type).toBe('document')
    expect(doc.children.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Write inline syntax tests for strong, emphasis, inline code, and links**

Create `tests/spec/inline/parse-inline.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { parseMarkdown } from '../../../src/parser/parse-markdown'

describe('parseMarkdown inline syntax', () => {
  test('preserves strong, emphasis, inline code, and links as inline nodes', () => {
    const doc = parseMarkdown('Text with **strong**, *em*, `code`, and [link](https://example.com).')
    expect(doc.type).toBe('document')
    expect(doc.children.length).toBe(1)
  })
})
```

- [ ] **Step 3: Write GFM syntax tests for tables and task lists**

Create `tests/spec/gfm/parse-gfm.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { parseMarkdown } from '../../../src/parser/parse-markdown'

describe('parseMarkdown gfm syntax', () => {
  test('parses tables and task lists', () => {
    const markdown = [
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '- [x] done',
      '- [ ] todo',
    ].join('\\n')

    const doc = parseMarkdown(markdown)
    expect(doc.type).toBe('document')
    expect(doc.children.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Run parser tests to confirm failure**

Run:

```bash
bun test tests/spec/blocks/parse-blocks.test.ts tests/spec/inline/parse-inline.test.ts tests/spec/gfm/parse-gfm.test.ts
```

Expected: FAIL because `parseMarkdown` still returns an empty document

- [ ] **Step 5: Define the initial Marknative document model**

Create `src/document/types.ts` with semantic node types:

```ts
export type MarkdownDocument = {
  type: 'document'
  children: BlockNode[]
}

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | BlockquoteNode
  | CodeBlockNode
  | TableNode
  | ThematicBreakNode
  | ImageNode

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'emphasis'; children: InlineNode[] }
  | { type: 'inlineCode'; value: string }
  | { type: 'link'; url: string; children: InlineNode[] }
  | { type: 'break' }

export type HeadingNode = { type: 'heading'; depth: number; children: InlineNode[] }
export type ParagraphNode = { type: 'paragraph'; children: InlineNode[] }
export type ListNode = { type: 'list'; ordered: boolean; start?: number; items: ListItemNode[] }
export type ListItemNode = { type: 'listItem'; checked?: boolean | null; children: BlockNode[] }
export type BlockquoteNode = { type: 'blockquote'; children: BlockNode[] }
export type CodeBlockNode = { type: 'codeBlock'; lang?: string; value: string }
export type TableNode = { type: 'table'; align: Array<'left' | 'right' | 'center' | null>; rows: TableRowNode[] }
export type TableRowNode = { type: 'tableRow'; cells: TableCellNode[] }
export type TableCellNode = { type: 'tableCell'; children: InlineNode[] }
export type ThematicBreakNode = { type: 'thematicBreak' }
export type ImageNode = { type: 'image'; url: string; alt?: string }
```

- [ ] **Step 6: Implement real parsing with `mdast` conversion**

Replace `src/parser/parse-markdown.ts` with a real parser entry:

```ts
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import type { Root } from 'mdast'
import type { MarkdownDocument } from '../document/types'
import { fromMdast } from '../document/from-mdast'

export function parseMarkdown(markdown: string): MarkdownDocument {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as Root

  return fromMdast(tree)
}
```

- [ ] **Step 7: Add AST normalization implementation**

Create `src/document/from-mdast.ts` and convert the required mdast node types used in the test.

The file must export:

```ts
export function fromMdast(root: Root): MarkdownDocument
```

Implementation requirements:

- normalize headings, paragraphs, lists, list items, block quotes, fenced code, tables, thematic breaks, and images
- preserve inline strong/emphasis/code/link/text
- keep unsupported nodes explicit by mapping them to text or throwing only if truly impossible

- [ ] **Step 8: Run parser tests**

Run:

```bash
bun test tests/spec/blocks/parse-blocks.test.ts tests/spec/inline/parse-inline.test.ts tests/spec/gfm/parse-gfm.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit parser foundation**

```bash
git add src/document src/parser tests/spec
git commit -m "feat: add commonmark and gfm parser foundation"
```

### Task 4: Add Document Model Normalization Coverage

**Files:**
- Create: `tests/spec/gfm/normalize-gfm.test.ts`
- Modify: `src/document/from-mdast.ts`

- [ ] **Step 1: Add explicit normalization tests for nested lists, table rows, task list state, and inline links**

Create `tests/spec/gfm/normalize-gfm.test.ts` with assertions for:

- ordered list start index
- nested list item children
- GFM task list `checked`
- table rows/cells
- inline link nodes

- [ ] **Step 2: Run the normalization tests to find missing cases**

Run: `bun test tests/spec/gfm/normalize-gfm.test.ts`

Expected: initial failures on cases not covered in Task 3

- [ ] **Step 3: Extend `fromMdast` to satisfy the failing cases**

Implement the missing branches in `src/document/from-mdast.ts` until the test passes.

- [ ] **Step 4: Re-run parser and document tests**

Run:

```bash
bun test tests/spec/blocks/parse-blocks.test.ts tests/spec/inline/parse-inline.test.ts tests/spec/gfm/parse-gfm.test.ts tests/spec/gfm/normalize-gfm.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit document model normalization**

```bash
git add src/document tests/spec
git commit -m "test: cover normalized markdown document model"
```

### Task 5: Introduce Theme And Layout Types

**Files:**
- Create: `src/theme/default-theme.ts`
- Create: `src/layout/types.ts`
- Create: `tests/layout/types.test.ts`

- [ ] **Step 1: Write a small layout type smoke test**

Create `tests/layout/types.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { defaultTheme } from '../../src/theme/default-theme'

describe('defaultTheme', () => {
  test('defines page, typography, and block styles', () => {
    expect(defaultTheme.page.width).toBeGreaterThan(0)
    expect(defaultTheme.typography.body.lineHeight).toBeGreaterThan(0)
    expect(defaultTheme.blocks.code.padding).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Define theme and layout types**

Create `src/layout/types.ts` with:

- page geometry types
- line box types
- fragment types
- paint box types

Keep this file limited to shared structural types only.

- [ ] **Step 3: Implement `defaultTheme`**

Create `src/theme/default-theme.ts`:

```ts
export const defaultTheme = {
  page: {
    width: 1080,
    height: 1440,
    margin: { top: 80, right: 72, bottom: 80, left: 72 },
  },
  typography: {
    h1: { font: 'bold 52px sans-serif', lineHeight: 72 },
    h2: { font: 'bold 38px sans-serif', lineHeight: 54 },
    body: { font: '28px sans-serif', lineHeight: 44 },
    code: { font: '24px monospace', lineHeight: 36 },
  },
  blocks: {
    paragraph: { marginBottom: 24 },
    heading: { marginTop: 40, marginBottom: 20 },
    list: { marginBottom: 24, itemGap: 8, indent: 36 },
    code: { marginBottom: 24, padding: 24 },
    quote: { marginBottom: 24, padding: 24 },
    table: { marginBottom: 24, cellPadding: 16 },
  },
}
```

- [ ] **Step 4: Run theme/layout tests**

Run: `bun test tests/layout/types.test.ts`

Expected: PASS

- [ ] **Step 5: Commit theme and layout types**

```bash
git add src/layout src/theme tests/layout
git commit -m "feat: add marknative theme and layout types"
```

### Task 6: Integrate Pretext Inline Line Layout

**Files:**
- Create: `src/layout/inline/line-layout.ts`
- Create: `tests/layout/inline/line-layout.test.ts`

- [ ] **Step 1: Write line layout tests for Chinese, English, and mixed inline runs**

Create `tests/layout/inline/line-layout.test.ts` with tests that verify:

- multiple lines are produced when width is constrained
- Chinese and English mixed content produces deterministic line counts
- inline code and strong/emphasis runs survive into line segments

- [ ] **Step 2: Run the line layout tests to confirm failure**

Run: `bun test tests/layout/inline/line-layout.test.ts`

Expected: FAIL because the module does not exist yet

- [ ] **Step 3: Implement `pretext` adapter**

Create `src/layout/inline/line-layout.ts` exporting:

```ts
export function layoutInlineRuns(runs: InlineNode[], width: number, theme: typeof defaultTheme): LineBox[]
```

Implementation requirements:

- flatten inline nodes into styled runs
- pass plain text and font settings into `pretext`
- return line boxes with stable width/height/y offsets

- [ ] **Step 4: Run line layout tests**

Run: `bun test tests/layout/inline/line-layout.test.ts`

Expected: PASS

- [ ] **Step 5: Commit inline layout**

```bash
git add src/layout/inline tests/layout/inline
git commit -m "feat: add pretext-backed inline line layout"
```

### Task 7: Build Block Layout Fragments

**Files:**
- Create: `src/layout/block/layout-document.ts`
- Create: `tests/layout/blocks/layout-blocks.test.ts`

- [ ] **Step 1: Write failing block layout tests**

Add tests that verify:

- paragraph nodes become paragraph fragments with line boxes
- list nodes become list fragments with item-level structure
- code block nodes become code fragments preserving source lines
- heading nodes become heading fragments

- [ ] **Step 2: Run block layout tests**

Run: `bun test tests/layout/blocks/layout-blocks.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement block layout entry**

Create `src/layout/block/layout-document.ts` exporting:

```ts
export function layoutDocument(doc: MarkdownDocument, theme = defaultTheme): LayoutFragment[]
```

Implementation requirements:

- map each document node type to an explicit fragment type
- paragraph fragments must carry line boxes
- list fragments must preserve ordered/bullet/task marker semantics
- code fragments must preserve code lines
- table fragments may initially preserve row/cell structure without full pagination support

- [ ] **Step 4: Run block layout tests**

Run: `bun test tests/layout/blocks/layout-blocks.test.ts`

Expected: PASS

- [ ] **Step 5: Commit block layout fragments**

```bash
git add src/layout/block tests/layout/blocks
git commit -m "feat: add markdown block layout fragments"
```

### Task 8: Implement Fragment Pagination

**Files:**
- Create: `src/layout/pagination/paginate.ts`
- Create: `tests/layout/pagination/paginate.test.ts`

- [ ] **Step 1: Write pagination tests for paragraph, ordered list, code block, and mixed article flows**

The test file must verify:

- long paragraphs continue onto later pages
- ordered list numbering continues after page breaks
- code blocks continue across pages
- mixed technical article content yields deterministic page counts

- [ ] **Step 2: Run pagination tests**

Run: `bun test tests/layout/pagination/paginate.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement fragment pagination**

Create `src/layout/pagination/paginate.ts` exporting:

```ts
export function paginateFragments(fragments: LayoutFragment[], theme = defaultTheme): Page[]
```

Implementation requirements:

- page construction based on theme page geometry
- paragraph split by line boxes
- list split by item fragments, with later extension points for nested continuation
- code block split by source lines and wrapped line boxes
- table rows stay atomic in phase 1 if row splitting is not yet implemented

- [ ] **Step 4: Run pagination tests**

Run: `bun test tests/layout/pagination/paginate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit pagination engine**

```bash
git add src/layout/pagination tests/layout/pagination
git commit -m "feat: add fragment-based pagination engine"
```

### Task 9: Add Paint Abstraction And Skia Backend

**Files:**
- Create: `src/paint/types.ts`
- Create: `src/paint/skia-canvas.ts`
- Create: `tests/render/png/render-png.test.ts`
- Create: `tests/render/svg/render-svg.test.ts`
- Modify: `src/render/render-markdown.ts`

- [ ] **Step 1: Write a failing PNG end-to-end render test**

Create `tests/render/png/render-png.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { renderMarkdown } from '../../../src/render/render-markdown'

describe('renderMarkdown', () => {
  test('renders a technical article into png pages', async () => {
    const pages = await renderMarkdown('# Title\\n\\nParagraph', { format: 'png' })
    expect(pages.length).toBeGreaterThan(0)
    expect(pages[0]?.format).toBe('png')
  })
})
```

- [ ] **Step 2: Write a failing SVG render contract test**

Create `tests/render/svg/render-svg.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { renderMarkdown } from '../../../src/render/render-markdown'

describe('renderMarkdown svg', () => {
  test('renders markdown into svg pages', async () => {
    const pages = await renderMarkdown('# Title\\n\\nParagraph', { format: 'svg' })
    expect(pages.length).toBeGreaterThan(0)
    expect(pages[0]?.format).toBe('svg')
  })
})
```

- [ ] **Step 3: Run the render tests**

Run:

```bash
bun test tests/render/png/render-png.test.ts tests/render/svg/render-svg.test.ts
```

Expected: FAIL

- [ ] **Step 4: Define paint interfaces**

Create `src/paint/types.ts` with:

```ts
export type PaintPage = { width: number; height: number; boxes: PaintBox[] }
export type PaintBox = { kind: 'text' | 'rect' | 'image'; [key: string]: unknown }
export interface Painter {
  renderPng(page: PaintPage): Promise<Buffer>
  renderSvg(page: PaintPage): Promise<string>
}
```

- [ ] **Step 5: Implement `skia-canvas` painter**

Create `src/paint/skia-canvas.ts` and wire text/rect/image drawing for the paint boxes required by the current layout output.

- [ ] **Step 6: Implement `renderMarkdown` pipeline**

Replace `src/render/render-markdown.ts` so it performs:

```ts
parseMarkdown(markdown)
-> layoutDocument(doc, theme)
-> paginateFragments(fragments, theme)
-> paint pages
```

It should support:

- `png`
- `svg`
- `html` placeholder if paint-to-html is not yet implemented, but only if explicitly defined in the returned format contract

- [ ] **Step 7: Run render tests**

Run:

```bash
bun test tests/render/png/render-png.test.ts tests/render/svg/render-svg.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit renderer pipeline**

```bash
git add src/paint src/render tests/render
git commit -m "feat: add marknative renderer pipeline"
```

### Task 10: Add Structured Smoke Coverage

**Files:**
- Create: `tests/smoke/articles/technical-blog.test.ts`
- Create: `tests/smoke/reference/api-doc.test.ts`
- Create: `tests/smoke/gfm/table-heavy.test.ts`
- Create: `tests/smoke/regressions/README.md`

- [ ] **Step 1: Add a technical article smoke test**

Create `tests/smoke/articles/technical-blog.test.ts` with:

- a multi-section article
- paragraphs
- ordered list
- block quote
- code block
- tags/footer-like plain text if desired

The test should write PNG pages to:

```ts
tests/smoke/output/articles/
```

- [ ] **Step 2: Add a reference-style API doc smoke test**

Create `tests/smoke/reference/api-doc.test.ts` with:

- dense headings
- nested ordered and bullet lists
- code examples
- definition-like prose

The test should write PNG pages to:

```ts
tests/smoke/output/reference/
```

- [ ] **Step 3: Add a GFM-heavy smoke test**

Create `tests/smoke/gfm/table-heavy.test.ts` with:

- tables
- task lists
- strikethrough
- autolink-like content

The test should write PNG pages to:

```ts
tests/smoke/output/gfm/
```

- [ ] **Step 4: Add regressions folder contract**

Create `tests/smoke/regressions/README.md`:

```md
# Regression Smoke Fixtures

Every previously fixed rendering bug must add a dedicated smoke case here.

Examples:

- orphaned list numbering
- broken paragraph continuation
- code block continuation clipping
- table row overflow
```

- [ ] **Step 5: Run smoke tests**

Run:

```bash
bun test tests/smoke/articles/technical-blog.test.ts tests/smoke/reference/api-doc.test.ts tests/smoke/gfm/table-heavy.test.ts
```

Expected: PASS and PNG files written

- [ ] **Step 6: Manually inspect the generated PNGs**

Open the generated pages and check:

- heading rhythm
- paragraph density
- list continuity
- code block pagination
- page fullness

If anything is obviously broken, fix it before claiming the task complete.

- [ ] **Step 7: Commit structured smoke coverage**

```bash
git add tests/smoke
git commit -m "test: add structured smoke coverage"
```

### Task 11: Final Cleanup And Verification

**Files:**
- Modify: `README.md`
- Modify: `src/index.ts`
- Modify: any remaining stale references discovered during verification

- [ ] **Step 1: Run the full verification suite**

Run:

```bash
bun run typecheck
bun test
```

Expected: PASS

- [ ] **Step 2: Search for old product terminology**

Run:

```bash
rg -n "story|template|xiaohongshu|card renderer|renderDoc|renderStory" src tests README.md
```

Expected: no stale old-product references outside migration notes if any

- [ ] **Step 3: Clean any remaining stale references**

Remove or rename leftover references found by the search in Step 2.

- [ ] **Step 4: Re-run full verification**

Run:

```bash
bun run typecheck
bun test
```

Expected: PASS

- [ ] **Step 5: Commit final cleanup**

```bash
git add README.md src tests
git commit -m "chore: finalize marknative reset"
```

## Self-Review

Spec coverage check:

- product reset: covered by Tasks 1 and 2
- parser stack: covered by Tasks 3 and 4
- document model: covered by Tasks 3 and 4
- theme/layout types: covered by Task 5
- `pretext` line layout: covered by Task 6
- block fragments: covered by Task 7
- pagination engine: covered by Task 8
- paint abstraction and renderer output: covered by Task 9
- structured smoke validation and regressions: covered by Task 10
- old product removal and terminology cleanup: covered by Tasks 2 and 11

Placeholder scan:

- No `TODO`, `TBD`, or “similar to previous task” references remain.
- Each task identifies exact files and commands.

Type consistency:

- Public API names are consistently `parseMarkdown`, `layoutDocument`, `paginateFragments`, and `renderMarkdown`.
- Core document type is consistently `MarkdownDocument`.
