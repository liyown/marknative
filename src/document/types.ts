export type MarkdownDocument = {
  type: 'document'
  children: BlockNode[]
}

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | BlockquoteNode
  | CodeBlockNode
  | TableNode
  | ThematicBreakNode
  | ImageNode
  | MathBlockNode

export type InlineNode =
  | TextNode
  | StrongNode
  | EmphasisNode
  | InlineCodeNode
  | LinkNode
  | InlineImageNode
  | DeleteNode
  | BreakNode
  | InlineMathNode

export type HeadingNode = {
  type: 'heading'
  depth: number
  children: InlineNode[]
}

export type ParagraphNode = {
  type: 'paragraph'
  children: InlineNode[]
}

export type ListNode = {
  type: 'list'
  ordered: boolean
  start: number | null
  spread: boolean
  items: ListItemNode[]
}

export type ListItemNode = {
  type: 'listItem'
  checked: boolean | null
  spread: boolean
  children: BlockNode[]
}

export type BlockquoteNode = {
  type: 'blockquote'
  children: BlockNode[]
}

export type CodeBlockNode = {
  type: 'codeBlock'
  lang: string | null
  meta: string | null
  value: string
}

export type TableNode = {
  type: 'table'
  align: Array<'left' | 'right' | 'center' | null>
  header: TableRowNode
  rows: TableRowNode[]
}

export type TableRowNode = {
  type: 'tableRow'
  cells: TableCellNode[]
}

export type TableCellNode = {
  type: 'tableCell'
  children: InlineNode[]
}

export type ThematicBreakNode = {
  type: 'thematicBreak'
}

export type ImageNode = {
  type: 'image'
  alt: string
  url: string
  title: string | null
}

export type TextNode = {
  type: 'text'
  value: string
}

export type StrongNode = {
  type: 'strong'
  children: InlineNode[]
}

export type EmphasisNode = {
  type: 'emphasis'
  children: InlineNode[]
}

export type InlineCodeNode = {
  type: 'inlineCode'
  value: string
}

export type LinkNode = {
  type: 'link'
  url: string
  title: string | null
  children: InlineNode[]
}

export type InlineImageNode = {
  type: 'inlineImage'
  url: string
  alt?: string
  title: string | null
}

export type DeleteNode = {
  type: 'delete'
  children: InlineNode[]
}

export type BreakNode = {
  type: 'break'
}

export type MathBlockNode = {
  type: 'mathBlock'
  value: string
}

export type InlineMathNode = {
  type: 'inlineMath'
  value: string
}
