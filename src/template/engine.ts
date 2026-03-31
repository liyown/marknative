import type {
  ContentBlock,
  Template,
  LayoutSpec,
  LayoutSpecNode,
  TemplateNode,
  SlotNode,
  RuleContext,
} from '../types'

function makeTextNode(
  text: string,
  tokens: Template['tokens'],
  color = tokens.colors.text,
  font = tokens.typography.body.font,
  lineHeight = tokens.typography.body.lineHeight,
): LayoutSpecNode {
  return {
    type: 'text',
    spans: [{ text }],
    font,
    lineHeight,
    color,
  }
}

function fallbackNodesForBlock(
  block: ContentBlock,
  tokens: Template['tokens'],
): LayoutSpecNode[] {
  switch (block.type) {
    case 'heroTitle':
      return [
        makeTextNode(
          block.title,
          tokens,
          tokens.colors.text,
          tokens.typography.h1.font,
          tokens.typography.h1.lineHeight,
        ),
      ]
    case 'heading':
      return [
        makeTextNode(
          block.text,
          tokens,
          tokens.colors.text,
          block.level === 1 ? tokens.typography.h1.font : tokens.typography.h2.font,
          block.level === 1
            ? tokens.typography.h1.lineHeight
            : tokens.typography.h2.lineHeight,
        ),
      ]
    case 'paragraph':
      return [
        {
          type: 'text',
          spans: block.spans,
          font: tokens.typography.body.font,
          lineHeight: tokens.typography.body.lineHeight,
          color: tokens.colors.text,
        },
      ]
    case 'bulletList':
    case 'steps':
      return block.items.map(item => makeTextNode(`• ${item}`, tokens))
    case 'orderedList':
      return block.items.map((item, index) => makeTextNode(`${index + 1}. ${item}`, tokens))
    case 'quoteCard':
      return [makeTextNode(block.text, tokens)]
    case 'metric':
      return [makeTextNode(`${block.label}: ${block.value}`, tokens)]
    case 'tags':
      return [
        {
          type: 'text',
          spans: block.items.map(tag => ({ text: `#${tag} ` })),
          font: tokens.typography.caption.font,
          lineHeight: tokens.typography.caption.lineHeight,
          color: tokens.colors.primary,
        },
      ]
    case 'codeBlock':
      return [
        makeTextNode(
          block.code,
          tokens,
          tokens.colors.text,
          tokens.typography.code.font,
          tokens.typography.code.lineHeight,
        ),
      ]
    default:
      return []
  }
}

