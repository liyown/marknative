import { describe, expect, test } from 'bun:test'
import { Canvas, loadImage } from 'skia-canvas'

import { renderMarkdown } from '../../../src/render/render-markdown'
import { defaultTheme } from '../../../src/theme/default-theme'

describe('renderMarkdown svg', () => {
  test('renders markdown into svg pages through the default painter', async () => {
    const pages = await renderMarkdown('# Title\n\nParagraph', { format: 'svg' })

    expect(pages).toHaveLength(1)

    const page = pages[0]

    if (!page) {
      throw new Error('Expected one rendered page')
    }

    expect(page.format).toBe('svg')
    expect(page.page.width).toBe(defaultTheme.page.width)
    expect(page.page.height).toBe(defaultTheme.page.height)
    expect(typeof page.data).toBe('string')

    const image = await loadImage(Buffer.from(page.data))
    expect(image.width).toBe(page.page.width)
    expect(image.height).toBe(page.page.height)

    const canvas = new Canvas(image.width, image.height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)

    const pixels = context.getImageData(0, 0, image.width, image.height).data
    expect(countNonWhitePixels(pixels)).toBeGreaterThan(0)
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
