# NoteCard 渲染引擎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零构建模板化内容渲染引擎，将任意内容（Markdown/JSON）映射到卡片模板，稳定产出 PNG / SVG / HTML。

**Architecture:** Content Layer 解析输入为语义化 ContentBlock[]，Template Engine 将其绑定到声明式模板产出 LayoutSpec，Layout Engine 用 Textura（Yoga + Pretext）计算几何信息产出 LayoutBox[]，三端 Renderer 消费 LayoutBox[] 输出图片或字符串。Content Paginator 在 Template Engine 之前做粗估分页，Template Selector 按页号分配模板族。

**Tech Stack:** Bun, TypeScript strict, `textura@0.2.1`（Yoga WASM + Pretext）, `@chenglou/pretext@0.0.3`, `@napi-rs/canvas@0.1.97`, `marked@17`

---

## File Map

```
src/
├── types.ts                        新建  所有公共类型
├── content/
│   ├── parse-markdown.ts           新建  marked → ContentBlock[]
│   └── parse-json.ts               新建  raw JSON → ContentBlock[]（含校验）
├── template/
│   ├── engine.ts                   新建  slot 绑定 + rules 执行 → LayoutSpec
│   ├── paginator.ts                新建  ContentBlock[] → ContentBlock[][] 粗估分页
│   └── selector.ts                 新建  按页号选模板族
├── layout/
│   ├── engine.ts                   新建  LayoutSpec → LayoutBox[]（Textura 封装）
│   ├── measure-text.ts             新建  Pretext 文本测量工具
│   └── preload-images.ts           新建  图片并发预加载
├── renderer/
│   ├── canvas.ts                   新建  CanvasRenderer → Buffer
│   ├── svg.ts                      新建  SvgRenderer → string
│   └── html.ts                     新建  HtmlRenderer → string
├── templates/
│   ├── tokens/
│   │   └── default.ts              新建  默认 DesignTokens
│   ├── content/
│   │   └── article.ts              新建  通用文章内容模板
│   ├── cover/
│   │   └── hero.ts                 新建  封面模板
│   └── ending/
│       └── summary.ts              新建  结尾模板
├── pipeline/
│   └── render-one.ts               新建  高层 renderContent / renderMarkdown
└── index.ts                        新建  公共 API 导出

tests/
├── content/
│   ├── parse-markdown.test.ts      新建
│   └── parse-json.test.ts          新建
├── template/
│   ├── engine.test.ts              新建
│   ├── paginator.test.ts           新建
│   └── selector.test.ts            新建
├── layout/
│   ├── engine.test.ts              新建
│   └── measure-text.test.ts        新建
├── renderer/
│   ├── svg.test.ts                 新建
│   └── html.test.ts                新建
└── smoke/
    └── render.test.ts              新建  端到端 smoke
```

**API 约定（整个计划通用）：**

```ts
// Pretext 实际 API
import { prepare, layoutWithLines, prepareWithSegments } from '@chenglou/pretext'
// prepare(text: string, font: string): PreparedText
// layoutWithLines(prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number): LayoutLinesResult
// LayoutLinesResult.lines: LayoutLine[]  — LayoutLine.text: string, .width: number

// Textura 实际 API
import { init, computeLayout } from 'textura'
import type { BoxNode, TextNode, LayoutNode, ComputedLayout } from 'textura'
// await init()  — 初始化 Yoga WASM，调用一次
// computeLayout(tree: LayoutNode, options?: { width?, height? }): ComputedLayout
// ComputedLayout: { x, y, width, height, children: ComputedLayout[], lineCount?, text? }
// ComputedLayout 的 x/y 是相对父节点的偏移
```

---

## Phase 1：骨架（单页端到端）

---

### Task 1: 清理旧文件，提交干净起点

**Files:**
- Stage: 所有已删除文件（`git add -A`）

- [ ] **Step 1: Stage 所有删除，提交**

```bash
cd /Users/liuyaowen/Workspace/javascript/NoteCard
git add -A
git commit -m "chore: remove old implementation (full rewrite)"
```

Expected: commit 成功，`git status` 显示 clean（除 `docs/`）。

---

### Task 2: 定义核心类型

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// src/types.ts
// ─── Content Layer ────────────────────────────────────────────────────────

export type Span = {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  color?: string
  link?: string
}

export type ContentBlock =
  | { type: 'heading';     level: 1 | 2 | 3; text: string }
  | { type: 'paragraph';   spans: Span[] }
  | { type: 'bulletList';  items: string[] }
  | { type: 'orderedList'; items: string[] }
  | { type: 'steps';       items: string[] }
  | { type: 'quoteCard';   text: string; author?: string }
  | { type: 'metric';      label: string; value: string }
  | { type: 'tags';        items: string[] }
  | { type: 'image';       src: string; alt?: string }
  | { type: 'codeBlock';   code: string; language?: string }
  | { type: 'divider' }
  | { type: 'heroTitle';   title: string; subtitle?: string }

// ─── Design Tokens ────────────────────────────────────────────────────────

export type DesignTokens = {
  colors: {
    bg: string; text: string; subtext: string
    primary: string; accent: string; border: string
  }
  typography: {
    h1:      { font: string; lineHeight: number }
    h2:      { font: string; lineHeight: number }
    body:    { font: string; lineHeight: number }
    caption: { font: string; lineHeight: number }
    code:    { font: string; lineHeight: number }
  }
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number }
  radius:  { sm: number; md: number; lg: number }
}

// ─── Template & LayoutSpec ────────────────────────────────────────────────

export type ResolvedPaint =
  | { type: 'color'; value: string }
  | { type: 'linear-gradient'; angle: number; stops: Array<{ offset: number; color: string }> }
  | { type: 'image'; src: string; fit?: 'cover' | 'contain' | 'fill' }

export type LayoutSpecNode =
  | {
      type: 'container'
      direction?: 'row' | 'column'
      gap?: number
      padding?: number | { top: number; right: number; bottom: number; left: number }
      width?: number | 'fill'
      height?: number | 'fill' | 'hug'
      align?: 'start' | 'center' | 'end' | 'stretch'
      justify?: 'start' | 'center' | 'end' | 'space-between'
      position?: 'relative' | 'absolute'
      x?: number; y?: number
      background?: ResolvedPaint
      children: LayoutSpecNode[]
    }
  | {
      type: 'text'
      spans: Span[]
      font: string
      lineHeight: number
      color: string
      align?: 'left' | 'center' | 'right'
      maxLines?: number
    }
  | {
      type: 'image'
      src: string
      width: number
      height: number
      fit?: 'cover' | 'contain'
      borderRadius?: number
    }
  | {
      type: 'rect'
      width: number | 'fill'
      height: number | 'fill' | 'hug'
      fill: ResolvedPaint
      borderRadius?: number
      shadow?: Shadow
    }

export type LayoutSpec = LayoutSpecNode

export type SlotNode = { type: 'slot'; name: string }
export type TemplateNode = LayoutSpecNode | SlotNode

export type Shadow = { x: number; y: number; blur: number; color: string }

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
  cover?:  Template
  content: Template
  ending?: Template
}

// ─── Layout Box ───────────────────────────────────────────────────────────

export type TextLine = {
  spans: Array<{ text: string; font: string; color: string; x: number }>
  y: number
  height: number
}

export type LayoutBox = {
  id: string
  kind: 'text' | 'image' | 'rect' | 'group'
  x: number; y: number
  width: number; height: number
  zIndex?: number
  // text
  lines?: TextLine[]
  textAlign?: 'left' | 'center' | 'right'
  // image
  src?: string
  loadedImage?: unknown | null
  fit?: 'cover' | 'contain'
  borderRadius?: number
  // rect / background
  fill?: ResolvedPaint
  shadow?: Shadow
  // group
  children?: LayoutBox[]
}

// ─── Renderer ─────────────────────────────────────────────────────────────

export type RenderOptions = {
  renderer?: 'canvas' | 'svg' | 'html'
  format?: 'png' | 'jpeg'
  quality?: number
}

export type RenderOutput =
  | { format: 'png' | 'jpeg'; data: Buffer }
  | { format: 'svg'; data: string }
  | { format: 'html'; data: string }

export interface IRenderer {
  renderPage(
    boxes: LayoutBox[],
    size: { width: number; height: number },
    options?: RenderOptions,
  ): Promise<RenderOutput>
}
```

- [ ] **Step 2: 验证类型检查通过**

```bash
bun run typecheck
```

Expected: 无错误输出（或仅警告）。

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: core type definitions"
```

---

### Task 3: Content Layer — Markdown 解析器

**Files:**
- Create: `src/content/parse-markdown.ts`
- Create: `tests/content/parse-markdown.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/content/parse-markdown.test.ts
import { test, expect, describe } from 'bun:test'
import { parseMarkdown } from '../../src/content/parse-markdown'

describe('parseMarkdown', () => {
  test('h1 → heroTitle', () => {
    expect(parseMarkdown('# 今日份灵感')).toEqual([
      { type: 'heroTitle', title: '今日份灵感' },
    ])
  })

  test('h2 → heading level 2', () => {
    expect(parseMarkdown('## 副标题')).toEqual([
      { type: 'heading', level: 2, text: '副标题' },
    ])
  })

  test('paragraph → paragraph with spans', () => {
    expect(parseMarkdown('Hello world')).toEqual([
      { type: 'paragraph', spans: [{ text: 'Hello world' }] },
    ])
  })

  test('bold in paragraph → span with bold:true', () => {
    const blocks = parseMarkdown('普通 **加粗** 文字')
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        spans: [
          { text: '普通 ' },
          { text: '加粗', bold: true },
          { text: ' 文字' },
        ],
      },
    ])
  })

  test('unordered list → bulletList', () => {
    expect(parseMarkdown('- 苹果\n- 香蕉')).toEqual([
      { type: 'bulletList', items: ['苹果', '香蕉'] },
    ])
  })

  test('ordered list → orderedList', () => {
    expect(parseMarkdown('1. 第一步\n2. 第二步')).toEqual([
      { type: 'orderedList', items: ['第一步', '第二步'] },
    ])
  })

  test('blockquote → quoteCard', () => {
    expect(parseMarkdown('> 人生苦短')).toEqual([
      { type: 'quoteCard', text: '人生苦短' },
    ])
  })

  test('code block → codeBlock', () => {
    expect(parseMarkdown('```js\nconsole.log(1)\n```')).toEqual([
      { type: 'codeBlock', code: 'console.log(1)', language: 'js' },
    ])
  })

  test('hr → divider', () => {
    expect(parseMarkdown('---')).toEqual([{ type: 'divider' }])
  })

  test('image → image block', () => {
    expect(parseMarkdown('![alt](https://example.com/img.png)')).toEqual([
      { type: 'image', src: 'https://example.com/img.png', alt: 'alt' },
    ])
  })

  test('mixed content → multiple blocks', () => {
    const blocks = parseMarkdown('# Title\n\nSome text.')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'heroTitle', title: 'Title' })
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      spans: [{ text: 'Some text.' }],
    })
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/content/parse-markdown.test.ts
```

