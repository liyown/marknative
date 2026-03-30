import { loadImage, type Image } from '@napi-rs/canvas'
import type { Background, CardElement, CardSchema, Paint } from './types.js'

function collectPaintSrc(paint: Paint, srcs: Set<string>): void {
  if (paint.type === 'image') srcs.add(paint.src)
}

function collectElementSrcs(el: CardElement, srcs: Set<string>): void {
  if (el.type === 'image') {
    srcs.add(el.src)
    return
  }

  if (el.type === 'rect') {
    if (el.fill) collectPaintSrc(el.fill, srcs)
    if (el.stroke) collectPaintSrc(el.stroke.paint, srcs)
    return
  }

  if (el.type === 'text') {
    for (const span of el.spans) {
      collectPaintSrc(span.fill, srcs)
      if (span.stroke) collectPaintSrc(span.stroke.paint, srcs)
    }
    return
  }

  if (el.type === 'group') {
    for (const child of el.children) collectElementSrcs(child, srcs)
  }
}

function collectBackgroundSrc(bg: Background, srcs: Set<string>): void {
  if (bg.type === 'image') srcs.add(bg.src)
}

export async function buildImageCache(schema: CardSchema): Promise<Map<string, Image>> {
  const srcs = new Set<string>()

  collectBackgroundSrc(schema.background, srcs)
  for (const el of schema.elements) collectElementSrcs(el, srcs)

  const entries = await Promise.all(
    [...srcs].map(async src => [src, await loadImage(src)] as [string, Image]),
  )
  return new Map(entries)
}
