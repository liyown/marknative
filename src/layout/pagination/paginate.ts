import { defaultTheme } from '../../theme/default-theme'
import type {
  BlockLayoutFragment,
  CodeFragment,
  HeadingFragment,
  LayoutFragment,
  ListFragment,
  ListItemFragment,
  Page,
  ParagraphFragment,
  TableFragment,
} from '../types'

type PageState = {
  page: Page
  cursorY: number
}

const EPSILON = 0.001

export function paginateFragments(fragments: LayoutFragment[], theme = defaultTheme): Page[] {
  if (fragments.length === 0) {
    return []
  }

  const pages: Page[] = []
  let state = createPageState(theme)

  for (const fragment of fragments) {
    state = paginateFragment(fragment, state, pages, theme)
  }

  if (state.page.fragments.length > 0) {
    pages.push(state.page)
  }

  return pages
}

function paginateFragment(
  fragment: LayoutFragment,
  state: PageState,
  pages: Page[],
  theme: typeof defaultTheme,
): PageState {
  switch (fragment.kind) {
    case 'paragraph':
      return paginateParagraph(fragment, state, pages, theme)
    case 'list':
      return paginateList(fragment, state, pages, theme)
    case 'code':
      return paginateCode(fragment, state, pages, theme)
    case 'table':
      return paginateTable(fragment, state, pages, theme)
    case 'heading':
      return placeAtomicFragment(fragment, state, pages, theme, theme.blocks.heading.marginBottom)
    case 'blockquote':
      return placeAtomicFragment(fragment, state, pages, theme, theme.blocks.quote.marginBottom)
    case 'image':
      return placeAtomicFragment(fragment, state, pages, theme, theme.blocks.image.marginBottom)
    case 'thematicBreak':
      return placeAtomicFragment(fragment, state, pages, theme, 0)
    default:
      return placeAtomicFragment(fragment, state, pages, theme, 0)
  }
}

function paginateParagraph(
  fragment: ParagraphFragment,
  state: PageState,
  pages: Page[],
  theme: typeof defaultTheme,
): PageState {
  let index = 0
  let current = state

  while (index < fragment.lines.length) {
    current = ensurePageForContent(current, pages, theme)

    const remainingHeight = availableHeight(current, theme)
    let endIndex = index
    let usedHeight = 0

    while (endIndex < fragment.lines.length) {
      const lineHeight = fragment.lines[endIndex]?.height ?? 0

      if (usedHeight + lineHeight > remainingHeight + EPSILON) {
        break
      }

      usedHeight += lineHeight
      endIndex++
    }

    if (endIndex === index) {
      if (current.page.fragments.length > 0) {
        current = finishPage(current, pages, theme)
        continue
      }

      endIndex = index + 1
      usedHeight = fragment.lines[index]?.height ?? 0
    }

    const isFinalPiece = endIndex >= fragment.lines.length
    const piece = sliceParagraph(fragment, index, endIndex, current.cursorY, theme)
    current = placePiece(piece, current, pages, theme, isFinalPiece ? theme.blocks.paragraph.marginBottom : 0)
    index = endIndex

    if (index < fragment.lines.length) {
      current = finishPage(current, pages, theme)
    }
  }

  return current
}

function paginateList(
  fragment: ListFragment,
  state: PageState,
  pages: Page[],
  theme: typeof defaultTheme,
): PageState {
  let index = 0
  let current = state

  while (index < fragment.items.length) {
    current = ensurePageForContent(current, pages, theme)

    const remainingHeight = availableHeight(current, theme)
    let endIndex = index
    let usedHeight = 0

    while (endIndex < fragment.items.length) {
      const itemHeight = fragment.items[endIndex]?.box.height ?? 0
      const gap = endIndex > index ? theme.blocks.list.itemGap : 0

      if (usedHeight + gap + itemHeight > remainingHeight + EPSILON) {
        break
      }

      usedHeight += gap + itemHeight
      endIndex++
    }

    if (endIndex === index) {
      if (current.page.fragments.length > 0) {
        current = finishPage(current, pages, theme)
        continue
      }

      throw new Error('List item exceeds the available page content height and cannot be paginated atomically.')
    }

    const isFinalPiece = endIndex >= fragment.items.length
    const piece = sliceList(fragment, index, endIndex, current.cursorY, theme)
    current = placePiece(piece, current, pages, theme, isFinalPiece ? theme.blocks.list.marginBottom : 0)
    index = endIndex

    if (index < fragment.items.length) {
      current = finishPage(current, pages, theme)
    }
  }

  return current
}

