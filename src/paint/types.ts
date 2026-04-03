export type PaintInsets = {
  top: number
  right: number
  bottom: number
  left: number
}

export type PaintBox = {
  x: number
  y: number
  width: number
  height: number
}

export type PaintLineRun = PaintBox & {
  type: 'text'
  text: string
  styleKind: 'text' | 'strong' | 'emphasis' | 'inlineCode' | 'link' | 'delete' | 'inlineImage' | 'codeToken'
  color?: string
  fontStyle?: 'italic'
  fontWeight?: 'bold'
}

export type PaintLineBox = PaintBox & {
  type: 'line'
  baseline: number
  runs: PaintLineRun[]
}

export type PaintFragmentBase = {
  type: 'fragment'
  box: PaintBox
}

export type PaintListMarker =
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

export type PaintParagraphFragment = PaintFragmentBase & {
  kind: 'paragraph'
  lines: PaintLineBox[]
}

export type PaintHeadingFragment = PaintFragmentBase & {
  kind: 'heading'
  depth: number
  lines: PaintLineBox[]
}

export type PaintListItemFragment = PaintFragmentBase & {
  kind: 'listItem'
  checked: boolean | null
  spread: boolean
  marker: PaintListMarker
  children: PaintBlockFragment[]
}

export type PaintListFragment = PaintFragmentBase & {
  kind: 'list'
  ordered: boolean
  start: number | null
  spread: boolean
  items: PaintListItemFragment[]
}

export type PaintBlockquoteFragment = PaintFragmentBase & {
  kind: 'blockquote'
  children: PaintBlockFragment[]
}

export type PaintCodeFragment = PaintFragmentBase & {
  kind: 'code'
  lang: string | null
  meta: string | null
  sourceLines: string[]
  lineSourceMap: number[]
  lines: PaintLineBox[]
}

export type PaintTableCellFragment = PaintFragmentBase & {
  kind: 'tableCell'
  align: 'left' | 'right' | 'center' | null
  lines: PaintLineBox[]
}

export type PaintTableRowFragment = PaintFragmentBase & {
  kind: 'tableRow'
  cells: PaintTableCellFragment[]
}

export type PaintTableFragment = PaintFragmentBase & {
  kind: 'table'
  align: Array<'left' | 'right' | 'center' | null>
  header: PaintTableRowFragment
  rows: PaintTableRowFragment[]
}

export type PaintThematicBreakFragment = PaintFragmentBase & {
  kind: 'thematicBreak'
}

export type PaintImageFragment = PaintFragmentBase & {
  kind: 'image'
  alt: string
  url: string
  title: string | null
}

export type PaintBlockFragment =
  | PaintParagraphFragment
  | PaintHeadingFragment
  | PaintListFragment
  | PaintBlockquoteFragment
  | PaintCodeFragment
  | PaintTableFragment
  | PaintThematicBreakFragment
  | PaintImageFragment

export type PaintPage = {
  type: 'page'
  width: number
  height: number
  margin: PaintInsets
  fragments: PaintBlockFragment[]
}

export interface Painter {
  renderPng(page: PaintPage): Promise<Buffer>
  renderSvg(page: PaintPage): Promise<string>
}
