import { layoutInlineRuns } from '../inline/line-layout'
import { layoutNextLine, prepareWithSegments } from '@chenglou/pretext'
import type { LayoutCursor } from '@chenglou/pretext'
import type {
  BlockNode,
  BlockquoteNode,
  CodeBlockNode,
  HeadingNode,
  ImageNode,
  InlineMathNode,
  ListNode,
  MarkdownDocument,
  MathBlockNode,
  ParagraphNode,
  TableNode,
} from '../../document/types'
import { defaultTheme, type Theme, type TypographyStyle } from '../../theme/default-theme'
import { withFontStyle, withFontWeight } from '../font-utils'
import type { HighlightedCodeBlock } from '../../highlight/types'
import type { CodeToken } from '../../highlight/types'
import type { RenderedMath } from '../../math/render-math'
import type {
  BlockquoteFragment,
  BlockLayoutFragment,
  CodeFragment,
  HeadingFragment,
  ImageFragment,
  ListFragment,
  ListItemFragment,
  ListMarker,
  MathBlockFragment,
  ParagraphFragment,
  PaintBox,
  TableCellFragment,
  TableFragment,
  TableRowFragment,
  ThematicBreakFragment,
  LineBox,
  LineRun,
} from '../types'

type LayoutContext = {
  x: number
  y: number
  width: number
  theme: Theme
  highlightedBlocks: Map<CodeBlockNode, HighlightedCodeBlock>
  renderedMath: Map<MathBlockNode | InlineMathNode, RenderedMath>
}

type LayoutResult<T extends BlockLayoutFragment> = {
  fragment: T
  nextY: number
}

export function layoutDocument(
  doc: MarkdownDocument,
  theme: Theme = defaultTheme,
  highlightedBlocks: Map<CodeBlockNode, HighlightedCodeBlock> = new Map(),
  renderedMath: Map<MathBlockNode | InlineMathNode, RenderedMath> = new Map(),
): BlockLayoutFragment[] {
  const { fragments } = layoutBlocks(doc.children, {
    x: theme.page.margin.left,
    y: theme.page.margin.top,
    width: theme.page.width - theme.page.margin.left - theme.page.margin.right,
    theme,
    highlightedBlocks,
    renderedMath,
  })

  return fragments
}

function layoutBlocks(nodes: BlockNode[], context: LayoutContext): { fragments: BlockLayoutFragment[]; nextY: number } {
  const fragments: BlockLayoutFragment[] = []
  let cursorY = context.y

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    const nextNode = nodes[i + 1]

    // Apply heading top margin when the heading is preceded by other content.
    if (node.type === 'heading' && i > 0) {
      cursorY += context.theme.blocks.heading.marginTop
    }

    const laidOut = layoutBlock(node, { ...context, y: cursorY })

    fragments.push(laidOut.fragment)

    // Paragraph immediately followed by a list (e.g. list item label + nested list):
    // collapse the margin to itemGap to avoid a large visual gap before the first sub-item.
    if (node.type === 'paragraph' && nextNode?.type === 'list') {
      cursorY = laidOut.fragment.box.y + laidOut.fragment.box.height + context.theme.blocks.list.itemGap
    } else {
      cursorY = laidOut.nextY
    }
  }

  return { fragments, nextY: cursorY }
}

function layoutBlock(node: BlockNode, context: LayoutContext): LayoutResult<BlockLayoutFragment> {
  switch (node.type) {
    case 'heading':
      return layoutHeading(node, context)
    case 'paragraph':
      return layoutParagraph(node, context)
    case 'list':
      return layoutList(node, context)
    case 'blockquote':
      return layoutBlockquote(node, context)
    case 'codeBlock':
      return layoutCode(node, context)
    case 'table':
      return layoutTable(node, context)
    case 'thematicBreak':
      return layoutThematicBreak(context)
    case 'image':
      return layoutImage(node, context)
    case 'mathBlock':
      return layoutMathBlock(node, context)
    default:
      throw new Error(`Unsupported block node: ${(node as { type: string }).type}`)
  }
}

function layoutHeading(node: HeadingNode, context: LayoutContext): LayoutResult<HeadingFragment> {
  const bodyStyle = headingTypography(node.depth, context.theme)
  const lines = layoutInlineLines(node.children, context.x, context.y, context.width, context, bodyStyle)
  const box = fragmentBox(context.x, context.y, context.width, lines)

  return {
    fragment: {
      type: 'fragment',
      kind: 'heading',
      depth: node.depth,
      box,
      lines,
    },
    nextY: context.y + box.height + context.theme.blocks.heading.marginBottom,
  }
}