function paginateCode(
  fragment: CodeFragment,
  state: PageState,
  pages: Page[],
  theme: typeof defaultTheme,
): PageState {
  let index = 0
  let current = state
  const firstOriginalLine = fragment.lines[0]
  const lastOriginalLine = fragment.lines[fragment.lines.length - 1]
  const topInset = firstOriginalLine ? firstOriginalLine.y - fragment.box.y : 0
  const bottomInset = lastOriginalLine
    ? fragment.box.y + fragment.box.height - (lastOriginalLine.y + lastOriginalLine.height)
    : 0

  while (index < fragment.lines.length) {
    current = ensurePageForContent(current, pages, theme)

    const remainingHeight = availableHeight(current, theme)
    let endIndex = index
    let usedHeight = 0

    while (endIndex < fragment.lines.length) {
      const lineHeight = fragment.lines[endIndex]?.height ?? 0

      if (topInset + usedHeight + lineHeight + bottomInset > remainingHeight + EPSILON) {
        break
      }

      usedHeight += lineHeight
      endIndex++
    }

    if (endIndex === index) {
      if (current.page.fragments.length > 0) {
        current = finishPage(current, pages, theme)
        continue
      }

      throw new Error('Code block line exceeds the available page content height and cannot be paginated atomically.')
    }

    const isFinalPiece = endIndex >= fragment.lines.length
    const piece = sliceCode(fragment, index, endIndex, current.cursorY, theme)
    current = placePiece(piece, current, pages, theme, isFinalPiece ? theme.blocks.code.marginBottom : 0)
    index = endIndex

    if (index < fragment.lines.length) {
      current = finishPage(current, pages, theme)
    }
  }

  return current
}

function paginateTable(
  fragment: TableFragment,
  state: PageState,
  pages: Page[],
  theme: typeof defaultTheme,
): PageState {
  let current = ensurePageForContent(state, pages, theme)

  const headerHeight = fragment.header.box.height
  const rowMargin = theme.blocks.table.marginBottom
  const firstRowRemaining = availableHeight(current, theme) - headerHeight

  if (fragment.rows.length === 0) {
    return placeAtomicFragment(fragment, current, pages, theme, rowMargin)
  }

  if (firstRowRemaining <= EPSILON && current.page.fragments.length > 0) {
    current = finishPage(current, pages, theme)
  }

  let index = 0

  while (index < fragment.rows.length) {
    current = ensurePageForContent(current, pages, theme)
    const remainingHeight = availableHeight(current, theme)
    let usedHeight = fragment.header.box.height
    let endIndex = index

    while (endIndex < fragment.rows.length) {
      const rowHeight = fragment.rows[endIndex]?.box.height ?? 0

      if (usedHeight + rowHeight > remainingHeight + EPSILON) {
        break
      }

      usedHeight += rowHeight
      endIndex++
    }

    if (endIndex === index) {
      if (current.page.fragments.length > 0) {
        current = finishPage(current, pages, theme)
        continue
      }

      throw new Error('Table row exceeds the available page content height and cannot be paginated atomically.')
    }

    const isFinalPiece = endIndex >= fragment.rows.length
    const piece = sliceTable(fragment, index, endIndex, current.cursorY, theme)
    current = placePiece(piece, current, pages, theme, isFinalPiece ? rowMargin : 0)
    index = endIndex

    if (index < fragment.rows.length) {
      current = finishPage(current, pages, theme)
    }
  }

  return current
}

