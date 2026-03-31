export type BoxInsets = {
  top: number
  right: number
  bottom: number
  left: number
}

export type PageGeometry = {
  width: number
  height: number
  margin: BoxInsets
}

export type PaintBox = {
  x: number
  y: number
  width: number
  height: number
}

export type LineRun = PaintBox & {
  type: 'text'
  text: string
  styleKind: 'text' | 'strong' | 'emphasis' | 'inlineCode' | 'link' | 'delete' | 'inlineImage'
}

export type LineBox = PaintBox & {
  type: 'line'
  baseline: number
  runs: LineRun[]
}

export type FragmentBase = {
  type: 'fragment'
  box: PaintBox
  lines?: LineBox[]
}

export type ListMarker =
  | {
      kind: 'bullet'
    }
  | {
      kind: 'ordered'
      ordinal: number
    }
  | {
      kind: 'task'
      checked: boolean
    }

export type ParagraphFragment = FragmentBase & {
  kind: 'paragraph'
  lines: LineBox[]
}

export type HeadingFragment = FragmentBase & {
  kind: 'heading'
  depth: number
  lines: LineBox[]
}

export type ListItemFragment = FragmentBase & {
  kind: 'listItem'
  checked: boolean | null
  spread: boolean
  marker: ListMarker
  children: BlockLayoutFragment[]
}

export type ListFragment = FragmentBase & {
  kind: 'list'
  ordered: boolean
  start: number | null
  spread: boolean
  items: ListItemFragment[]
}

export type BlockquoteFragment = FragmentBase & {
  kind: 'blockquote'
  children: BlockLayoutFragment[]
}

export type CodeFragment = FragmentBase & {
  kind: 'code'
  lang: string | null
  meta: string | null
  sourceLines: string[]
  lineSourceMap: number[]
  lines: LineBox[]
}

export type TableCellFragment = FragmentBase & {
  kind: 'tableCell'
  align: 'left' | 'right' | 'center' | null
  lines: LineBox[]
}

export type TableRowFragment = FragmentBase & {
  kind: 'tableRow'
  cells: TableCellFragment[]
}

export type TableFragment = FragmentBase & {
  kind: 'table'
  align: Array<'left' | 'right' | 'center' | null>
  header: TableRowFragment
  rows: TableRowFragment[]
}

export type ThematicBreakFragment = FragmentBase & {
  kind: 'thematicBreak'
}

export type ImageFragment = FragmentBase & {
  kind: 'image'
  alt: string
  url: string
  title: string | null
}

export type BlockLayoutFragment =
  | ParagraphFragment
  | HeadingFragment
  | ListFragment
  | BlockquoteFragment
  | CodeFragment
  | TableFragment
  | ThematicBreakFragment
  | ImageFragment

export type StructuralLayoutFragment =
  | ListItemFragment
  | TableRowFragment
  | TableCellFragment

type InternalLayoutFragment = BlockLayoutFragment | StructuralLayoutFragment

export type LayoutFragment = BlockLayoutFragment

export type Fragment = BlockLayoutFragment

export type FragmentKind = BlockLayoutFragment['kind']

export type PageBox = PageGeometry & {
  type: 'page'
  fragments: BlockLayoutFragment[]
}

export type Page = PageBox
