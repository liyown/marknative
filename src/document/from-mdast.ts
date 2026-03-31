import type {
  BlockNode,
  BlockquoteNode,
  BreakNode,
  CodeBlockNode,
  DeleteNode,
  EmphasisNode,
  HeadingNode,
  ImageNode,
  InlineCodeNode,
  InlineImageNode,
  InlineNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MarkdownDocument,
  ParagraphNode,
  StrongNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  TextNode,
  ThematicBreakNode,
} from './types'

type MdastNode = {
  type: string
  children?: MdastNode[]
  value?: string
  depth?: number
  url?: string
  title?: string | null
  alt?: string | null
  lang?: string | null
  meta?: string | null
  ordered?: boolean
  start?: number | null
  spread?: boolean
  checked?: boolean | null
  align?: Array<'left' | 'right' | 'center' | null>
  identifier?: string
  label?: string | null
  referenceType?: 'shortcut' | 'collapsed' | 'full'
}

type MdastRoot = MdastNode & {
  type: 'root'
  children: MdastNode[]
}

export function fromMdast(root: MdastRoot): MarkdownDocument {
  const definitions = collectDefinitions(root.children)

  return {
    type: 'document',
    children: convertBlockChildren(root.children, definitions),
  }
}

type DefinitionMap = Map<
  string,
  {
    url: string
    title: string | null
  }
>

function collectDefinitions(nodes: MdastNode[]): DefinitionMap {
  const definitions: DefinitionMap = new Map()

  for (const node of nodes) {
    if (node.type === 'definition' && node.identifier && node.url) {
      const identifier = normalizeIdentifier(node.identifier)

      if (!definitions.has(identifier)) {
        definitions.set(identifier, {
          url: node.url,
          title: node.title ?? null,
        })
      }
    }

    if (node.children?.length) {
      for (const [identifier, definition] of collectDefinitions(node.children)) {
        if (!definitions.has(identifier)) {
          definitions.set(identifier, definition)
        }
      }
    }
  }

  return definitions
}

function convertBlockChildren(nodes: MdastNode[], definitions: DefinitionMap): BlockNode[] {
  return nodes.flatMap((node) => convertBlockNode(node, definitions))
}

function convertBlockNode(node: MdastNode, definitions: DefinitionMap): BlockNode[] {
  switch (node.type) {
    case 'heading':
      return [convertHeading(node, definitions)]
    case 'paragraph':
      return convertParagraph(node, definitions)
    case 'list':
      return [convertList(node, definitions)]
    case 'blockquote':
      return [convertBlockquote(node, definitions)]
    case 'code':
      return [convertCodeBlock(node)]
    case 'table':
      return [convertTable(node, definitions)]
    case 'thematicBreak':
      return [convertThematicBreak()]
    case 'image':
      return [convertImage(node)]
    case 'html':
      return [convertHtmlBlock(node)]
    case 'definition':
      return []
    default:
      throwUnsupportedNode(node)
  }
}

function convertHeading(node: MdastNode, definitions: DefinitionMap): HeadingNode {
  return {
    type: 'heading',
    depth: node.depth ?? 1,
    children: convertInlineChildren(node.children ?? [], definitions),
  }
}

function convertParagraph(node: MdastNode, definitions: DefinitionMap): BlockNode[] {
  const children = node.children ?? []

  if (children.length === 1) {
    const onlyChild = children[0]

    if (onlyChild?.type === 'image') {
      return [convertImage(onlyChild)]
    }

    if (onlyChild?.type === 'imageReference') {
      return [convertImageReferenceAsBlock(onlyChild, definitions)]
    }
  }

  return [
    {
      type: 'paragraph',
      children: convertInlineChildren(children, definitions),
    },
  ]
}

function convertList(node: MdastNode, definitions: DefinitionMap): ListNode {
  return {
    type: 'list',
    ordered: node.ordered ?? false,
    start: node.start ?? null,
    spread: node.spread ?? false,
    items: (node.children ?? []).map((child) => convertListItem(child, definitions)),
  }
}

function convertListItem(node: MdastNode, definitions: DefinitionMap): ListItemNode {
  return {
    type: 'listItem',
    checked: node.checked ?? null,
    spread: node.spread ?? false,
    children: convertBlockChildren(node.children ?? [], definitions),
  }
}

function convertBlockquote(node: MdastNode, definitions: DefinitionMap): BlockquoteNode {
  return {
    type: 'blockquote',
    children: convertBlockChildren(node.children ?? [], definitions),
  }
}

function convertCodeBlock(node: MdastNode): CodeBlockNode {
  return {
    type: 'codeBlock',
    lang: node.lang ?? null,
    meta: node.meta ?? null,
    value: node.value ?? '',
  }
}

function convertTable(node: MdastNode, definitions: DefinitionMap): TableNode {
  const [header, ...rows] = node.children ?? []

  return {
    type: 'table',
    align: node.align ?? [],
    header: convertTableRow(header ?? { type: 'tableRow', children: [] }, definitions),
    rows: rows.map((row) => convertTableRow(row, definitions)),
  }
}