function placeAtomicFragment<T extends BlockLayoutFragment>(
  fragment: T,
  state: PageState,
  pages: Page[],
  theme: typeof defaultTheme,
  marginBottom: number,
): PageState {
  let current = ensurePageForContent(state, pages, theme)
  const fits = fragment.box.height <= availableHeight(current, theme) + EPSILON

  if (!fits && current.page.fragments.length > 0) {
    current = finishPage(current, pages, theme)
  }

  const placed = translateFragment(cloneFragment(fragment), theme.page.margin.left - fragment.box.x, current.cursorY - fragment.box.y)
  current.page.fragments.push(placed)
  current.cursorY += placed.box.height + marginBottom

  return current
}

function placePiece<T extends BlockLayoutFragment>(
  fragment: T,
  state: PageState,
  pages: Page[],
  _theme: typeof defaultTheme,
  marginBottom: number,
): PageState {
  state.page.fragments.push(fragment)
  state.cursorY += fragment.box.height + marginBottom

  return state
}

function sliceParagraph(
  fragment: ParagraphFragment,
  startIndex: number,
  endIndex: number,
  startY: number,
  theme: typeof defaultTheme,
): ParagraphFragment {
  const lines = fragment.lines.slice(startIndex, endIndex)
  const boxHeight = sumHeights(lines)
  const yOffset = startY - (lines[0]?.y ?? fragment.box.y)

  return translateFragment(
    {
      ...cloneFragment(fragment),
      box: {
        ...fragment.box,
        y: lines[0]?.y ?? fragment.box.y,
        height: boxHeight,
      },
      lines,
    },
    theme.page.margin.left - fragment.box.x,
    yOffset,
  ) as ParagraphFragment
}

function sliceList(
  fragment: ListFragment,
  startIndex: number,
  endIndex: number,
  startY: number,
  theme: typeof defaultTheme,
): ListFragment {
  const items = fragment.items.slice(startIndex, endIndex)
  const firstItem = items[0]
  const lastItem = items[items.length - 1]
  const height = lastItem && firstItem ? lastItem.box.y + lastItem.box.height - firstItem.box.y : 0
  const yOffset = startY - (firstItem?.box.y ?? fragment.box.y)

  return translateFragment(
    {
      ...cloneFragment(fragment),
      start: firstOrderedOrdinal(items) ?? fragment.start,
      box: {
        ...fragment.box,
        y: firstItem?.box.y ?? fragment.box.y,
        height,
      },
      items,
    },
    theme.page.margin.left - fragment.box.x,
    yOffset,
  ) as ListFragment
}

function sliceCode(
  fragment: CodeFragment,
  startIndex: number,
  endIndex: number,
  startY: number,
  theme: typeof defaultTheme,
): CodeFragment {
  const lines = fragment.lines.slice(startIndex, endIndex)
  const firstLine = lines[0]
  const lastLine = lines[lines.length - 1]
  const firstOriginalLine = fragment.lines[0]
  const lastOriginalLine = fragment.lines[fragment.lines.length - 1]
  const topInset = firstOriginalLine ? firstOriginalLine.y - fragment.box.y : 0
  const bottomInset = lastOriginalLine
    ? fragment.box.y + fragment.box.height - (lastOriginalLine.y + lastOriginalLine.height)
    : 0
  const contentHeight = lastLine && firstLine ? lastLine.y + lastLine.height - firstLine.y : 0
  const height = topInset + contentHeight + bottomInset
  const yOffset = startY + topInset - (firstLine?.y ?? fragment.box.y)
  const { sourceLines, lineSourceMap } = sliceCodeSourceLines(fragment, startIndex, endIndex)

  return translateFragment(
    {
      ...cloneFragment(fragment),
      box: {
        ...fragment.box,
        y: (firstLine?.y ?? fragment.box.y) - topInset,
        height,
      },
      lines,
      sourceLines,
      lineSourceMap,
    },
    theme.page.margin.left - fragment.box.x,
    yOffset,
  ) as CodeFragment
}

function sliceCodeSourceLines(
  fragment: CodeFragment,
  startIndex: number,
  endIndex: number,
): { sourceLines: string[]; lineSourceMap: number[] } {
  const mapped = fragment.lineSourceMap.slice(startIndex, endIndex)

  if (mapped.length === 0) {
    return { sourceLines: [], lineSourceMap: [] }
  }

  const min = Math.min(...mapped)
  const max = Math.max(...mapped)

  return {
    sourceLines: fragment.sourceLines.slice(min, max + 1),
    lineSourceMap: mapped.map((sourceIndex) => sourceIndex - min),
  }
}

