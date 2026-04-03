import { createRequire } from 'node:module'

import type {
  BlockquoteFragment,
  CodeFragment,
  HeadingFragment,
  ImageFragment,
  LayoutFragment,
  LineBox,
  LineRun,
  ListFragment,
  ListItemFragment,
  Page,
  ParagraphFragment,
  TableCellFragment,
  TableFragment,
  TableRowFragment,
  ThematicBreakFragment,
} from '../layout/types'
import type { BlockNode, CodeBlockNode, MarkdownDocument } from '../document/types'
import { layoutDocument } from '../layout/block/layout-document'
import type { HighlightedCodeBlock } from '../highlight/types'
import { highlightCodeBlock } from '../highlight/highlight-code'
import { paginateFragments, singlePageFromFragments } from '../layout/pagination/paginate'
import { parseMarkdown } from '../parser/parse-markdown'
import { createSkiaCanvasPainter } from '../paint/skia-canvas'
import type {
  PaintBlockFragment,
  PaintBox,
  PaintCodeFragment,
  PaintHeadingFragment,
  PaintImageFragment,
  PaintInsets,
  PaintLineBox,
  PaintLineRun,
  PaintListFragment,
  PaintListItemFragment,
  PaintPage,
  PaintParagraphFragment,
  PaintTableCellFragment,
  PaintTableFragment,
  PaintTableRowFragment,
  PaintThematicBreakFragment,
  Painter,
} from '../paint/types'
import { defaultTheme } from '../theme/default-theme'
import type { ThemeOverrides } from '../theme/default-theme'
import type { BuiltInThemeName } from '../theme/built-in-themes'
import { resolveTheme } from '../theme/built-in-themes'

const require = createRequire(import.meta.url)

export type RenderMarkdownOptions = {
  format?: 'png' | 'svg'
  painter?: Painter
  /** Render all content into a single image instead of paginating. Capped at MAX_SINGLE_PAGE_HEIGHT px tall. */
  singlePage?: boolean
  /**
   * Theme to use for rendering.
   * - A `BuiltInThemeName` string (e.g. `'dark'`, `'nord'`) selects a preset.
   * - A `ThemeOverrides` object is merged onto `defaultTheme`.
   */
  theme?: ThemeOverrides | BuiltInThemeName
  /**
   * Code syntax highlighting options. Requires `shiki` to be installed.
   * Falls back to plain monochrome rendering when shiki is unavailable or
   * the language is not supported.
   */
  codeHighlighting?: {
    /**
     * Shiki theme name (e.g. `'github-light'`, `'github-dark'`, `'nord'`).
     * @default 'github-light'
     */
    theme?: string
  }
}

export type RenderPage =
  | {
      format: 'png'
      data: Buffer
      page: PaintPage
    }
  | {
      format: 'svg'
      data: string
      page: PaintPage
    }

export async function renderMarkdown(markdown: string, options: RenderMarkdownOptions = {}): Promise<RenderPage[]> {
  const theme = resolveTheme(options.theme)
  const parsedDoc = parseMarkdown(markdown)
  const shikiTheme = options.codeHighlighting?.theme ?? 'github-light'
  const highlightedBlocks = await preHighlightCodeBlocks(parsedDoc, shikiTheme)

  const restoreMeasurementSupport = ensureTextMeasurementSupport()
  let paintPages: PaintPage[]

  try {
    const fragments = layoutDocument(parsedDoc, theme, highlightedBlocks)
    const layoutPages = options.singlePage
      ? [singlePageFromFragments(fragments, theme)]
      : paginateFragments(fragments, theme)
    paintPages = layoutPages.map(mapLayoutPageToPaintPage)
  } finally {
    restoreMeasurementSupport()
  }

  const painter = options.painter ?? createSkiaCanvasPainter(theme)
  const format = options.format ?? 'png'

  return Promise.all(
    paintPages.map(async (page) => {
      if (format === 'svg') {
        return {
          format,
          data: await painter.renderSvg(page),
          page,
        }
      }

      return {
        format,
        data: await painter.renderPng(page),
        page,
      }
    }),
  )
}

