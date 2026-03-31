# Pagination Model Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace block-only pagination with a fragment-aware pagination model that supports splitting paragraphs, code blocks, and lists across pages.

**Architecture:** Keep `ContentBlock` as the semantic input, introduce `PageFragment` as the pagination output unit, and route pagination through block-specific adapters. `renderDoc(...)` will stop using `measureBlocks + paginateByHeights` directly and instead call a new fragment-aware paginator that yields `PageFragment[][]`, which are then rendered through `fragmentToNodes(...)`.

**Tech Stack:** Bun, TypeScript strict, existing `textura` layout engine, `@chenglou/pretext`, `@napi-rs/canvas`

---

## File Map

**Create:**
- `src/pipeline/pagination/policies.ts` — maps `ContentBlock` to default `PaginationPolicy`
- `src/pipeline/pagination/adapters/paragraph.ts` — paragraph fragment measurement, splitting, rendering
- `src/pipeline/pagination/adapters/code-block.ts` — code block fragment measurement, splitting, rendering
- `src/pipeline/pagination/adapters/list.ts` — list/ordered/steps fragment measurement, splitting, rendering
- `src/pipeline/pagination/paginate-fragments.ts` — fragment-aware paginator
- `tests/pipeline/pagination/policies.test.ts`
- `tests/pipeline/pagination/paragraph.test.ts`
- `tests/pipeline/pagination/code-block.test.ts`
- `tests/pipeline/pagination/list.test.ts`
- `tests/pipeline/pagination/paginate-fragments.test.ts`

**Modify:**
- `src/types.ts` — add `PaginationPolicy`, `PageFragment`, and adapter-related types
- `src/pipeline/block-to-nodes.ts` — add `fragmentToNodes(...)` while keeping `blockToNodes(...)`
- `src/pipeline/render-doc.ts` — switch to fragment-aware pagination path
- `tests/pipeline/render-doc.test.ts` — add regression coverage for split paragraph/list/code blocks
- `tests/smoke/production-cases.test.ts` — add realistic split-heavy markdown smoke cases if needed

**Keep Temporarily:**
- `src/pipeline/measure.ts`
- `src/pipeline/paginate.ts`

---

## Task 1: Add fragment and policy types

**Files:**
- Modify: `src/types.ts`
- Create: `tests/pipeline/pagination/policies.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/pipeline/pagination/policies.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { ContentBlock, PageFragment, PaginationPolicy } from '../../../src/types'
import { getPaginationPolicy } from '../../../src/pipeline/pagination/policies'

describe('pagination policies', () => {
  test('paragraph and codeBlock are splittable by lines', () => {
    const paragraph: ContentBlock = { type: 'paragraph', spans: [{ text: 'Hello' }] }
    const code: ContentBlock = { type: 'codeBlock', code: 'const x = 1' }

    expect(getPaginationPolicy(paragraph)).toEqual({ mode: 'splittable', splitBy: 'lines' })
    expect(getPaginationPolicy(code)).toEqual({ mode: 'splittable', splitBy: 'lines' })
  })

  test('lists and steps are splittable by items', () => {
    expect(getPaginationPolicy({ type: 'bulletList', items: ['a'] })).toEqual({
      mode: 'splittable',
      splitBy: 'items',
    })
    expect(getPaginationPolicy({ type: 'orderedList', items: ['a'] })).toEqual({
      mode: 'splittable',
      splitBy: 'items',
    })
    expect(getPaginationPolicy({ type: 'steps', items: ['a'] })).toEqual({
      mode: 'splittable',
      splitBy: 'items',
    })
  })

  test('heading remains atomic', () => {
    expect(getPaginationPolicy({ type: 'heading', level: 2, text: 'Title' })).toEqual({
      mode: 'atomic',
    })
  })

  test('page fragments are assignable', () => {
    const fragment: PageFragment = {
      type: 'paragraph-fragment',
      spans: [{ text: 'Hello' }],
      continuedFromPrev: false,
      continuesToNext: true,
    }
    const policy: PaginationPolicy = { mode: 'splittable', splitBy: 'lines' }

    expect(fragment.type).toBe('paragraph-fragment')
    expect(policy.mode).toBe('splittable')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test tests/pipeline/pagination/policies.test.ts
```