Expected: `Cannot find module '../../src/content/parse-markdown'`

- [ ] **Step 3: 实现**

```typescript
// src/content/parse-markdown.ts
import { marked } from 'marked'
import type { ContentBlock, Span } from '../types'

function inlineTokensToSpans(tokens: ReturnType<typeof marked.lexer>[0] extends { tokens?: infer T } ? NonNullable<T> : never): Span[] {
  const spans: Span[] = []
  for (const t of tokens as Array<{ type: string; text?: string; tokens?: unknown[] }>) {
    switch (t.type) {
      case 'text':
        if (t.text) spans.push({ text: t.text })
        break
      case 'strong':
        if (t.tokens) {
          for (const inner of flattenText(t.tokens as Array<{ type: string; text?: string }>)) {
            spans.push({ text: inner, bold: true })
          }
        }
        break
      case 'em':
        if (t.tokens) {
          for (const inner of flattenText(t.tokens as Array<{ type: string; text?: string }>)) {
            spans.push({ text: inner, italic: true })
          }
        }
        break
      case 'codespan':
        if (t.text) spans.push({ text: t.text, code: true })
        break
      default:
        if (t.text) spans.push({ text: t.text })
    }
  }
  return spans.filter(s => s.text.length > 0)
}

function flattenText(tokens: Array<{ type: string; text?: string }>): string[] {
  return tokens.flatMap(t => (t.text ? [t.text] : []))
}

export function parseMarkdown(markdown: string): ContentBlock[] {
  const tokens = marked.lexer(markdown)
  const blocks: ContentBlock[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const text = token.text.trim()
        if (token.depth === 1) {
          blocks.push({ type: 'heroTitle', title: text })
        } else {
          blocks.push({ type: 'heading', level: Math.min(token.depth, 3) as 1 | 2 | 3, text })
        }
        break
      }
      case 'paragraph': {
        // Standalone image: paragraph contains exactly one image inline token
        if (token.tokens && token.tokens.length === 1) {
          const first = token.tokens[0] as { type: string; href?: string; text?: string }
          if (first.type === 'image') {
            blocks.push({ type: 'image', src: first.href ?? '', alt: first.text || undefined })
            break
          }
        }
        const spans = token.tokens ? inlineTokensToSpans(token.tokens as never) : [{ text: token.text }]
        if (spans.length > 0) blocks.push({ type: 'paragraph', spans })
        break
      }
      case 'list': {
        const items = token.items.map(item => item.text.trim())
        if (token.ordered) {
          blocks.push({ type: 'orderedList', items })
        } else {
          blocks.push({ type: 'bulletList', items })
        }
        break
      }
      case 'blockquote': {
        const innerText = token.text.trim()
        blocks.push({ type: 'quoteCard', text: innerText })
        break
      }
      case 'code': {
        blocks.push({ type: 'codeBlock', code: token.text, language: token.lang || undefined })
        break
      }
      case 'hr': {
        blocks.push({ type: 'divider' })
        break
      }
      case 'space':
        break
      default: {
        // paragraph with image token inside
        if (token.type === 'paragraph' && token.text.startsWith('![')) {
          // already handled above via paragraph case
        }
        break
      }
    }
  }

  return blocks
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test tests/content/parse-markdown.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/content/parse-markdown.ts tests/content/parse-markdown.test.ts
git commit -m "feat: markdown → ContentBlock[] parser"
```

---

### Task 4: Content Layer — JSON 解析器

**Files:**
- Create: `src/content/parse-json.ts`
- Create: `tests/content/parse-json.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/content/parse-json.test.ts
import { test, expect, describe } from 'bun:test'
import { parseJson } from '../../src/content/parse-json'

describe('parseJson', () => {
  test('valid ContentBlock[] passes through', () => {
    const input = [
      { type: 'paragraph', spans: [{ text: 'Hello' }] },
      { type: 'divider' },
    ]
    expect(parseJson(input)).toEqual(input)
  })

  test('throws on non-array', () => {
    expect(() => parseJson({ type: 'paragraph' })).toThrow('Expected array')
  })

  test('throws on unknown block type', () => {
    expect(() => parseJson([{ type: 'unknown_type' }])).toThrow()
  })

  test('throws on paragraph missing spans', () => {
    expect(() => parseJson([{ type: 'paragraph' }])).toThrow()
  })

  test('heroTitle block passes through', () => {
    const input = [{ type: 'heroTitle', title: 'My Title', subtitle: 'Sub' }]
    expect(parseJson(input)).toEqual(input)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/content/parse-json.test.ts
```

Expected: `Cannot find module '../../src/content/parse-json'`

- [ ] **Step 3: 实现**

```typescript
// src/content/parse-json.ts
import type { ContentBlock } from '../types'

const VALID_TYPES = new Set([
  'heading', 'paragraph', 'bulletList', 'orderedList', 'steps',
  'quoteCard', 'metric', 'tags', 'image', 'codeBlock', 'divider', 'heroTitle',
])

function assertBlock(item: unknown, index: number): ContentBlock {
  if (!item || typeof item !== 'object') {
    throw new Error(`Block at index ${index} is not an object`)
  }
  const b = item as Record<string, unknown>
  if (!b['type'] || typeof b['type'] !== 'string') {
    throw new Error(`Block at index ${index} is missing 'type' field`)
  }
  if (!VALID_TYPES.has(b['type'])) {
    throw new Error(`Block at index ${index} has unknown type '${b['type']}'`)
  }
  // Per-type required field checks
  switch (b['type']) {
    case 'paragraph':
      if (!Array.isArray(b['spans'])) throw new Error(`Block ${index} (paragraph) missing 'spans' array`)
      break
    case 'heading':
      if (typeof b['text'] !== 'string') throw new Error(`Block ${index} (heading) missing 'text'`)
      if (![1, 2, 3].includes(b['level'] as number)) throw new Error(`Block ${index} (heading) invalid 'level'`)
      break
    case 'bulletList': case 'orderedList': case 'steps': case 'tags':
      if (!Array.isArray(b['items'])) throw new Error(`Block ${index} (${b['type']}) missing 'items' array`)
      break
    case 'heroTitle':
      if (typeof b['title'] !== 'string') throw new Error(`Block ${index} (heroTitle) missing 'title'`)
      break
    case 'quoteCard':
      if (typeof b['text'] !== 'string') throw new Error(`Block ${index} (quoteCard) missing 'text'`)
      break
    case 'metric':
      if (typeof b['label'] !== 'string' || typeof b['value'] !== 'string') {
        throw new Error(`Block ${index} (metric) missing 'label' or 'value'`)
      }
      break
    case 'image':
      if (typeof b['src'] !== 'string') throw new Error(`Block ${index} (image) missing 'src'`)
      break
    case 'codeBlock':
      if (typeof b['code'] !== 'string') throw new Error(`Block ${index} (codeBlock) missing 'code'`)
      break
  }
  return b as unknown as ContentBlock
}

export function parseJson(raw: unknown): ContentBlock[] {
  if (!Array.isArray(raw)) throw new Error('Expected array of ContentBlock')
  return raw.map((item, i) => assertBlock(item, i))
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test tests/content/parse-json.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/content/parse-json.ts tests/content/parse-json.test.ts
git commit -m "feat: JSON → ContentBlock[] parser with validation"
```

---

### Task 5: 默认 Design Tokens

**Files:**
- Create: `src/templates/tokens/default.ts`

- [ ] **Step 1: 创建默认 token 集（无需测试，纯数据）**

```typescript
// src/templates/tokens/default.ts
import type { DesignTokens } from '../../types'

// 字体名 placeholder — 使用者需在 registerFont() 后覆盖
const FONT = 'Heiti SC'

export const defaultTokens: DesignTokens = {
  colors: {
    bg:      '#ffffff',
    text:    '#1a1a1a',
    subtext: '#6b7280',
    primary: '#ef4444',
    accent:  '#f97316',
    border:  '#e5e7eb',
  },
  typography: {
    h1:      { font: `bold 52px ${FONT}`,  lineHeight: 72 },
    h2:      { font: `bold 38px ${FONT}`,  lineHeight: 54 },
    body:    { font: `28px ${FONT}`,        lineHeight: 44 },
    caption: { font: `22px ${FONT}`,        lineHeight: 34 },
    code:    { font: `24px monospace`,      lineHeight: 36 },
  },
  spacing: { xs: 8, sm: 16, md: 24, lg: 40, xl: 64 },
  radius:  { sm: 8, md: 16, lg: 24 },
}

export function makeTokens(font: string, overrides?: Partial<DesignTokens>): DesignTokens {
  const base: DesignTokens = {
    ...defaultTokens,
    typography: {
      h1:      { font: `bold 52px ${font}`,  lineHeight: 72 },
      h2:      { font: `bold 38px ${font}`,  lineHeight: 54 },
      body:    { font: `28px ${font}`,        lineHeight: 44 },
      caption: { font: `22px ${font}`,        lineHeight: 34 },
      code:    { font: `24px monospace`,      lineHeight: 36 },
    },
  }
  return overrides ? { ...base, ...overrides } : base
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/tokens/default.ts
git commit -m "feat: default design tokens"
```