export function resolveSlot(
  name: string,
  blocks: ContentBlock[],
  tokens: Template['tokens'],
): LayoutSpecNode[] {
  const titleBlock = blocks.find(
    block => block.type === 'heroTitle' || block.type === 'heading',
  )

  switch (name) {
    case 'title': {
      const block = titleBlock
      if (!block) return []

      const text = block.type === 'heroTitle' ? block.title : block.text
      return [
        {
          type: 'text',
          spans: [{ text }],
          font: tokens.typography.h1.font,
          lineHeight: tokens.typography.h1.lineHeight,
          color: tokens.colors.text,
        },
      ]
    }
    case 'subtitle': {
      const hero = blocks.find(block => block.type === 'heroTitle')
      if (hero?.type === 'heroTitle' && hero.subtitle) {
        return [
          {
            type: 'text',
            spans: [{ text: hero.subtitle }],
            font: tokens.typography.h2.font,
            lineHeight: tokens.typography.h2.lineHeight,
            color: tokens.colors.subtext,
          },
        ]
      }

      const headings = blocks.filter(
        block => block.type === 'heroTitle' || block.type === 'heading',
      )
      const fallback = headings[1]
      if (!fallback) return []

      return [
        {
          type: 'text',
          spans: [
            {
              text: fallback.type === 'heroTitle' ? fallback.title : fallback.text,
            },
          ],
          font: tokens.typography.h2.font,
          lineHeight: tokens.typography.h2.lineHeight,
          color: tokens.colors.subtext,
        },
      ]
    }
    case 'body': {
      return blocks.flatMap(block => {
        if (
          block.type === 'image' ||
          block.type === 'metric' ||
          block.type === 'tags'
        ) {
          return []
        }

        return fallbackNodesForBlock(block, tokens)
      })
    }
    case 'list': {
      const block = blocks.find(
        block =>
          block.type === 'bulletList' ||
          block.type === 'orderedList' ||
          block.type === 'steps',
      )
      if (!block || !('items' in block)) return []

      return block.items.map((item, index) => ({
        type: 'text' as const,
        spans: [
          {
            text: `${block.type === 'orderedList' ? `${index + 1}.` : '•'} ${item}`,
          },
        ],
        font: tokens.typography.body.font,
        lineHeight: tokens.typography.body.lineHeight,
        color: tokens.colors.text,
      }))
    }
    case 'quote': {
      const block = blocks.find(block => block.type === 'quoteCard')
      if (!block || block.type !== 'quoteCard') return []

      return [
        {
          type: 'text',
          spans: [{ text: block.text }],
          font: tokens.typography.body.font,
          lineHeight: tokens.typography.body.lineHeight,
          color: tokens.colors.text,
        },
      ]
    }
    case 'cover-image': {
      const block = blocks.find(block => block.type === 'image')
      if (!block || block.type !== 'image') return []

      return [{ type: 'image', src: block.src, width: 1080, height: 608 }]
    }
    case 'tags': {
      const block = blocks.find(block => block.type === 'tags')
      if (!block || block.type !== 'tags') return []

      return [
        {
          type: 'text',
          spans: block.items.map(tag => ({ text: `#${tag} ` })),
          font: tokens.typography.caption.font,
          lineHeight: tokens.typography.caption.lineHeight,
          color: tokens.colors.primary,
        },
      ]
    }
    case 'metrics': {
      return blocks
        .filter(block => block.type === 'metric')
        .flatMap(block => fallbackNodesForBlock(block, tokens))
    }
    default:
      return blocks.flatMap(block => fallbackNodesForBlock(block, tokens))
  }
}

export function bindNode(
  node: TemplateNode,
  blocks: ContentBlock[],
  tokens: Template['tokens'],
): LayoutSpecNode[] {
  if (node.type === 'slot') {
    return resolveSlot((node as SlotNode).name, blocks, tokens)
  }

  if (node.type === 'container') {
    const children = node.children.flatMap(child => bindNode(child, blocks, tokens))
    return [{ ...node, children }]
  }

  return [node]
}

export function applyMutate(
  root: LayoutSpecNode,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.')
  if (parts[0] !== 'root') return

  let current: Record<string, unknown> = root as Record<string, unknown>

  for (let index = 1; index < parts.length - 1; index++) {
    const key = parts[index]
    if (!key) return

    const next = current[key]
    if (Array.isArray(next) && parts[index + 1] !== undefined) {
      const childIndex = Number(parts[index + 1])
      if (!Number.isNaN(childIndex)) {
        const child = next[childIndex]
        if (!child || typeof child !== 'object') return
        current = child as Record<string, unknown>
        index += 1
        continue
      }
    }

    if (!next || typeof next !== 'object') return
    current = next as Record<string, unknown>
  }

  const lastKey = parts[parts.length - 1]
  if (!lastKey) return
  current[lastKey] = value
}

export function applyTemplate(
  blocks: ContentBlock[],
  template: Template,
): LayoutSpec {
  const boundNodes = bindNode(template.root, blocks, template.tokens)
  const root: LayoutSpecNode =
    boundNodes.length === 1 && boundNodes[0]?.type === 'container'
      ? boundNodes[0]
      : {
          type: 'container',
          direction: 'column',
          width: template.size.width,
          height: template.size.height,
          children: boundNodes,
        }

  if (template.rules?.length) {
    const ctx: RuleContext = {
      blocks,
      tokens: template.tokens,
      mutate: (path, nextValue) => applyMutate(root, path, nextValue),
    }

    for (const rule of template.rules) {
      rule(ctx)
    }
  }

  return root
}
