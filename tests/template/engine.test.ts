import { test, expect, describe } from 'bun:test'
import { applyTemplate } from '../../src/template/engine'
import type { Template, ContentBlock, LayoutSpecNode } from '../../src/types'
import { defaultTokens } from '../../src/templates/tokens/default'

const mockTemplate: Template = {
  id: 'test',
  size: { width: 1080, height: 1440 },
  tokens: defaultTokens,
  contentArea: { x: 60, y: 60, width: 960, height: 1320 },
  root: {
    type: 'container',
    direction: 'column',
    padding: 60,
    width: 1080,
    height: 1440,
    children: [
      { type: 'slot', name: 'title' },
      { type: 'slot', name: 'body' },
    ],
  },
}

const flowTemplate: Template = {
  ...mockTemplate,
  root: {
    ...mockTemplate.root,
    children: [{ type: 'slot', name: 'body' }],
  },
}

const blocks: ContentBlock[] = [
  { type: 'heroTitle', title: '今日份灵感' },
  { type: 'paragraph', spans: [{ text: '每天进步一点点' }] },
]

const mockRoot = mockTemplate.root as Extract<LayoutSpecNode, { type: 'container' }>

describe('applyTemplate', () => {
  test('produces LayoutSpec with no SlotNode', () => {
    const spec = applyTemplate(blocks, mockTemplate)
    const hasSlot = JSON.stringify(spec).includes('"type":"slot"')
    expect(hasSlot).toBe(false)
  })

  test('title slot → text node with h1 font', () => {
    const spec = applyTemplate(blocks, mockTemplate)
    expect(spec.type).toBe('container')
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>
    const titleNode = container.children[0]
    expect(titleNode?.type).toBe('text')
    if (titleNode?.type === 'text') {
      expect(titleNode.spans[0]?.text).toBe('今日份灵感')
      expect(titleNode.font).toContain('bold')
    }
  })

  test('body slot keeps markdown title and paragraph in order', () => {
    const spec = applyTemplate(blocks, flowTemplate)
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>

    expect(container.children).toHaveLength(2)
    expect(container.children[0]?.type).toBe('text')
    expect(container.children[1]?.type).toBe('text')

    if (container.children[0]?.type === 'text') {
      expect(container.children[0].spans[0]?.text).toBe('今日份灵感')
      expect(container.children[0].font).toBe(defaultTokens.typography.h1.font)
    }
    if (container.children[1]?.type === 'text') {
      expect(container.children[1].spans[0]?.text).toBe('每天进步一点点')
    }
  })

  test('body slot keeps headings in document flow', () => {
    const spec = applyTemplate(
      [
        { type: 'heroTitle', title: '今日份灵感' },
        { type: 'paragraph', spans: [{ text: '开场正文' }] },
        { type: 'heading', level: 2, text: '今日金句' },
        { type: 'paragraph', spans: [{ text: '后续正文' }] },
      ],
      flowTemplate,
    )

    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>
    expect(container.children).toHaveLength(4)
    if (container.children[0]?.type === 'text') {
      expect(container.children[0].spans[0]?.text).toBe('今日份灵感')
      expect(container.children[0].font).toBe(defaultTokens.typography.h1.font)
    }
    if (container.children[2]?.type === 'text') {
      expect(container.children[2].spans[0]?.text).toBe('今日金句')
      expect(container.children[2].font).toBe(defaultTokens.typography.h2.font)
    }
  })

  test('body slot preserves headings in original order', () => {
    const spec = applyTemplate(
      [
        { type: 'heading', level: 2, text: '第 3 节' },
        { type: 'paragraph', spans: [{ text: '第一页正文' }] },
        { type: 'heading', level: 2, text: '第 4 节' },
      ],
      flowTemplate,
    )

    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>
    expect(container.children).toHaveLength(3)
    if (container.children[0]?.type === 'text') {
      expect(container.children[0].spans[0]?.text).toBe('第 3 节')
    }
    if (container.children[1]?.type === 'text') {
      expect(container.children[1].spans[0]?.text).toBe('第一页正文')
    }
    if (container.children[2]?.type === 'text') {
      expect(container.children[2].spans[0]?.text).toBe('第 4 节')
    }
  })

  test('rules are executed and can mutate spec', () => {
    const template: Template = {
      ...mockTemplate,
      rules: [
        ctx => {
          ctx.mutate('root.children.0.color', '#ff0000')
        },
      ],
    }

    const spec = applyTemplate(blocks, template)
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>
    const titleNode = container.children[0]

    expect(titleNode?.type).toBe('text')
    if (titleNode?.type === 'text') {
      expect(titleNode.color).toBe('#ff0000')
    }
  })

  test('subtitle slot falls back to second heading when hero subtitle is missing', () => {
    const template: Template = {
      ...mockTemplate,
      root: {
        ...mockRoot,
        children: [{ type: 'slot', name: 'subtitle' }],
      },
    }
    const subtitleBlocks: ContentBlock[] = [
      { type: 'heroTitle', title: '封面主标题' },
      { type: 'heading', level: 2, text: '备用副标题' },
    ]

    const spec = applyTemplate(subtitleBlocks, template)
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>
    const subtitleNode = container.children[0]

    expect(subtitleNode?.type).toBe('text')
    if (subtitleNode?.type === 'text') {
      expect(subtitleNode.spans[0]?.text).toBe('备用副标题')
      expect(subtitleNode.color).toBe(defaultTokens.colors.subtext)
    }
  })

  test('metrics slot maps metric blocks into text nodes', () => {
    const template: Template = {
      ...mockTemplate,
      root: {
        ...mockRoot,
        children: [{ type: 'slot', name: 'metrics' }],
      },
    }
    const metricBlocks: ContentBlock[] = [
      { type: 'metric', label: '阅读量', value: '1024' },
      { type: 'metric', label: '点赞', value: '256' },
    ]

    const spec = applyTemplate(metricBlocks, template)
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>

    expect(container.children).toHaveLength(2)
    expect(container.children[0]?.type).toBe('text')
    if (container.children[0]?.type === 'text') {
      expect(container.children[0].spans[0]?.text).toBe('阅读量: 1024')
    }
  })

  test('unknown slot falls back to conservative text mapping', () => {
    const template: Template = {
      ...mockTemplate,
      root: {
        ...mockRoot,
        children: [{ type: 'slot', name: 'custom' }],
      },
    }
    const fallbackBlocks: ContentBlock[] = [
      { type: 'paragraph', spans: [{ text: '保留正文' }] },
      { type: 'quoteCard', text: '保留引用' },
    ]

    const spec = applyTemplate(fallbackBlocks, template)
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>

    expect(container.children).toHaveLength(2)
    expect(container.children[0]?.type).toBe('text')
    expect(container.children[1]?.type).toBe('text')
    if (container.children[0]?.type === 'text') {
      expect(container.children[0].spans[0]?.text).toBe('保留正文')
    }
  })
})
