# Direct Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Template/Slot system with a direct Design System → Markdown rendering pipeline that uses actual Yoga layout measurements for precise pagination.

**Architecture:** User provides `RenderConfig` (Design System tokens + canvas size + content area). Each `ContentBlock` maps directly to `LayoutSpecNode[]` via `blockToNodes`. Pagination uses actual Yoga layout calls to measure each block's real height, then greedy bin-packs into pages. No Template, Slot, or TemplateFamily abstractions.

**Tech Stack:** Bun, TypeScript strict, textura (Yoga WASM), @chenglou/pretext, @napi-rs/canvas

---

## File Map

**Create:**
- `src/pipeline/block-to-nodes.ts` — Maps each ContentBlock type to LayoutSpecNode[] using DesignTokens
- `src/pipeline/measure.ts` — Measures each block's actual height via Yoga layout
- `src/pipeline/paginate.ts` — Greedy bin-pack using real heights; pure function
- `src/pipeline/render-doc.ts` — New top-level entry: renderDoc / renderDocFromBlocks / renderDocFromJson
- `tests/pipeline/block-to-nodes.test.ts`
- `tests/pipeline/measure.test.ts`
- `tests/pipeline/paginate.test.ts`
- `tests/pipeline/render-doc.test.ts`

**Modify:**
- `src/types.ts` — Add `RenderConfig`; in cleanup task remove Template/Slot types
- `src/index.ts` — Export new API; in cleanup task remove old exports

**Delete (Task 8):**
- `src/template/engine.ts`, `src/template/paginator.ts`, `src/template/selector.ts`
- `src/pipeline/render-one.ts`
- `src/templates/cover/hero.ts`, `src/templates/content/article.ts`, `src/templates/ending/summary.ts`
- `tests/template/engine.test.ts`, `tests/template/paginator.test.ts`, `tests/template/selector.test.ts`
- `tests/pipeline/render-one.test.ts`
- `tests/smoke/render.test.ts`, `tests/smoke/markdown-generalization.test.ts`

---

## Task 1: Add `RenderConfig` to types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add RenderConfig after the TemplateFamily type block**

Open `src/types.ts` and add the following after the `TemplateFamily` type (line ~127):

```typescript
export type RenderConfig = {
  ds: DesignTokens
  size: { width: number; height: number }
  contentArea: { x: number; y: number; width: number; height: number }
  background?: ResolvedPaint
  blockGap?: number
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd /Users/liuyaowen/Workspace/javascript/NoteCard/.worktrees/feat-rendering-engine
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add RenderConfig type for direct rendering"
```

---

## Task 2: Implement `blockToNodes`