Expected: FAIL because the new types and `getPaginationPolicy(...)` do not exist.

- [ ] **Step 3: Add the new types and policy helper**

Update `src/types.ts` to add:

```ts
export type PaginationPolicy =
  | { mode: 'atomic' }
  | { mode: 'splittable'; splitBy: 'lines' | 'items' }

export type PageFragment =
  | { type: 'block'; block: ContentBlock }
  | {
      type: 'paragraph-fragment'
      spans: Span[]
      continuedFromPrev?: boolean
      continuesToNext?: boolean
    }
  | {
      type: 'code-fragment'
      code: string
      language?: string
      continuedFromPrev?: boolean
      continuesToNext?: boolean
    }
  | {
      type: 'list-fragment'
      listType: 'bullet' | 'ordered' | 'steps'
      items: string[]
      startIndex?: number
      continuedFromPrev?: boolean
      continuesToNext?: boolean
    }
```

Create `src/pipeline/pagination/policies.ts`:

```ts
import type { ContentBlock, PaginationPolicy } from '../../types'

export function getPaginationPolicy(block: ContentBlock): PaginationPolicy {
  switch (block.type) {
    case 'paragraph':
    case 'codeBlock':
      return { mode: 'splittable', splitBy: 'lines' }
    case 'bulletList':
    case 'orderedList':
    case 'steps':
      return { mode: 'splittable', splitBy: 'items' }
    default:
      return { mode: 'atomic' }
  }
}
```

- [ ] **Step 4: Re-run the test and typecheck**

Run:

```bash
bun test tests/pipeline/pagination/policies.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

---

## Task 2: Add fragment rendering for paragraph, code, and list fragments

**Files:**
- Modify: `src/pipeline/block-to-nodes.ts`
- Create: `tests/pipeline/pagination/paragraph.test.ts`
- Create: `tests/pipeline/pagination/code-block.test.ts`
- Create: `tests/pipeline/pagination/list.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/pipeline/pagination/paragraph.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { fragmentToNodes } from '../../../src/pipeline/block-to-nodes'
import { defaultTokens } from '../../../src/templates/tokens/default'

describe('paragraph fragment rendering', () => {
  test('renders a paragraph fragment as a text node', () => {
    const nodes = fragmentToNodes(
      {
        type: 'paragraph-fragment',
        spans: [{ text: 'Line A' }, { text: 'Line B' }],
      },
      defaultTokens,
      936,
    )

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'text',
      spans: [{ text: 'Line A' }, { text: 'Line B' }],
      font: defaultTokens.typography.body.font,
    })
  })
})
```

Create `tests/pipeline/pagination/code-block.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { fragmentToNodes } from '../../../src/pipeline/block-to-nodes'
import { defaultTokens } from '../../../src/templates/tokens/default'

describe('code fragment rendering', () => {
  test('renders a code fragment inside the code block container', () => {
    const nodes = fragmentToNodes(
      {
        type: 'code-fragment',
        code: 'const x = 1\\nconst y = 2',
        language: 'ts',
      },
      defaultTokens,
      936,
    )

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('container')
  })
})
```

Create `tests/pipeline/pagination/list.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { fragmentToNodes } from '../../../src/pipeline/block-to-nodes'
import { defaultTokens } from '../../../src/templates/tokens/default'

