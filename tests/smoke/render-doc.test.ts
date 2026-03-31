import { test, expect, describe, beforeAll } from 'bun:test'
import { renderDoc, renderDocFromJson } from '../../src'
import { defaultTokens } from '../../src/templates/tokens/default'
import type { RenderConfig } from '../../src/types'
import { writeFileSync, mkdirSync } from 'node:fs'

const config: RenderConfig = {
  ds: defaultTokens,
  size: { width: 1080, height: 1440 },
  contentArea: { x: 72, y: 72, width: 936, height: 1296 },
}

const COVER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#102a43"/><stop offset="100%" stop-color="#ef8354"/>' +
      '</linearGradient></defs>' +
      '<rect width="1200" height="675" fill="url(#g)"/>' +
      '</svg>',
  )

const SINGLE_PAGE_MARKDOWN = `
# 今日份灵感

每一个清晨都是一次新的开始，让我们用**积极的心态**迎接每一天。

无论遇到多少困难，都要记住：*坚持就是胜利*。

## 今日金句

人生就是一场旅行，重要的不是目的地，而是沿途的风景。

---

保持微笑，温暖他人，也温暖自己。
`.trim()

const LONG_MARKDOWN = `
# 长内容分页测试

这是一段用于验证多页渲染的长文内容。

![封面图](${COVER_IMAGE})

${Array.from(
  { length: 24 },
  (_, i) =>
    `## 第 ${i + 1} 节\n\n本节内容用于拉长文档长度，确保分页器会在内容足够多时切换到下一页。`,
).join('\n\n')}
`.trim()

describe('renderDoc smoke tests', () => {
  beforeAll(() => {
    mkdirSync('tests/smoke/output', { recursive: true })
  })

  test('single-page markdown → PNG', async () => {
    const pages = await renderDoc(SINGLE_PAGE_MARKDOWN, config, { renderer: 'canvas' })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.format).toBe('png')
    expect((pages[0] as { data: Buffer }).data.byteLength).toBeGreaterThan(1000)
    writeFileSync('tests/smoke/output/doc-single.png', (pages[0] as { data: Buffer }).data)
  })

  test('single-page markdown → SVG', async () => {
    const pages = await renderDoc(SINGLE_PAGE_MARKDOWN, config, { renderer: 'svg' })
    expect(pages[0]!.format).toBe('svg')
    const svg = (pages[0] as { data: string }).data
    expect(svg).toContain('<svg')
    expect(svg).toContain('今日份灵感')
    writeFileSync('tests/smoke/output/doc-single.svg', svg)
  })

  test('single-page markdown → HTML', async () => {
    const pages = await renderDoc(SINGLE_PAGE_MARKDOWN, config, { renderer: 'html' })
    expect(pages[0]!.format).toBe('html')
    const html = (pages[0] as { data: string }).data
    expect(html).toContain('今日份灵感')
    expect(html).toContain('今日金句')
    writeFileSync('tests/smoke/output/doc-single.html', html)
  })

  test('long markdown → multiple PNG pages', async () => {
    const pages = await renderDoc(LONG_MARKDOWN, config, { renderer: 'canvas' })
    expect(pages.length).toBeGreaterThan(1)
    pages.forEach((page, index) => {
      writeFileSync(
        `tests/smoke/output/doc-long-${String(index + 1).padStart(2, '0')}.png`,
        (page as { data: Buffer }).data,
      )
    })
  })

  test('json input → PNG', async () => {
    const pages = await renderDocFromJson(
      [
        { type: 'heroTitle', title: 'JSON 输入测试', subtitle: '副标题文字' },
        { type: 'paragraph', spans: [{ text: '直接传入 ContentBlock[] 也可以工作。' }] },
        { type: 'tags', items: ['测试', 'json', '渲染'] },
      ],
      config,
      { renderer: 'canvas' },
    )
    expect(pages[0]!.format).toBe('png')
    writeFileSync('tests/smoke/output/doc-json.png', (pages[0] as { data: Buffer }).data)
  })
})
