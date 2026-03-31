import type { ContentBlock } from '../types'

export function paginateByHeights(
  blocks: ContentBlock[],
  heights: number[],
  pageHeight: number,
  blockGap: number,
): ContentBlock[][] {
  if (blocks.length === 0) return [[]]

  const pages: ContentBlock[][] = []
  let current: ContentBlock[] = []
  let usedHeight = 0

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!
    const h = heights[index] ?? 0
    const gap = current.length > 0 ? blockGap : 0
    const needed = h + gap

    if (h > pageHeight) {
      if (current.length > 0) {
        pages.push(current)
        current = []
        usedHeight = 0
      }
      pages.push([block])
      continue
    }

    if (current.length > 0 && usedHeight + needed > pageHeight) {
      pages.push(current)
      current = [block]
      usedHeight = h
    } else {
      current.push(block)
      usedHeight += needed
    }
  }

  if (current.length > 0) {
    pages.push(current)
  }

  return pages
}
