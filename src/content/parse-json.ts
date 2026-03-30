import type { ContentBlock } from '../types'

const VALID_TYPES = new Set([
  'heading',
  'paragraph',
  'bulletList',
  'orderedList',
  'steps',
  'quoteCard',
  'metric',
  'tags',
  'image',
  'codeBlock',
  'divider',
  'heroTitle',
])

function assertBlock(item: unknown, index: number): ContentBlock {
  if (!item || typeof item !== 'object') {
    throw new Error(`Block at index ${index} is not an object`)
  }

  const block = item as Record<string, unknown>

  if (!block['type'] || typeof block['type'] !== 'string') {
    throw new Error(`Block at index ${index} is missing 'type' field`)
  }

  if (!VALID_TYPES.has(block['type'])) {
    throw new Error(`Block at index ${index} has unknown type '${block['type']}'`)
  }

  switch (block['type']) {
    case 'paragraph':
      if (!Array.isArray(block['spans'])) {
        throw new Error(`Block ${index} (paragraph) missing 'spans' array`)
      }
      break
    case 'heading':
      if (typeof block['text'] !== 'string') {
        throw new Error(`Block ${index} (heading) missing 'text'`)
      }
      if (![1, 2, 3].includes(block['level'] as number)) {
        throw new Error(`Block ${index} (heading) invalid 'level'`)
      }
      break
    case 'bulletList':
    case 'orderedList':
    case 'steps':
    case 'tags':
      if (!Array.isArray(block['items'])) {
        throw new Error(`Block ${index} (${block['type']}) missing 'items' array`)
      }
      break
    case 'heroTitle':
      if (typeof block['title'] !== 'string') {
        throw new Error(`Block ${index} (heroTitle) missing 'title'`)
      }
      break
    case 'quoteCard':
      if (typeof block['text'] !== 'string') {
        throw new Error(`Block ${index} (quoteCard) missing 'text'`)
      }
      break
    case 'metric':
      if (typeof block['label'] !== 'string' || typeof block['value'] !== 'string') {
        throw new Error(`Block ${index} (metric) missing 'label' or 'value'`)
      }
      break
    case 'image':
      if (typeof block['src'] !== 'string') {
        throw new Error(`Block ${index} (image) missing 'src'`)
      }
      break
    case 'codeBlock':
      if (typeof block['code'] !== 'string') {
        throw new Error(`Block ${index} (codeBlock) missing 'code'`)
      }
      break
  }

  return block as unknown as ContentBlock
}

export function parseJson(raw: unknown): ContentBlock[] {
  if (!Array.isArray(raw)) {
    throw new Error('Expected array of ContentBlock')
  }

  return raw.map((item, index) => assertBlock(item, index))
}
