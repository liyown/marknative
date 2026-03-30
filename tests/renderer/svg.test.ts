import { describe, expect, test } from 'bun:test'
import { renderPageSvg } from '../../src/renderer/svg'
import type { LayoutBox } from '../../src/types'

describe('renderPageSvg', () => {
  test('outputs a valid SVG root element', async () => {
    const result = await renderPageSvg([], { width: 400, height: 600 })

    expect(result.format).toBe('svg')
    expect(result.data).toContain('<svg ')
    expect(result.data).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(result.data).toContain('width="400"')
    expect(result.data).toContain('height="600"')
    expect(result.data).toContain('viewBox="0 0 400 600"')
    expect(result.data).toContain('</svg>')
  })

  test('renders rect boxes as rect elements', async () => {
    const boxes: LayoutBox[] = [
      {
        id: 'rect-1',
        kind: 'rect',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        fill: { type: 'color', value: '#ff0000' },
      },
    ]

    const result = await renderPageSvg(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('<rect')
    expect(result.data).toContain('x="10"')
    expect(result.data).toContain('y="20"')
    expect(result.data).toContain('width="100"')
    expect(result.data).toContain('height="50"')
    expect(result.data).toContain('fill="#ff0000"')
  })

  test('escapes xml in text content and font attributes', async () => {
    const boxes: LayoutBox[] = [
      {
        id: 'text-1',
        kind: 'text',
        x: 0,
        y: 0,
        width: 300,
        height: 60,
        textAlign: 'center',
        lines: [
          {
            y: 0,
            height: 56,
            spans: [
              {
                text: 'Hello & <World> "svg"',
                font: 'bold 40px sans-serif',
                color: '#000000',
                x: 0,
              },
            ],
          },
        ],
      },
    ]

    const result = await renderPageSvg(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('<text')
    expect(result.data).toContain('font="bold 40px sans-serif"')
    expect(result.data).toContain('Hello &amp; &lt;World&gt; &quot;svg&quot;')
  })

  test('renders linear gradient fills in defs', async () => {
    const boxes: LayoutBox[] = [
      {
        id: 'rect-gradient',
        kind: 'rect',
        x: 0,
        y: 0,
        width: 200,
        height: 120,
        fill: {
          type: 'linear-gradient',
          angle: 45,
          stops: [
            { offset: 0, color: '#111111' },
            { offset: 1, color: '#eeeeee' },
          ],
        },
      },
    ]

    const result = await renderPageSvg(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('<defs>')
    expect(result.data).toContain('<linearGradient')
    expect(result.data).toContain('url(#grad-1)')
    expect(result.data).toContain('offset="0"')
    expect(result.data).toContain('offset="1"')
  })

  test('renders image and group boxes', async () => {
    const boxes: LayoutBox[] = [
      {
        id: 'group-1',
        kind: 'group',
        x: 8,
        y: 12,
        width: 120,
        height: 80,
        children: [
          {
            id: 'child-rect',
            kind: 'rect',
            x: 8,
            y: 12,
            width: 120,
            height: 80,
            fill: { type: 'color', value: '#00ff00' },
          },
        ],
      },
      {
        id: 'image-1',
        kind: 'image',
        x: 20,
        y: 30,
        width: 64,
        height: 64,
        src: 'https://example.com/image.png',
        fit: 'contain',
        borderRadius: 6,
      },
    ]

    const result = await renderPageSvg(boxes, { width: 400, height: 600 })

    expect(result.data).toContain('<g transform="translate(8,12)">')
    expect(result.data).toContain('<image')
    expect(result.data).toContain('href="https://example.com/image.png"')
    expect(result.data).toContain('preserveAspectRatio="xMidYMid meet"')
  })
})
