import { describe, expect, test } from 'bun:test'
import { Canvas, loadImage } from 'skia-canvas'

import { renderMarkdown } from '../../../src/render/render-markdown'
import type { Painter } from '../../../src/paint/types'
import { defaultTheme } from '../../../src/theme/default-theme'

describe('renderMarkdown png', () => {
  test('renders markdown into png pages through the default painter', async () => {
    const pages = await renderMarkdown('# Title\n\nParagraph', { format: 'png' })

    expect(pages).toHaveLength(1)

    const page = pages[0]

    if (!page) {
      throw new Error('Expected one rendered page')
    }

    expect(page.format).toBe('png')
    expect(page.page.width).toBe(defaultTheme.page.width)
    expect(page.page.height).toBe(defaultTheme.page.height)
    expect(Buffer.isBuffer(page.data)).toBe(true)

    const image = await loadImage(page.data)
    expect(image.width).toBe(page.page.width * 2)
    expect(image.height).toBe(page.page.height * 2)

    const canvas = new Canvas(image.width, image.height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)

    const pixels = context.getImageData(0, 0, image.width, image.height).data
    expect(countNonWhitePixels(pixels)).toBeGreaterThan(0)
  })

  test('restores measurement shims before invoking a custom painter', async () => {
    const originalOffscreenCanvas = (globalThis as typeof globalThis & { OffscreenCanvas?: unknown }).OffscreenCanvas
    let observedOffscreenCanvas: unknown = Symbol('unset')
    const painter: Painter = {
      async renderPng() {
        observedOffscreenCanvas = (globalThis as typeof globalThis & { OffscreenCanvas?: unknown }).OffscreenCanvas
        return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      },
      async renderSvg() {
        throw new Error('unused in png test')
      },
    }

    await renderMarkdown('# Title\n\nParagraph', { format: 'png', painter })

    expect(observedOffscreenCanvas).toBe(originalOffscreenCanvas)
  })

  test('renders headings with visibly more ink than body text of the same content', async () => {
    const pages = await renderMarkdown('# Sample\n\nSample', { format: 'png' })
    const page = pages[0]

    if (!page || page.format !== 'png') {
      throw new Error('Expected a rendered png page')
    }

    const image = await loadImage(page.data)
    const canvas = new Canvas(image.width, image.height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)

    const pixels = context.getImageData(0, 0, image.width, image.height).data
    const heading = page.page.fragments.find((fragment) => fragment.kind === 'heading')
    const paragraph = page.page.fragments.find((fragment) => fragment.kind === 'paragraph')

    if (!heading || !paragraph) {
      throw new Error('Expected heading and paragraph fragments')
    }

    const headingInk = countNonWhitePixelsInBox(pixels, image.width, scaleBox(heading.box, 2))
    const paragraphInk = countNonWhitePixelsInBox(pixels, image.width, scaleBox(paragraph.box, 2))

    expect(headingInk).toBeGreaterThan(paragraphInk * 1.5)
  })

  test('uses skia-consistent text measurement for mixed CJK and latin spacing', async () => {
    const pages = await renderMarkdown('原生 Markdown 渲染真正难的地方。', { format: 'png' })
    const page = pages[0]

    if (!page) {
      throw new Error('Expected one rendered page')
    }

    const paragraph = page.page.fragments.find((fragment) => fragment.kind === 'paragraph')

    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('Expected paragraph fragment')
    }

    const firstLine = paragraph.lines[0]
    const cjkRun = firstLine?.runs.find((run) => run.text.includes('渲染真正难的地方'))

    if (!firstLine || !cjkRun) {
      throw new Error('Expected mixed paragraph line runs')
    }

    const canvas = new Canvas(10, 10)
    const context = canvas.getContext('2d')
    context.font = defaultTheme.typography.body.font

    const expectedX = defaultTheme.page.margin.left + context.measureText('原生 Markdown ').width

    expect(cjkRun.x).toBeGreaterThan(expectedX - 1)
    expect(cjkRun.x).toBeLessThan(expectedX + 1)
  })
})

function countNonWhitePixels(pixels: Uint8ClampedArray): number {
  let count = 0

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const alpha = pixels[index + 3]

    if (red !== 255 || green !== 255 || blue !== 255 || alpha !== 255) {
      count += 1
    }
  }

  return count
}

function countNonWhitePixelsInBox(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  box: { x: number; y: number; width: number; height: number },
): number {
  let count = 0
  const minX = Math.max(0, Math.floor(box.x))
  const maxX = Math.min(imageWidth, Math.ceil(box.x + box.width))
  const minY = Math.max(0, Math.floor(box.y))
  const maxY = Math.ceil(box.y + box.height)

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const index = (y * imageWidth + x) * 4
      const red = pixels[index]
      const green = pixels[index + 1]
      const blue = pixels[index + 2]
      const alpha = pixels[index + 3]

      if (red !== 255 || green !== 255 || blue !== 255 || alpha !== 255) {
        count += 1
      }
    }
  }

  return count
}

function scaleBox(
  box: { x: number; y: number; width: number; height: number },
  scale: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: box.x * scale,
    y: box.y * scale,
    width: box.width * scale,
    height: box.height * scale,
  }
}
