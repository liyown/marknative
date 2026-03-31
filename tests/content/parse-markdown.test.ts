import { test, expect, describe } from 'bun:test'
import { parseMarkdown } from '../../src/content/parse-markdown'

describe('parseMarkdown', () => {
  test('h1 → heroTitle', () => {
    expect(parseMarkdown('# 今日份灵感')).toEqual([
      { type: 'heroTitle', title: '今日份灵感' },
    ])
  })

  test('h2 → heading level 2', () => {
    expect(parseMarkdown('## 副标题')).toEqual([
      { type: 'heading', level: 2, text: '副标题' },
    ])
  })

  test('paragraph → paragraph with spans', () => {
    expect(parseMarkdown('Hello world')).toEqual([
      { type: 'paragraph', spans: [{ text: 'Hello world' }] },
    ])
  })

  test('bold in paragraph → span with bold:true', () => {
    const blocks = parseMarkdown('普通 **加粗** 文字')
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        spans: [
          { text: '普通 ' },
          { text: '加粗', bold: true },
          { text: ' 文字' },
        ],
      },
    ])
  })

  test('link in paragraph → span with link', () => {
    expect(parseMarkdown('访问 [官网](https://example.com)')).toEqual([
      {
        type: 'paragraph',
        spans: [
          { text: '访问 ' },
          { text: '官网', link: 'https://example.com' },
        ],
      },
    ])
  })

  test('unordered list → bulletList', () => {
    expect(parseMarkdown('- 苹果\n- 香蕉')).toEqual([
      { type: 'bulletList', items: ['苹果', '香蕉'] },
    ])
  })

  test('unordered list with inline markdown → normalized items', () => {
    expect(parseMarkdown('- hello **bold** [link](https://a.com)')).toEqual([
      { type: 'bulletList', items: ['hello bold link'] },
    ])
  })

  test('ordered list → orderedList', () => {
    expect(parseMarkdown('1. 第一步\n2. 第二步')).toEqual([
      { type: 'orderedList', items: ['第一步', '第二步'] },
    ])
  })

  test('blockquote → quoteCard', () => {
    expect(parseMarkdown('> 人生苦短')).toEqual([
      { type: 'quoteCard', text: '人生苦短' },
    ])
  })

  test('blockquote with inline markdown → normalized text', () => {
    expect(parseMarkdown('> hello **bold** [link](https://a.com)')).toEqual([
      { type: 'quoteCard', text: 'hello bold link' },
    ])
  })

  test('blockquote with multiple paragraphs → preserves boundary', () => {
    expect(parseMarkdown('> one\n>\n> two')).toEqual([
      { type: 'quoteCard', text: 'one\ntwo' },
    ])
  })

  test('blockquote with list item → preserves item text', () => {
    expect(parseMarkdown('> - item')).toEqual([{ type: 'quoteCard', text: 'item' }])
  })

  test('blockquote with heading → preserves heading text', () => {
    expect(parseMarkdown('> # heading')).toEqual([
      { type: 'quoteCard', text: 'heading' },
    ])
  })

  test('code block → codeBlock', () => {
    expect(parseMarkdown('```js\nconsole.log(1)\n```')).toEqual([
      { type: 'codeBlock', code: 'console.log(1)', language: 'js' },
    ])
  })

  test('hr → divider', () => {
    expect(parseMarkdown('---')).toEqual([{ type: 'divider' }])
  })

  test('image → image block', () => {
    expect(parseMarkdown('![alt](https://example.com/img.png)')).toEqual([
      { type: 'image', src: 'https://example.com/img.png', alt: 'alt' },
    ])
  })

  test('mixed content → multiple blocks', () => {
    const blocks = parseMarkdown('# Title\n\nSome text.')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'heroTitle', title: 'Title' })
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      spans: [{ text: 'Some text.' }],
    })
  })
})
