import { createCanvas } from '@napi-rs/canvas'
import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext'
import type { LayoutLine } from '@chenglou/pretext'

if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class CanvasOffscreenCanvas {
    private readonly canvas

    constructor(width: number, height: number) {
      this.canvas = createCanvas(width, height)
    }

    getContext(contextId: '2d') {
      return this.canvas.getContext(contextId)
    }
  }

  ;(globalThis as typeof globalThis & { OffscreenCanvas?: typeof CanvasOffscreenCanvas }).OffscreenCanvas =
    CanvasOffscreenCanvas
}

export function measureTextHeight(
  text: string,
  font: string,
  lineHeight: number,
  maxWidth: number,
): number {
  if (!text.trim()) return 0

  const prepared = prepareWithSegments(text, font)
  return layoutWithLines(prepared, maxWidth, lineHeight).height
}

export function getTextLines(
  text: string,
  font: string,
  lineHeight: number,
  maxWidth: number,
): LayoutLine[] {
  if (!text.trim()) return []

  const prepared = prepareWithSegments(text, font)
  return layoutWithLines(prepared, maxWidth, lineHeight).lines
}

export function spansToPlainText(spans: Array<{ text: string }>): string {
  return spans.map(span => span.text).join('')
}
