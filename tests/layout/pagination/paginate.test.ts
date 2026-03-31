import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { parseMarkdown } from '../../../src/parser/parse-markdown'
import { layoutDocument } from '../../../src/layout/block/layout-document'
import { paginateFragments } from '../../../src/layout/pagination/paginate'
import { defaultTheme } from '../../../src/theme/default-theme'
import type { DefaultTheme } from '../../../src/theme/default-theme'
import type { LayoutFragment } from '../../../src/layout/types'

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

const compactTheme: DefaultTheme = {
  ...defaultTheme,
  page: {
    ...defaultTheme.page,
    width: 420,
    height: 240,
    margin: {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
    },
  },
  typography: {
    ...defaultTheme.typography,
    h1: {
      ...defaultTheme.typography.h1,
      lineHeight: 44,
      font: 'bold 28px sans-serif',
    },
    h2: {
      ...defaultTheme.typography.h2,
      lineHeight: 36,
      font: 'bold 24px sans-serif',
    },
    body: {
      ...defaultTheme.typography.body,
      lineHeight: 24,
      font: '20px sans-serif',
    },
    code: {
      ...defaultTheme.typography.code,
      lineHeight: 22,
      font: '18px monospace',
    },
  },
  blocks: {
    ...defaultTheme.blocks,
    paragraph: {
      marginBottom: 12,
    },
    heading: {
      marginTop: 16,
      marginBottom: 12,
    },
    list: {
      ...defaultTheme.blocks.list,
      marginBottom: 12,
      itemGap: 6,
      indent: 28,
    },
    code: {
      ...defaultTheme.blocks.code,
      marginBottom: 12,
      padding: 12,
    },
    quote: {
      ...defaultTheme.blocks.quote,
      marginBottom: 12,
      padding: 12,
    },
    table: {
      ...defaultTheme.blocks.table,
      marginBottom: 12,
      cellPadding: 10,
    },
    image: {
      ...defaultTheme.blocks.image,
      marginBottom: 12,
    },
  },
}

