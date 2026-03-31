import { afterEach, beforeEach, expect, test } from 'bun:test'

import { parseMarkdown } from '../../../src/parser/parse-markdown'
import { layoutDocument } from '../../../src/layout/block/layout-document'
import { defaultTheme } from '../../../src/theme/default-theme'

class TestMeasureContext {
  font = '16px sans-serif'

  measureText(text: string): { width: number } {
    return { width: measureTextWidth(text, this.font) }
  }
}

class TestOffscreenCanvas {
  width: number
  height: number
  private readonly context: TestMeasureContext

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.context = new TestMeasureContext()
  }

  getContext(type: '2d'): TestMeasureContext | null {
    return type === '2d' ? this.context : null
  }
}

const originalOffscreenCanvas = (globalThis as typeof globalThis & { OffscreenCanvas?: unknown }).OffscreenCanvas

beforeEach(() => {
  ;(globalThis as typeof globalThis & { OffscreenCanvas?: typeof TestOffscreenCanvas }).OffscreenCanvas =
    TestOffscreenCanvas
})

afterEach(() => {
  ;(globalThis as typeof globalThis & { OffscreenCanvas?: unknown }).OffscreenCanvas = originalOffscreenCanvas
})

test('lays out block nodes into explicit fragment kinds with nested structure', () => {
  const document = parseMarkdown(`# Heading

Paragraph text that should produce line boxes.

- Bullet item
1. Ordered item
2. Second ordered item
- [x] Done task
- [ ] Todo task

\`\`\`ts
console.log('code')
line two
\`\`\`

| Left | Right |
| :--- | ----: |
| a | b |
`)

  const fragments = layoutDocument(document, defaultTheme)

  expect(fragments.map((fragment) => fragment.kind)).toEqual([
    'heading',
    'paragraph',
    'list',
    'list',
    'list',
    'code',
    'table',
  ])

  const heading = fragments[0]
  if (!heading || heading.kind !== 'heading') {
    throw new Error('Expected heading fragment')
  }

  expect(heading.depth).toBe(1)
  expect(heading.lines?.length).toBeGreaterThan(0)
  expect(heading.lines?.[0]?.runs.map((run) => run.text).join('')).toBe('Heading')

  const paragraph = fragments[1]
  if (!paragraph || paragraph.kind !== 'paragraph') {
    throw new Error('Expected paragraph fragment')
  }

  expect(paragraph.lines?.length).toBeGreaterThan(0)
  expect(paragraph.lines?.[0]?.runs.map((run) => run.text).join('')).toContain('Paragraph text')

  const bulletList = fragments[2]
  if (!bulletList || bulletList.kind !== 'list') {
    throw new Error('Expected bullet list fragment')
  }

  expect(bulletList.ordered).toBe(false)
  expect(bulletList.items).toHaveLength(1)
  expect(bulletList.items[0]?.marker.kind).toBe('bullet')
  expect(bulletList.items[0]?.children[0]?.kind).toBe('paragraph')
  expect(bulletList.items[0]?.children[0]?.lines?.[0]?.runs.map((run) => run.text).join('')).toBe('Bullet item')

  const orderedList = fragments[3]
  if (!orderedList || orderedList.kind !== 'list') {
    throw new Error('Expected ordered list fragment')
  }

  expect(orderedList.ordered).toBe(true)
  expect(orderedList.start).toBe(1)
  expect(orderedList.items.map((item) => item.marker.kind)).toEqual(['ordered', 'ordered'])
  expect(
    orderedList.items.map((item) => {
      if (item.marker.kind !== 'ordered') {
        throw new Error('Expected ordered marker')
      }

      return item.marker.ordinal
    }),
  ).toEqual([1, 2])

  const taskList = fragments[4]
  if (!taskList || taskList.kind !== 'list') {
    throw new Error('Expected task list fragment')
  }

  expect(taskList.items.map((item) => item.marker.kind)).toEqual(['task', 'task'])
  expect(
    taskList.items.map((item) => {
      if (item.marker.kind !== 'task') {
        throw new Error('Expected task marker')
      }

      return item.marker.checked
    }),
  ).toEqual([true, false])
  expect(
    taskList.items.every((item) => {
      const lastChild = item.children.at(-1)

      if (!lastChild) {
        return false
      }

      return item.box.y + item.box.height === lastChild.box.y + lastChild.box.height
    }),
  ).toBe(true)
  expect(taskList.items[1]?.box.y).toBe(
    (taskList.items[0]?.box.y ?? 0) +
      (taskList.items[0]?.box.height ?? 0) +
      defaultTheme.blocks.list.itemGap,
  )

  const code = fragments[5]
  if (!code || code.kind !== 'code') {
    throw new Error('Expected code fragment')
  }

  expect(code.lang).toBe('ts')
  expect(code.sourceLines).toEqual(["console.log('code')", 'line two'])
  expect(code.lines?.map((line) => line.runs.map((run) => run.text).join(''))).toEqual([
    "console.log('code')",
    'line two',
  ])

  const table = fragments[6]
  if (!table || table.kind !== 'table') {
    throw new Error('Expected table fragment')
  }

  expect(table.header.cells).toHaveLength(2)
  expect(table.rows).toHaveLength(1)
  expect(table.header.cells[0]?.lines?.[0]?.runs.map((run) => run.text).join('')).toBe('Left')
  expect(table.rows[0]?.cells[1]?.lines?.[0]?.runs.map((run) => run.text).join('')).toBe('b')
})

