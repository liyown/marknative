import type { Image, SKRSContext2D } from '@napi-rs/canvas'
import type { Paint } from './types.js'

type FillValue =
  | string
  | ReturnType<SKRSContext2D['createLinearGradient']>
  | ReturnType<SKRSContext2D['createRadialGradient']>
  | ReturnType<SKRSContext2D['createPattern']>

export function applyPaint(
  ctx: SKRSContext2D,
  paint: Paint,
  x: number,
  y: number,
  width: number,
  height: number,
  imageCache?: Map<string, Image>,
): FillValue {
  if (paint.type === 'color') {
    return paint.value
  }

  if (paint.type === 'linear-gradient') {
    // CSS convention: 0° = top→bottom, 90° = left→right
    const rad = (paint.angle * Math.PI) / 180
    const r = Math.sqrt(width * width + height * height) / 2
    const cx = x + width / 2
    const cy = y + height / 2
    const gradient = ctx.createLinearGradient(
      cx - Math.sin(rad) * r, cy + Math.cos(rad) * r,
      cx + Math.sin(rad) * r, cy - Math.cos(rad) * r,
    )
    for (const stop of paint.stops) {
      gradient.addColorStop(stop.offset, stop.color)
    }
    return gradient
  }

  if (paint.type === 'radial-gradient') {
    const gradient = ctx.createRadialGradient(
      x + paint.cx * width,
      y + paint.cy * height,
      0,
      x + paint.cx * width,
      y + paint.cy * height,
      paint.r * Math.max(width, height),
    )
    for (const stop of paint.stops) {
      gradient.addColorStop(stop.offset, stop.color)
    }
    return gradient
  }

  if (paint.type === 'image') {
    const img = imageCache?.get(paint.src)
    if (!img) return 'transparent'
    const repeat = paint.repeat ?? 'repeat'
    return ctx.createPattern(img, repeat) ?? 'transparent'
  }

  throw new Error(`Unsupported paint type: ${(paint as { type: string }).type}`)
}