function layoutParagraph(node: ParagraphNode, context: LayoutContext): LayoutResult<ParagraphFragment> {
  const lines = layoutInlineLines(
    node.children,
    context.x,
    context.y,
    context.width,
    context,
    context.theme.typography.body,
  )
  const box = fragmentBox(context.x, context.y, context.width, lines)

  return {
    fragment: {
      type: 'fragment',
      kind: 'paragraph',
      box,
      lines,
    },
    nextY: context.y + box.height + context.theme.blocks.paragraph.marginBottom,
  }
}

function layoutList(node: ListNode, context: LayoutContext): LayoutResult<ListFragment> {
  const items: ListItemFragment[] = []
  let cursorY = context.y

  node.items.forEach((item, index) => {
    const marker = resolveListMarker(node, item.checked, index)
    const childContext = {
      ...context,
      x: context.x + context.theme.blocks.list.indent,
      width: Math.max(1, context.width - context.theme.blocks.list.indent),
      y: cursorY,
    }
    const { fragments: children } = layoutBlocks(item.children, childContext)
    const contentBottom = children.at(-1) ? children.at(-1)!.box.y + children.at(-1)!.box.height : cursorY
    // Empty items get at least one line-height so the bullet renders at a valid position.
    const childBottom = children.length === 0 ? cursorY + context.theme.typography.body.lineHeight : contentBottom
    const itemBox = {
      x: context.x,
      y: cursorY,
      width: context.width,
      height: childBottom - cursorY,
    }

    items.push({
      type: 'fragment',
      kind: 'listItem',
      box: itemBox,
      checked: item.checked,
      spread: item.spread,
      marker,
      children,
    })

    cursorY = childBottom

    if (index < node.items.length - 1) {
      cursorY += context.theme.blocks.list.itemGap
    }
  })

  const box = {
    x: context.x,
    y: context.y,
    width: context.width,
    height: cursorY - context.y,
  }

  return {
    fragment: {
      type: 'fragment',
      kind: 'list',
      box,
      ordered: node.ordered,
      start: node.start,
      spread: node.spread,
      items,
    },
    nextY: cursorY + context.theme.blocks.list.marginBottom,
  }
}

function parseWidth(width: number | string, containerWidth: number): number {
  if (typeof width === 'number') {
    return width > 0 ? width : containerWidth
  }
  if (width === 'fit-content') {
    return -1
  }
  // percentage, e.g. "50%", "80%"
  const match = width.match(/^(\d+(?:\.\d+)?)%$/)
  if (match && match[1]) {
    const percentage = parseFloat(match[1])
    if (!isNaN(percentage) && percentage > 0) {
      return (containerWidth * percentage) / 100
    }
  }

  return containerWidth
}

function layoutBlockquote(node: BlockquoteNode, context: LayoutContext): LayoutResult<BlockquoteFragment> {
  const padding = context.theme.blocks.quote.padding
  // The line box has ~32% of lineHeight as dead space above the first visible glyph
  // (because baseline = line.y + lineHeight * 0.8, and cap top is ~0.72 * fontSize below baseline).
  // Compensate so the visual top and bottom padding look equal.
  const lineTopDead = Math.round(context.theme.typography.body.lineHeight * 0.32)
  const topOffset = Math.max(2, padding - lineTopDead)
  const childContext = {
    ...context,
    x: context.x + padding,
    y: context.y + topOffset,
    width: Math.max(1, context.width - padding * 2),
  }
  const { fragments: children } = layoutBlocks(node.children, childContext)
  const lastChild = children.at(-1)
  const contentBottom = lastChild ? lastChild.box.y + lastChild.box.height : childContext.y
  const box = {
    x: context.x,
    y: context.y,
    width: context.width,
    height: contentBottom - context.y + padding,
  }

  return {
    fragment: {
      type: 'fragment',
      kind: 'blockquote',
      box,
      children,
    },
    nextY: box.y + box.height + context.theme.blocks.quote.marginBottom,
  }
}

