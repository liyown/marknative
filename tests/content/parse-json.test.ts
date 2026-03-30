import { test, expect, describe } from 'bun:test'
import type { ContentBlock } from '../../src/types'
import { parseJson } from '../../src/content/parse-json'

describe('parseJson', () => {
  test('valid ContentBlock[] passes through', () => {
    const input: ContentBlock[] = [
      { type: 'paragraph', spans: [{ text: 'Hello' }] },
      { type: 'divider' },
    ]
    expect(parseJson(input)).toEqual(input)
  })

  test('throws on non-array', () => {
    expect(() => parseJson({ type: 'paragraph' })).toThrow('Expected array')
  })

  test('throws on unknown block type', () => {
    expect(() => parseJson([{ type: 'unknown_type' }])).toThrow()
  })

  test('throws on paragraph missing spans', () => {
    expect(() => parseJson([{ type: 'paragraph' }])).toThrow()
  })

  test('heroTitle block passes through', () => {
    const input: ContentBlock[] = [
      { type: 'heroTitle', title: 'My Title', subtitle: 'Sub' },
    ]
    expect(parseJson(input)).toEqual(input)
  })
})
