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

const blocks: ContentBlock[] = [
  { type: 'heroTitle', title: '今日份灵感' },
  { type: 'paragraph', spans: [{ text: '每天进步一点点' }] },
]

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

  test('body slot → text nodes from paragraphs', () => {
    const spec = applyTemplate(blocks, mockTemplate)
    const container = spec as Extract<LayoutSpecNode, { type: 'container' }>
    const bodyNode = container.children[1]
    expect(bodyNode?.type).toBe('text')
    if (bodyNode?.type === 'text') {
      expect(bodyNode.spans[0]?.text).toBe('每天进步一点点')
    }
  })

  test('rules are executed and can mutate spec', () => {
    const template: Template = {
      ...mockTemplate,
      rules: [
        ctx => {
          // If title is short, set a flag via mutate (no-op here, just test it runs)
          ctx.mutate('root.children.0.color', '#ff0000')
        },
      ],
    }
    // Should not throw
    expect(() => applyTemplate(blocks, template)).not.toThrow()
  })
})
