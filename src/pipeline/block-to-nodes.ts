import type { ContentBlock, DesignTokens, LayoutSpecNode } from '../types'

export function blockToNodes(
  block: ContentBlock,
  ds: DesignTokens,
  contentWidth: number,
): LayoutSpecNode[] {
  switch (block.type) {
    case 'heroTitle': {
      const titleNode: LayoutSpecNode = {
        type: 'text',
        spans: [{ text: block.title }],
        font: ds.typography.h1.font,
        lineHeight: ds.typography.h1.lineHeight,
        color: ds.colors.text,
      }
      if (!block.subtitle) return [titleNode]
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          gap: ds.spacing.sm,
          children: [
            titleNode,
            {
              type: 'text',
              spans: [{ text: block.subtitle }],
              font: ds.typography.h2.font,
              lineHeight: ds.typography.h2.lineHeight,
              color: ds.colors.subtext,
            },
          ],
        },
      ]
    }

    case 'heading': {
      const style = block.level === 1 ? ds.typography.h1 : ds.typography.h2
      return [
        {
          type: 'text',
          spans: [{ text: block.text }],
          font: style.font,
          lineHeight: style.lineHeight,
          color: ds.colors.text,
        },
      ]
    }

    case 'paragraph':
      return [
        {
          type: 'text',
          spans: block.spans,
          font: ds.typography.body.font,
          lineHeight: ds.typography.body.lineHeight,
          color: ds.colors.text,
        },
      ]

    case 'bulletList':
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          gap: ds.spacing.xs,
          children: block.items.map(item => ({
            type: 'text' as const,
            spans: [{ text: `• ${item}` }],
            font: ds.typography.body.font,
            lineHeight: ds.typography.body.lineHeight,
            color: ds.colors.text,
          })),
        },
      ]

    case 'orderedList':
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          gap: ds.spacing.xs,
          children: block.items.map((item, index) => ({
            type: 'text' as const,
            spans: [{ text: `${index + 1}. ${item}` }],
            font: ds.typography.body.font,
            lineHeight: ds.typography.body.lineHeight,
            color: ds.colors.text,
          })),
        },
      ]

    case 'steps':
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          gap: ds.spacing.xs,
          children: block.items.map((item, index) => ({
            type: 'text' as const,
            spans: [{ text: `${index + 1}. ${item}` }],
            font: ds.typography.body.font,
            lineHeight: ds.typography.body.lineHeight,
            color: ds.colors.text,
          })),
        },
      ]

    case 'quoteCard':
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          padding: ds.spacing.md,
          gap: ds.spacing.xs,
          background: { type: 'color', value: ds.colors.border },
          children: [
            {
              type: 'text',
              spans: [{ text: block.text }],
              font: ds.typography.body.font,
              lineHeight: ds.typography.body.lineHeight,
              color: ds.colors.text,
            },
            ...(block.author
              ? [
                  {
                    type: 'text' as const,
                    spans: [{ text: `— ${block.author}` }],
                    font: ds.typography.caption.font,
                    lineHeight: ds.typography.caption.lineHeight,
                    color: ds.colors.subtext,
                  },
                ]
              : []),
          ],
        },
      ]

    case 'metric':
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          gap: ds.spacing.xs,
          children: [
            {
              type: 'text',
              spans: [{ text: block.value }],
              font: ds.typography.h1.font,
              lineHeight: ds.typography.h1.lineHeight,
              color: ds.colors.primary,
            },
            {
              type: 'text',
              spans: [{ text: block.label }],
              font: ds.typography.caption.font,
              lineHeight: ds.typography.caption.lineHeight,
              color: ds.colors.subtext,
            },
          ],
        },
      ]

    case 'tags':
      return [
        {
          type: 'text',
          spans: block.items.map(tag => ({ text: `#${tag} ` })),
          font: ds.typography.caption.font,
          lineHeight: ds.typography.caption.lineHeight,
          color: ds.colors.primary,
        },
      ]

    case 'image':
      return [
        {
          type: 'image',
          src: block.src,
          width: contentWidth,
          height: Math.round(contentWidth * (9 / 16)),
          fit: 'cover',
        },
      ]

    case 'codeBlock':
      return [
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          padding: ds.spacing.md,
          background: { type: 'color', value: ds.colors.codeBg },
          children: [
            {
              type: 'text',
              spans: [{ text: block.code }],
              font: ds.typography.code.font,
              lineHeight: ds.typography.code.lineHeight,
              color: ds.colors.text,
            },
          ],
        },
      ]

    case 'divider':
      return [
        {
          type: 'rect',
          width: 'fill',
          height: 2,
          fill: { type: 'color', value: ds.colors.border },
        },
      ]

    default: {
      const _exhaustive: never = block
      throw new Error(`Unhandled ContentBlock type: ${(_exhaustive as { type: string }).type}`)
    }
  }
}