describe('list fragment rendering', () => {
  test('renders ordered list fragment with startIndex offset', () => {
    const nodes = fragmentToNodes(
      {
        type: 'list-fragment',
        listType: 'ordered',
        items: ['Third', 'Fourth'],
        startIndex: 3,
      },
      defaultTokens,
      936,
    )

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('container')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test tests/pipeline/pagination/paragraph.test.ts
bun test tests/pipeline/pagination/code-block.test.ts
bun test tests/pipeline/pagination/list.test.ts
```

Expected: FAIL because `fragmentToNodes(...)` does not exist.

- [ ] **Step 3: Add `fragmentToNodes(...)` to `src/pipeline/block-to-nodes.ts`**

Implement:

```ts
export function fragmentToNodes(
  fragment: PageFragment,
  ds: DesignTokens,
  contentWidth: number,
): LayoutSpecNode[] {
  switch (fragment.type) {
    case 'block':
      return blockToNodes(fragment.block, ds, contentWidth)
    case 'paragraph-fragment':
      return [{
        type: 'text',
        spans: fragment.spans,
        font: ds.typography.body.font,
        lineHeight: ds.typography.body.lineHeight,
        color: ds.colors.text,
      }]
    case 'code-fragment':
      return [{
        type: 'container',
        direction: 'column',
        width: 'fill',
        height: 'hug',
        padding: ds.spacing.md,
        background: { type: 'color', value: ds.colors.codeBg },
        children: [{
          type: 'text',
          spans: [{ text: fragment.code }],
          font: ds.typography.code.font,
          lineHeight: ds.typography.code.lineHeight,
          color: ds.colors.text,
        }],
      }]
    case 'list-fragment': {
      const prefix = (index: number) =>
        fragment.listType === 'bullet'
          ? '• '
          : `${(fragment.startIndex ?? 1) + index}. `

      return [{
        type: 'container',
        direction: 'column',
        width: 'fill',
        height: 'hug',
        gap: ds.spacing.xs,
        children: fragment.items.map((item, index) => ({
          type: 'text' as const,
          spans: [{ text: `${prefix(index)}${item}` }],
          font: ds.typography.body.font,
          lineHeight: ds.typography.body.lineHeight,
          color: ds.colors.text,
        })),
      }]
    }
  }
}
```

- [ ] **Step 4: Re-run the tests and typecheck**

Run:

```bash
bun test tests/pipeline/pagination/paragraph.test.ts
bun test tests/pipeline/pagination/code-block.test.ts
bun test tests/pipeline/pagination/list.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

---

## Task 3: Implement paragraph splitting adapter

**Files:**
- Create: `src/pipeline/pagination/adapters/paragraph.ts`
- Create: `tests/pipeline/pagination/paragraph.test.ts`

- [ ] **Step 1: Extend the failing test with split behavior**

Append to `tests/pipeline/pagination/paragraph.test.ts`:

```ts
import { splitParagraphBlock } from '../../../src/pipeline/pagination/adapters/paragraph'
import { makeTokens } from '../../../src'

test('splits a long paragraph into head/tail fragments by available height', async () => {
  const ds = makeTokens('Heiti SC')
  const result = await splitParagraphBlock(
    {
      type: 'paragraph',
      spans: [{ text: '长期主义不是慢，而是不短视。'.repeat(80) }],
    },
    ds.typography.body.lineHeight * 4,
    ds,
    936,
  )

  expect(result.head?.type).toBe('paragraph-fragment')
  expect(result.tail?.type).toBe('paragraph-fragment')
  expect(result.head).not.toBeNull()
  expect(result.tail).not.toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test tests/pipeline/pagination/paragraph.test.ts
```

Expected: FAIL because `splitParagraphBlock(...)` does not exist.

- [ ] **Step 3: Implement paragraph splitting**

Create `src/pipeline/pagination/adapters/paragraph.ts`:

```ts
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import type { ContentBlock, DesignTokens, PageFragment } from '../../../src/types'

function paragraphText(block: Extract<ContentBlock, { type: 'paragraph' }>): string {
  return block.spans.map(span => span.text).join('')
}

export async function splitParagraphBlock(
  block: Extract<ContentBlock, { type: 'paragraph' }>,
  availableHeight: number,
  ds: DesignTokens,
  contentWidth: number,
): Promise<{ head: PageFragment | null; tail: PageFragment | null }> {
  const lineHeight = ds.typography.body.lineHeight
  const maxLines = Math.floor(availableHeight / lineHeight)

  if (maxLines <= 0) return { head: null, tail: { type: 'paragraph-fragment', spans: block.spans } }

  const prepared = prepareWithSegments(paragraphText(block), ds.typography.body.font)
  const result = layoutWithLines(prepared, contentWidth, lineHeight)

  if (result.lines.length <= maxLines) {
    return {
      head: { type: 'paragraph-fragment', spans: block.spans },
      tail: null,
    }
  }

  const headText = result.lines.slice(0, maxLines).map(line => line.text).join('')
  const tailText = result.lines.slice(maxLines).map(line => line.text).join('')

  return {
    head: {
      type: 'paragraph-fragment',
      spans: [{ text: headText }],
      continuesToNext: true,
    },
    tail: {
      type: 'paragraph-fragment',
      spans: [{ text: tailText }],
      continuedFromPrev: true,
    },
  }
}
```

- [ ] **Step 4: Re-run the test and typecheck**

Run:

```bash
bun test tests/pipeline/pagination/paragraph.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

---

## Task 4: Implement list and code block splitting adapters

**Files:**
- Create: `src/pipeline/pagination/adapters/list.ts`
- Create: `src/pipeline/pagination/adapters/code-block.ts`
- Modify: `tests/pipeline/pagination/list.test.ts`
- Modify: `tests/pipeline/pagination/code-block.test.ts`

- [ ] **Step 1: Extend the failing tests**

Append to `tests/pipeline/pagination/list.test.ts`:

```ts
import { splitListBlock } from '../../../src/pipeline/pagination/adapters/list'

test('splits ordered list by items and keeps startIndex', async () => {
  const result = await splitListBlock(
    { type: 'orderedList', items: ['a', 'b', 'c', 'd'] },
    100,
    defaultTokens,
    936,
  )

  expect(result.head?.type).toBe('list-fragment')
  expect(result.tail?.type).toBe('list-fragment')
})
```

Append to `tests/pipeline/pagination/code-block.test.ts`:

```ts
import { splitCodeBlock } from '../../../src/pipeline/pagination/adapters/code-block'

test('splits code block by lines', async () => {
  const result = await splitCodeBlock(
    { type: 'codeBlock', code: Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\\n') },
    defaultTokens.typography.code.lineHeight * 6,
    defaultTokens,
    936,
  )

  expect(result.head?.type).toBe('code-fragment')
  expect(result.tail?.type).toBe('code-fragment')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test tests/pipeline/pagination/list.test.ts
bun test tests/pipeline/pagination/code-block.test.ts
```

Expected: FAIL because split helpers do not exist.

- [ ] **Step 3: Implement list and code splitting**

Create `src/pipeline/pagination/adapters/list.ts` and `src/pipeline/pagination/adapters/code-block.ts` with minimal split logic:

- list: estimate per-item height using existing body lineHeight and split whole items
- code: split by newline count and include container padding in available height

- [ ] **Step 4: Re-run the tests and typecheck**

Run:

```bash
bun test tests/pipeline/pagination/list.test.ts
bun test tests/pipeline/pagination/code-block.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

---

## Task 5: Implement fragment-aware paginator

**Files:**
- Create: `src/pipeline/pagination/paginate-fragments.ts`
- Create: `tests/pipeline/pagination/paginate-fragments.test.ts`

- [ ] **Step 1: Write the failing paginator test**

Create `tests/pipeline/pagination/paginate-fragments.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { paginateBlocksToFragments } from '../../../src/pipeline/pagination/paginate-fragments'
import { defaultTokens } from '../../../src/templates/tokens/default'

describe('paginateBlocksToFragments', () => {
  test('splits a long paragraph across multiple pages', async () => {
    const pages = await paginateBlocksToFragments(
      [
        { type: 'paragraph', spans: [{ text: '长期主义不是慢，而是不短视。'.repeat(120) }] },
      ],
      defaultTokens,
      936,
      200,
      24,
    )

    expect(pages.length).toBeGreaterThan(1)
    expect(pages[0]?.[0]?.type).toBe('paragraph-fragment')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test tests/pipeline/pagination/paginate-fragments.test.ts
```

Expected: FAIL because `paginateBlocksToFragments(...)` does not exist.

- [ ] **Step 3: Implement the new paginator**

Create `src/pipeline/pagination/paginate-fragments.ts` with a single exported function:

```ts
export async function paginateBlocksToFragments(
  blocks: ContentBlock[],
  ds: DesignTokens,
  contentWidth: number,
  pageHeight: number,
  blockGap: number,
): Promise<PageFragment[][]>
```

Requirements:
- `atomic` blocks become `{ type: 'block', block }`
- `splittable` blocks try whole-fit first, then split into `head/tail`
- `tail` continues flowing across later pages
- no infinite loops on zero-fit splits

- [ ] **Step 4: Re-run the test and typecheck**

Run:

```bash
bun test tests/pipeline/pagination/paginate-fragments.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

---

## Task 6: Wire the new paginator into render-doc

**Files:**
- Modify: `src/pipeline/render-doc.ts`
- Modify: `tests/pipeline/render-doc.test.ts`

- [ ] **Step 1: Add the failing regression tests**

Append to `tests/pipeline/render-doc.test.ts`:

```ts
test('renders a long single paragraph into multiple html pages without overflow', async () => {
  const markdown = `# Title\\n\\n${'长期主义不是慢，而是不短视。'.repeat(300)}`
  const pages = await renderDoc(markdown, config, { renderer: 'html' })

  expect(pages.length).toBeGreaterThan(1)
  pages.forEach(page => expect(page.format).toBe('html'))
})

test('renders a long code block into multiple html pages', async () => {
  const code = Array.from({ length: 80 }, (_, i) => `const line${i} = ${i}`).join('\\n')
  const pages = await renderDoc(`\\n\\n\`\`\`ts\\n${code}\\n\`\`\``, config, { renderer: 'html' })

  expect(pages.length).toBeGreaterThan(1)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test tests/pipeline/render-doc.test.ts
```

Expected: FAIL because current block-only pagination overflows or under-paginates.

- [ ] **Step 3: Replace block-only pagination in `src/pipeline/render-doc.ts`**

Change the pagination path to:

```ts
const pageFragments = await paginateBlocksToFragments(
  blocks,
  ds,
  contentArea.width,
  contentArea.height,
  blockGap,
)

return Promise.all(
  pageFragments.map(async fragments => {
    const spec = fragmentsToSpec(fragments, config)
    const boxes = await computeLayoutBoxes(spec, config.size)
    return renderBoxes(boxes, config.size, options)
  }),
)
```

Also add `fragmentsToSpec(...)` that maps `PageFragment[]` to page children via `fragmentToNodes(...)`.

- [ ] **Step 4: Re-run the regression tests and typecheck**

Run:

```bash
bun test tests/pipeline/render-doc.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

---

## Task 7: Add smoke coverage for split-heavy markdown

**Files:**
- Modify: `tests/smoke/production-cases.test.ts`

- [ ] **Step 1: Add split-heavy smoke tests**

Add at least one new smoke case each for:
- long single paragraph
- long code block
- long ordered/bullet list

Each case should write PNG outputs to `tests/smoke/output/cases/` and assert multiple pages.

- [ ] **Step 2: Run smoke and regression**

Run:

```bash
bun test tests/smoke/production-cases.test.ts
bun test tests/smoke/story-template-system.test.ts
bun test tests/pipeline/render-doc.test.ts
bun run typecheck
```

Expected: PASS for all commands.

---

## Self-Review Notes

**Spec coverage:**
- `atomic / splittable` model: Task 1
- `PageFragment` layer: Task 1
- `paragraph` line splitting: Task 3
- `codeBlock` line splitting: Task 4
- `list / steps` item splitting: Task 4
- fragment-aware paginator: Task 5
- `renderDoc(...)` integration: Task 6
- smoke coverage: Task 7

**Placeholder scan:**
- No `TODO`, `TBD`, or undefined “later” steps remain.
- Every task names exact files and concrete verification commands.

**Type consistency:**
- `PageFragment`, `PaginationPolicy`, `fragmentToNodes`, and `paginateBlocksToFragments` are defined before later tasks depend on them.
- `Story` and `renderStory` work from the previous plan remain untouched by this scope.

---

Plan complete and saved to `docs/superpowers/plans/2026-03-31-pagination-model-upgrade.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