function sliceTable(
  fragment: TableFragment,
  startIndex: number,
  endIndex: number,
  startY: number,
  theme: typeof defaultTheme,
): TableFragment {
  const rows = fragment.rows.slice(startIndex, endIndex)
  const firstRow = rows[0]
  const lastRow = rows[rows.length - 1]
  const bodyHeight = firstRow && lastRow ? lastRow.box.y + lastRow.box.height - firstRow.box.y : 0
  const height = fragment.header.box.height + bodyHeight
  const yOffset = startY - fragment.header.box.y

  return translateFragment(
    {
      ...cloneFragment(fragment),
      box: {
        ...fragment.box,
        y: fragment.header.box.y,
        height,
      },
      rows,
    },
    theme.page.margin.left - fragment.box.x,
    yOffset,
  ) as TableFragment
}

function ensurePageForContent(state: PageState, pages: Page[], theme: typeof defaultTheme): PageState {
  if (state.page.fragments.length === 0 && state.cursorY === theme.page.margin.top) {
    return state
  }

  if (availableHeight(state, theme) > EPSILON) {
    return state
  }

  return finishPage(state, pages, theme)
}

function finishPage(state: PageState, pages: Page[], theme: typeof defaultTheme): PageState {
  if (state.page.fragments.length > 0) {
    pages.push(state.page)
  }

  return createPageState(theme)
}

function availableHeight(state: PageState, theme: typeof defaultTheme): number {
  return theme.page.height - theme.page.margin.bottom - state.cursorY
}

function createPageState(theme: typeof defaultTheme): PageState {
  return {
    page: {
      type: 'page',
      width: theme.page.width,
      height: theme.page.height,
      margin: theme.page.margin,
      fragments: [],
    },
    cursorY: theme.page.margin.top,
  }
}

function sumHeights(lines: Array<{ height: number }>): number {
  return lines.reduce((height, line) => height + line.height, 0)
}

function firstOrderedOrdinal(items: ListItemFragment[]): number | null {
  const firstMarker = items[0]?.marker
  return firstMarker?.kind === 'ordered' ? firstMarker.ordinal : null
}

function cloneFragment<T extends BlockLayoutFragment>(fragment: T): T {
  return structuredClone(fragment)
}

function translateFragment<T extends BlockLayoutFragment>(fragment: T, dx: number, dy: number): T {
  return {
    ...fragment,
    box: translateBox(fragment.box, dx, dy),
    lines: 'lines' in fragment && fragment.lines ? fragment.lines.map((line) => translateLineBox(line, dx, dy)) : fragment.lines,
    ...(fragment.kind === 'list'
      ? {
          items: fragment.items.map((item) => translateListItem(item, dx, dy)),
        }
      : {}),
    ...(fragment.kind === 'blockquote'
      ? {
          children: fragment.children.map((child) => translateFragment(child, dx, dy)),
        }
      : {}),
    ...(fragment.kind === 'table'
      ? {
          header: translateTableRow(fragment.header, dx, dy),
          rows: fragment.rows.map((row) => translateTableRow(row, dx, dy)),
        }
      : {}),
  } as T
}

function translateListItem(item: ListItemFragment, dx: number, dy: number): ListItemFragment {
  return {
    ...item,
    box: translateBox(item.box, dx, dy),
    children: item.children.map((child) => translateFragment(child, dx, dy)),
  }
}

function translateTableRow(row: TableFragment['header'], dx: number, dy: number): TableFragment['header'] {
  return {
    ...row,
    box: translateBox(row.box, dx, dy),
    cells: row.cells.map((cell) => ({
      ...cell,
      box: translateBox(cell.box, dx, dy),
      lines: cell.lines.map((line) => translateLineBox(line, dx, dy)),
    })),
  }
}

function translateLineBox(line: ParagraphFragment['lines'][number], dx: number, dy: number): ParagraphFragment['lines'][number] {
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

function translateBox(box: { x: number; y: number; width: number; height: number }, dx: number, dy: number) {
  return {
    ...box,
    x: box.x + dx,
    y: box.y + dy,
  }
}