**Files:**
- Create: `src/pipeline/block-to-nodes.ts`
- Create: `tests/pipeline/block-to-nodes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/pipeline/block-to-nodes.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test'
import { blockToNodes } from '../../src/pipeline/block-to-nodes'
import { defaultTokens } from '../../src/templates/tokens/default'

const WIDTH = 936

describe('blockToNodes', () => {
  test('heading level 1 → text with h1 typography', () => {
    const nodes = blockToNodes({ type: 'heading', level: 1, text: 'Title' }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'text',
      spans: [{ text: 'Title' }],
      font: defaultTokens.typography.h1.font,
      lineHeight: defaultTokens.typography.h1.lineHeight,
      color: defaultTokens.colors.text,
    })
  })

  test('heading level 2 → text with h2 typography', () => {
    const nodes = blockToNodes({ type: 'heading', level: 2, text: 'Sub' }, defaultTokens, WIDTH)
    expect(nodes[0]).toMatchObject({
      font: defaultTokens.typography.h2.font,
      lineHeight: defaultTokens.typography.h2.lineHeight,
    })
  })

  test('paragraph → text with body typography and original spans', () => {
    const spans = [{ text: 'Hello ', bold: true as const }, { text: 'world' }]
    const nodes = blockToNodes({ type: 'paragraph', spans }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ type: 'text', spans, font: defaultTokens.typography.body.font })
  })

  test('bulletList → one text node per item prefixed with bullet', () => {
    const nodes = blockToNodes({ type: 'bulletList', items: ['A', 'B', 'C'] }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(3)
    expect((nodes[0] as { spans: { text: string }[] }).spans[0]!.text).toBe('• A')
    expect((nodes[1] as { spans: { text: string }[] }).spans[0]!.text).toBe('• B')
    expect((nodes[2] as { spans: { text: string }[] }).spans[0]!.text).toBe('• C')
  })

  test('orderedList → numbered items', () => {
    const nodes = blockToNodes(
      { type: 'orderedList', items: ['First', 'Second'] },
      defaultTokens,
      WIDTH,
    )
    expect((nodes[0] as { spans: { text: string }[] }).spans[0]!.text).toBe('1. First')
    expect((nodes[1] as { spans: { text: string }[] }).spans[0]!.text).toBe('2. Second')
  })

  test('steps → numbered items', () => {
    const nodes = blockToNodes({ type: 'steps', items: ['Do A', 'Do B'] }, defaultTokens, WIDTH)
    expect((nodes[0] as { spans: { text: string }[] }).spans[0]!.text).toBe('1. Do A')
    expect((nodes[1] as { spans: { text: string }[] }).spans[0]!.text).toBe('2. Do B')
  })

  test('quoteCard with author → container with text and author line', () => {
    const nodes = blockToNodes(
      { type: 'quoteCard', text: 'Quote', author: 'Alice' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type).toBe('container')
    const children = (nodes[0] as { children: { spans: { text: string }[] }[] }).children
    expect(children).toHaveLength(2)
    expect(children[1]!.spans[0]!.text).toBe('— Alice')
  })

  test('quoteCard without author → container with one child', () => {
    const nodes = blockToNodes({ type: 'quoteCard', text: 'Quote' }, defaultTokens, WIDTH)
    const children = (nodes[0] as { children: unknown[] }).children
    expect(children).toHaveLength(1)
  })

  test('codeBlock → container with code text using code font', () => {
    const nodes = blockToNodes({ type: 'codeBlock', code: 'const x = 1' }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type).toBe('container')
    const child = (nodes[0] as { children: { spans: { text: string }[]; font: string }[] }).children[0]!
    expect(child.spans[0]!.text).toBe('const x = 1')
    expect(child.font).toBe(defaultTokens.typography.code.font)
  })

  test('image → image node with contentWidth and 9:16 height', () => {
    const nodes = blockToNodes(
      { type: 'image', src: 'https://example.com/img.png' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'image',
      src: 'https://example.com/img.png',
      width: WIDTH,
      height: Math.round(WIDTH * (9 / 16)),
    })
  })

  test('divider → thin rect with border color', () => {
    const nodes = blockToNodes({ type: 'divider' }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'rect',
      width: 'fill',
      height: 2,
      fill: { type: 'color', value: defaultTokens.colors.border },
    })
  })

  test('tags → single text node with hash-prefixed spans', () => {
    const nodes = blockToNodes(
      { type: 'tags', items: ['react', 'typescript'] },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(1)
    const spans = (nodes[0] as { spans: { text: string }[] }).spans
    expect(spans[0]!.text).toBe('#react ')
    expect(spans[1]!.text).toBe('#typescript ')
  })

  test('metric → value text (h1 color primary) then label text (caption subtext)', () => {
    const nodes = blockToNodes(
      { type: 'metric', label: 'Views', value: '10K' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({
      type: 'text',
      spans: [{ text: '10K' }],
      font: defaultTokens.typography.h1.font,
      color: defaultTokens.colors.primary,
    })
    expect(nodes[1]).toMatchObject({
      type: 'text',
      spans: [{ text: 'Views' }],
      font: defaultTokens.typography.caption.font,
      color: defaultTokens.colors.subtext,
    })
  })

  test('heroTitle with subtitle → title (h1) + subtitle (h2 subtext)', () => {
    const nodes = blockToNodes(
      { type: 'heroTitle', title: 'Main', subtitle: 'Sub' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({
      font: defaultTokens.typography.h1.font,
      color: defaultTokens.colors.text,
    })
    expect(nodes[1]).toMatchObject({
      font: defaultTokens.typography.h2.font,
      color: defaultTokens.colors.subtext,
    })
  })

  test('heroTitle without subtitle → single h1 text node', () => {
    const nodes = blockToNodes(
      { type: 'heroTitle', title: 'Only title' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test tests/pipeline/block-to-nodes.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement blockToNodes**

Create `src/pipeline/block-to-nodes.ts`:

```typescript
import type { ContentBlock, DesignTokens, LayoutSpecNode } from '../types'