function convertTableRow(node: MdastNode, definitions: DefinitionMap): TableRowNode {
  return {
    type: 'tableRow',
    cells: (node.children ?? []).map((cell) => convertTableCell(cell, definitions)),
  }
}

function convertTableCell(node: MdastNode, definitions: DefinitionMap): TableCellNode {
  return {
    type: 'tableCell',
    children: convertInlineChildren(node.children ?? [], definitions),
  }
}

function convertThematicBreak(): ThematicBreakNode {
  return {
    type: 'thematicBreak',
  }
}

function convertImage(node: MdastNode): ImageNode {
  return {
    type: 'image',
    alt: node.alt ?? '',
    url: node.url ?? '',
    title: node.title ?? null,
  }
}

function convertHtmlBlock(node: MdastNode): ParagraphNode {
  return {
    type: 'paragraph',
    children: [convertText(node)],
  }
}

function convertInlineChildren(nodes: MdastNode[], definitions: DefinitionMap): InlineNode[] {
  return nodes.flatMap((node) => convertInlineNode(node, definitions))
}

function convertInlineNode(node: MdastNode, definitions: DefinitionMap): InlineNode[] {
  switch (node.type) {
    case 'text':
      return [convertText(node)]
    case 'strong':
      return [convertStrong(node, definitions)]
    case 'emphasis':
      return [convertEmphasis(node, definitions)]
    case 'inlineCode':
      return [convertInlineCode(node)]
    case 'link':
      return [convertLink(node, definitions)]
    case 'linkReference':
      return [convertLinkReference(node, definitions)]
    case 'image':
      return [convertInlineImage(node)]
    case 'imageReference':
      return [convertInlineImageReference(node, definitions)]
    case 'html':
      return [convertText(node)]
    case 'delete':
      return [convertDelete(node, definitions)]
    case 'break':
      return [convertBreak()]
    default:
      throwUnsupportedNode(node)
  }
}

function convertText(node: MdastNode): TextNode {
  return {
    type: 'text',
    value: node.value ?? '',
  }
}

function convertStrong(node: MdastNode, definitions: DefinitionMap): StrongNode {
  return {
    type: 'strong',
    children: convertInlineChildren(node.children ?? [], definitions),
  }
}

function convertEmphasis(node: MdastNode, definitions: DefinitionMap): EmphasisNode {
  return {
    type: 'emphasis',
    children: convertInlineChildren(node.children ?? [], definitions),
  }
}

function convertInlineCode(node: MdastNode): InlineCodeNode {
  return {
    type: 'inlineCode',
    value: node.value ?? '',
  }
}

function convertLink(node: MdastNode, definitions: DefinitionMap): LinkNode {
  return {
    type: 'link',
    url: node.url ?? '',
    title: node.title ?? null,
    children: convertInlineChildren(node.children ?? [], definitions),
  }
}

function convertLinkReference(node: MdastNode, definitions: DefinitionMap): LinkNode {
  const definition = resolveDefinition(node, definitions)

  return {
    type: 'link',
    url: definition.url,
    title: definition.title,
    children: convertInlineChildren(node.children ?? [], definitions),
  }
}

function convertInlineImage(node: MdastNode): InlineImageNode {
  return {
    type: 'inlineImage',
    url: node.url ?? '',
    alt: node.alt ?? undefined,
    title: node.title ?? null,
  }
}

function convertInlineImageReference(node: MdastNode, definitions: DefinitionMap): InlineImageNode {
  const definition = resolveDefinition(node, definitions)

  return {
    type: 'inlineImage',
    url: definition.url,
    alt: node.alt ?? undefined,
    title: definition.title,
  }
}

function convertImageReferenceAsBlock(node: MdastNode, definitions: DefinitionMap): ImageNode {
  const definition = resolveDefinition(node, definitions)

  return {
    type: 'image',
    url: definition.url,
    alt: node.alt ?? '',
    title: definition.title,
  }
}

function convertDelete(node: MdastNode, definitions: DefinitionMap): DeleteNode {
  return {
    type: 'delete',
    children: convertInlineChildren(node.children ?? [], definitions),
  }
}

function convertBreak(): BreakNode {
  return {
    type: 'break',
  }
}

function throwUnsupportedNode(node: MdastNode): never {
  throw new Error(`Unsupported mdast node: ${node.type}`)
}

function resolveDefinition(
  node: MdastNode,
  definitions: DefinitionMap,
): {
  url: string
  title: string | null
} {
  const identifier = node.identifier ? normalizeIdentifier(node.identifier) : null

  if (!identifier) {
    throw new Error(`Unsupported mdast node: ${node.type}`)
  }

  const definition = definitions.get(identifier)

  if (!definition) {
    throw new Error(`Unresolved mdast reference: ${node.type}:${node.identifier}`)
  }

  return definition
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase()
}
