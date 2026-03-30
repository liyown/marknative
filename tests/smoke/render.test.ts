import { test, expect, describe, beforeAll } from 'bun:test'
import { renderMarkdown, renderJson } from '../../src'
import { articleTemplate } from '../../src/templates/content/article'
import { heroTemplate } from '../../src/templates/cover/hero'
import { summaryTemplate } from '../../src/templates/ending/summary'
import type { TemplateFamily } from '../../src/types'
import { writeFileSync, mkdirSync } from 'node:fs'

const family: TemplateFamily = { content: articleTemplate }
const multiPageFamily: TemplateFamily = {
  cover: heroTemplate,
  content: articleTemplate,
  ending: summaryTemplate,
}

const MARKDOWN = `
# 今日份灵感

每一个清晨都是一次新的开始，让我们用**积极的心态**迎接每一天。

无论遇到多少困难，都要记住：*坚持就是胜利*。

## 今日金句

人生就是一场旅行，重要的不是目的地，而是沿途的风景。

---

保持微笑，温暖他人，也温暖自己。
`.trim()

const LONG_MARKDOWN = `
![封面图](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9WQAAAAASUVORK5CYII=)

# 长内容分页测试

这是一段用于验证多页渲染的长文内容。它会不断重复，直到超过单页的可承载范围。

${Array.from({ length: 24 }, (_, index) => `## 第 ${index + 1} 节

本节内容用于拉长文档长度，并确保分页器会在内容足够多时切换到下一页。

我们希望第一页保留封面图，后续页面继续承载正文，直到最后一页使用 summary 模板收尾。`).join('\n\n')}
`.trim()

describe('end-to-end render', () => {
  beforeAll(() => {
    mkdirSync('tests/smoke/output', { recursive: true })
  })

  test('renderMarkdown → PNG Buffer', async () => {
    const pages = await renderMarkdown(MARKDOWN, family, { renderer: 'canvas', format: 'png' })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.format).toBe('png')
    expect((pages[0] as { format: 'png'; data: Buffer }).data.byteLength).toBeGreaterThan(1000)
    writeFileSync('tests/smoke/output/article.png', (pages[0] as { data: Buffer }).data)
  })

  test('renderMarkdown → SVG string', async () => {
    const pages = await renderMarkdown(MARKDOWN, family, { renderer: 'svg' })
    expect(pages[0]!.format).toBe('svg')
    const svg = (pages[0] as { data: string }).data
    expect(svg).toContain('<svg')
    expect(svg).toContain('今日份灵感')
    writeFileSync('tests/smoke/output/article.svg', svg)
  })

  test('renderMarkdown → HTML string', async () => {
    const pages = await renderMarkdown(MARKDOWN, family, { renderer: 'html' })
    expect(pages[0]!.format).toBe('html')
    const html = (pages[0] as { data: string }).data
    expect(html).toContain('今日份灵感')
    writeFileSync('tests/smoke/output/article.html', html)
  })

  test('renderJson → PNG Buffer', async () => {
    const input = [
      { type: 'heroTitle', title: 'JSON 输入测试' },
      { type: 'paragraph', spans: [{ text: '直接传入 ContentBlock[] 也可以工作' }] },
    ]
    const pages = await renderJson(input, family, { renderer: 'canvas' })
    expect(pages[0]!.format).toBe('png')
    writeFileSync('tests/smoke/output/json-input.png', (pages[0] as { data: Buffer }).data)
  })

  test('renderMarkdown → multiple pages with template family', async () => {
    const pages = await renderMarkdown(LONG_MARKDOWN, multiPageFamily, {
      renderer: 'canvas',
      format: 'png',
    })

    expect(pages.length).toBeGreaterThan(1)
    expect(pages[0]!.format).toBe('png')
    expect(pages.at(-1)!.format).toBe('png')

    pages.forEach((page, index) => {
      writeFileSync(
        `tests/smoke/output/long-content-${String(index + 1).padStart(2, '0')}.png`,
        (page as { data: Buffer }).data,
      )
    })
  })
})