export function blockToNodes(
  block: ContentBlock,
  ds: DesignTokens,
  contentWidth: number,
): LayoutSpecNode[] {
  switch (block.type) {
    case 'heroTitle': {
      const nodes: LayoutSpecNode[] = [
        {
          type: 'text',
          spans: [{ text: block.title }],
          font: ds.typography.h1.font,
          lineHeight: ds.typography.h1.lineHeight,
          color: ds.colors.text,
        },
      ]
      if (block.subtitle) {
        nodes.push({
          type: 'text',
          spans: [{ text: block.subtitle }],
          font: ds.typography.h2.font,
          lineHeight: ds.typography.h2.lineHeight,
          color: ds.colors.subtext,
        })
      }
      return nodes
    }

    case 'heading': {
      const style = block.level === 1 ? ds.typography.h1 : ds.typography.h2
      return [
        {
          type: 'text',
          spans: [{ text: block.text }],
          font: style.font,
          lineHeight: style.lineHeight,
          color: ds.colors.text,
        },
      ]
    }

    case 'paragraph':
      return [
        {
          type: 'text',
          spans: block.spans,
          font: ds.typography.body.font,
          lineHeight: ds.typography.body.lineHeight,
          color: ds.colors.text,
        },
      ]

    case 'bulletList':
      return block.items.map(item => ({
        type: 'text' as const,
        spans: [{ text: `• ${item}` }],
        font: ds.typography.body.font,
        lineHeight: ds.typography.body.lineHeight,
        color: ds.colors.text,
      }))

    case 'orderedList':
      return block.items.map((item, index) => ({
        type: 'text' as const,
        spans: [{ text: `${index + 1}. ${item}` }],
        font: ds.typography.body.font,
        lineHeight: ds.typography.body.lineHeight,
        color: ds.colors.text,
      }))

    case 'steps':
      return block.items.map((item, index) => ({
        type: 'text' as const,
        spans: [{ text: `${index + 1}. ${item}` }],
        font: ds.typography.body.font,
        lineHeight: ds.typography.body.lineHeight,
        color: ds.colors.text,
      }))

    case 'quoteCard':
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          padding: ds.spacing.md,
          gap: ds.spacing.xs,
          background: { type: 'color', value: ds.colors.border },
          children: [
            {
              type: 'text',
              spans: [{ text: block.text }],
              font: ds.typography.body.font,
              lineHeight: ds.typography.body.lineHeight,
              color: ds.colors.text,
            },
            ...(block.author
              ? [
                  {
                    type: 'text' as const,
                    spans: [{ text: `— ${block.author}` }],
                    font: ds.typography.caption.font,
                    lineHeight: ds.typography.caption.lineHeight,
                    color: ds.colors.subtext,
                  },
                ]
              : []),
          ],
        },
      ]

    case 'metric':
      return [
        {
          type: 'text',
          spans: [{ text: block.value }],
          font: ds.typography.h1.font,
          lineHeight: ds.typography.h1.lineHeight,
          color: ds.colors.primary,
        },
        {
          type: 'text',
          spans: [{ text: block.label }],
          font: ds.typography.caption.font,
          lineHeight: ds.typography.caption.lineHeight,
          color: ds.colors.subtext,
        },
      ]

    case 'tags':
      return [
        {
          type: 'text',
          spans: block.items.map(tag => ({ text: `#${tag} ` })),
          font: ds.typography.caption.font,
          lineHeight: ds.typography.caption.lineHeight,
          color: ds.colors.primary,
        },
      ]

    case 'image':
      return [
        {
          type: 'image',
          src: block.src,
          width: contentWidth,
          height: Math.round(contentWidth * (9 / 16)),
          fit: 'cover',
        },
      ]

    case 'codeBlock':
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          padding: ds.spacing.md,
          background: { type: 'color', value: '#f5f5f5' },
          children: [
            {
              type: 'text',
              spans: [{ text: block.code }],
              font: ds.typography.code.font,
              lineHeight: ds.typography.code.lineHeight,
              color: ds.colors.text,
            },
          ],
        },
      ]

    case 'divider':
      return [
        {
          type: 'rect',
          width: 'fill',
          height: 2,
          fill: { type: 'color', value: ds.colors.border },
        },
      ]

    default:
      return []
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test tests/pipeline/block-to-nodes.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
bun test
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/block-to-nodes.ts tests/pipeline/block-to-nodes.test.ts
git commit -m "feat: add blockToNodes — direct ContentBlock to LayoutSpecNode mapping"
```

---

## Task 3: Implement `measureBlocks`

**Files:**
- Create: `src/pipeline/measure.ts`
- Create: `tests/pipeline/measure.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/pipeline/measure.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test'
import { measureBlocks } from '../../src/pipeline/measure'
import { defaultTokens } from '../../src/templates/tokens/default'
import type { ContentBlock } from '../../src/types'

const WIDTH = 936

