import { test, expect, describe } from 'bun:test'
import { paginateContent } from '../../src/template/paginator'
import type { ContentBlock } from '../../src/types'
import { articleTemplate } from '../../src/templates/content/article'
import { summaryTemplate } from '../../src/templates/ending/summary'

const makeBlocks = (n: number): ContentBlock[] =>
  Array.from({ length: n }, (_, i) => ({
    type: 'paragraph' as const,
    spans: [{ text: `段落 ${i + 1}：这是一段足够长的文字，用于测试分页是否正确触发。每行文字都会占用一定高度。` }],
  }))

describe('paginateContent', () => {
  test('small content → single page', () => {
    const pages = paginateContent(makeBlocks(2), articleTemplate)
    expect(pages).toHaveLength(1)
  })

  test('large content → multiple pages', () => {
    const pages = paginateContent(makeBlocks(30), articleTemplate)
    expect(pages.length).toBeGreaterThan(1)
  })

  test('all blocks are preserved across pages', () => {
    const blocks = makeBlocks(20)
    const pages = paginateContent(blocks, articleTemplate)
    const allBlocks = pages.flat()
    expect(allBlocks).toEqual(blocks)
  })

  test('empty input → one empty page', () => {
    const pages = paginateContent([], articleTemplate)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toEqual([])
  })

  test('long lists can trigger pagination with per-item height estimation', () => {
    const listText =
      '第X项内容：这是一段特别长的列表文本，用来测试每个列表项在分页时是否会按实际换行高度计算，而不是只按单行估算。'
        .repeat(5)
    const listBlock: ContentBlock = {
      type: 'bulletList',
      items: Array.from({ length: 20 }, (_, i) => `第 ${i + 1} 项：${listText}`),
    }
    const blocks: ContentBlock[] = [
      listBlock,
      { type: 'paragraph', spans: [{ text: '列表之后的正文段落。' }] },
    ]

    const pages = paginateContent(blocks, articleTemplate)

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.flat()).toEqual(blocks)
  })

  test('oversized block stays isolated on its own page', () => {
    const oversized: ContentBlock = {
      type: 'paragraph',
      spans: [
        {
          text:
            '超大段落 '.repeat(400) +
            '这段文本足够长，应该单独占据一页而不会和前后内容合并。',
        },
      ],
    }
    const blocks: ContentBlock[] = [
      { type: 'paragraph', spans: [{ text: '第一页内容。' }] },
      oversized,
      { type: 'paragraph', spans: [{ text: '尾页内容。' }] },
    ]

    const pages = paginateContent(blocks, articleTemplate)

    expect(pages.length).toBeGreaterThanOrEqual(3)
    expect(pages[1]).toEqual([oversized])
    expect(pages.flat()).toEqual(blocks)
  })

  test('ending template repacks the tail to reduce last-page whitespace', () => {
    const blocks: ContentBlock[] = [
      { type: 'heroTitle', title: '长内容分页测试' },
      { type: 'paragraph', spans: [{ text: '这是一段用于验证多页渲染的长文内容。它会不断重复，直到超过单页的可承载范围。' }] },
      ...Array.from({ length: 24 }, (_, index) => ([
        { type: 'heading' as const, level: 2 as const, text: `第 ${index + 1} 节` },
        { type: 'paragraph' as const, spans: [{ text: '本节内容用于拉长文档长度，并确保分页器会在内容足够多时切换到下一页。' }] },
        { type: 'paragraph' as const, spans: [{ text: '我们希望第一页保留封面图，后续页面继续承载正文，直到最后一页使用 summary 模板收尾。' }] },
      ])).flat(),
    ]

    const plainPages = paginateContent(blocks, articleTemplate)
    const endingAwarePages = paginateContent(blocks, articleTemplate, {
      endingTemplate: summaryTemplate,
    })

    expect(plainPages.flat()).toEqual(blocks)
    expect(endingAwarePages.flat()).toEqual(blocks)
    expect(endingAwarePages.length).toBeGreaterThanOrEqual(2)
  })

})