function mapLayoutPageToPaintPage(page: Page): PaintPage {
  return {
    type: 'page',
    width: page.width,
    height: page.height,
    margin: mapInsets(page.margin),
    fragments: page.fragments.map(mapBlockFragment),
  }
}

function mapInsets(insets: Page['margin']): PaintInsets {
  return {
    top: insets.top,
    right: insets.right,
    bottom: insets.bottom,
    left: insets.left,
  }
}

function mapBlockFragment(fragment: LayoutFragment): PaintBlockFragment {
  switch (fragment.kind) {
    case 'paragraph':
      return mapParagraph(fragment)
    case 'heading':
      return mapHeading(fragment)
    case 'list':
      return mapList(fragment)
    case 'blockquote':
      return mapBlockquote(fragment)
    case 'code':
      return mapCode(fragment)
    case 'table':
      return mapTable(fragment)
    case 'thematicBreak':
      return mapThematicBreak(fragment)
    case 'image':
      return mapImage(fragment)
  }
}

function mapParagraph(fragment: ParagraphFragment): PaintParagraphFragment {
  return {
    type: 'fragment',
    kind: 'paragraph',
    box: mapBox(fragment.box),
    lines: fragment.lines.map(mapLine),
  }
}

function mapHeading(fragment: HeadingFragment): PaintHeadingFragment {
  return {
    type: 'fragment',
    kind: 'heading',
    box: mapBox(fragment.box),
    depth: fragment.depth,
    lines: fragment.lines.map(mapLine),
  }
}

function mapList(fragment: ListFragment): PaintListFragment {
  return {
    type: 'fragment',
    kind: 'list',
    box: mapBox(fragment.box),
    ordered: fragment.ordered,
    start: fragment.start,
    spread: fragment.spread,
    items: fragment.items.map(mapListItem),
  }
}

function mapListItem(fragment: ListItemFragment): PaintListItemFragment {
  return {
    type: 'fragment',
    kind: 'listItem',
    box: mapBox(fragment.box),
    checked: fragment.checked,
    spread: fragment.spread,
    marker: fragment.marker,
    children: fragment.children.map(mapBlockFragment),
  }
}

function mapBlockquote(fragment: BlockquoteFragment): PaintBlockFragment {
  return {
    type: 'fragment',
    kind: 'blockquote',
    box: mapBox(fragment.box),
    children: fragment.children.map(mapBlockFragment),
  }
}

function mapCode(fragment: CodeFragment): PaintCodeFragment {
  return {
    type: 'fragment',
    kind: 'code',
    box: mapBox(fragment.box),
    lang: fragment.lang,
    meta: fragment.meta,
    sourceLines: [...fragment.sourceLines],
    lineSourceMap: [...fragment.lineSourceMap],
    lines: fragment.lines.map(mapLine),
  }
}

function mapTable(fragment: TableFragment): PaintTableFragment {
  return {
    type: 'fragment',
    kind: 'table',
    box: mapBox(fragment.box),
    align: [...fragment.align],
    header: mapTableRow(fragment.header),
    rows: fragment.rows.map(mapTableRow),
  }
}

function mapTableRow(fragment: TableRowFragment): PaintTableRowFragment {
  return {
    type: 'fragment',
    kind: 'tableRow',
    box: mapBox(fragment.box),
    cells: fragment.cells.map(mapTableCell),
  }
}

function mapTableCell(fragment: TableCellFragment): PaintTableCellFragment {
  return {
    type: 'fragment',
    kind: 'tableCell',
    box: mapBox(fragment.box),
    align: fragment.align,
    lines: fragment.lines.map(mapLine),
  }
}

function mapThematicBreak(fragment: ThematicBreakFragment): PaintThematicBreakFragment {
  return {
    type: 'fragment',
    kind: 'thematicBreak',
    box: mapBox(fragment.box),
  }
}

function mapImage(fragment: ImageFragment): PaintImageFragment {
  return {
    type: 'fragment',
    kind: 'image',
    box: mapBox(fragment.box),
    alt: fragment.alt,
    url: fragment.url,
    title: fragment.title,
  }
}

