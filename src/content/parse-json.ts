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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function assertStringArray(values: unknown, label: string, index: number, type: string) {
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) {
    throw new Error(`Block ${index} (${type}) invalid '${label}' array`)
  }
}

function assertSpanArray(values: unknown, index: number) {
  if (!Array.isArray(values)) {
    throw new Error(`Block ${index} (paragraph) missing 'spans' array`)
  }

  for (const span of values) {
    if (!isRecord(span) || typeof span['text'] !== 'string') {
      throw new Error(`Block ${index} (paragraph) invalid 'spans' array`)
    }
  }
}

function assertBlock(item: unknown, index: number): ContentBlock {
  if (!isRecord(item)) {
    throw new Error(`Block at index ${index} is not an object`)
  }

  const block = item

  if (!block['type'] || typeof block['type'] !== 'string') {
    throw new Error(`Block at index ${index} is missing 'type' field`)
  }

  if (!VALID_TYPES.has(block['type'])) {
    throw new Error(`Block at index ${index} has unknown type '${block['type']}'`)
  }

  switch (block['type']) {
    case 'paragraph':
      assertSpanArray(block['spans'], index)
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
      assertStringArray(block['items'], 'items', index, block['type'])
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

  return block as ContentBlock
}

export function parseJson(raw: unknown): ContentBlock[] {
  if (!Array.isArray(raw)) {
    throw new Error('Expected array of ContentBlock')
  }

  return raw.map((item, index) => assertBlock(item, index))
}