function layoutCode(node: CodeBlockNode, context: LayoutContext): LayoutResult<CodeFragment> {
  const padding = context.theme.blocks.code.padding
  const width = context.theme.blocks.code.width
  const lineHeight = context.theme.typography.code.lineHeight
  const lineWidth = Math.max(1, context.width - padding * 2)
  const codeTheme = withBodyTypography(context.theme, context.theme.typography.code)
  const highlighted = context.highlightedBlocks.get(node)
  const sourceLines = splitSourceLines(node.value)
  const lines: LineBox[] = []
  const lineSourceMap: number[] = []
  let cursorY = context.y + padding
  let boxWidth = 0

  sourceLines.forEach((sourceLine, sourceLineIndex) => {
    const hlLine = highlighted?.lines[sourceLineIndex]
    const laidOut =
      hlLine !== undefined && hlLine.tokens.length > 0
        ? layoutHighlightedCodeLine(hlLine.tokens, lineWidth, context.theme.typography.code)
        : sourceLine.length > 0
          ? layoutInlineRuns([{ type: 'text', value: sourceLine }], lineWidth, codeTheme)
          : []

    if (laidOut.length > 0) {
      for (const line of laidOut) {
        if (line.width > boxWidth) boxWidth = line.width
        lines.push(offsetLineBox(line, context.x + padding, cursorY - line.y))
        lineSourceMap.push(sourceLineIndex)
        cursorY += line.height
      }
      return
    }

    lines.push(emptyLineBox(context.x + padding, cursorY, lineHeight))
    lineSourceMap.push(sourceLineIndex)
    cursorY += lineHeight
  })

  const parsedWidth = parseWidth(width, context.width)
  const finalWidth = parsedWidth === -1 ? boxWidth + padding * 2 : parsedWidth

  const box = {
    x: context.x,
    y: context.y,
    width: finalWidth,
    height: cursorY - context.y + padding,
  }

  return {
    fragment: {
      type: 'fragment',
      kind: 'code',
      box,
      lang: node.lang,
      meta: node.meta,
      sourceLines,
      lineSourceMap,
      lines,
    },
    nextY: box.y + box.height + context.theme.blocks.code.marginBottom,
  }
}

function layoutTable(node: TableNode, context: LayoutContext): LayoutResult<TableFragment> {
  const columnCount = Math.max(node.header.cells.length, ...node.rows.map((row) => row.cells.length), 1)
  const columnWidth = context.width / columnCount
  const cellPadding = context.theme.blocks.table.cellPadding
  const bodyTheme = context.theme

  let cursorY = context.y
  const header = layoutTableRow(node.header, node.align, {
    ...context,
    y: cursorY,
    width: context.width,
    theme: bodyTheme,
  }, columnWidth, cellPadding)
  cursorY = header.box.y + header.box.height

  const rows: TableRowFragment[] = []

  for (const row of node.rows) {
    const laidOut = layoutTableRow(row, node.align, {
      ...context,
      y: cursorY,
      width: context.width,
      theme: bodyTheme,
    }, columnWidth, cellPadding)
    rows.push(laidOut)
    cursorY = laidOut.box.y + laidOut.box.height
  }

  const box = {
    x: context.x,
    y: context.y,
    width: context.width,
    height: cursorY - context.y,
  }

  return {
    fragment: {
      type: 'fragment',
      kind: 'table',
      box,
      align: node.align,
      header,
      rows,
    },
    nextY: cursorY + context.theme.blocks.table.marginBottom,
  }
}

function layoutTableRow(
  row: TableNode['header'],
  align: TableNode['align'],
  context: LayoutContext,
  columnWidth: number,
  cellPadding: number,
): TableRowFragment {
  const cells: TableCellFragment[] = []
  let rowHeight = 0

  row.cells.forEach((cell, index) => {
    const cellX = context.x + index * columnWidth
    const cellAlign = align[index] ?? null
    const lines = layoutInlineLines(
      cell.children,
      cellX + cellPadding,
      context.y + cellPadding,
      Math.max(1, columnWidth - cellPadding * 2),
      context,
      context.theme.typography.body,
    )
    const cellHeight = fragmentHeight(lines) + cellPadding * 2
    rowHeight = Math.max(rowHeight, cellHeight)

    cells.push({
      type: 'fragment',
      kind: 'tableCell',
      box: {
        x: cellX,
        y: context.y,
        width: columnWidth,
        height: 0,
      },
      align: cellAlign,
      lines,
    })
  })

  const normalizedCells = cells.map((cell) => ({
    ...cell,
    box: {
      ...cell.box,
      height: rowHeight,
    },
  }))

  return {
    type: 'fragment',
    kind: 'tableRow',
    box: {
      x: context.x,
      y: context.y,
      width: context.width,
      height: rowHeight,
    },
    cells: normalizedCells,
  }
}

function layoutThematicBreak(context: LayoutContext): LayoutResult<ThematicBreakFragment> {
  const box = {
    x: context.x,
    y: context.y,
    width: context.width,
    height: 1,
  }

  return {
    fragment: {
      type: 'fragment',
      kind: 'thematicBreak',
      box,
    },
    nextY: context.y + box.height,
  }
}

