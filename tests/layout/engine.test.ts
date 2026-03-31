import { test, expect, describe, beforeAll } from 'bun:test'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { renderPageCanvas } from '../../src/renderer/canvas'
import { computeLayoutBoxes, initLayoutEngine } from '../../src/layout/engine'
import { preloadImageForCanvas, preloadImageForSvg } from '../../src/layout/preload-images'
import type { LayoutSpec, LayoutBox } from '../../src/types'

beforeAll(async () => {
  await initLayoutEngine()
})

async function firstPaintedRow(png: Buffer): Promise<number> {
  const image = await loadImage(png)
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(0, 0, image.width, image.height).data
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const a = data[offset + 3]
      if (!(r === 255 && g === 255 && b === 255 && a === 255)) {
        return y
      }
    }
  }

  return -1
}

describe('computeLayoutBoxes', () => {
  test('rect node gets correct absolute position', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 400,
      height: 600,
      children: [
        { type: 'rect', width: 400, height: 100, fill: { type: 'color', value: '#ff0000' } },
      ],
    }
    const boxes = await computeLayoutBoxes(spec, { width: 400, height: 600 })
    const rectBox = boxes.find(b => b.kind === 'rect' && b.fill?.type === 'color')
    expect(rectBox).toBeDefined()
    expect(rectBox!.width).toBe(400)
    expect(rectBox!.height).toBe(100)
    expect(rectBox!.x).toBe(0)
    expect(rectBox!.y).toBe(0)
  })

  test('two rects in column are stacked vertically', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 400,
      height: 600,
      children: [
        { type: 'rect', width: 400, height: 100, fill: { type: 'color', value: '#ff0000' } },
        { type: 'rect', width: 400, height: 200, fill: { type: 'color', value: '#00ff00' } },
      ],
    }
    const boxes = await computeLayoutBoxes(spec, { width: 400, height: 600 })
    const rects = boxes.filter(b => b.kind === 'rect')
    expect(rects).toHaveLength(2)
    expect(rects[0]!.y).toBe(0)
    expect(rects[1]!.y).toBe(100)
  })

  test('text node produces LayoutBox with lines', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 500,
      height: 800,
      children: [
        {
          type: 'text',
          spans: [{ text: 'Hello world' }],
          font: 'bold 40px sans-serif',
          lineHeight: 56,
          color: '#000000',
        },
      ],
    }
    const boxes = await computeLayoutBoxes(spec, { width: 500, height: 800 })
    const textBox = boxes.find(b => b.kind === 'text')
    expect(textBox).toBeDefined()
    expect(textBox!.lines).toBeDefined()
    expect(textBox!.lines!.length).toBeGreaterThan(0)
  })

  test('padding on container offsets children', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 400,
      height: 600,
      padding: 40,
      children: [
        { type: 'rect', width: 'fill', height: 100, fill: { type: 'color', value: '#ff0000' } },
      ],
    }
    const boxes = await computeLayoutBoxes(spec, { width: 400, height: 600 })
    const rectBox = boxes.find(b => b.kind === 'rect')
    expect(rectBox).toBeDefined()
    expect(rectBox!.x).toBe(40)
    expect(rectBox!.y).toBe(40)
    expect(rectBox!.width).toBe(320)
  })

  test('text node respects maxLines and reports capped height', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 180,
      height: 600,
      children: [
        {
          type: 'text',
          spans: [{ text: 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda' }],
          font: 'bold 32px sans-serif',
          lineHeight: 40,
          color: '#000000',
          maxLines: 2,
        },
      ],
    }

    const boxes = await computeLayoutBoxes(spec, { width: 180, height: 600 })
    const textBox = boxes.find(b => b.kind === 'text')

    expect(textBox).toBeDefined()
    expect(textBox!.lines).toHaveLength(2)
    expect(textBox!.height).toBe(80)
  })

  test('following siblings flow after capped text height', async () => {
    const spec: LayoutSpec = {
      type: 'container',
      direction: 'column',
      width: 180,
      height: 600,
      children: [
        {
          type: 'text',
          spans: [{ text: 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda' }],
          font: 'bold 32px sans-serif',
          lineHeight: 40,
          color: '#000000',
          maxLines: 2,
        },
        { type: 'rect', width: 180, height: 50, fill: { type: 'color', value: '#ff0000' } },
      ],
    }

    const boxes = await computeLayoutBoxes(spec, { width: 180, height: 600 })
    const rects = boxes.filter(b => b.kind === 'rect')

    expect(rects).toHaveLength(1)
    expect(rects[0]!.y).toBe(80)
  })
})

describe('preloadImageForCanvas', () => {
  test('loads png data URLs without treating them as file paths', async () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XGJ0AAAAASUVORK5CYII='

    const image = (await preloadImageForCanvas(dataUrl)) as {
      width: number
      height: number
    }

    expect(image.width).toBe(1)
    expect(image.height).toBe(1)
  })

  test('loads utf8 svg data URLs with media type parameters', async () => {
    const dataUrl =
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"></svg>'

    const image = (await preloadImageForCanvas(dataUrl)) as {
      width: number
      height: number
    }

    expect(image.width).toBe(4)
    expect(image.height).toBe(3)
  })

  test('throws a clear error when remote fetch returns non-2xx', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response('missing', { status: 404, statusText: 'Not Found' })) as unknown as typeof fetch

    try {
      await expect(preloadImageForCanvas('https://example.com/missing.png')).rejects.toThrow(
        'Failed to fetch image: https://example.com/missing.png (404 Not Found)',
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('preloadImageForSvg', () => {
  test('uses the correct svg mime type for local files', async () => {
    const tempPath = `/tmp/notecard-preload-${Date.now()}.svg`
    await Bun.write(
      tempPath,
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"></svg>',
    )

    try {
      const dataUrl = await preloadImageForSvg(tempPath)
      expect(dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true)
    } finally {
      await Bun.file(tempPath).delete()
    }
  })
})

describe('renderPageCanvas', () => {
  test('continues rendering when one image preload fails', async () => {
    const boxes: LayoutBox[] = [
      {
        id: 'bad-image',
        kind: 'image',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        src: 'https://example.com/missing.png',
      },
      {
        id: 'rect',
        kind: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: { type: 'color', value: '#ff0000' },
      },
    ]

    const output = await renderPageCanvas(boxes, { width: 100, height: 100 })

    expect(output.format).toBe('png')
    expect(Buffer.isBuffer(output.data)).toBe(true)
    expect((output.data as Buffer).byteLength).toBeGreaterThan(0)
  })

  test('vertically centers glyphs within the line box to avoid top clipping', async () => {
    const output = await renderPageCanvas(
      [
        {
          id: 'text',
          kind: 'text',
          x: 0,
          y: 0,
          width: 320,
          height: 56,
          lines: [
            {
              y: 0,
              height: 56,
              spans: [{ text: '今日金句', font: 'bold 28px sans-serif', color: '#000000', x: 0 }],
            },
          ],
        },
      ],
      { width: 320, height: 80 },
      { format: 'png' },
    )

    const firstRow = await firstPaintedRow(output.data as Buffer)
    expect(firstRow).toBeGreaterThan(0)
  })
})
