import { describe, expect, test } from 'bun:test'
import { blockToNodes } from '../../src/pipeline/block-to-nodes'
import { defaultTokens } from '../../src/templates/tokens/default'

const WIDTH = 936

describe('blockToNodes', () => {
  test('heading level 1 → text with h1 typography', () => {
    const nodes = blockToNodes({ type: 'heading', level: 1, text: 'Title' }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'text',
      spans: [{ text: 'Title' }],
      font: defaultTokens.typography.h1.font,
      lineHeight: defaultTokens.typography.h1.lineHeight,
      color: defaultTokens.colors.text,
    })
  })

  test('heading level 2 → text with h2 typography', () => {
    const nodes = blockToNodes({ type: 'heading', level: 2, text: 'Sub' }, defaultTokens, WIDTH)
    expect(nodes[0]).toMatchObject({
      font: defaultTokens.typography.h2.font,
      lineHeight: defaultTokens.typography.h2.lineHeight,
    })
  })

  test('paragraph → text with body typography and original spans', () => {
    const spans = [{ text: 'Hello ', bold: true as const }, { text: 'world' }]
    const nodes = blockToNodes({ type: 'paragraph', spans }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ type: 'text', spans, font: defaultTokens.typography.body.font })
  })

  test('bulletList → one text node per item prefixed with bullet', () => {
    const nodes = blockToNodes({ type: 'bulletList', items: ['A', 'B', 'C'] }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(3)
    expect((nodes[0] as { spans: { text: string }[] }).spans[0]!.text).toBe('• A')
    expect((nodes[1] as { spans: { text: string }[] }).spans[0]!.text).toBe('• B')
    expect((nodes[2] as { spans: { text: string }[] }).spans[0]!.text).toBe('• C')
  })

  test('orderedList → numbered items', () => {
    const nodes = blockToNodes(
      { type: 'orderedList', items: ['First', 'Second'] },
      defaultTokens,
      WIDTH,
    )
    expect((nodes[0] as { spans: { text: string }[] }).spans[0]!.text).toBe('1. First')
    expect((nodes[1] as { spans: { text: string }[] }).spans[0]!.text).toBe('2. Second')
  })

  test('steps → numbered items', () => {
    const nodes = blockToNodes({ type: 'steps', items: ['Do A', 'Do B'] }, defaultTokens, WIDTH)
    expect((nodes[0] as { spans: { text: string }[] }).spans[0]!.text).toBe('1. Do A')
    expect((nodes[1] as { spans: { text: string }[] }).spans[0]!.text).toBe('2. Do B')
  })

  test('quoteCard with author → container with text and author line', () => {
    const nodes = blockToNodes(
      { type: 'quoteCard', text: 'Quote', author: 'Alice' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type).toBe('container')
    const children = (nodes[0] as { children: { spans: { text: string }[] }[] }).children
    expect(children).toHaveLength(2)
    expect(children[1]!.spans[0]!.text).toBe('— Alice')
  })

  test('quoteCard without author → container with one child', () => {
    const nodes = blockToNodes({ type: 'quoteCard', text: 'Quote' }, defaultTokens, WIDTH)
    const children = (nodes[0] as { children: unknown[] }).children
    expect(children).toHaveLength(1)
  })

  test('codeBlock → container with code text using code font', () => {
    const nodes = blockToNodes({ type: 'codeBlock', code: 'const x = 1' }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.type).toBe('container')
    const child = (nodes[0] as { children: { spans: { text: string }[]; font: string }[] }).children[0]!
    expect(child.spans[0]!.text).toBe('const x = 1')
    expect(child.font).toBe(defaultTokens.typography.code.font)
  })

  test('image → image node with contentWidth and 9:16 height', () => {
    const nodes = blockToNodes(
      { type: 'image', src: 'https://example.com/img.png' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'image',
      src: 'https://example.com/img.png',
      width: WIDTH,
      height: Math.round(WIDTH * (9 / 16)),
    })
  })

  test('divider → thin rect with border color', () => {
    const nodes = blockToNodes({ type: 'divider' }, defaultTokens, WIDTH)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'rect',
      width: 'fill',
      height: 2,
      fill: { type: 'color', value: defaultTokens.colors.border },
    })
  })

  test('tags → single text node with hash-prefixed spans', () => {
    const nodes = blockToNodes(
      { type: 'tags', items: ['react', 'typescript'] },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(1)
    const spans = (nodes[0] as { spans: { text: string }[] }).spans
    expect(spans[0]!.text).toBe('#react ')
    expect(spans[1]!.text).toBe('#typescript ')
  })

  test('metric → value text (h1 color primary) then label text (caption subtext)', () => {
    const nodes = blockToNodes(
      { type: 'metric', label: 'Views', value: '10K' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({
      type: 'text',
      spans: [{ text: '10K' }],
      font: defaultTokens.typography.h1.font,
      color: defaultTokens.colors.primary,
    })
    expect(nodes[1]).toMatchObject({
      type: 'text',
      spans: [{ text: 'Views' }],
      font: defaultTokens.typography.caption.font,
      color: defaultTokens.colors.subtext,
    })
  })

  test('heroTitle with subtitle → title (h1) + subtitle (h2 subtext)', () => {
    const nodes = blockToNodes(
      { type: 'heroTitle', title: 'Main', subtitle: 'Sub' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({
      font: defaultTokens.typography.h1.font,
      color: defaultTokens.colors.text,
    })
    expect(nodes[1]).toMatchObject({
      font: defaultTokens.typography.h2.font,
      color: defaultTokens.colors.subtext,
    })
  })

  test('heroTitle without subtitle → single h1 text node', () => {
    const nodes = blockToNodes(
      { type: 'heroTitle', title: 'Only title' },
      defaultTokens,
      WIDTH,
    )
    expect(nodes).toHaveLength(1)
  })
})