function mapLine(line: LineBox): PaintLineBox {
  return {
    type: 'line',
    x: line.x,
    y: line.y,
    width: line.width,
    height: line.height,
    baseline: line.baseline,
    runs: line.runs.map(mapRun),
  }
}

function mapRun(run: LineRun): PaintLineRun {
  return {
    type: 'text',
    x: run.x,
    y: run.y,
    width: run.width,
    height: run.height,
    text: run.text,
    styleKind: run.styleKind,
    color: run.color,
    fontStyle: run.fontStyle,
    fontWeight: run.fontWeight,
  }
}

// ─── Code block pre-highlighting ─────────────────────────────────────────────

async function preHighlightCodeBlocks(
  doc: MarkdownDocument,
  shikiTheme: string,
): Promise<Map<CodeBlockNode, HighlightedCodeBlock>> {
  const nodes = collectCodeBlocks(doc)
  const results = await Promise.all(
    nodes.map((node) =>
      node.lang ? highlightCodeBlock(node.value, node.lang, shikiTheme) : Promise.resolve(null),
    ),
  )
  const map = new Map<CodeBlockNode, HighlightedCodeBlock>()
  nodes.forEach((node, i) => {
    const result = results[i]
    if (result) map.set(node, result)
  })
  return map
}

function collectCodeBlocks(doc: MarkdownDocument): CodeBlockNode[] {
  const blocks: CodeBlockNode[] = []
  collectFromNodes(doc.children, blocks)
  return blocks
}

function collectFromNodes(nodes: BlockNode[], blocks: CodeBlockNode[]): void {
  for (const node of nodes) {
    if (node.type === 'codeBlock') {
      blocks.push(node)
    } else if (node.type === 'blockquote') {
      collectFromNodes(node.children, blocks)
    } else if (node.type === 'list') {
      for (const item of node.items) {
        collectFromNodes(item.children, blocks)
      }
    }
  }
}

function mapBox(box: PaintBox): PaintBox {
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  }
}

function ensureTextMeasurementSupport(): () => void {
  const globalScope = globalThis as typeof globalThis & {
    OffscreenCanvas?: new (width: number, height: number) => {
      getContext: (type: '2d') => { font: string; measureText: (text: string) => { width: number } } | null
    }
  }

  if (globalScope.OffscreenCanvas) {
    try {
      const context = new globalScope.OffscreenCanvas(1, 1).getContext('2d')

      if (context) {
        return () => {}
      }
    } catch {
      // Fall through to install the local shim.
    }
  }

  const previous = globalScope.OffscreenCanvas
  globalScope.OffscreenCanvas = RenderOffscreenCanvas
  return () => {
    globalScope.OffscreenCanvas = previous
  }
}

class RenderOffscreenCanvas {
  width: number
  height: number
  private readonly context: RenderMeasureContext

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.context = new RenderMeasureContext()
  }

  getContext(type: '2d'): RenderMeasureContext | null {
    return type === '2d' ? this.context : null
  }
}

class RenderMeasureContext {
  font = '16px sans-serif'
  private skiaContext: { font: string; measureText: (text: string) => { width: number } } | null = null

  measureText(text: string): { width: number } {
    const context = this.getSkiaContext()

    if (context) {
      context.font = this.font
      return { width: context.measureText(text).width }
    }

    return { width: measureTextWidth(text, this.font) }
  }

  private getSkiaContext(): { font: string; measureText: (text: string) => { width: number } } | null {
    if (this.skiaContext) {
      return this.skiaContext
    }

    try {
      const skiaCanvas = require('skia-canvas') as {
        Canvas: new (width?: number, height?: number) => {
          getContext(type?: '2d'): { font: string; measureText: (text: string) => { width: number } }
        }
      }
      const canvas = new skiaCanvas.Canvas(1, 1)
      this.skiaContext = canvas.getContext('2d')
    } catch {
      this.skiaContext = null
    }

    return this.skiaContext
  }
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
