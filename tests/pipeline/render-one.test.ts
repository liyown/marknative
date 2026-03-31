import { describe, expect, test } from 'bun:test'
import { renderMarkdown, validateRenderOptions } from '../../src/pipeline/render-one'
import { articleTemplate } from '../../src/templates/content/article'
import { heroTemplate } from '../../src/templates/cover/hero'
import { summaryTemplate } from '../../src/templates/ending/summary'

describe('validateRenderOptions', () => {
  test('defaults to canvas backend and png format', () => {
    expect(validateRenderOptions({})).toEqual({
      backend: 'canvas',
      format: 'png',
    })
  })

  test('allows canvas with png format', () => {
    expect(
      validateRenderOptions({ renderer: 'canvas', format: 'png' }),
    ).toEqual({
      backend: 'canvas',
      format: 'png',
    })
  })

  test('rejects canvas with svg and html formats', () => {
    expect(() =>
      validateRenderOptions({ renderer: 'canvas', format: 'svg' }),
    ).toThrow("Cannot use renderer 'canvas' with vector format 'svg'")
    expect(() =>
      validateRenderOptions({ renderer: 'canvas', format: 'html' }),
    ).toThrow("Cannot use renderer 'canvas' with vector format 'html'")
  })

  test('allows svg renderer only with native format or no format', () => {
    expect(validateRenderOptions({ renderer: 'svg' })).toEqual({
      backend: 'svg',
      format: 'svg',
    })
    expect(
      validateRenderOptions({ renderer: 'svg', format: 'svg' }),
    ).toEqual({
      backend: 'svg',
      format: 'svg',
    })
  })

  test('rejects svg renderer with non-native formats', () => {
    expect(() =>
      validateRenderOptions({ renderer: 'svg', format: 'png' }),
    ).toThrow("Cannot use renderer 'svg' with format 'png'")
    expect(() =>
      validateRenderOptions({ renderer: 'svg', format: 'html' }),
    ).toThrow("Cannot use renderer 'svg' with format 'html'")
  })

  test('allows html renderer only with native format or no format', () => {
    expect(validateRenderOptions({ renderer: 'html' })).toEqual({
      backend: 'html',
      format: 'html',
    })
    expect(
      validateRenderOptions({ renderer: 'html', format: 'html' }),
    ).toEqual({
      backend: 'html',
      format: 'html',
    })
  })

  test('rejects html renderer with non-native formats', () => {
    expect(() =>
      validateRenderOptions({ renderer: 'html', format: 'png' }),
    ).toThrow("Cannot use renderer 'html' with format 'png'")
    expect(() =>
      validateRenderOptions({ renderer: 'html', format: 'svg' }),
    ).toThrow("Cannot use renderer 'html' with format 'svg'")
  })
})

describe('renderMarkdown', () => {
  test('cover page only consumes image and hero title so section one starts on page two', async () => {
    const markdown = `
![封面图](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9WQAAAAASUVORK5CYII=)

# 长内容分页测试

这是一段用于验证多页渲染的长文内容。

## 第 1 节

本节内容用于拉长文档长度，并确保分页器会在内容足够多时切换到下一页。

我们希望第一页保留封面图，后续页面继续承载正文，直到最后一页使用 summary 模板收尾。

## 第 2 节

本节内容用于拉长文档长度，并确保分页器会在内容足够多时切换到下一页。

我们希望第一页保留封面图，后续页面继续承载正文，直到最后一页使用 summary 模板收尾。

## 第 3 节

本节内容用于拉长文档长度，并确保分页器会在内容足够多时切换到下一页。
`.trim()

    const pages = await renderMarkdown(
      markdown,
      { cover: heroTemplate, content: articleTemplate, ending: summaryTemplate },
      { renderer: 'html' },
    )

    expect(pages.length).toBeGreaterThan(1)
    expect((pages[0] as { data: string }).data).toContain('长内容分页测试')
    expect((pages[0] as { data: string }).data).not.toContain('第 1 节')
    expect((pages[1] as { data: string }).data).toContain('第 1 节')
    expect((pages[1] as { data: string }).data).toContain('第 2 节')
  })
})
