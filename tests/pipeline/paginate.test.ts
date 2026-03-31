import { describe, expect, test } from 'bun:test'
import { paginateByHeights } from '../../src/pipeline/paginate'
import type { ContentBlock } from '../../src/types'

function makeBlocks(n: number): ContentBlock[] {
  return Array.from({ length: n }, (_, i) => ({
    type: 'paragraph' as const,
    spans: [{ text: `Block ${i}` }],
  }))
}

describe('paginateByHeights', () => {
  test('empty blocks returns single empty page', () => {
    const pages = paginateByHeights([], [], 1000, 20)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(0)
  })

  test('single block fits on one page', () => {
    const blocks = makeBlocks(1)
    const pages = paginateByHeights(blocks, [100], 1000, 20)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(1)
  })

  test('blocks within page height stay on one page', () => {
    // 100 + (20+100) + (20+100) = 340 < 400
    const blocks = makeBlocks(3)
    const pages = paginateByHeights(blocks, [100, 100, 100], 400, 20)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(3)
  })

  test('splits when accumulated height + gap exceeds page height', () => {
    // page 1: 100 + (20+100) + (20+100) = 340 ≤ 350
    // block 3: 340 + 20 + 100 = 460 > 350 → new page
    const blocks = makeBlocks(4)
    const pages = paginateByHeights(blocks, [100, 100, 100, 100], 350, 20)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toHaveLength(3)
    expect(pages[1]).toHaveLength(1)
  })

  test('block taller than page height gets its own page', () => {
    const blocks = makeBlocks(3)
    const pages = paginateByHeights(blocks, [100, 2000, 100], 500, 20)
    expect(pages).toHaveLength(3)
    expect(pages[0]).toHaveLength(1)
    expect(pages[1]).toHaveLength(1)
    expect(pages[2]).toHaveLength(1)
  })

  test('exact fit keeps blocks on same page', () => {
    // 100 + (20+80) = 200 === 200
    const blocks = makeBlocks(2)
    const pages = paginateByHeights(blocks, [100, 80], 200, 20)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(2)
  })

  test('preserves block order across pages', () => {
    const blocks = makeBlocks(4)
    const pages = paginateByHeights(blocks, [100, 100, 100, 100], 250, 20)
    expect(pages.flat()).toEqual(blocks)
  })

  test('no gap on first block of each page', () => {
    // page 1 starts: 0 + 300 = 300 ≤ 300 (fits exactly, no gap on first)
    // block 1: 300 + 20 + 300 = 620 > 300 → new page
    const blocks = makeBlocks(2)
    const pages = paginateByHeights(blocks, [300, 300], 300, 20)
    expect(pages).toHaveLength(2)
  })
})
