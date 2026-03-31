import { describe, expect, test } from 'bun:test'
import { measureBlocks } from '../../src/pipeline/measure'
import { defaultTokens } from '../../src/templates/tokens/default'
import type { ContentBlock } from '../../src/types'

const WIDTH = 936

describe('measureBlocks', () => {
  test('returns one height per block', async () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', level: 1, text: 'Title' },
      { type: 'paragraph', spans: [{ text: 'Body text here.' }] },
      { type: 'divider' },
    ]
    const heights = await measureBlocks(blocks, defaultTokens, WIDTH)
    expect(heights).toHaveLength(3)
    heights.forEach(h => expect(h).toBeGreaterThanOrEqual(0))
  })

  test('longer paragraph is taller than shorter one', async () => {
    const short: ContentBlock = { type: 'paragraph', spans: [{ text: 'Short.' }] }
    const long: ContentBlock = { type: 'paragraph', spans: [{ text: 'A'.repeat(600) }] }
    const heights = await measureBlocks([short, long], defaultTokens, WIDTH)
    expect(heights[1]).toBeGreaterThan(heights[0]!)
  })

  test('quoteCard with author is taller than without', async () => {
    const withAuthor: ContentBlock = { type: 'quoteCard', text: 'Some quote', author: 'Alice' }
    const withoutAuthor: ContentBlock = { type: 'quoteCard', text: 'Some quote' }
    const heights = await measureBlocks([withAuthor, withoutAuthor], defaultTokens, WIDTH)
    expect(heights[0]).toBeGreaterThan(heights[1]!)
  })

  test('narrower contentWidth wraps text more and increases height', async () => {
    const block: ContentBlock = {
      type: 'paragraph',
      spans: [{ text: 'This is a medium-length paragraph for testing layout width effects on text wrapping.' }],
    }
    const [wideH] = await measureBlocks([block], defaultTokens, 936)
    const [narrowH] = await measureBlocks([block], defaultTokens, 300)
    expect(narrowH!).toBeGreaterThanOrEqual(wideH!)
  })

  test('empty blocks list returns empty array', async () => {
    const heights = await measureBlocks([], defaultTokens, WIDTH)
    expect(heights).toHaveLength(0)
  })
})
