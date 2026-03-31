import { test, expect, describe } from 'bun:test'
import { selectTemplates } from '../../src/template/selector'
import type { ContentBlock, TemplateFamily, Template } from '../../src/types'
import { articleTemplate } from '../../src/templates/content/article'

const makeTemplate = (id: string): Template => ({
  ...articleTemplate,
  id,
})

const blocks1: ContentBlock[] = [{ type: 'paragraph', spans: [{ text: 'Page 1' }] }]
const blocks2: ContentBlock[] = [{ type: 'paragraph', spans: [{ text: 'Page 2' }] }]
const blocks3: ContentBlock[] = [{ type: 'paragraph', spans: [{ text: 'Page 3' }] }]

describe('selectTemplates', () => {
  test('single page uses content template', () => {
    const family: TemplateFamily = { content: makeTemplate('content') }
    const result = selectTemplates([[...blocks1]], family)
    expect(result).toHaveLength(1)
    expect(result[0]!.template.id).toBe('content')
  })

  test('first page uses cover when family.cover exists and the page has an image block', () => {
    const family: TemplateFamily = {
      cover: makeTemplate('cover'),
      content: makeTemplate('content'),
    }
    const pagesWithImage: ContentBlock[][] = [
      [{ type: 'image', src: 'cover.jpg' }, ...blocks1],
      [...blocks2],
    ]
    const result = selectTemplates(pagesWithImage, family)
    expect(result[0]!.template.id).toBe('cover')
    expect(result[1]!.template.id).toBe('content')
  })

  test('last page uses ending template when provided', () => {
    const family: TemplateFamily = {
      content: makeTemplate('content'),
      ending: makeTemplate('ending'),
    }
    const result = selectTemplates([[...blocks1], [...blocks2], [...blocks3]], family)
    expect(result[0]!.template.id).toBe('content')
    expect(result[1]!.template.id).toBe('content')
    expect(result[2]!.template.id).toBe('ending')
  })

  test('single page with cover and ending still uses content', () => {
    const family: TemplateFamily = {
      cover: makeTemplate('cover'),
      content: makeTemplate('content'),
      ending: makeTemplate('ending'),
    }
    const result = selectTemplates([[...blocks1]], family)
    expect(result[0]!.template.id).toBe('content')
  })
})
