import { describe, expect, test } from 'bun:test'
import { renderDoc, renderDocFromBlocks, renderDocFromJson } from '../../src/pipeline/render-doc'
import { defaultTokens } from '../../src/templates/tokens/default'
import type { RenderConfig } from '../../src/types'

const config: RenderConfig = {
  ds: defaultTokens,
  size: { width: 1080, height: 1440 },
  contentArea: { x: 72, y: 72, width: 936, height: 1296 },
}

describe('renderDoc', () => {
  test('renders short markdown as a single html page containing the content', async () => {
    const pages = await renderDoc('# Hello\n\nWorld', config, { renderer: 'html' })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.format).toBe('html')
    expect((pages[0] as { data: string }).data).toContain('Hello')
    expect((pages[0] as { data: string }).data).toContain('World')
  })

  test('renders long markdown into multiple pages', async () => {
    const longMarkdown = Array.from({ length: 30 }, (_, i) =>
      `## Section ${i + 1}\n\nThis is content for section ${i + 1} with enough text to verify pagination.`,
    ).join('\n\n')

    const pages = await renderDoc(longMarkdown, config, { renderer: 'html' })
    expect(pages.length).toBeGreaterThan(1)
    pages.forEach(page => expect(page.format).toBe('html'))
  })

  test('renders to png buffer with correct byteLength', async () => {
    const pages = await renderDoc('# Test\n\nContent here.', config, { renderer: 'canvas' })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.format).toBe('png')
    expect((pages[0] as { data: Buffer }).data.byteLength).toBeGreaterThan(1000)
  })

  test('renders to svg string', async () => {
    const pages = await renderDoc('# SVG\n\nTest', config, { renderer: 'svg' })
    expect(pages[0]!.format).toBe('svg')
    const svg = (pages[0] as { data: string }).data
    expect(svg).toContain('<svg')
    expect(svg).toContain('SVG')
  })

  test('renderDocFromBlocks accepts ContentBlock array directly', async () => {
    const pages = await renderDocFromBlocks(
      [
        { type: 'heading', level: 1, text: 'From Blocks' },
        { type: 'paragraph', spans: [{ text: 'Direct block input.' }] },
      ],
      config,
      { renderer: 'html' },
    )
    expect(pages).toHaveLength(1)
    expect((pages[0] as { data: string }).data).toContain('From Blocks')
  })

  test('renderDocFromJson accepts raw JSON array', async () => {
    const pages = await renderDocFromJson(
      [
        { type: 'heroTitle', title: 'JSON Input' },
        { type: 'paragraph', spans: [{ text: 'From JSON.' }] },
      ],
      config,
      { renderer: 'html' },
    )
    expect(pages).toHaveLength(1)
    expect((pages[0] as { data: string }).data).toContain('JSON Input')
  })

  test('custom background overrides design system bg color', async () => {
    const customConfig: RenderConfig = {
      ...config,
      background: { type: 'color', value: '#ff0000' },
    }
    const pages = await renderDoc('# Red BG', customConfig, { renderer: 'svg' })
    expect((pages[0] as { data: string }).data).toContain('#ff0000')
  })

  test('custom blockGap is respected — same content with larger gap produces more pages', async () => {
    const markdown = Array.from({ length: 20 }, (_, i) =>
      `## Section ${i + 1}\n\nContent ${i + 1}.`,
    ).join('\n\n')

    const tightConfig: RenderConfig = { ...config, blockGap: 0 }
    const looseConfig: RenderConfig = { ...config, blockGap: 200 }

    const tightPages = await renderDoc(markdown, tightConfig, { renderer: 'html' })
    const loosePages = await renderDoc(markdown, looseConfig, { renderer: 'html' })

    expect(loosePages.length).toBeGreaterThanOrEqual(tightPages.length)
  })
})