test('keeps table cell heights aligned with row height when cells wrap unevenly', () => {
  const document = parseMarkdown(`| Very long left column text that wraps | short |
| --- | --- |
| a | b |
`)

  const fragments = layoutDocument(document, defaultTheme)
  const table = fragments[0]

  if (!table || table.kind !== 'table') {
    throw new Error('Expected table fragment')
  }

  expect(table.header.cells.every((cell) => cell.box.height === table.header.box.height)).toBe(true)
  expect(table.rows.every((row) => row.cells.every((cell) => cell.box.height === row.box.height))).toBe(true)
  expect(table.header.cells[0]?.box.x).toBe(table.box.x)
  expect(table.header.cells[1]?.box.x).toBeGreaterThan(table.header.cells[0]?.box.x ?? 0)
  expect(table.header.cells[0]?.box.width).toBe(table.header.cells[1]?.box.width)
})

test('gives block images vertical space so following content does not overlap', () => {
  const document = parseMarkdown(`![Diagram](https://example.com/diagram.png "Caption")

Paragraph after image.
`)

  const fragments = layoutDocument(document, defaultTheme)
  const image = fragments[0]
  const paragraph = fragments[1]

  if (!image || image.kind !== 'image') {
    throw new Error('Expected image fragment')
  }

  if (!paragraph || paragraph.kind !== 'paragraph') {
    throw new Error('Expected paragraph fragment')
  }

  expect(image.box.height).toBeGreaterThan(0)
  expect(paragraph.box.y - (image.box.y + image.box.height)).toBe(defaultTheme.blocks.image.marginBottom)
})

test('wraps long code lines within the code block content width', () => {
  const document = parseMarkdown(`\`\`\`ts
renderMarkdown(markdown: string, options?: { format?: 'png' | 'svg'; painter?: CustomPainter; theme?: DefaultTheme })
\`\`\`
`)

  const fragments = layoutDocument(document, defaultTheme)
  const code = fragments[0]

  if (!code || code.kind !== 'code') {
    throw new Error('Expected code fragment')
  }

  expect(code.lines.length).toBeGreaterThan(1)
  expect(code.lines.every((line) => line.width <= code.box.width - defaultTheme.blocks.code.padding * 2 + 0.001)).toBe(
    true,
  )
  expect(code.lines.every((line) => line.y + line.height <= code.box.y + code.box.height)).toBe(true)
})

function measureTextWidth(text: string, font: string): number {
  const fontSize = parseFontSize(font)
  const fontWeightMultiplier = /\bbold\b/i.test(font) ? 1.1 : 1
  const fontStyleMultiplier = /\bitalic\b/i.test(font) ? 1.03 : 1

  let width = 0

  const segmenter =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null

  const graphemes = segmenter ? Array.from(segmenter.segment(text), (segment) => segment.segment) : Array.from(text)

  for (const grapheme of graphemes) {
    if (grapheme === ' ') {
      width += fontSize * 0.33
      continue
    }

    if (/\s/.test(grapheme)) {
      width += fontSize * 0.25
      continue
    }

    if (isCjkOrWide(grapheme)) {
      width += fontSize
      continue
    }

    if (/[.,;:!?'"()\[\]{}<>\/-]/.test(grapheme)) {
      width += fontSize * 0.35
      continue
    }

    if (/[A-Z0-9]/.test(grapheme)) {
      width += fontSize * 0.62
      continue
    }

    width += fontSize * 0.55
  }

  return width * fontWeightMultiplier * fontStyleMultiplier
}

function parseFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)\s*px/i)
  return match ? Number.parseFloat(match[1]!) : 16
}

function isCjkOrWide(grapheme: string): boolean {
  for (const char of grapheme) {
    const code = char.codePointAt(0)

    if (
      (code !== undefined && code >= 0x2e80 && code <= 0x9fff) ||
      (code !== undefined && code >= 0xf900 && code <= 0xfaff) ||
      (code !== undefined && code >= 0x3000 && code <= 0x303f) ||
      (code !== undefined && code >= 0xff00 && code <= 0xffef)
    ) {
      return true
    }
  }

  return false
}
