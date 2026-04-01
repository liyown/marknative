import { layoutInlineRuns } from '../inline/line-layout'
import type {
  BlockNode,
  BlockquoteNode,
  CodeBlockNode,
  HeadingNode,
  ImageNode,
  ListNode,
  MarkdownDocument,
  ParagraphNode,
  TableNode,
} from '../../document/types'
import { defaultTheme } from '../../theme/default-theme'
import type {
  BlockquoteFragment,
  BlockLayoutFragment,
  CodeFragment,
  HeadingFragment,
  ImageFragment,
  ListFragment,
  ListItemFragment,
  ListMarker,
  ParagraphFragment,
  PaintBox,
  TableCellFragment,
  TableFragment,
  TableRowFragment,
  ThematicBreakFragment,
  LineBox,
} from '../types'

type LayoutContext = {
  x: number
  y: number
  width: number
  theme: typeof defaultTheme
}

type LayoutResult<T extends BlockLayoutFragment> = {
  fragment: T
  nextY: number
}

export function layoutDocument(doc: MarkdownDocument, theme = defaultTheme): BlockLayoutFragment[] {
  const { fragments } = layoutBlocks(doc.children, {
    x: theme.page.margin.left,
    y: theme.page.margin.top,
    width: theme.page.width - theme.page.margin.left - theme.page.margin.right,
    theme,
  })

  return fragments
}

function layoutBlocks(nodes: BlockNode[], context: LayoutContext): { fragments: BlockLayoutFragment[]; nextY: number } {
  const fragments: BlockLayoutFragment[] = []
  let cursorY = context.y

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    const nextNode = nodes[i + 1]
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
    default:
      throw new Error(`Unsupported block node: ${(node as { type: string }).type}`)
  }
}

function layoutHeading(node: HeadingNode, context: LayoutContext): LayoutResult<HeadingFragment> {
  const bodyStyle = headingTypography(node.depth, context.theme)
  const lines = layoutInlineLines(node.children, context.x, context.y, context.width, context.theme, bodyStyle)
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
    context.theme,
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
  const lineHeight = context.theme.typography.code.lineHeight
  const lineWidth = Math.max(1, context.width - padding * 2)
  const codeTheme = withBodyTypography(context.theme, context.theme.typography.code)
  const sourceLines = splitSourceLines(node.value)
  const lines: LineBox[] = []
  const lineSourceMap: number[] = []
  let cursorY = context.y + padding

  sourceLines.forEach((sourceLine, sourceLineIndex) => {
    const laidOut = sourceLine.length > 0 ? layoutInlineRuns([{ type: 'text', value: sourceLine }], lineWidth, codeTheme) : []

    if (laidOut.length > 0) {
      for (const line of laidOut) {
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

  const box = {
    x: context.x,
    y: context.y,
    width: context.width,
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
      context.theme,
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

function layoutInlineLines(
  runs: ParagraphNode['children'],
  x: number,
  y: number,
  width: number,
  theme: typeof defaultTheme,
  bodyStyle: typeof defaultTheme.typography.body,
): LineBox[] {
  return offsetLineBoxes(layoutInlineRuns(runs, Math.max(1, width), withBodyTypography(theme, bodyStyle)), x, y)
}

function withBodyTypography(theme: typeof defaultTheme, bodyStyle: typeof defaultTheme.typography.body): typeof defaultTheme {
  return {
    ...theme,
    typography: {
      ...theme.typography,
      body: bodyStyle,
    },
  }
}

function headingTypography(depth: number, theme: typeof defaultTheme): typeof defaultTheme.typography.body {
  if (depth <= 1) {
    return theme.typography.h1
  }

  return theme.typography.h2
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