describe('measureBlocks', () => {
  test('returns one height per block', async () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', level: 1, text: 'Title' },
      { type: 'paragraph', spans: [{ text: 'Body text here.' }] },
      { type: 'divider' },
    ]
    const heights = await measureBlocks(blocks, defaultTokens, WIDTH)
    expect(heights).toHaveLength(3)
    heights.forEach(h => expect(h).toBeGreaterThanOrEqual(0))
  })

  test('longer paragraph is taller than shorter one', async () => {
    const short: ContentBlock = { type: 'paragraph', spans: [{ text: 'Short.' }] }
    const long: ContentBlock = { type: 'paragraph', spans: [{ text: 'A'.repeat(600) }] }
    const heights = await measureBlocks([short, long], defaultTokens, WIDTH)
    expect(heights[1]).toBeGreaterThan(heights[0]!)
  })

  test('quoteCard with author is taller than without', async () => {
    const withAuthor: ContentBlock = { type: 'quoteCard', text: 'Some quote', author: 'Alice' }
    const withoutAuthor: ContentBlock = { type: 'quoteCard', text: 'Some quote' }
    const heights = await measureBlocks([withAuthor, withoutAuthor], defaultTokens, WIDTH)
    expect(heights[0]).toBeGreaterThan(heights[1]!)
  })

  test('narrower contentWidth wraps text more and increases height', async () => {
    const block: ContentBlock = {
      type: 'paragraph',
      spans: [{ text: 'This is a medium-length paragraph for testing layout width effects on text wrapping.' }],
    }
    const [wideH] = await measureBlocks([block], defaultTokens, 936)
    const [narrowH] = await measureBlocks([block], defaultTokens, 300)
    expect(narrowH!).toBeGreaterThanOrEqual(wideH!)
  })

  test('empty blocks list returns empty array', async () => {
    const heights = await measureBlocks([], defaultTokens, WIDTH)
    expect(heights).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test tests/pipeline/measure.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement measureBlocks**

Create `src/pipeline/measure.ts`:

```typescript
import type { ContentBlock, DesignTokens, LayoutSpecNode } from '../types'
import { computeLayoutBoxes } from '../layout/engine'
import { blockToNodes } from './block-to-nodes'

async function measureBlock(
  block: ContentBlock,
  ds: DesignTokens,
  contentWidth: number,
): Promise<number> {
  const nodes = blockToNodes(block, ds, contentWidth)
  if (nodes.length === 0) return 0

  // Wrap in a hug-height container with a background so boxes[0]
  // is a rect whose height equals the container's total height
  const spec: LayoutSpecNode = {
    type: 'container',
    direction: 'column',
    width: contentWidth,
    height: 'hug',
    gap: 0,
    background: { type: 'color', value: '#000000' },
    children: nodes,
  }

  const boxes = await computeLayoutBoxes(spec, { width: contentWidth, height: 99999 })
  return boxes[0]?.height ?? 0
}

export async function measureBlocks(
  blocks: ContentBlock[],
  ds: DesignTokens,
  contentWidth: number,
): Promise<number[]> {
  return Promise.all(blocks.map(block => measureBlock(block, ds, contentWidth)))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test tests/pipeline/measure.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/measure.ts tests/pipeline/measure.test.ts
git commit -m "feat: add measureBlocks — precise block height via Yoga layout"
```

---

## Task 4: Implement `paginateByHeights`

**Files:**
- Create: `src/pipeline/paginate.ts`
- Create: `tests/pipeline/paginate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/pipeline/paginate.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test'
import { paginateByHeights } from '../../src/pipeline/paginate'
import type { ContentBlock } from '../../src/types'

function makeBlocks(n: number): ContentBlock[] {
  return Array.from({ length: n }, (_, i) => ({
    type: 'paragraph' as const,
    spans: [{ text: `Block ${i}` }],
  }))
}

describe('paginateByHeights', () => {
  test('empty blocks returns single empty page', () => {
    const pages = paginateByHeights([], [], 1000, 20)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(0)
  })

  test('single block fits on one page', () => {
    const blocks = makeBlocks(1)
    const pages = paginateByHeights(blocks, [100], 1000, 20)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(1)
  })

  test('blocks within page height stay on one page', () => {
    // 100 + (20+100) + (20+100) = 340 < 400
    const blocks = makeBlocks(3)
    const pages = paginateByHeights(blocks, [100, 100, 100], 400, 20)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(3)
  })

  test('splits when accumulated height + gap exceeds page height', () => {
    // page 1: 100 + (20+100) + (20+100) = 340 ≤ 350
    // block 3: 340 + 20 + 100 = 460 > 350 → new page
    const blocks = makeBlocks(4)
    const pages = paginateByHeights(blocks, [100, 100, 100, 100], 350, 20)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toHaveLength(3)
    expect(pages[1]).toHaveLength(1)
  })

  test('block taller than page height gets its own page', () => {
    const blocks = makeBlocks(3)
    const pages = paginateByHeights(blocks, [100, 2000, 100], 500, 20)
    expect(pages).toHaveLength(3)
    expect(pages[0]).toHaveLength(1)
    expect(pages[1]).toHaveLength(1)
    expect(pages[2]).toHaveLength(1)
  })

  test('exact fit keeps blocks on same page', () => {
    // 100 + (20+80) = 200 === 200
    const blocks = makeBlocks(2)
    const pages = paginateByHeights(blocks, [100, 80], 200, 20)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(2)
  })

  test('preserves block order across pages', () => {
    const blocks = makeBlocks(4)
    const pages = paginateByHeights(blocks, [100, 100, 100, 100], 250, 20)
    expect(pages.flat()).toEqual(blocks)
  })

  test('no gap on first block of each page', () => {
    // page 1 starts: 0 + 300 = 300 ≤ 300 (fits exactly, no gap on first)
    // block 1: 300 + 20 + 300 = 620 > 300 → new page
    const blocks = makeBlocks(2)
    const pages = paginateByHeights(blocks, [300, 300], 300, 20)
    expect(pages).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test tests/pipeline/paginate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement paginateByHeights**

Create `src/pipeline/paginate.ts`:

```typescript
import type { ContentBlock } from '../types'

export function paginateByHeights(
  blocks: ContentBlock[],
  heights: number[],
  pageHeight: number,
  blockGap: number,
): ContentBlock[][] {
  if (blocks.length === 0) return [[]]

  const pages: ContentBlock[][] = []
  let current: ContentBlock[] = []
  let usedHeight = 0

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!
    const h = heights[index] ?? 0
    const gap = current.length > 0 ? blockGap : 0
    const needed = h + gap

    if (h > pageHeight) {
      if (current.length > 0) {
        pages.push(current)
        current = []
        usedHeight = 0
      }
      pages.push([block])
      continue
    }

    if (current.length > 0 && usedHeight + needed > pageHeight) {
      pages.push(current)
      current = [block]
      usedHeight = h
    } else {
      current.push(block)
      usedHeight += needed
    }
  }

  if (current.length > 0) {
    pages.push(current)
  }

  return pages
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test tests/pipeline/paginate.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/paginate.ts tests/pipeline/paginate.test.ts
git commit -m "feat: add paginateByHeights — greedy bin-pack with exact block heights"
```

---

## Task 5: Implement `renderDoc`

**Files:**
- Create: `src/pipeline/render-doc.ts`
- Create: `tests/pipeline/render-doc.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/pipeline/render-doc.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test'
import { renderDoc, renderDocFromBlocks, renderDocFromJson } from '../../src/pipeline/render-doc'
import { defaultTokens } from '../../src/templates/tokens/default'
import type { RenderConfig } from '../../src/types'

const config: RenderConfig = {
  ds: defaultTokens,
  size: { width: 1080, height: 1440 },
  contentArea: { x: 72, y: 72, width: 936, height: 1296 },
}

describe('renderDoc', () => {
  test('renders short markdown as a single html page containing the content', async () => {
    const pages = await renderDoc('# Hello\n\nWorld', config, { renderer: 'html' })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.format).toBe('html')
    expect((pages[0] as { data: string }).data).toContain('Hello')
    expect((pages[0] as { data: string }).data).toContain('World')
  })

  test('renders long markdown into multiple pages', async () => {
    const longMarkdown = Array.from({ length: 30 }, (_, i) =>
      `## Section ${i + 1}\n\nThis is content for section ${i + 1} with enough text to verify pagination.`,
    ).join('\n\n')

    const pages = await renderDoc(longMarkdown, config, { renderer: 'html' })
    expect(pages.length).toBeGreaterThan(1)
    pages.forEach(page => expect(page.format).toBe('html'))
  })

  test('renders to png buffer with correct byteLength', async () => {
    const pages = await renderDoc('# Test\n\nContent here.', config, { renderer: 'canvas' })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.format).toBe('png')
    expect((pages[0] as { data: Buffer }).data.byteLength).toBeGreaterThan(1000)
  })

  test('renders to svg string', async () => {
    const pages = await renderDoc('# SVG\n\nTest', config, { renderer: 'svg' })
    expect(pages[0]!.format).toBe('svg')
    const svg = (pages[0] as { data: string }).data
    expect(svg).toContain('<svg')
    expect(svg).toContain('SVG')
  })

  test('renderDocFromBlocks accepts ContentBlock array directly', async () => {
    const pages = await renderDocFromBlocks(
      [
        { type: 'heading', level: 1, text: 'From Blocks' },
        { type: 'paragraph', spans: [{ text: 'Direct block input.' }] },
      ],
      config,
      { renderer: 'html' },
    )
    expect(pages).toHaveLength(1)
    expect((pages[0] as { data: string }).data).toContain('From Blocks')
  })

  test('renderDocFromJson accepts raw JSON array', async () => {
    const pages = await renderDocFromJson(
      [
        { type: 'heroTitle', title: 'JSON Input' },
        { type: 'paragraph', spans: [{ text: 'From JSON.' }] },
      ],
      config,
      { renderer: 'html' },
    )
    expect(pages).toHaveLength(1)
    expect((pages[0] as { data: string }).data).toContain('JSON Input')
  })

  test('custom background overrides design system bg color', async () => {
    const customConfig: RenderConfig = {
      ...config,
      background: { type: 'color', value: '#ff0000' },
    }
    const pages = await renderDoc('# Red BG', customConfig, { renderer: 'svg' })
    expect((pages[0] as { data: string }).data).toContain('#ff0000')
  })

  test('custom blockGap is respected — same content with larger gap produces more pages', async () => {
    const markdown = Array.from({ length: 20 }, (_, i) =>
      `## Section ${i + 1}\n\nContent ${i + 1}.`,
    ).join('\n\n')

    const tightConfig: RenderConfig = { ...config, blockGap: 0 }
    const looseConfig: RenderConfig = { ...config, blockGap: 200 }

    const tightPages = await renderDoc(markdown, tightConfig, { renderer: 'html' })
    const loosePages = await renderDoc(markdown, looseConfig, { renderer: 'html' })

    expect(loosePages.length).toBeGreaterThanOrEqual(tightPages.length)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test tests/pipeline/render-doc.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement renderDoc**

Create `src/pipeline/render-doc.ts`:

```typescript
import type { ContentBlock, RenderConfig, RenderOptions, RenderOutput, LayoutBox, LayoutSpecNode } from '../types'
import { parseMarkdown } from '../content/parse-markdown'
import { parseJson } from '../content/parse-json'
import { computeLayoutBoxes } from '../layout/engine'
import { renderPageCanvas } from '../renderer/canvas'
import { renderPageSvg } from '../renderer/svg'
import { renderPageHtml } from '../renderer/html'
import { measureBlocks } from './measure'
import { paginateByHeights } from './paginate'
import { blockToNodes } from './block-to-nodes'
import { validateRenderOptions } from './render-one'

function blocksToSpec(blocks: ContentBlock[], config: RenderConfig): LayoutSpecNode {
  const { ds, size, contentArea } = config
  const gap = config.blockGap ?? ds.spacing.md

  return {
    type: 'container',
    direction: 'column',
    width: size.width,
    height: size.height,
    padding: {
      top: contentArea.y,
      right: size.width - contentArea.x - contentArea.width,
      bottom: size.height - contentArea.y - contentArea.height,
      left: contentArea.x,
    },
    gap,
    background: config.background ?? { type: 'color', value: ds.colors.bg },
    children: blocks.flatMap(block => blockToNodes(block, ds, contentArea.width)),
  }
}

async function renderBoxes(
  boxes: LayoutBox[],
  size: { width: number; height: number },
  options: RenderOptions,
): Promise<RenderOutput> {
  const { backend } = validateRenderOptions(options)
  if (backend === 'svg') return renderPageSvg(boxes, size)
  if (backend === 'html') return renderPageHtml(boxes, size)
  return renderPageCanvas(boxes, size, options)
}

export async function renderDocFromBlocks(
  blocks: ContentBlock[],
  config: RenderConfig,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const { contentArea, ds } = config
  const blockGap = config.blockGap ?? ds.spacing.md

  const heights = await measureBlocks(blocks, ds, contentArea.width)
  const pages = paginateByHeights(blocks, heights, contentArea.height, blockGap)

  return Promise.all(
    pages.map(async pageBlocks => {
      const spec = blocksToSpec(pageBlocks, config)
      const boxes = await computeLayoutBoxes(spec, config.size)
      return renderBoxes(boxes, config.size, options)
    }),
  )
}

export async function renderDoc(
  markdown: string,
  config: RenderConfig,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  return renderDocFromBlocks(parseMarkdown(markdown), config, options)
}

export async function renderDocFromJson(
  raw: unknown,
  config: RenderConfig,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  return renderDocFromBlocks(parseJson(raw), config, options)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test tests/pipeline/render-doc.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/render-doc.ts tests/pipeline/render-doc.test.ts
git commit -m "feat: add renderDoc pipeline — DS + RenderConfig replaces TemplateFamily"
```

---

## Task 6: Update `src/index.ts` to export new API

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace index.ts content**

```typescript
// New direct rendering API
export { renderDoc, renderDocFromBlocks, renderDocFromJson } from './pipeline/render-doc'

// Content parsers (still useful standalone)
export { parseMarkdown } from './content/parse-markdown'
export { parseJson } from './content/parse-json'

// Low-level building blocks
export { blockToNodes } from './pipeline/block-to-nodes'
export { measureBlocks } from './pipeline/measure'
export { paginateByHeights } from './pipeline/paginate'
export { computeLayoutBoxes, initLayoutEngine } from './layout/engine'
export { registerFont } from './setup'
export { defaultTokens, makeTokens } from './templates/tokens/default'

// Types
export type {
  ContentBlock,
  Span,
  DesignTokens,
  RenderConfig,
  LayoutSpec,
  LayoutSpecNode,
  LayoutBox,
  TextLine,
  ResolvedPaint,
  Shadow,
  RenderOptions,
  RenderOutput,
  IRenderer,
} from './types'
```

- [ ] **Step 2: Run full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: update public API exports to new direct rendering system"
```

---

## Task 7: Add new smoke test

**Files:**
- Create: `tests/smoke/render-doc.test.ts`

- [ ] **Step 1: Create smoke test**

```typescript
import { test, expect, describe, beforeAll } from 'bun:test'
import { renderDoc, renderDocFromJson } from '../../src'
import { defaultTokens } from '../../src/templates/tokens/default'
import type { RenderConfig } from '../../src/types'
import { writeFileSync, mkdirSync } from 'node:fs'

const config: RenderConfig = {
  ds: defaultTokens,
  size: { width: 1080, height: 1440 },
  contentArea: { x: 72, y: 72, width: 936, height: 1296 },
}

const COVER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#102a43"/><stop offset="100%" stop-color="#ef8354"/>' +
      '</linearGradient></defs>' +
      '<rect width="1200" height="675" fill="url(#g)"/>' +
      '</svg>',
  )

const SINGLE_PAGE_MARKDOWN = `
# 今日份灵感

每一个清晨都是一次新的开始，让我们用**积极的心态**迎接每一天。

无论遇到多少困难，都要记住：*坚持就是胜利*。

## 今日金句

人生就是一场旅行，重要的不是目的地，而是沿途的风景。

---

保持微笑，温暖他人，也温暖自己。
`.trim()

const LONG_MARKDOWN = `
# 长内容分页测试

这是一段用于验证多页渲染的长文内容。

![封面图](${COVER_IMAGE})

${Array.from(
  { length: 24 },
  (_, i) =>
    `## 第 ${i + 1} 节\n\n本节内容用于拉长文档长度，确保分页器会在内容足够多时切换到下一页。`,
).join('\n\n')}
`.trim()

describe('renderDoc smoke tests', () => {
  beforeAll(() => {
    mkdirSync('tests/smoke/output', { recursive: true })
  })

  test('single-page markdown → PNG', async () => {
    const pages = await renderDoc(SINGLE_PAGE_MARKDOWN, config, { renderer: 'canvas' })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.format).toBe('png')
    expect((pages[0] as { data: Buffer }).data.byteLength).toBeGreaterThan(1000)
    writeFileSync('tests/smoke/output/doc-single.png', (pages[0] as { data: Buffer }).data)
  })

  test('single-page markdown → SVG', async () => {
    const pages = await renderDoc(SINGLE_PAGE_MARKDOWN, config, { renderer: 'svg' })
    expect(pages[0]!.format).toBe('svg')
    const svg = (pages[0] as { data: string }).data
    expect(svg).toContain('<svg')
    expect(svg).toContain('今日份灵感')
    writeFileSync('tests/smoke/output/doc-single.svg', svg)
  })

  test('single-page markdown → HTML', async () => {
    const pages = await renderDoc(SINGLE_PAGE_MARKDOWN, config, { renderer: 'html' })
    expect(pages[0]!.format).toBe('html')
    const html = (pages[0] as { data: string }).data
    expect(html).toContain('今日份灵感')
    expect(html).toContain('今日金句')
    writeFileSync('tests/smoke/output/doc-single.html', html)
  })

  test('long markdown → multiple PNG pages', async () => {
    const pages = await renderDoc(LONG_MARKDOWN, config, { renderer: 'canvas' })
    expect(pages.length).toBeGreaterThan(1)
    pages.forEach((page, index) => {
      writeFileSync(
        `tests/smoke/output/doc-long-${String(index + 1).padStart(2, '0')}.png`,
        (page as { data: Buffer }).data,
      )
    })
  })

  test('json input → PNG', async () => {
    const pages = await renderDocFromJson(
      [
        { type: 'heroTitle', title: 'JSON 输入测试', subtitle: '副标题文字' },
        { type: 'paragraph', spans: [{ text: '直接传入 ContentBlock[] 也可以工作。' }] },
        { type: 'tags', items: ['测试', 'json', '渲染'] },
      ],
      config,
      { renderer: 'canvas' },
    )
    expect(pages[0]!.format).toBe('png')
    writeFileSync('tests/smoke/output/doc-json.png', (pages[0] as { data: Buffer }).data)
  })
})
```

- [ ] **Step 2: Run smoke test**

```bash
bun test tests/smoke/render-doc.test.ts
```

Expected: all PASS. Output PNGs/SVG/HTML written to `tests/smoke/output/`.

- [ ] **Step 3: Run full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/render-doc.test.ts
git commit -m "test: add renderDoc smoke tests with output artifacts"
```

---

## Task 8: Delete old Template/Slot system

**Files:**
- Delete: `src/template/engine.ts`, `src/template/paginator.ts`, `src/template/selector.ts`
- Delete: `src/pipeline/render-one.ts`
- Delete: `src/templates/cover/hero.ts`, `src/templates/content/article.ts`, `src/templates/ending/summary.ts`
- Delete: `tests/template/engine.test.ts`, `tests/template/paginator.test.ts`, `tests/template/selector.test.ts`
- Delete: `tests/pipeline/render-one.test.ts`
- Delete: `tests/smoke/render.test.ts`, `tests/smoke/markdown-generalization.test.ts`
- Modify: `src/types.ts` — remove Template/Slot types
- Modify: `src/layout/engine.ts` — remove SlotNode guards

- [ ] **Step 1: Delete old implementation files**

```bash
rm src/template/engine.ts src/template/paginator.ts src/template/selector.ts
rm src/pipeline/render-one.ts
rm src/templates/cover/hero.ts src/templates/content/article.ts src/templates/ending/summary.ts
```

- [ ] **Step 2: Delete old test files**

```bash
rm tests/template/engine.test.ts tests/template/paginator.test.ts tests/template/selector.test.ts
rm tests/pipeline/render-one.test.ts
rm tests/smoke/render.test.ts tests/smoke/markdown-generalization.test.ts
```

- [ ] **Step 3: Remove Template/Slot types from src/types.ts**

In `src/types.ts`, remove these blocks:

```typescript
// Remove:
export type SlotNode = { type: 'slot'; name: string }
export type TemplateNode = LayoutSpecNode | SlotNode

export type RuleContext = {
  blocks: ContentBlock[]
  tokens: DesignTokens
  mutate: (path: string, value: unknown) => void
}

export type Template = {
  id: string
  size: { width: number; height: number }
  tokens: DesignTokens
  contentArea: { x: number; y: number; width: number; height: number }
  root: TemplateNode
  rules?: Array<(ctx: RuleContext) => void>
}

export type TemplateFamily = {
  cover?: Template
  content: Template
  ending?: Template
}
```

Also simplify the `children` type in the `container` variant of `LayoutSpecNode`:

```typescript
// Change from:
children: Array<LayoutSpecNode | SlotNode>
// To:
children: Array<LayoutSpecNode>
```

- [ ] **Step 4: Remove SlotNode guards from src/layout/engine.ts**

In `src/layout/engine.ts`, remove these now-unused functions and their import:

```typescript
// Remove these functions entirely:
function isSlotNode(node: LayoutSpecNode | SlotNode): node is SlotNode { ... }
function assertNoSlotNode(node: LayoutSpecNode | SlotNode): LayoutSpecNode { ... }
```

Also remove `SlotNode` from the import at line 4:
```typescript
// Change from:
import type { LayoutSpec, LayoutSpecNode, LayoutBox, TextLine, SlotNode } from '../types'
// To:
import type { LayoutSpec, LayoutSpecNode, LayoutBox, TextLine } from '../types'
```

Replace all calls to `assertNoSlotNode(child)` with just `child`:
- Line ~87: `node.children.map(child => specToTextura(assertNoSlotNode(child)))`
  → `node.children.map(child => specToTextura(child))`
- Line ~147: `specToTexturaWithMeasuredHeights(assertNoSlotNode(child), ...)`
  → `specToTexturaWithMeasuredHeights(child, ...)`
- Line ~181: `assertNoSlotNode(spec.children[index]!)`
  → `spec.children[index]!`

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
bun test
```

Expected: all tests pass (only new tests remain).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove Template/Slot system — replaced by direct DS rendering"
```