describe('paginateFragments', () => {
  test('keeps long paragraphs flowing onto later pages', () => {
    const markdown = `# Pagination

${Array.from({ length: 24 }, (_, index) =>
  `This paragraph line ${index + 1} carries pagination state across page boundaries in a deterministic way.`,
).join(' ')}
`

    const pages = paginateFragments(layoutDocument(parseMarkdown(markdown), compactTheme), compactTheme)
    const paragraphPages = pages.filter((page) => page.fragments.some((fragment) => fragment.kind === 'paragraph'))

    expect(pages.length).toBeGreaterThan(1)
    expect(paragraphPages.length).toBeGreaterThan(1)
    expect(joinFragmentText(paragraphPages[0]?.fragments ?? [])).toContain('This paragraph line 1')
    expect(normalizeWhitespace(joinFragmentText(paragraphPages.at(-1)?.fragments ?? []))).toContain('page boundaries')
  })

  test('continues ordered list numbering after page breaks', () => {
    const markdown = `1. Item 1
2. Item 2
3. Item 3
4. Item 4
5. Item 5
6. Item 6
7. Item 7
8. Item 8
9. Item 9
10. Item 10
11. Item 11
12. Item 12
13. Item 13
14. Item 14
15. Item 15
`

    const pages = paginateFragments(layoutDocument(parseMarkdown(markdown), compactTheme), compactTheme)
    const listFragments = pages.flatMap((page) => page.fragments.filter((fragment) => fragment.kind === 'list'))
    const ordinals = listFragments.flatMap((fragment) =>
      fragment.items.flatMap((item) => (item.marker.kind === 'ordered' ? [item.marker.ordinal] : [])),
    )

    expect(pages.length).toBeGreaterThan(1)
    expect(listFragments.length).toBeGreaterThan(1)
    expect(ordinals).toEqual(Array.from({ length: ordinals.length }, (_, index) => index + 1))
    expect(
      listFragments.every((fragment) =>
        fragment.ordered && fragment.items[0]?.marker.kind === 'ordered'
          ? fragment.start === fragment.items[0].marker.ordinal
          : true,
      ),
    ).toBe(true)
  })

  test('keeps code blocks continuous across pages', () => {
    const markdown = `\`\`\`ts
${Array.from({ length: 18 }, (_, index) => `const value${index + 1} = ${index + 1}`).join('\n')}
\`\`\`
`

    const pages = paginateFragments(layoutDocument(parseMarkdown(markdown), compactTheme), compactTheme)
    const codeFragments = pages.flatMap((page) => page.fragments.filter((fragment) => fragment.kind === 'code'))

    expect(pages.length).toBeGreaterThan(1)
    expect(codeFragments.length).toBeGreaterThan(1)
    expect(codeFragments.flatMap((fragment) => fragment.sourceLines)).toEqual(
      Array.from({ length: 18 }, (_, index) => `const value${index + 1} = ${index + 1}`),
    )
    expect(
      codeFragments.every(
        (fragment) =>
          fragment.box.height >
          fragment.lines.reduce((height, line) => height + line.height, 0),
      ),
    ).toBe(true)
    expect(
      codeFragments.every((fragment) =>
        fragment.lineSourceMap.every((sourceIndex) => sourceIndex >= 0 && sourceIndex < fragment.sourceLines.length),
      ),
    ).toBe(true)
    expect(
      codeFragments.every((fragment) =>
        fragment.lines.every((line, index) => joinLineText(line) === fragment.sourceLines[fragment.lineSourceMap[index]!]!),
      ),
    ).toBe(true)
    expect(
      pages.every((page) =>
        page.fragments
          .filter((fragment) => fragment.kind === 'code')
          .every(
            (fragment) =>
              fragment.box.y + fragment.box.height <= page.height - page.margin.bottom,
          ),
      ),
    ).toBe(true)
  })

  test('preserves rebased code line mapping across blank lines and page breaks', () => {
    const markdown = `\`\`\`ts
const first = 1

const second = 2
const third = 3

${Array.from({ length: 14 }, (_, index) => `const item${index + 1} = ${index + 1}`).join('\n')}
\`\`\`
`

    const pages = paginateFragments(layoutDocument(parseMarkdown(markdown), compactTheme), compactTheme)
    const codeFragments = pages.flatMap((page) => page.fragments.filter((fragment) => fragment.kind === 'code'))

    expect(codeFragments.length).toBeGreaterThan(1)
    expect(
      codeFragments.every((fragment) =>
        fragment.lines.every((line, index) => joinLineText(line) === fragment.sourceLines[fragment.lineSourceMap[index]!]!),
      ),
    ).toBe(true)
    expect(codeFragments.some((fragment) => fragment.sourceLines.includes(''))).toBe(true)
  })

  test('produces deterministic page counts for mixed technical article content', () => {
    const markdown = `# Architecture Notes

This article explains pagination behavior for technical documentation with enough text to span multiple pages and exercise deterministic splitting.

1. First implementation detail
2. Second implementation detail
3. Third implementation detail

\`\`\`ts
${Array.from({ length: 12 }, (_, index) => `export const step${index + 1} = ${index + 1}`).join('\n')}
\`\`\`

| Topic | Status |
| --- | --- |
| parser | stable |
| layout | stable |
| pagination | active |
`

    const firstRun = paginateFragments(layoutDocument(parseMarkdown(markdown), compactTheme), compactTheme)
    const secondRun = paginateFragments(layoutDocument(parseMarkdown(markdown), compactTheme), compactTheme)

    expect(firstRun.length).toBe(secondRun.length)
    expect(summarizePages(firstRun)).toEqual(summarizePages(secondRun))
  })

  test('does not drop a page when the previous page is exactly full', () => {
    const exactTheme: DefaultTheme = {
      ...compactTheme,
      page: {
        ...compactTheme.page,
        height: 96,
        margin: {
          top: 24,
          right: 24,
          bottom: 24,
          left: 24,
        },
      },
      blocks: {
        ...compactTheme.blocks,
        paragraph: {
          marginBottom: 0,
        },
      },
    }

    const fragments = layoutDocument(
      parseMarkdown(`First paragraph that should take exactly one page.

Second paragraph that should be forced onto the next page.`),
      exactTheme,
    )

    const pages = paginateFragments(fragments, exactTheme)

    expect(pages).toHaveLength(2)
    expect(joinFragmentText(pages[0]?.fragments ?? [])).toContain('First paragraph')
    expect(joinFragmentText(pages[1]?.fragments ?? [])).toContain('Second paragraph')
  })

  test('keeps table rows atomic while allowing tall tables to continue across pages', () => {
    const markdown = `| Topic | Status |
| --- | --- |
${Array.from({ length: 20 }, (_, index) => `| row-${index + 1} | value-${index + 1} |`).join('\n')}
`

    const pages = paginateFragments(layoutDocument(parseMarkdown(markdown), compactTheme), compactTheme)
    const tableFragments = pages.flatMap((page) => page.fragments.filter((fragment) => fragment.kind === 'table'))
    const bodyRows = tableFragments.flatMap((fragment) => fragment.rows)

    expect(pages.length).toBeGreaterThan(1)
    expect(tableFragments.length).toBeGreaterThan(1)
    expect(bodyRows).toHaveLength(20)
    expect(tableFragments.every((fragment) => fragment.header.box.height > 0)).toBe(true)
  })

  test('throws when a single list item is taller than the page content area', () => {
    const markdown = `1. ${Array.from({ length: 180 }, () => 'This oversized list item keeps expanding.').join(' ')}`
    const fragments = layoutDocument(parseMarkdown(markdown), compactTheme)

    expect(() => paginateFragments(fragments, compactTheme)).toThrow(
      'List item exceeds the available page content height and cannot be paginated atomically.',
    )
  })

  test('throws when a single table row is taller than the page content area', () => {
    const markdown = `| Column |\n| --- |\n| ${Array.from({ length: 220 }, () => 'This oversized table row keeps expanding.').join(' ')} |`
    const fragments = layoutDocument(parseMarkdown(markdown), compactTheme)

    expect(() => paginateFragments(fragments, compactTheme)).toThrow(
      'Table row exceeds the available page content height and cannot be paginated atomically.',
    )
  })

  test('throws when a single code line cannot fit into an empty page', () => {
    const tinyCodeTheme: DefaultTheme = {
      ...compactTheme,
      page: {
        ...compactTheme.page,
        height: 64,
      },
    }
    const fragments = layoutDocument(
      parseMarkdown(`\`\`\`ts\nconst onlyLine = 1\n\`\`\`\n`),
      tinyCodeTheme,
    )

    expect(() => paginateFragments(fragments, tinyCodeTheme)).toThrow(
      'Code block line exceeds the available page content height and cannot be paginated atomically.',
    )
  })
})

function joinFragmentText(fragments: LayoutFragment[]): string {
  return normalizeWhitespace(
    fragments
      .flatMap((fragment) => ('lines' in fragment && fragment.lines ? fragment.lines : []))
      .map((line) => line.runs.map((run) => run.text).join(''))
      .join(' '),
  )
}

function summarizePages(pages: Array<{ fragments: LayoutFragment[] }>): string[] {
  return pages.map((page) =>
    page.fragments
      .map((fragment) => {
        switch (fragment.kind) {
          case 'paragraph':
          case 'heading':
          case 'code':
            return fragment.kind
          case 'list':
            return `list:${fragment.items.map((item) => (item.marker.kind === 'ordered' ? item.marker.ordinal : item.marker.kind)).join(',')}`
          case 'table':
            return `table:${fragment.rows.length}`
          case 'blockquote':
            return `blockquote:${fragment.children.length}`
          case 'thematicBreak':
            return 'thematicBreak'
          case 'image':
            return 'image'
        }
      })
      .join('|'),
  )
}

function joinLineText(line: { runs: Array<{ text: string }> }): string {
  return line.runs.map((run) => run.text).join('')
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
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