function layoutImage(node: ImageNode, context: LayoutContext): LayoutResult<ImageFragment> {
  const imageHeight = Math.max(context.theme.typography.body.lineHeight * 4, Math.round(context.width * 0.56))
  const box = {
    x: context.x,
    y: context.y,
    width: context.width,
    height: imageHeight,
  }

  return {
    fragment: {
      type: 'fragment',
      kind: 'image',
      box,
      alt: node.alt,
      url: node.url,
      title: node.title,
    },
    nextY: context.y + imageHeight + context.theme.blocks.image.marginBottom,
  }
}

function layoutMathBlock(node: MathBlockNode, context: LayoutContext): LayoutResult<MathBlockFragment> {
  const rendered = context.renderedMath.get(node)
  const padding = context.theme.blocks.math.padding

  // Clamp rendered width to available content width; maintain aspect ratio for height
  const intrinsicWidth = rendered?.width ?? context.width
  const intrinsicHeight = rendered?.height ?? context.theme.typography.body.lineHeight * 2
  const displayWidth = Math.min(intrinsicWidth, context.width - padding * 2)
  const scale = displayWidth / intrinsicWidth
  const displayHeight = Math.round(intrinsicHeight * scale)
  const boxHeight = displayHeight + padding * 2

  const box = {
    x: context.x,
    y: context.y,
    width: context.width,
    height: boxHeight,
  }

  return {
    fragment: {
      type: 'fragment',
      kind: 'mathBlock',
      box,
      svgBuffer: rendered?.svgBuffer ?? Buffer.alloc(0),
      intrinsicWidth,
    },
    nextY: context.y + boxHeight + context.theme.blocks.math.marginBottom,
  }
}

function layoutInlineLines(
  runs: ParagraphNode['children'],
  x: number,
  y: number,
  width: number,
  context: LayoutContext,
  bodyStyle: Theme['typography']['body'],
): LineBox[] {
  const inlineMathMap = context.renderedMath as Map<InlineMathNode, RenderedMath>
  return offsetLineBoxes(
    layoutInlineRuns(runs, Math.max(1, width), withBodyTypography(context.theme, bodyStyle), inlineMathMap),
    x,
    y,
  )
}

function withBodyTypography(theme: Theme, bodyStyle: Theme['typography']['body']): Theme {
  return {
    ...theme,
    typography: {
      ...theme.typography,
      body: bodyStyle,
    },
  }
}

function headingTypography(depth: number, theme: Theme): Theme['typography']['body'] {
  if (depth <= 1) return theme.typography.h1
  if (depth === 2) return theme.typography.h2
  if (depth === 3) return theme.typography.h3
  return theme.typography.h4 // h4, h5, h6
}

function resolveListMarker(node: ListNode, checked: boolean | null, index: number): ListMarker {
  if (checked !== null) {
    return {
      kind: 'task',
      checked,
    }
  }

  if (node.ordered) {
    return {
      kind: 'ordered',
      ordinal: (node.start ?? 1) + index,
    }
  }

  return {
    kind: 'bullet',
  }
}

function splitSourceLines(value: string): string[] {
  return value.length === 0 ? [''] : value.split(/\r?\n/)
}

function fragmentBox(x: number, y: number, width: number, lines: LineBox[]): PaintBox {
  return {
    x,
    y,
    width,
    height: fragmentHeight(lines),
  }
}

function fragmentHeight(lines: LineBox[]): number {
  return lines.reduce((height, line) => height + line.height, 0)
}

function offsetLineBoxes(lines: LineBox[], dx: number, dy: number): LineBox[] {
  return lines.map((line) => offsetLineBox(line, dx, dy))
}

function offsetLineBox(line: LineBox, dx: number, dy: number): LineBox {
  return {
    ...line,
    x: line.x + dx,
    y: line.y + dy,
    baseline: line.baseline + dy,
    runs: line.runs.map((run) => ({
      ...run,
      x: run.x + dx,
      y: run.y + dy,
    })),
  }
}

function emptyLineBox(x: number, y: number, lineHeight: number): LineBox {
  return {
    type: 'line',
    x,
    y,
    width: 0,
    height: lineHeight,
    baseline: y,
    runs: [],
  }
}

// ─── Highlighted code line layout ────────────────────────────────────────────
//
// This function replaces layoutInlineRuns for code blocks that have been
// highlighted by shiki. Key differences from the paragraph inline layout:
//   1. Leading/trailing spaces are preserved exactly — prepareWithSegments
//      strips them from its widths array, so we use canvas.measureText instead.
//   2. Shiki tokens are treated as atomic wrap units; splitting within a token
//      only happens when it exceeds the full line width.

