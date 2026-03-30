import type { SKRSContext2D } from '@napi-rs/canvas'
import { roundedRectPath } from '../canvas-utils.js'
import { applyPaint } from '../paint.js'
import type { RenderContext } from '../render-context.js'
import type { RectElement } from '../types.js'

export function renderRect(ctx: SKRSContext2D, el: RectElement, rc: RenderContext): void {
  if (el.borderRadius) {
    roundedRectPath(ctx, el.x, el.y, el.width, el.height, el.borderRadius)
  } else {
    ctx.beginPath()
    ctx.rect(el.x, el.y, el.width, el.height)
  }

  if (el.fill) {
    ctx.fillStyle = applyPaint(ctx, el.fill, el.x, el.y, el.width, el.height, rc.imageCache)
    ctx.fill()
  }

  if (el.stroke) {
    ctx.strokeStyle = applyPaint(ctx, el.stroke.paint, el.x, el.y, el.width, el.height, rc.imageCache)
    ctx.lineWidth = el.stroke.width
    ctx.stroke()
  }
}
