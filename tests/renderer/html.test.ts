import { describe, expect, test } from 'bun:test'
import { renderPageHtml } from '../../src/renderer/html'
import type { LayoutBox } from '../../src/types'

describe('renderPageHtml', () => {
  test('outputs div with correct dimensions', async () => {
    const result = await renderPageHtml([], { width: 400, height: 600 })

    expect(result.format).toBe('html')
    expect(result.data).toContain('width:400px')
    expect(result.data).toContain('height:600px')
  })

  test('rect box -> div with background-color', async () => {
    const boxes: LayoutBox[] = [
      {
        id: '1',
        kind: 'rect',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        fill: { type: 'color', value: '#ff0000' },
      },
    ]

    const result = await renderPageHtml(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('background-color:#ff0000')
    expect(result.data).toContain('left:10px')
    expect(result.data).toContain('top:20px')
  })

  test('image box falls back to src when loadedImage is an object', async () => {
    const boxes: LayoutBox[] = [
      {
        id: 'image-1',
        kind: 'image',
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        src: 'https://example.com/fallback.png',
        loadedImage: { width: 64, height: 64 },
      },
    ]

    const result = await renderPageHtml(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('src="https://example.com/fallback.png"')
  })

  test('text box -> div with span elements', async () => {
    const boxes: LayoutBox[] = [
      {
        id: '2',
        kind: 'text',
        x: 0,
        y: 0,
        width: 300,
        height: 60,
        lines: [
          {
            y: 0,
            height: 56,
            spans: [{ text: 'Hello', font: 'bold 40px sans-serif', color: '#000', x: 0 }],
          },
        ],
      },
    ]

    const result = await renderPageHtml(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('Hello')
    expect(result.data).toContain('<span')
  })

  test('text spans preserve horizontal offsets in output styles', async () => {
    const boxes: LayoutBox[] = [
      {
        id: '3',
        kind: 'text',
        x: 0,
        y: 0,
        width: 300,
        height: 60,
        lines: [
          {
            y: 0,
            height: 56,
            spans: [
              { text: 'A', font: 'bold 40px sans-serif', color: '#000', x: 12 },
              { text: 'B', font: 'bold 40px sans-serif', color: '#000', x: 48 },
            ],
          },
        ],
      },
    ]

    const result = await renderPageHtml(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('left:12px')
    expect(result.data).toContain('left:48px')
  })

  test('center and right aligned text do not emit fixed span left offsets', async () => {
    const boxes: LayoutBox[] = [
      {
        id: '4',
        kind: 'text',
        x: 0,
        y: 0,
        width: 300,
        height: 120,
        textAlign: 'center',
        lines: [
          {
            y: 0,
            height: 56,
            spans: [{ text: 'Center', font: 'bold 40px sans-serif', color: '#000', x: 12 }],
          },
          {
            y: 60,
            height: 56,
            spans: [{ text: 'Right', font: 'bold 40px sans-serif', color: '#000', x: 48 }],
          },
        ],
      },
    ]

    const result = await renderPageHtml(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('text-align:center')
    expect(result.data).toContain('Center')
    expect(result.data).toContain('Right')
    expect(result.data).not.toContain('left:12px')
    expect(result.data).not.toContain('left:48px')
    expect(result.data).not.toContain('position:absolute;left:12px')
    expect(result.data).not.toContain('position:absolute;left:48px')
  })
})