const CODE_EPSILON = 0.001

type MeasureCtx = { font: string; measureText(text: string): { width: number } }

function getOffscreenContext(): MeasureCtx | null {
  const g = globalThis as typeof globalThis & {
    OffscreenCanvas?: new (w: number, h: number) => { getContext(t: '2d'): MeasureCtx | null }
  }
  return g.OffscreenCanvas ? (new g.OffscreenCanvas(1, 1).getContext('2d') ?? null) : null
}

function canvasWidth(ctx: MeasureCtx | null, text: string, font: string): number {
  if (!ctx) return 0
  ctx.font = font
  return ctx.measureText(text).width
}

function layoutHighlightedCodeLine(
  tokens: CodeToken[],
  maxWidth: number,
  typography: TypographyStyle,
): LineBox[] {
  type MutableLine = { y: number; width: number; height: number; runs: LineRun[] }

  const ctx = getOffscreenContext()
  const lines: MutableLine[] = []
  let currentY = 0
  let currentLine: MutableLine = { y: 0, width: 0, height: 0, runs: [] }

  const flushLine = () => {
    const height = currentLine.height > 0 ? currentLine.height : typography.lineHeight
    lines.push({ ...currentLine, height })
    currentY += height
    currentLine = { y: currentY, width: 0, height: 0, runs: [] }
  }

  for (const token of tokens) {
    if (token.text.length === 0) continue

    const font = codeTokenFont(token, typography.font)
    // Use canvas measurement so leading/trailing spaces are included in width.
    const fullWidth = canvasWidth(ctx, token.text, font)

    if (fullWidth <= 0) continue

    // Case 1: token fits on the current line (most common)
    if (currentLine.width + fullWidth <= maxWidth + CODE_EPSILON) {
      currentLine.runs.push(codeRun(token, token.text, currentLine.width, fullWidth, typography.lineHeight))
      currentLine.width += fullWidth
      currentLine.height = typography.lineHeight
      continue
    }

    // Token doesn't fit — flush the current line if it has content
    if (currentLine.runs.length > 0) {
      flushLine()
    }

    // Case 2: token fits on a fresh line
    if (fullWidth <= maxWidth + CODE_EPSILON) {
      currentLine.runs.push(codeRun(token, token.text, 0, fullWidth, typography.lineHeight))
      currentLine.width = fullWidth
      currentLine.height = typography.lineHeight
      continue
    }

    // Case 3: token is wider than the full line — split at grapheme boundaries
    // using pretext (Unicode-safe), then re-measure each chunk with canvas.
    const prepared = prepareWithSegments(token.text, font)
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }

    while (true) {
      const remaining = maxWidth - currentLine.width
      if (remaining <= CODE_EPSILON) {
        flushLine()
        continue
      }

      const chunk = layoutNextLine(prepared, cursor, remaining)
      if (!chunk || chunk.text.length === 0) break

      // Re-measure with canvas to get accurate width for this chunk.
      const chunkWidth = canvasWidth(ctx, chunk.text, font)

      if (chunkWidth > remaining + CODE_EPSILON && currentLine.runs.length > 0) {
        flushLine()
        continue
      }

      currentLine.runs.push(codeRun(token, chunk.text, currentLine.width, chunkWidth, typography.lineHeight))
      currentLine.width += chunkWidth
      currentLine.height = typography.lineHeight
      cursor = chunk.end

      if (cursor.segmentIndex < prepared.segments.length) {
        flushLine()
      } else {
        break
      }
    }
  }

  if (currentLine.runs.length > 0) {
    const height = currentLine.height > 0 ? currentLine.height : typography.lineHeight
    lines.push({ ...currentLine, height })
  }

  return lines.map(
    (line): LineBox => ({
      type: 'line',
      x: 0,
      y: line.y,
      width: line.width,
      height: line.height,
      baseline: line.y + line.height * 0.8,
      runs: line.runs.map((run) => ({ ...run, height: line.height })),
    }),
  )
}

function codeRun(
  token: CodeToken,
  text: string,
  x: number,
  width: number,
  lineHeight: number,
): LineRun {
  return {
    type: 'text',
    text,
    x,
    y: 0,
    width,
    height: lineHeight,
    styleKind: 'codeToken',
    color: token.color,
    fontStyle: token.fontStyle,
    fontWeight: token.fontWeight,
  }
}

function codeTokenFont(token: CodeToken, baseFont: string): string {
  let font = baseFont
  if (token.fontStyle === 'italic') font = withFontStyle(font, 'italic')
  if (token.fontWeight === 'bold') font = withFontWeight(font, 'bold')
  return font
}