---

### Task 6: Template Engine — slot 绑定

**Files:**
- Create: `src/template/engine.ts`
- Create: `tests/template/engine.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/template/engine.test.ts
import { test, expect, describe } from 'bun:test'
import { applyTemplate } from '../../src/template/engine'
import type { Template, ContentBlock, LayoutSpecNode } from '../../src/types'
import { defaultTokens } from '../../src/templates/tokens/default'

const mockTemplate: Template = {
  id: 'test',
  size: { width: 1080, height: 1440 },
  tokens: defaultTokens,
  contentArea: { x: 60, y: 60, width: 960, height: 1320 },
  root: {
    type: 'container',
    direction: 'column',
    padding: 60,
    width: 1080,
    height: 1440,
    children: [
      { type: 'slot', name: 'title' },
      { type: 'slot', name: 'body' },
    ],
  },
}

const blocks: ContentBlock[] = [
  { type: 'heroTitle', title: '今日份灵感' },
  { type: 'paragraph', spans: [{ text: '每天进步一点点' }] },
]

describe('applyTemplate', () => {
  test('produces LayoutSpec with no SlotNode', () => {
    const spec = applyTemplate(blocks, mockTemplate)
    const hasSlot = JSON.stringify(spec).includes('"type":"slot"')
    expect(hasSlot).toBe(false)
  })

  test('title slot → text node with h1 font', () => {
    const spec = applyTemplate(blocks, mockTemplate)
    expect(spec.type).toBe('container')
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>
    const titleNode = container.children[0]
    expect(titleNode?.type).toBe('text')
    if (titleNode?.type === 'text') {
      expect(titleNode.spans[0]?.text).toBe('今日份灵感')
      expect(titleNode.font).toContain('bold')
    }
  })

  test('body slot → text nodes from paragraphs', () => {
    const spec = applyTemplate(blocks, mockTemplate)
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>
    const bodyNode = container.children[1]
    expect(bodyNode?.type).toBe('text')
    if (bodyNode?.type === 'text') {
      expect(bodyNode.spans[0]?.text).toBe('每天进步一点点')
    }
  })

  test('rules are executed and can mutate spec', () => {
    const template: Template = {
      ...mockTemplate,
      rules: [
        ctx => {
          // If title is short, set a flag via mutate (no-op here, just test it runs)
          ctx.mutate('root.children.0.color', '#ff0000')
        },
      ],
    }
    // Should not throw
    expect(() => applyTemplate(blocks, template)).not.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/template/engine.test.ts
```

Expected: `Cannot find module '../../src/template/engine'`

- [ ] **Step 3: 实现**

```typescript
// src/template/engine.ts
import type {
  ContentBlock, Template, LayoutSpec, LayoutSpecNode,
  TemplateNode, SlotNode, Span, RuleContext,
} from '../types'

// ─── Slot resolver ───────────────────────────────────────────────────────

function resolveSlot(name: string, blocks: ContentBlock[], tokens: Template['tokens']): LayoutSpecNode[] {
  switch (name) {
    case 'title': {
      const b = blocks.find(b => b.type === 'heroTitle' || b.type === 'heading')
      if (!b) return []
      const text = b.type === 'heroTitle' ? b.title : b.text
      return [{
        type: 'text',
        spans: [{ text }],
        font: tokens.typography.h1.font,
        lineHeight: tokens.typography.h1.lineHeight,
        color: tokens.colors.text,
      }]
    }
    case 'subtitle': {
      const hero = blocks.find(b => b.type === 'heroTitle')
      if (hero?.type === 'heroTitle' && hero.subtitle) {
        return [{
          type: 'text',
          spans: [{ text: hero.subtitle }],
          font: tokens.typography.h2.font,
          lineHeight: tokens.typography.h2.lineHeight,
          color: tokens.colors.subtext,
        }]
      }
      return []
    }
    case 'body': {
      return blocks
        .filter(b => b.type === 'paragraph')
        .map(b => {
          const para = b as Extract<ContentBlock, { type: 'paragraph' }>
          return {
            type: 'text' as const,
            spans: para.spans,
            font: tokens.typography.body.font,
            lineHeight: tokens.typography.body.lineHeight,
            color: tokens.colors.text,
          }
        })
    }
    case 'list': {
      const b = blocks.find(b => b.type === 'bulletList' || b.type === 'orderedList' || b.type === 'steps')
      if (!b || !('items' in b)) return []
      return b.items.map((item, i) => ({
        type: 'text' as const,
        spans: [{ text: `${b.type === 'orderedList' ? `${i + 1}.` : '•'} ${item}` }],
        font: tokens.typography.body.font,
        lineHeight: tokens.typography.body.lineHeight,
        color: tokens.colors.text,
      }))
    }
    case 'quote': {
      const b = blocks.find(b => b.type === 'quoteCard')
      if (!b || b.type !== 'quoteCard') return []
      return [{
        type: 'text' as const,
        spans: [{ text: b.text }],
        font: tokens.typography.body.font,
        lineHeight: tokens.typography.body.lineHeight,
        color: tokens.colors.text,
      }]
    }
    case 'cover-image': {
      const b = blocks.find(b => b.type === 'image')
      if (!b || b.type !== 'image') return []
      return [{ type: 'image' as const, src: b.src, width: 1080, height: 608 }]
    }
    case 'tags': {
      const b = blocks.find(b => b.type === 'tags')
      if (!b || b.type !== 'tags') return []
      return [{
        type: 'text' as const,
        spans: b.items.map(tag => ({ text: `#${tag} ` })),
        font: tokens.typography.caption.font,
        lineHeight: tokens.typography.caption.lineHeight,
        color: tokens.colors.primary,
      }]
    }
    default:
      return []
  }
}

// ─── Tree binder ─────────────────────────────────────────────────────────

function bindNode(node: TemplateNode, blocks: ContentBlock[], tokens: Template['tokens']): LayoutSpecNode[] {
  if (node.type === 'slot') {
    return resolveSlot((node as SlotNode).name, blocks, tokens)
  }
  if (node.type === 'container') {
    const boundChildren = node.children.flatMap(child => bindNode(child, blocks, tokens))
    return [{ ...node, children: boundChildren }]
  }
  return [node as LayoutSpecNode]
}

// ─── Mutate helper ───────────────────────────────────────────────────────

function applyMutate(root: LayoutSpecNode, path: string, value: unknown): void {
  const parts = path.split('.')
  // Only traverse known safe paths starting with 'root'
  if (parts[0] !== 'root') return
  let cur: Record<string, unknown> = root as unknown as Record<string, unknown>
  for (let i = 1; i < parts.length - 1; i++) {
    const key = parts[i]!
    const next = cur[key]
    if (Array.isArray(next) && parts[i + 1] !== undefined) {
      const idx = Number(parts[i + 1])
      if (!isNaN(idx)) {
        cur = (next as Record<string, unknown>[])[idx] ?? cur
        i++ // skip the index part
        continue
      }
    }
    if (typeof next === 'object' && next !== null) {
      cur = next as Record<string, unknown>
    } else {
      return
    }
  }
  const lastKey = parts[parts.length - 1]!
  cur[lastKey] = value
}

// ─── Public API ──────────────────────────────────────────────────────────

