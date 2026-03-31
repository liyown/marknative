import { afterEach, beforeEach, expect, test } from 'bun:test'

import type { InlineNode } from '../../../src/document/types'
import { layoutInlineRuns } from '../../../src/layout/inline/line-layout'
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

const sampleRuns: InlineNode[] = [
  { type: 'text', value: 'This paragraph has enough plain text to wrap across multiple lines.' },
]

const mixedRuns: InlineNode[] = [
  { type: 'text', value: '混合 ' },
  { type: 'text', value: 'English ' },
  { type: 'text', value: '和中文一起排版，' },
  { type: 'text', value: 'should stay deterministic.' },
]

const styledRuns: InlineNode[] = [
  { type: 'text', value: 'Start ' },
  {
    type: 'strong',
    children: [{ type: 'text', value: 'bold segment wraps across lines' }],
  },
  { type: 'text', value: ' then ' },
  {
    type: 'emphasis',
    children: [{ type: 'text', value: 'italic segment wraps across lines' }],
  },
  { type: 'text', value: ' and ' },
  {
    type: 'inlineCode',
    value: 'code segment wraps across lines',
  },
  { type: 'text', value: ' end.' },
]

function runKinds(lines: ReturnType<typeof layoutInlineRuns>): string[] {
  return lines.flatMap((line) => line.runs.map((run) => run.styleKind))
}

test('produces multiple lines when width is constrained', () => {
  const lines = layoutInlineRuns(sampleRuns, 120, defaultTheme)

  expect(lines.length).toBeGreaterThan(1)
  expect(lines.every((line, index) => line.y === index * line.height)).toBe(true)
  expect(lines.every((line) => line.width > 0)).toBe(true)
})

test('never emits a line wider than the requested width when wrapping plain text', () => {
  const lines = layoutInlineRuns(
    [
      {
        type: 'text',
        value: 'We rebuilt the rendering pipeline around a document model so layout can be tested independently from output encoding.',
      },
    ],
    936,
    defaultTheme,
  )

  expect(lines.length).toBeGreaterThan(1)
  expect(lines.every((line) => line.width <= 936 + 0.001)).toBe(true)
})

test('prefers wrapping whole latin words onto the next line instead of splitting them mid-word', () => {
  const source =
    'We rebuilt the rendering pipeline around a document model so layout can be tested independently from output encoding.'
  const lines = layoutInlineRuns(
    [
      {
        type: 'text',
        value: source,
      },
    ],
    936,
    defaultTheme,
  )

  expect(lines).toHaveLength(2)
  expect(lines[0]?.runs.map((run) => run.text).join('')).toMatch(/\s$/)
  expect(lines[1]?.runs.map((run) => run.text).join('')).not.toMatch(/^\s/)
  expect(lines.map((line) => line.runs.map((run) => run.text).join('')).join('')).toBe(source)
})

test('keeps mixed Chinese and English line counts deterministic', () => {
  const first = layoutInlineRuns(mixedRuns, 180, defaultTheme)
  const second = layoutInlineRuns(mixedRuns, 180, defaultTheme)

  expect(first.length).toBe(second.length)
  expect(first.map((line) => line.runs.map((run) => run.text).join(''))).toEqual(
    second.map((line) => line.runs.map((run) => run.text).join('')),
  )
})

test('does not collapse a mixed CJK and Latin paragraph into an underfilled first line', () => {
  const lines = layoutInlineRuns(
    [
      {
        type: 'text',
        value:
          '原生 Markdown 渲染真正难的地方，不是把语法树解析出来，而是要把长段落、中英混排、代码片段和列表节奏稳定地排进有限页面。',
      },
    ],
    936,
    defaultTheme,
  )

  expect(lines).toHaveLength(2)
  expect(lines[0]?.runs.map((run) => run.text).join('')).toContain('渲染真正难的地方')
  expect(lines[0]?.width).toBeGreaterThan(700)
})

test('preserves strong, emphasis, and inline code run kinds across line segments', () => {
  const lines = layoutInlineRuns(styledRuns, 80, defaultTheme)
  const strongRuns = collectRunsByKind(lines, 'strong')
  const emphasisRuns = collectRunsByKind(lines, 'emphasis')
  const codeRuns = collectRunsByKind(lines, 'inlineCode')

  expect(lines.length).toBeGreaterThan(1)
  expect(runKinds(lines)).toContain('strong')
  expect(runKinds(lines)).toContain('emphasis')
  expect(runKinds(lines)).toContain('inlineCode')
  expect(strongRuns.text).toBe('bold segment wraps across lines')
  expect(emphasisRuns.text).toBe('italic segment wraps across lines')
  expect(codeRuns.text).toBe('code segment wraps across lines')
  expect(strongRuns.lineIndexes.size).toBeGreaterThan(1)
  expect(emphasisRuns.lineIndexes.size).toBeGreaterThan(1)
  expect(codeRuns.lineIndexes.size).toBeGreaterThan(1)
  expect(lines.every((line) => line.height > 0)).toBe(true)
})

test('preserves explicit hard breaks as separate line boxes, including empty lines', () => {
  const lines = layoutInlineRuns(
    [
      { type: 'text', value: 'First line' },
      { type: 'break' },
      { type: 'break' },
      { type: 'text', value: 'Third line' },
    ],
    240,
    defaultTheme,
  )

  expect(lines).toHaveLength(3)
  expect(lines[0]?.runs.map((run) => run.text).join('')).toBe('First line')
  expect(lines[1]?.runs).toEqual([])
  expect(lines[2]?.runs.map((run) => run.text).join('')).toBe('Third line')
})

test('preserves trailing hard breaks as a final empty line box', () => {
  const lines = layoutInlineRuns(
    [
      { type: 'text', value: 'Last line' },
      { type: 'break' },
    ],
    240,
    defaultTheme,
  )

  expect(lines).toHaveLength(2)
  expect(lines[0]?.runs.map((run) => run.text).join('')).toBe('Last line')
  expect(lines[1]?.runs).toEqual([])
})

test('throws when no text measurement support is available', () => {
  const previous = (globalThis as typeof globalThis & { OffscreenCanvas?: unknown }).OffscreenCanvas
  delete (globalThis as typeof globalThis & { OffscreenCanvas?: unknown }).OffscreenCanvas

  try {
    expect(() => layoutInlineRuns([{ type: 'text', value: 'hello' }], 120, defaultTheme)).toThrow(
      /requires OffscreenCanvas or a DOM canvas 2d context/,
    )
  } finally {
    ;(globalThis as typeof globalThis & { OffscreenCanvas?: unknown }).OffscreenCanvas = previous
  }
})

test('supports break-only input without text measurement', () => {
  delete (globalThis as typeof globalThis & { OffscreenCanvas?: unknown }).OffscreenCanvas

  const lines = layoutInlineRuns([{ type: 'break' }, { type: 'break' }], 120, defaultTheme)

  expect(lines).toHaveLength(3)
  expect(lines.every((line) => line.runs.length === 0)).toBe(true)
})

function collectRunsByKind(
  lines: ReturnType<typeof layoutInlineRuns>,
  kind: ReturnType<typeof runKinds>[number],
): {
  text: string
  lineIndexes: Set<number>
} {
  const lineIndexes = new Set<number>()
  let text = ''

  for (const [index, line] of lines.entries()) {
    for (const run of line.runs) {
      if (run.styleKind !== kind) continue
      lineIndexes.add(index)
      text += run.text
    }
  }

  return { text, lineIndexes }
}

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
