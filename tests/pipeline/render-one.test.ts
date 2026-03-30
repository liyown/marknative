import { describe, expect, mock, test } from 'bun:test'
import type { TemplateFamily } from '../../src/types'

mock.module('../../src/template/engine', () => ({
  applyTemplate: mock(() => ({ type: 'container', width: 1, height: 1, children: [] })),
}))

mock.module('../../src/layout/engine', () => ({
  computeLayoutBoxes: mock(async () => []),
}))

const renderCanvas = mock(async () => ({ format: 'png', data: Buffer.from('canvas') }))
const renderSvg = mock(async () => ({ format: 'svg', data: '<svg />' }))
const renderHtml = mock(async () => ({ format: 'html', data: '<html />' }))

mock.module('../../src/renderer/canvas', () => ({ renderPageCanvas: renderCanvas }))
mock.module('../../src/renderer/svg', () => ({ renderPageSvg: renderSvg }))
mock.module('../../src/renderer/html', () => ({ renderPageHtml: renderHtml }))

const { renderContent } = await import('../../src/pipeline/render-one')

const family: TemplateFamily = {
  content: {
    id: 'content',
    size: { width: 100, height: 100 },
    tokens: {
      colors: {
        bg: '#fff',
        text: '#000',
        subtext: '#000',
        primary: '#000',
        accent: '#000',
        border: '#000',
      },
      typography: {
        h1: { font: 'sans', lineHeight: 1 },
        h2: { font: 'sans', lineHeight: 1 },
        body: { font: 'sans', lineHeight: 1 },
        caption: { font: 'sans', lineHeight: 1 },
        code: { font: 'sans', lineHeight: 1 },
      },
      spacing: { xs: 1, sm: 1, md: 1, lg: 1, xl: 1 },
      radius: { sm: 1, md: 1, lg: 1 },
    },
    contentArea: { x: 0, y: 0, width: 100, height: 100 },
    root: { type: 'container', width: 100, height: 100, children: [] },
  },
}

describe('renderContent option guards', () => {
  test('allows canvas with default and png formats', async () => {
    await expect(renderContent([], family, {})).resolves.toHaveLength(1)
    await expect(renderContent([], family, { renderer: 'canvas', format: 'png' })).resolves.toHaveLength(1)
    expect(renderCanvas).toHaveBeenCalledTimes(2)
  })

  test('rejects canvas with svg and html formats', async () => {
    await expect(
      renderContent([], family, { renderer: 'canvas', format: 'svg' }),
    ).rejects.toThrow("Cannot use renderer 'canvas' with vector format 'svg'")
    await expect(
      renderContent([], family, { renderer: 'canvas', format: 'html' }),
    ).rejects.toThrow("Cannot use renderer 'canvas' with vector format 'html'")
  })

  test('allows svg renderer only with native format or no format', async () => {
    await expect(renderContent([], family, { renderer: 'svg' })).resolves.toHaveLength(1)
    await expect(renderContent([], family, { renderer: 'svg', format: 'svg' })).resolves.toHaveLength(1)
    expect(renderSvg).toHaveBeenCalledTimes(2)
  })

  test('rejects svg renderer with non-native formats', async () => {
    await expect(
      renderContent([], family, { renderer: 'svg', format: 'png' }),
    ).rejects.toThrow("Cannot use renderer 'svg' with format 'png'")
    await expect(
      renderContent([], family, { renderer: 'svg', format: 'html' }),
    ).rejects.toThrow("Cannot use renderer 'svg' with format 'html'")
  })

  test('allows html renderer only with native format or no format', async () => {
    await expect(renderContent([], family, { renderer: 'html' })).resolves.toHaveLength(1)
    await expect(renderContent([], family, { renderer: 'html', format: 'html' })).resolves.toHaveLength(1)
    expect(renderHtml).toHaveBeenCalledTimes(2)
  })

  test('rejects html renderer with non-native formats', async () => {
    await expect(
      renderContent([], family, { renderer: 'html', format: 'png' }),
    ).rejects.toThrow("Cannot use renderer 'html' with format 'png'")
    await expect(
      renderContent([], family, { renderer: 'html', format: 'svg' }),
    ).rejects.toThrow("Cannot use renderer 'html' with format 'svg'")
  })
})