export function applyTemplate(blocks: ContentBlock[], template: Template): LayoutSpec {
  const boundNodes = bindNode(template.root, blocks, template.tokens)
  const root: LayoutSpecNode = boundNodes.length === 1 && boundNodes[0]!.type === 'container'
    ? boundNodes[0]!
    : {
        type: 'container',
        direction: 'column',
        width: template.size.width,
        height: template.size.height,
        children: boundNodes,
      }

  if (template.rules && template.rules.length > 0) {
    const ctx: RuleContext = {
      blocks,
      tokens: template.tokens,
      mutate: (path, value) => applyMutate(root, path, value),
    }
    for (const rule of template.rules) {
      rule(ctx)
    }
  }

  return root
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test tests/template/engine.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/template/engine.ts tests/template/engine.test.ts
git commit -m "feat: template engine — slot binding and rules"
```

---

### Task 7: Pretext 文本测量工具

**Files:**
- Create: `src/layout/measure-text.ts`
- Create: `tests/layout/measure-text.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/layout/measure-text.test.ts
import { test, expect, describe } from 'bun:test'
import { measureTextHeight, getTextLines } from '../../src/layout/measure-text'

describe('measureTextHeight', () => {
  test('single line text has height ≈ lineHeight', () => {
    const h = measureTextHeight('Hello', 'bold 40px sans-serif', 60, 1000)
    expect(h).toBeGreaterThanOrEqual(55)
    expect(h).toBeLessThanOrEqual(120)
  })

  test('wider text wraps to more lines', () => {
    const narrow = measureTextHeight('ABCDEF GHIJKL MNOPQR', 'bold 40px sans-serif', 60, 200)
    const wide   = measureTextHeight('ABCDEF GHIJKL MNOPQR', 'bold 40px sans-serif', 60, 2000)
    expect(narrow).toBeGreaterThan(wide)
  })

  test('empty string returns 0', () => {
    expect(measureTextHeight('', 'bold 40px sans-serif', 60, 500)).toBe(0)
  })
})

describe('getTextLines', () => {
  test('returns array of lines', () => {
    const lines = getTextLines('Hello world', 'bold 40px sans-serif', 60, 500)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines[0]?.text).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/layout/measure-text.test.ts
```

Expected: `Cannot find module '../../src/layout/measure-text'`

- [ ] **Step 3: 实现**

```typescript
// src/layout/measure-text.ts
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import type { LayoutLine } from '@chenglou/pretext'

/**
 * Returns the rendered height of `text` at the given font and lineHeight,
 * constrained to `maxWidth` pixels.
 */
export function measureTextHeight(
  text: string,
  font: string,
  lineHeight: number,
  maxWidth: number,
): number {
  if (!text.trim()) return 0
  const prepared = prepareWithSegments(text, font)
  const result = layoutWithLines(prepared, maxWidth, lineHeight)
  return result.height
}

/**
 * Returns the laid-out lines for `text` at the given font, lineHeight, and maxWidth.
 */
export function getTextLines(
  text: string,
  font: string,
  lineHeight: number,
  maxWidth: number,
): LayoutLine[] {
  if (!text.trim()) return []
  const prepared = prepareWithSegments(text, font)
  const result = layoutWithLines(prepared, maxWidth, lineHeight)
  return result.lines
}

/**
 * Concatenates all spans into a single string for Textura measurement.
 * Uses the first span's font if available, otherwise falls back to provided font.
 */
export function spansToPlainText(spans: Array<{ text: string }>): string {
  return spans.map(s => s.text).join('')
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test tests/layout/measure-text.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/layout/measure-text.ts tests/layout/measure-text.test.ts
git commit -m "feat: pretext text measurement utilities"
```

---

### Task 8: Layout Engine — Textura 封装

**Files:**
- Create: `src/layout/engine.ts`
- Create: `src/layout/preload-images.ts`
- Create: `tests/layout/engine.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/layout/engine.test.ts
import { test, expect, describe, beforeAll } from 'bun:test'
import { computeLayoutBoxes, initLayoutEngine } from '../../src/layout/engine'
import type { LayoutSpec, LayoutBox } from '../../src/types'

beforeAll(async () => {
  await initLayoutEngine()
})

describe('computeLayoutBoxes', () => {
  test('rect node gets correct absolute position', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 400,
      height: 600,
      children: [
        { type: 'rect', width: 400, height: 100, fill: { type: 'color', value: '#ff0000' } },
      ],
    }
    const boxes = await computeLayoutBoxes(spec, { width: 400, height: 600 })
    const rectBox = boxes.find(b => b.kind === 'rect' && b.fill?.type === 'color')
    expect(rectBox).toBeDefined()
    expect(rectBox!.width).toBe(400)
    expect(rectBox!.height).toBe(100)
    expect(rectBox!.x).toBe(0)
    expect(rectBox!.y).toBe(0)
  })

  test('two rects in column are stacked vertically', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 400,
      height: 600,
      children: [
        { type: 'rect', width: 400, height: 100, fill: { type: 'color', value: '#ff0000' } },
        { type: 'rect', width: 400, height: 200, fill: { type: 'color', value: '#00ff00' } },
      ],
    }
    const boxes = await computeLayoutBoxes(spec, { width: 400, height: 600 })
    const rects = boxes.filter(b => b.kind === 'rect')
    expect(rects).toHaveLength(2)
    expect(rects[0]!.y).toBe(0)
    expect(rects[1]!.y).toBe(100)
  })

  test('text node produces LayoutBox with lines', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 500,
      height: 800,
      children: [
        {
          type: 'text',
          spans: [{ text: 'Hello world' }],
          font: 'bold 40px sans-serif',
          lineHeight: 56,
          color: '#000000',
        },
      ],
    }
    const boxes = await computeLayoutBoxes(spec, { width: 500, height: 800 })
    const textBox = boxes.find(b => b.kind === 'text')
    expect(textBox).toBeDefined()
    expect(textBox!.lines).toBeDefined()
    expect(textBox!.lines!.length).toBeGreaterThan(0)
  })

  test('padding on container offsets children', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 400,
      height: 600,
      padding: 40,
      children: [
        { type: 'rect', width: 'fill', height: 100, fill: { type: 'color', value: '#red' } },
      ],
    }
    const boxes = await computeLayoutBoxes(spec, { width: 400, height: 600 })
    const rectBox = boxes.find(b => b.kind === 'rect')
    expect(rectBox).toBeDefined()
    expect(rectBox!.x).toBe(40)
    expect(rectBox!.y).toBe(40)
    expect(rectBox!.width).toBe(320) // 400 - 2*40
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/layout/engine.test.ts
```

Expected: `Cannot find module '../../src/layout/engine'`

- [ ] **Step 3: 实现 `src/layout/preload-images.ts`**

```typescript
// src/layout/preload-images.ts

/**
 * Preloads an image for use in CanvasRenderer.
 * Returns the @napi-rs/canvas Image object, or a base64 data URL for SVG/HTML.
 */
export async function preloadImageForCanvas(src: string): Promise<unknown> {
  // Dynamic import to avoid errors in environments without @napi-rs/canvas
  const { Image } = await import('@napi-rs/canvas')
  const img = new Image()
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const resp = await fetch(src)
    const buf = Buffer.from(await resp.arrayBuffer())
    img.src = buf
  } else {
    img.src = await Bun.file(src).arrayBuffer().then(b => Buffer.from(b))
  }
  return img
}

export async function preloadImageForSvg(src: string): Promise<string> {
  if (src.startsWith('data:')) return src
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const resp = await fetch(src)
    const buf = Buffer.from(await resp.arrayBuffer())
    const mime = resp.headers.get('content-type') ?? 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  }
  const buf = Buffer.from(await Bun.file(src).arrayBuffer())
  const ext = src.split('.').pop()?.toLowerCase() ?? 'png'
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
  return `data:${mime};base64,${buf.toString('base64')}`
}
```

- [ ] **Step 4: 实现 `src/layout/engine.ts`**

```typescript
// src/layout/engine.ts
import { init, computeLayout } from 'textura'
import type { BoxNode, TextNode, LayoutNode, ComputedLayout } from 'textura'
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import type { LayoutSpec, LayoutSpecNode, LayoutBox, TextLine } from '../types'
import { spansToPlainText } from './measure-text'

let _initialized = false

export async function initLayoutEngine(): Promise<void> {
  if (!_initialized) {
    await init()
    _initialized = true
  }
}

// ─── LayoutSpec → Textura LayoutNode ─────────────────────────────────────

function specToTextura(node: LayoutSpecNode): LayoutNode {
  const padding = typeof node.type !== 'string' ? 0 :
    node.type === 'container' && node.padding
      ? (typeof node.padding === 'number' ? node.padding : undefined)
      : undefined

  const paddingInset = node.type === 'container' && typeof node.padding === 'object' && node.padding
    ? node.padding
    : null

  switch (node.type) {
    case 'container': {
      const box: BoxNode = {
        flexDirection: node.direction === 'row' ? 'row' : 'column',
        width:  node.width === 'fill' ? undefined : (node.width ?? 'auto'),
        height: node.height === 'fill' ? undefined : node.height === 'hug' ? undefined : (node.height ?? 'auto'),
        ...(node.width === 'fill' ? { flexGrow: 1 } : {}),
        ...(node.height === 'fill' ? { flexGrow: 1 } : {}),
        gap:  node.gap,
        alignItems:     node.align === 'start'  ? 'flex-start'
                      : node.align === 'end'    ? 'flex-end'
                      : node.align === 'center' ? 'center'
                      : node.align === 'stretch'? 'stretch'
                      : undefined,
        justifyContent: node.justify === 'start'         ? 'flex-start'
                      : node.justify === 'end'           ? 'flex-end'
                      : node.justify === 'center'        ? 'center'
                      : node.justify === 'space-between' ? 'space-between'
                      : undefined,
        position: node.position === 'absolute' ? 'absolute' : undefined,
        left: node.position === 'absolute' ? node.x : undefined,
        top:  node.position === 'absolute' ? node.y : undefined,
        ...(padding != null ? { padding } : {}),
        ...(paddingInset ? {
          paddingTop:    paddingInset.top,
          paddingRight:  paddingInset.right,
          paddingBottom: paddingInset.bottom,
          paddingLeft:   paddingInset.left,
        } : {}),
        overflow: 'hidden',
        children: node.children.map(specToTextura),
      }
      return box
    }
    case 'text': {
      const plainText = spansToPlainText(node.spans)
      const textNode: TextNode = {
        text: plainText,
        font: node.font,
        lineHeight: node.lineHeight,
        flexGrow: 0,
        flexShrink: 0,
        width: 'auto',
      }
      return textNode
    }
    case 'image': {
      const box: BoxNode = {
        width:  node.width,
        height: node.height,
        flexShrink: 0,
      }
      return box
    }
    case 'rect': {
      const box: BoxNode = {
        width:  node.width === 'fill' ? undefined : (node.width === 'hug' ? undefined : node.width),
        height: node.height === 'fill' ? undefined : (node.height === 'hug' ? undefined : node.height),
        ...(node.width === 'fill' ? { flexGrow: 1 } : {}),
        flexShrink: 0,
      }
      return box
    }
  }
}

// ─── ComputedLayout + LayoutSpec → LayoutBox[] ────────────────────────────

let _idCounter = 0
function nextId(): string { return `box-${++_idCounter}` }

