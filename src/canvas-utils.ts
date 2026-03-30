import type { SKRSContext2D } from '@napi-rs/canvas'
import type { ClipConfig } from './types.js'

export function roundedRectPath(
  ctx: SKRSContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export function applyClip(
  ctx: SKRSContext2D,
  x: number, y: number,
  w: number, h: number,
  clip: ClipConfig,
): void {
  if (clip.type === 'circle') {
    ctx.beginPath()
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
    ctx.clip()
  } else if (clip.type === 'rect') {
    if (clip.radius) {
      roundedRectPath(ctx, x, y, w, h, clip.radius)
    } else {
      ctx.beginPath()
      ctx.rect(x, y, w, h)
    }
    ctx.clip()
  }
}