function walkTree(
  spec: LayoutSpecNode,
  computed: ComputedLayout,
  parentX: number,
  parentY: number,
): LayoutBox[] {
  const absX = parentX + computed.x
  const absY = parentY + computed.y
  const boxes: LayoutBox[] = []

  switch (spec.type) {
    case 'container': {
      // Background rect
      if (spec.background) {
        boxes.push({
          id: nextId(), kind: 'rect',
          x: absX, y: absY,
          width: computed.width, height: computed.height,
          fill: spec.background,
        })
      }
      // Children
      for (let i = 0; i < spec.children.length; i++) {
        const child     = spec.children[i]!
        const childComp = computed.children[i]!
        boxes.push(...walkTree(child, childComp, absX, absY))
      }
      break
    }
    case 'text': {
      // Get actual lines via Pretext using computed width
      const plainText = spansToPlainText(spec.spans)
      const lines: TextLine[] = []
      if (plainText.trim()) {
        const prepared = prepareWithSegments(plainText, spec.font)
        const result = layoutWithLines(prepared, computed.width, spec.lineHeight)
        let lineY = 0
        for (const line of result.lines) {
          lines.push({
            y:      lineY,
            height: spec.lineHeight,
            spans:  [{ text: line.text, font: spec.font, color: spec.color, x: 0 }],
          })
          lineY += spec.lineHeight
        }
      }
      boxes.push({
        id: nextId(), kind: 'text',
        x: absX, y: absY,
        width: computed.width, height: computed.height,
        lines,
        textAlign: spec.align,
      })
      break
    }
    case 'image': {
      boxes.push({
        id: nextId(), kind: 'image',
        x: absX, y: absY,
        width: computed.width, height: computed.height,
        src: spec.src,
        fit: spec.fit,
        borderRadius: spec.borderRadius,
      })
      break
    }
    case 'rect': {
      boxes.push({
        id: nextId(), kind: 'rect',
        x: absX, y: absY,
        width: computed.width, height: computed.height,
        fill: spec.fill,
        borderRadius: spec.borderRadius,
        shadow: spec.shadow,
      })
      break
    }
  }

  return boxes
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function computeLayoutBoxes(
  spec: LayoutSpec,
  size: { width: number; height: number },
): Promise<LayoutBox[]> {
  await initLayoutEngine()
  _idCounter = 0

  const tree = specToTextura(spec)
  const computed = computeLayout(tree, { width: size.width, height: size.height })
  return walkTree(spec, computed, 0, 0)
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
bun test tests/layout/engine.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 6: Commit**

```bash
git add src/layout/engine.ts src/layout/preload-images.ts tests/layout/engine.test.ts
git commit -m "feat: layout engine — Textura + Pretext bridge"
```

---

### Task 9: CanvasRenderer

**Files:**
- Create: `src/renderer/canvas.ts`

（Canvas 渲染涉及像素输出，不做单元测试，由 smoke test 验证）

- [ ] **Step 1: 实现**

```typescript
// src/renderer/canvas.ts
import { createCanvas } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import type { LayoutBox, RenderOptions, RenderOutput, ResolvedPaint, Shadow } from '../types'
import { preloadImageForCanvas } from '../layout/preload-images'

type Ctx = SKRSContext2D

async function preloadImages(boxes: LayoutBox[]): Promise<void> {
  const tasks: Promise<void>[] = []
  function walk(box: LayoutBox) {
    if (box.kind === 'image' && box.src && box.loadedImage == null) {
      tasks.push(
        preloadImageForCanvas(box.src).then(img => { box.loadedImage = img })
      )
    }
    box.children?.forEach(walk)
  }
  boxes.forEach(walk)
  await Promise.all(tasks)
}

function applyPaint(ctx: Ctx, paint: ResolvedPaint, x: number, y: number, w: number, h: number): void {
  if (paint.type === 'color') {
    ctx.fillStyle = paint.value
  } else if (paint.type === 'linear-gradient') {
    const angle = (paint.angle - 90) * (Math.PI / 180)
    const grd = ctx.createLinearGradient(
      x + w / 2 - Math.cos(angle) * w / 2,
      y + h / 2 - Math.sin(angle) * h / 2,
      x + w / 2 + Math.cos(angle) * w / 2,
      y + h / 2 + Math.sin(angle) * h / 2,
    )
    for (const stop of paint.stops) {
      grd.addColorStop(stop.offset, stop.color)
    }
    ctx.fillStyle = grd
  } else {
    ctx.fillStyle = '#cccccc'
  }
}

function drawShadow(ctx: Ctx, shadow: Shadow): void {
  ctx.shadowOffsetX = shadow.x
  ctx.shadowOffsetY = shadow.y
  ctx.shadowBlur    = shadow.blur
  ctx.shadowColor   = shadow.color
}

function clearShadow(ctx: Ctx): void {
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.shadowBlur    = 0
  ctx.shadowColor   = 'transparent'
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

function drawBox(ctx: Ctx, box: LayoutBox): void {
  const { x, y, width: w, height: h } = box

  switch (box.kind) {
    case 'rect': {
      if (!box.fill) break
      if (box.shadow) drawShadow(ctx, box.shadow)
      applyPaint(ctx, box.fill, x, y, w, h)
      if (box.borderRadius && box.borderRadius > 0) {
        roundedRect(ctx, x, y, w, h, box.borderRadius)
        ctx.fill()
      } else {
        ctx.fillRect(x, y, w, h)
      }
      if (box.shadow) clearShadow(ctx)
      break
    }
    case 'text': {
      if (!box.lines) break
      ctx.save()
      ctx.rect(x, y, w, h)
      ctx.clip()
      for (const line of box.lines) {
        for (const span of line.spans) {
          ctx.font      = span.font
          ctx.fillStyle = span.color
          ctx.textBaseline = 'top'
          const textX = box.textAlign === 'center' ? x + (w - ctx.measureText(span.text).width) / 2
                      : box.textAlign === 'right'  ? x + w - ctx.measureText(span.text).width
                      : x + span.x
          ctx.fillText(span.text, textX, y + line.y)
        }
      }
      ctx.restore()
      break
    }
    case 'image': {
      if (!box.loadedImage) break
      ctx.save()
      if (box.borderRadius && box.borderRadius > 0) {
        roundedRect(ctx, x, y, w, h, box.borderRadius)
        ctx.clip()
      }
      // Draw with cover/contain fit
      const img = box.loadedImage as { width: number; height: number }
      const iw = img.width, ih = img.height
      if (box.fit === 'contain') {
        const scale = Math.min(w / iw, h / ih)
        const dw = iw * scale, dh = ih * scale
        ctx.drawImage(box.loadedImage as Parameters<Ctx['drawImage']>[0],
          x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
      } else {
        // cover (default)
        const scale = Math.max(w / iw, h / ih)
        const dw = iw * scale, dh = ih * scale
        ctx.drawImage(box.loadedImage as Parameters<Ctx['drawImage']>[0],
          x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
      }
      ctx.restore()
      break
    }
    case 'group': {
      box.children?.forEach(child => drawBox(ctx, child))
      break
    }
  }
}

export async function renderPageCanvas(
  boxes: LayoutBox[],
  size: { width: number; height: number },
  options: RenderOptions = {},
): Promise<RenderOutput> {
  await preloadImages(boxes)

  const canvas = createCanvas(size.width, size.height)
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size.width, size.height)

  const sorted = [...boxes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  for (const box of sorted) drawBox(ctx, box)

  const fmt = options.format ?? 'png'
  if (fmt === 'jpeg') {
    const data = await canvas.encode('jpeg', Math.round((options.quality ?? 0.9) * 100))
    return { format: 'jpeg', data }
  }
  const data = await canvas.encode('png')
  return { format: 'png', data }
}
```

- [ ] **Step 2: 类型检查通过**

```bash
bun run typecheck
```

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/canvas.ts
git commit -m "feat: CanvasRenderer"
```

---

### Task 10: SvgRenderer

**Files:**
- Create: `src/renderer/svg.ts`
- Create: `tests/renderer/svg.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/renderer/svg.test.ts
import { test, expect, describe } from 'bun:test'
import { renderPageSvg } from '../../src/renderer/svg'
import type { LayoutBox } from '../../src/types'

describe('renderPageSvg', () => {
  test('outputs valid SVG root element', async () => {
    const boxes: LayoutBox[] = []
    const result = await renderPageSvg(boxes, { width: 400, height: 600 })
    expect(result.format).toBe('svg')
    expect(result.data).toMatch(/^<svg /)
    expect(result.data).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(result.data).toContain('width="400"')
    expect(result.data).toContain('height="600"')
    expect(result.data).toContain('</svg>')
  })

  test('rect box → <rect> element', async () => {
    const boxes: LayoutBox[] = [{
      id: '1', kind: 'rect',
      x: 10, y: 20, width: 100, height: 50,
      fill: { type: 'color', value: '#ff0000' },
    }]
    const result = await renderPageSvg(boxes, { width: 400, height: 600 })
    expect(result.data).toContain('<rect')
    expect(result.data).toContain('x="10"')
    expect(result.data).toContain('y="20"')
    expect(result.data).toContain('fill="#ff0000"')
  })

  test('text box → <text> element with <tspan>', async () => {
    const boxes: LayoutBox[] = [{
      id: '2', kind: 'text',
      x: 0, y: 0, width: 300, height: 60,
      lines: [{
        y: 0, height: 56,
        spans: [{ text: 'Hello', font: 'bold 40px sans-serif', color: '#000', x: 0 }],
      }],
    }]
    const result = await renderPageSvg(boxes, { width: 400, height: 600 })
    expect(result.data).toContain('<text')
    expect(result.data).toContain('Hello')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/renderer/svg.test.ts
```

- [ ] **Step 3: 实现**

```typescript
// src/renderer/svg.ts
import type { LayoutBox, ResolvedPaint, RenderOutput } from '../types'

let _defCounter = 0

function paintToSvgFill(paint: ResolvedPaint, id: string): { fill: string; def?: string } {
  if (paint.type === 'color') return { fill: paint.value }
  if (paint.type === 'linear-gradient') {
    const gradId = `grad-${id}`
    const angle = paint.angle
    const rad = (angle - 90) * (Math.PI / 180)
    const x1 = 50 - Math.cos(rad) * 50
    const y1 = 50 - Math.sin(rad) * 50
    const x2 = 50 + Math.cos(rad) * 50
    const y2 = 50 + Math.sin(rad) * 50
    const stops = paint.stops.map(s =>
      `<stop offset="${s.offset}" stop-color="${s.color}"/>`
    ).join('')
    const def = `<linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`
    return { fill: `url(#${gradId})`, def }
  }
  return { fill: '#cccccc' }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function boxToSvg(box: LayoutBox, defs: string[]): string {
  const { x, y, width: w, height: h } = box

  switch (box.kind) {
    case 'rect': {
      if (!box.fill) return ''
      const { fill, def } = paintToSvgFill(box.fill, `${++_defCounter}`)
      if (def) defs.push(def)
      const r = box.borderRadius ? ` rx="${box.borderRadius}"` : ''
      const shadow = box.shadow
        ? ` filter="drop-shadow(${box.shadow.x}px ${box.shadow.y}px ${box.shadow.blur}px ${box.shadow.color})"`
        : ''
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${r} fill="${fill}"${shadow}/>`
    }
    case 'text': {
      if (!box.lines || box.lines.length === 0) return ''
      const parts: string[] = []
      for (const line of box.lines) {
        const lineY = y + line.y + line.height * 0.8 // approximate baseline
        for (const span of line.spans) {
          const tspanX = box.textAlign === 'center' ? x + w / 2
                       : box.textAlign === 'right'  ? x + w
                       : x + span.x
          const anchor = box.textAlign === 'center' ? ' text-anchor="middle"'
                       : box.textAlign === 'right'  ? ' text-anchor="end"'
                       : ''
          parts.push(
            `<text x="${tspanX}" y="${lineY}" font="${escapeXml(span.font)}" fill="${span.color}"${anchor}>`
            + `<tspan>${escapeXml(span.text)}</tspan></text>`
          )
        }
      }
      return parts.join('\n')
    }
    case 'image': {
      if (!box.src) return ''
      const src = (box.loadedImage as string | undefined) ?? box.src
      const r = box.borderRadius ? ` rx="${box.borderRadius}"` : ''
      return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(src)}"${r} preserveAspectRatio="${box.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}"/>`
    }
    case 'group': {
      const children = (box.children ?? []).map(c => boxToSvg(c, defs)).join('\n')
      return `<g transform="translate(${x},${y})">${children}</g>`
    }
  }
  return ''
}

export async function renderPageSvg(
  boxes: LayoutBox[],
  size: { width: number; height: number },
): Promise<RenderOutput> {
  _defCounter = 0
  const defs: string[] = []
  const sorted = [...boxes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  const body = sorted.map(b => boxToSvg(b, defs)).join('\n')
  const defsBlock = defs.length > 0 ? `<defs>${defs.join('')}</defs>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">\n${defsBlock}\n${body}\n</svg>`
  return { format: 'svg', data: svg }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test tests/renderer/svg.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/svg.ts tests/renderer/svg.test.ts
git commit -m "feat: SvgRenderer"
```

---

### Task 11: HtmlRenderer

**Files:**
- Create: `src/renderer/html.ts`
- Create: `tests/renderer/html.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/renderer/html.test.ts
import { test, expect, describe } from 'bun:test'
import { renderPageHtml } from '../../src/renderer/html'
import type { LayoutBox } from '../../src/types'

describe('renderPageHtml', () => {
  test('outputs div with correct dimensions', async () => {
    const result = await renderPageHtml([], { width: 400, height: 600 })
    expect(result.format).toBe('html')
    expect(result.data).toContain('width:400px')
    expect(result.data).toContain('height:600px')
  })

  test('rect box → div with background-color', async () => {
    const boxes: LayoutBox[] = [{
      id: '1', kind: 'rect',
      x: 10, y: 20, width: 100, height: 50,
      fill: { type: 'color', value: '#ff0000' },
    }]
    const result = await renderPageHtml(boxes, { width: 400, height: 600 })
    expect(result.data).toContain('background-color:#ff0000')
    expect(result.data).toContain('left:10px')
    expect(result.data).toContain('top:20px')
  })

  test('text box → div with span elements', async () => {
    const boxes: LayoutBox[] = [{
      id: '2', kind: 'text',
      x: 0, y: 0, width: 300, height: 60,
      lines: [{
        y: 0, height: 56,
        spans: [{ text: 'Hello', font: 'bold 40px sans-serif', color: '#000', x: 0 }],
      }],
    }]
    const result = await renderPageHtml(boxes, { width: 400, height: 600 })
    expect(result.data).toContain('Hello')
    expect(result.data).toContain('<span')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/renderer/html.test.ts
```

- [ ] **Step 3: 实现**

```typescript
// src/renderer/html.ts
import type { LayoutBox, ResolvedPaint, RenderOutput } from '../types'

function paintToCss(paint: ResolvedPaint): string {
  if (paint.type === 'color') return `background-color:${paint.value}`
  if (paint.type === 'linear-gradient') {
    const stops = paint.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')
    return `background:linear-gradient(${paint.angle}deg, ${stops})`
  }
  return 'background-color:#cccccc'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function boxToHtml(box: LayoutBox): string {
  const { x, y, width: w, height: h } = box
  const base = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:hidden;`

  switch (box.kind) {
    case 'rect': {
      if (!box.fill) return ''
      const bg = paintToCss(box.fill)
      const r = box.borderRadius ? `border-radius:${box.borderRadius}px;` : ''
      const shadow = box.shadow
        ? `box-shadow:${box.shadow.x}px ${box.shadow.y}px ${box.shadow.blur}px ${box.shadow.color};`
        : ''
      return `<div style="${base}${bg};${r}${shadow}"></div>`
    }
    case 'text': {
      if (!box.lines || box.lines.length === 0) return ''
      const textAlign = box.textAlign ? `text-align:${box.textAlign};` : ''
      const linesHtml = box.lines.map(line => {
        const spansHtml = line.spans.map(span =>
          `<span style="font:${span.font};color:${span.color}">${escapeHtml(span.text)}</span>`
        ).join('')
        return `<div style="position:absolute;top:${line.y}px;left:0;width:100%;height:${line.height}px;white-space:nowrap;">${spansHtml}</div>`
      }).join('')
      return `<div style="${base}${textAlign}">${linesHtml}</div>`
    }
    case 'image': {
      const src = (box.loadedImage as string | undefined) ?? box.src ?? ''
      const fit = box.fit ?? 'cover'
      const r = box.borderRadius ? `border-radius:${box.borderRadius}px;` : ''
      return `<div style="${base}${r}"><img src="${escapeHtml(src)}" style="width:100%;height:100%;object-fit:${fit}"/></div>`
    }
    case 'group': {
      const children = (box.children ?? []).map(boxToHtml).join('')
      return `<div style="${base}">${children}</div>`
    }
  }
  return ''
}

export async function renderPageHtml(
  boxes: LayoutBox[],
  size: { width: number; height: number },
): Promise<RenderOutput> {
  const sorted = [...boxes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  const body = sorted.map(boxToHtml).join('\n')
  const html = `<div style="position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:#fff">\n${body}\n</div>`
  return { format: 'html', data: html }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test tests/renderer/html.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/html.ts tests/renderer/html.test.ts
git commit -m "feat: HtmlRenderer"
```

---

### Task 12: Pipeline + 公共 API

**Files:**
- Create: `src/pipeline/render-one.ts`
- Create: `src/index.ts`

- [ ] **Step 1: 实现 Pipeline**

```typescript
// src/pipeline/render-one.ts
import type { ContentBlock, TemplateFamily, RenderOptions, RenderOutput, LayoutBox } from '../types'
import { parseMarkdown } from '../content/parse-markdown'
import { parseJson } from '../content/parse-json'
import { applyTemplate } from '../template/engine'
import { computeLayoutBoxes } from '../layout/engine'
import { renderPageCanvas } from '../renderer/canvas'
import { renderPageSvg } from '../renderer/svg'
import { renderPageHtml } from '../renderer/html'

async function renderBoxes(
  boxes: LayoutBox[],
  size: { width: number; height: number },
  options: RenderOptions,
): Promise<RenderOutput> {
  const backend = options.renderer ?? 'canvas'
  if (backend === 'svg')  return renderPageSvg(boxes, size)
  if (backend === 'html') return renderPageHtml(boxes, size)
  return renderPageCanvas(boxes, size, options)
}

export async function renderContent(
  blocks: ContentBlock[],
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  // Phase 1: single page — use content template only
  const template = family.content
  const spec  = applyTemplate(blocks, template)
  const boxes = await computeLayoutBoxes(spec, template.size)
  const page  = await renderBoxes(boxes, template.size, options)
  return [page]
}

export async function renderMarkdown(
  markdown: string,
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const blocks = parseMarkdown(markdown)
  return renderContent(blocks, family, options)
}

export async function renderJson(
  raw: unknown,
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const blocks = parseJson(raw)
  return renderContent(blocks, family, options)
}
```

- [ ] **Step 2: 实现 registerFont 和公共 API**

```typescript
// src/setup.ts
import { GlobalFonts } from '@napi-rs/canvas'

export function registerFont(path: string, family: string): void {
  GlobalFonts.registerFromPath(path, family)
}
```

```typescript
// src/index.ts
// Phase 1: paginateContent / selectTemplates 尚未创建，注释保留到 Phase 2 解注释
export { renderMarkdown, renderContent, renderJson } from './pipeline/render-one'
export { parseMarkdown } from './content/parse-markdown'
export { parseJson } from './content/parse-json'
export { applyTemplate } from './template/engine'
export { computeLayoutBoxes, initLayoutEngine } from './layout/engine'
export { registerFont } from './setup'
export { defaultTokens, makeTokens } from './templates/tokens/default'
// export { paginateContent } from './template/paginator'   // 解注释于 Task 15
// export { selectTemplates } from './template/selector'    // 解注释于 Task 16
export type {
  ContentBlock, Span, DesignTokens, Template, TemplateFamily,
  LayoutSpec, LayoutSpecNode, LayoutBox, TextLine,
  ResolvedPaint, Shadow, RenderOptions, RenderOutput, IRenderer,
} from './types'
```

- [ ] **Step 3: 类型检查**

```bash
bun run typecheck
```

Expected: 只有 paginator/selector 的 "cannot find module" 错误（注释掉这两行后应无错误）。

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/render-one.ts src/index.ts
git commit -m "feat: pipeline and public API"
```

---

### Task 13: 最简文章模板

**Files:**
- Create: `src/templates/content/article.ts`

- [ ] **Step 1: 实现**

```typescript
// src/templates/content/article.ts
import type { Template } from '../../types'
import { defaultTokens } from '../tokens/default'

export function makeArticleTemplate(fontFamily: string = 'Heiti SC'): Template {
  const t = {
    ...defaultTokens,
    typography: {
      h1:      { font: `bold 52px ${fontFamily}`,  lineHeight: 72 },
      h2:      { font: `bold 38px ${fontFamily}`,  lineHeight: 54 },
      body:    { font: `28px ${fontFamily}`,        lineHeight: 44 },
      caption: { font: `22px ${fontFamily}`,        lineHeight: 34 },
      code:    { font: `24px monospace`,            lineHeight: 36 },
    },
  }

  return {
    id: 'content.article.basic',
    size: { width: 1080, height: 1440 },
    tokens: t,
    contentArea: { x: 72, y: 72, width: 936, height: 1296 },
    root: {
      type: 'container',
      direction: 'column',
      width: 1080,
      height: 1440,
      padding: 72,
      gap: 24,
      background: { type: 'color', value: t.colors.bg },
      children: [
        { type: 'slot', name: 'title' },
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          gap: 4,
          children: [{ type: 'slot', name: 'body' }],
        },
        { type: 'slot', name: 'tags' },
      ],
    },
  }
}

export const articleTemplate = makeArticleTemplate()
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/content/article.ts
git commit -m "feat: article content template"
```

---

### Task 14: 端到端 Smoke Test（Phase 1 完成验证）

**Files:**
- Create: `tests/smoke/render.test.ts`

- [ ] **Step 1: 写 Smoke Test**

```typescript
// tests/smoke/render.test.ts
import { test, expect, describe, beforeAll } from 'bun:test'
import { renderMarkdown, renderJson } from '../../src'
import { articleTemplate } from '../../src/templates/content/article'
import type { TemplateFamily } from '../../src/types'
import { writeFileSync, mkdirSync } from 'node:fs'

const family: TemplateFamily = { content: articleTemplate }

const MARKDOWN = `
# 今日份灵感

每一个清晨都是一次新的开始，让我们用**积极的心态**迎接每一天。

无论遇到多少困难，都要记住：*坚持就是胜利*。

## 今日金句

人生就是一场旅行，重要的不是目的地，而是沿途的风景。

---

保持微笑，温暖他人，也温暖自己。
`.trim()

describe('end-to-end render', () => {
  beforeAll(() => {
    mkdirSync('tests/smoke/output', { recursive: true })
  })

  test('renderMarkdown → PNG Buffer', async () => {
    const pages = await renderMarkdown(MARKDOWN, family, { renderer: 'canvas', format: 'png' })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.format).toBe('png')
    expect((pages[0] as { format: 'png'; data: Buffer }).data.byteLength).toBeGreaterThan(1000)
    writeFileSync('tests/smoke/output/article.png', (pages[0] as { data: Buffer }).data)
  })

  test('renderMarkdown → SVG string', async () => {
    const pages = await renderMarkdown(MARKDOWN, family, { renderer: 'svg' })
    expect(pages[0]!.format).toBe('svg')
    const svg = (pages[0] as { data: string }).data
    expect(svg).toContain('<svg')
    expect(svg).toContain('今日份灵感')
    writeFileSync('tests/smoke/output/article.svg', svg)
  })

  test('renderMarkdown → HTML string', async () => {
    const pages = await renderMarkdown(MARKDOWN, family, { renderer: 'html' })
    expect(pages[0]!.format).toBe('html')
    const html = (pages[0] as { data: string }).data
    expect(html).toContain('今日份灵感')
    writeFileSync('tests/smoke/output/article.html', html)
  })

  test('renderJson → PNG Buffer', async () => {
    const input = [
      { type: 'heroTitle', title: 'JSON 输入测试' },
      { type: 'paragraph', spans: [{ text: '直接传入 ContentBlock[] 也可以工作' }] },
    ]
    const pages = await renderJson(input, family, { renderer: 'canvas' })
    expect(pages[0]!.format).toBe('png')
    writeFileSync('tests/smoke/output/json-input.png', (pages[0] as { data: Buffer }).data)
  })
})
```

- [ ] **Step 2: 运行 Smoke Test**

```bash
bun test tests/smoke/render.test.ts
```

Expected: 4 tests PASS，`tests/smoke/output/` 下生成 `article.png`、`article.svg`、`article.html`、`json-input.png`。

目视检查：打开 `tests/smoke/output/article.png`，确认卡片排版正常。

- [ ] **Step 3: 更新 .gitignore，忽略 smoke 输出**

在 `.gitignore` 末尾添加：

```
tests/smoke/output/
```

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/render.test.ts .gitignore
git commit -m "test: phase 1 end-to-end smoke tests"
```

**🎉 Phase 1 完成。单页端到端渲染 (PNG/SVG/HTML) 全部跑通。**

---

## Phase 2：多页与模板系统

---

### Task 15: Content Paginator

**Files:**
- Create: `src/template/paginator.ts`
- Create: `tests/template/paginator.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/template/paginator.test.ts
import { test, expect, describe } from 'bun:test'
import { paginateContent } from '../../src/template/paginator'
import type { ContentBlock } from '../../src/types'
import { articleTemplate } from '../../src/templates/content/article'

const makeBlocks = (n: number): ContentBlock[] =>
  Array.from({ length: n }, (_, i) => ({
    type: 'paragraph' as const,
    spans: [{ text: `段落 ${i + 1}：这是一段足够长的文字，用于测试分页是否正确触发。每行文字都会占用一定高度。` }],
  }))

describe('paginateContent', () => {
  test('small content → single page', () => {
    const pages = paginateContent(makeBlocks(2), articleTemplate)
    expect(pages).toHaveLength(1)
  })

  test('large content → multiple pages', () => {
    const pages = paginateContent(makeBlocks(30), articleTemplate)
    expect(pages.length).toBeGreaterThan(1)
  })

  test('all blocks are preserved across pages', () => {
    const blocks = makeBlocks(20)
    const pages = paginateContent(blocks, articleTemplate)
    const allBlocks = pages.flat()
    expect(allBlocks).toHaveLength(blocks.length)
  })

  test('empty input → one empty page', () => {
    const pages = paginateContent([], articleTemplate)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/template/paginator.test.ts
```

- [ ] **Step 3: 实现**

```typescript
// src/template/paginator.ts
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import type { ContentBlock, Template, DesignTokens } from '../types'

const BUFFER = 0.85  // 保守系数，防止轻微溢出

function estimateBlockHeight(
  block: ContentBlock,
  availableWidth: number,
  tokens: DesignTokens,
): number {
  switch (block.type) {
    case 'heroTitle': {
      const h = measureText(block.title, tokens.typography.h1.font, tokens.typography.h1.lineHeight, availableWidth)
      const subH = block.subtitle
        ? measureText(block.subtitle, tokens.typography.h2.font, tokens.typography.h2.lineHeight, availableWidth)
        : 0
      return h + subH + tokens.spacing.sm
    }
    case 'heading': {
      const style = block.level === 1 ? tokens.typography.h1 : tokens.typography.h2
      return measureText(block.text, style.font, style.lineHeight, availableWidth) + tokens.spacing.xs
    }
    case 'paragraph': {
      const text = block.spans.map(s => s.text).join('')
      return measureText(text, tokens.typography.body.font, tokens.typography.body.lineHeight, availableWidth) + tokens.spacing.xs
    }
    case 'bulletList':
    case 'orderedList':
    case 'steps':
      return block.items.length * (tokens.typography.body.lineHeight + tokens.spacing.xs)
    case 'quoteCard': {
      return measureText(block.text, tokens.typography.body.font, tokens.typography.body.lineHeight, availableWidth)
        + tokens.spacing.md * 2
    }
    case 'metric':
      return tokens.typography.h1.lineHeight + tokens.typography.caption.lineHeight + tokens.spacing.sm
    case 'tags':
      return tokens.typography.caption.lineHeight + tokens.spacing.sm
    case 'image':
      return availableWidth * (9 / 16) // default 16:9
    case 'codeBlock': {
      const lines = block.code.split('\n').length
      return lines * tokens.typography.code.lineHeight + tokens.spacing.md
    }
    case 'divider':
      return tokens.spacing.md
    default:
      return tokens.typography.body.lineHeight
  }
}

function measureText(text: string, font: string, lineHeight: number, maxWidth: number): number {
  if (!text.trim()) return 0
  try {
    const prepared = prepareWithSegments(text, font)
    return layoutWithLines(prepared, maxWidth, lineHeight).height
  } catch {
    // Fallback: rough estimate
    const charsPerLine = Math.floor(maxWidth / (parseInt(font) || 28))
    const lines = Math.ceil(text.length / Math.max(charsPerLine, 1))
    return lines * lineHeight
  }
}

export function paginateContent(
  blocks: ContentBlock[],
  contentTemplate: Template,
): ContentBlock[][] {
  if (blocks.length === 0) return [[]]

  const { width, height } = contentTemplate.contentArea
  const threshold = height * BUFFER
  const { tokens } = contentTemplate

  const pages: ContentBlock[][] = []
  let current: ContentBlock[] = []
  let currentHeight = 0

  for (const block of blocks) {
    const h = estimateBlockHeight(block, width, tokens)
    if (currentHeight + h > threshold && current.length > 0) {
      pages.push(current)
      current = [block]
      currentHeight = h
    } else {
      current.push(block)
      currentHeight += h
    }
  }

  if (current.length > 0 || pages.length === 0) {
    pages.push(current)
  }

  return pages
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test tests/template/paginator.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/template/paginator.ts tests/template/paginator.test.ts
git commit -m "feat: content paginator with conservative height estimation"
```

---

### Task 16: Template Selector

**Files:**
- Create: `src/template/selector.ts`
- Create: `tests/template/selector.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/template/selector.test.ts
import { test, expect, describe } from 'bun:test'
import { selectTemplates } from '../../src/template/selector'
import type { ContentBlock, TemplateFamily, Template } from '../../src/types'
import { articleTemplate } from '../../src/templates/content/article'
import { defaultTokens } from '../../src/templates/tokens/default'

const makeTemplate = (id: string): Template => ({
  ...articleTemplate,
  id,
})

const blocks1: ContentBlock[] = [{ type: 'paragraph', spans: [{ text: 'Page 1' }] }]
const blocks2: ContentBlock[] = [{ type: 'paragraph', spans: [{ text: 'Page 2' }] }]
const blocks3: ContentBlock[] = [{ type: 'paragraph', spans: [{ text: 'Page 3' }] }]

describe('selectTemplates', () => {
  test('single page → content template', () => {
    const family: TemplateFamily = { content: makeTemplate('content') }
    const result = selectTemplates([[...blocks1]], family)
    expect(result).toHaveLength(1)
    expect(result[0]!.template.id).toBe('content')
  })

  test('first page uses cover when family.cover exists and has image block', () => {
    const family: TemplateFamily = {
      cover: makeTemplate('cover'),
      content: makeTemplate('content'),
    }
    const pagesWithImage: ContentBlock[][] = [
      [{ type: 'image', src: 'cover.jpg' }, ...blocks1],
      [...blocks2],
    ]
    const result = selectTemplates(pagesWithImage, family)
    expect(result[0]!.template.id).toBe('cover')
    expect(result[1]!.template.id).toBe('content')
  })

  test('last page uses ending template when provided', () => {
    const family: TemplateFamily = {
      content: makeTemplate('content'),
      ending: makeTemplate('ending'),
    }
    const result = selectTemplates([[...blocks1], [...blocks2], [...blocks3]], family)
    expect(result[0]!.template.id).toBe('content')
    expect(result[1]!.template.id).toBe('content')
    expect(result[2]!.template.id).toBe('ending')
  })

  test('single page with cover+ending → uses content (no single-page cover)', () => {
    const family: TemplateFamily = {
      cover: makeTemplate('cover'),
      content: makeTemplate('content'),
      ending: makeTemplate('ending'),
    }
    // Only one page, no image block → uses content
    const result = selectTemplates([[...blocks1]], family)
    expect(result[0]!.template.id).toBe('content')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test tests/template/selector.test.ts
```

- [ ] **Step 3: 实现**

```typescript
// src/template/selector.ts
import type { ContentBlock, Template, TemplateFamily } from '../types'

function hasImageBlock(blocks: ContentBlock[]): boolean {
  return blocks.some(b => b.type === 'image')
}

export function selectTemplates(
  pages: ContentBlock[][],
  family: TemplateFamily,
): Array<{ blocks: ContentBlock[]; template: Template }> {
  const n = pages.length
  return pages.map((blocks, i) => {
    let template: Template

    if (i === 0 && n > 1 && family.cover && hasImageBlock(blocks)) {
      template = family.cover
    } else if (i === n - 1 && n > 1 && family.ending) {
      template = family.ending
    } else {
      template = family.content
    }

    return { blocks, template }
  })
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test tests/template/selector.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: 在 `src/index.ts` 取消注释 selector 导出**

确保 `src/index.ts` 中的 `export { selectTemplates }` 行已取消注释。

- [ ] **Step 6: Commit**

```bash
git add src/template/selector.ts tests/template/selector.test.ts src/index.ts
git commit -m "feat: template selector for template families"
```

---

### Task 17: 多页 Pipeline

**Files:**
- Modify: `src/pipeline/render-one.ts`
- Add: `src/templates/cover/hero.ts`
- Add: `src/templates/ending/summary.ts`

- [ ] **Step 1: 升级 pipeline 支持多页**

将 `src/pipeline/render-one.ts` 的 `renderContent` 替换为：

```typescript
// src/pipeline/render-one.ts  (完整文件)
import type { ContentBlock, TemplateFamily, RenderOptions, RenderOutput, LayoutBox } from '../types'
import { parseMarkdown } from '../content/parse-markdown'
import { parseJson } from '../content/parse-json'
import { applyTemplate } from '../template/engine'
import { paginateContent } from '../template/paginator'
import { selectTemplates } from '../template/selector'
import { computeLayoutBoxes } from '../layout/engine'
import { renderPageCanvas } from '../renderer/canvas'
import { renderPageSvg } from '../renderer/svg'
import { renderPageHtml } from '../renderer/html'

async function renderBoxes(
  boxes: LayoutBox[],
  size: { width: number; height: number },
  options: RenderOptions,
): Promise<RenderOutput> {
  const backend = options.renderer ?? 'canvas'
  if (backend === 'svg')  return renderPageSvg(boxes, size)
  if (backend === 'html') return renderPageHtml(boxes, size)
  return renderPageCanvas(boxes, size, options)
}

export async function renderContent(
  blocks: ContentBlock[],
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const pages = paginateContent(blocks, family.content)
  const assignments = selectTemplates(pages, family)

  const outputs = await Promise.all(
    assignments.map(async ({ blocks: pageBlocks, template }) => {
      const spec  = applyTemplate(pageBlocks, template)
      const boxes = await computeLayoutBoxes(spec, template.size)
      return renderBoxes(boxes, template.size, options)
    })
  )

  return outputs
}

export async function renderMarkdown(
  markdown: string,
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  return renderContent(parseMarkdown(markdown), family, options)
}

export async function renderJson(
  raw: unknown,
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  return renderContent(parseJson(raw), family, options)
}
```

- [ ] **Step 2: 创建 cover 模板**

```typescript
// src/templates/cover/hero.ts
import type { Template } from '../../types'
import { defaultTokens } from '../tokens/default'

export function makeHeroTemplate(fontFamily: string = 'Heiti SC'): Template {
  const t = {
    ...defaultTokens,
    typography: {
      ...defaultTokens.typography,
      h1: { font: `bold 64px ${fontFamily}`, lineHeight: 88 },
      h2: { font: `bold 40px ${fontFamily}`, lineHeight: 56 },
      body:    { font: `28px ${fontFamily}`, lineHeight: 44 },
      caption: { font: `22px ${fontFamily}`, lineHeight: 34 },
      code:    { font: `24px monospace`,     lineHeight: 36 },
    },
  }
  return {
    id: 'cover.hero',
    size: { width: 1080, height: 1440 },
    tokens: t,
    contentArea: { x: 72, y: 800, width: 936, height: 560 },
    root: {
      type: 'container',
      direction: 'column',
      width: 1080,
      height: 1440,
      background: { type: 'color', value: t.colors.bg },
      children: [
        { type: 'slot', name: 'cover-image' },
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'fill',
          padding: 72,
          gap: 16,
          background: { type: 'color', value: t.colors.bg },
          children: [
            { type: 'slot', name: 'title' },
            { type: 'slot', name: 'subtitle' },
          ],
        },
      ],
    },
  }
}

export const heroTemplate = makeHeroTemplate()
```

- [ ] **Step 3: 创建 ending 模板**

```typescript
// src/templates/ending/summary.ts
import type { Template } from '../../types'
import { defaultTokens } from '../tokens/default'

export function makeSummaryTemplate(fontFamily: string = 'Heiti SC'): Template {
  const t = {
    ...defaultTokens,
    colors: { ...defaultTokens.colors, bg: '#fafafa' },
    typography: {
      h1:      { font: `bold 52px ${fontFamily}`,  lineHeight: 72 },
      h2:      { font: `bold 38px ${fontFamily}`,  lineHeight: 54 },
      body:    { font: `28px ${fontFamily}`,        lineHeight: 44 },
      caption: { font: `22px ${fontFamily}`,        lineHeight: 34 },
      code:    { font: `24px monospace`,            lineHeight: 36 },
    },
  }
  return {
    id: 'ending.summary',
    size: { width: 1080, height: 1440 },
    tokens: t,
    contentArea: { x: 72, y: 200, width: 936, height: 1040 },
    root: {
      type: 'container',
      direction: 'column',
      width: 1080,
      height: 1440,
      padding: 72,
      gap: 32,
      background: { type: 'color', value: t.colors.bg },
      children: [
        {
          type: 'text',
          spans: [{ text: '— END —' }],
          font: t.typography.caption.font,
          lineHeight: t.typography.caption.lineHeight,
          color: t.colors.subtext,
          align: 'center',
        },
        { type: 'slot', name: 'body' },
        { type: 'slot', name: 'tags' },
      ],
    },
  }
}

export const summaryTemplate = makeSummaryTemplate()
```

- [ ] **Step 4: 运行全量测试，确认全部通过**

```bash
bun test
```

Expected: 全部 PASS。

- [ ] **Step 5: 取消注释 `src/index.ts` 中的 paginator 导出**

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/render-one.ts src/templates/cover/hero.ts src/templates/ending/summary.ts src/index.ts
git commit -m "feat: multi-page pipeline with template selector and paginator"
```

---

### Task 18: 多页 Smoke Test

**Files:**
- Modify: `tests/smoke/render.test.ts`

- [ ] **Step 1: 添加多页测试**

在 `tests/smoke/render.test.ts` 中追加：

```typescript
import { heroTemplate } from '../../src/templates/cover/hero'
import { summaryTemplate } from '../../src/templates/ending/summary'

const LONG_MARKDOWN = Array.from({ length: 15 }, (_, i) =>
  `## 第 ${i + 1} 节\n\n这是第 ${i + 1} 节的内容，包含足够多的文字以测试自动分页功能。每节都有独立的主题和要点。`
).join('\n\n')

test('long content → multiple pages', async () => {
  const multiFamily: TemplateFamily = {
    content: articleTemplate,
    ending: summaryTemplate,
  }
  const pages = await renderMarkdown(LONG_MARKDOWN, multiFamily, { renderer: 'canvas' })
  expect(pages.length).toBeGreaterThan(1)
  pages.forEach((page, i) => {
    writeFileSync(
      `tests/smoke/output/multipage-${i + 1}.png`,
      (page as { data: Buffer }).data
    )
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
bun test tests/smoke/render.test.ts
```

Expected: 所有测试 PASS，`tests/smoke/output/` 下生成多个 `multipage-N.png`。

目视检查：内容确实分布在多页，最后一页使用 summary 模板（灰色背景 + "— END —"）。

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/render.test.ts
git commit -m "test: multi-page smoke test with template family"
```

**🎉 Phase 2 完成。多页渲染、模板族、分页器全部跑通。**

---

## Phase 3：生产强化（预留）

以下为后续计划，每项可单独开启实现：

- **Template Rules**：在 `src/template/engine.ts` 完善 `mutate()` 路径解析，覆盖更多节点类型
- **Batch render**：`src/pipeline/render-batch.ts`，并发渲染多份内容
- **Plugin renderer**：`src/renderer/plugins.ts`，允许注册自定义 `kind` 的绘制器
- **Paginator 精度调优**：提高 `estimateBlockHeight` 准确性，降低溢出率
- **SVG/HTML Renderer 完善**：支持渐变背景、图片 base64 内嵌

---

## 运行全量测试

```bash
bun test
```

Expected: 全部绿色。
