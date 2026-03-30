import type { SKRSContext2D } from '@napi-rs/canvas'
import { applyClip } from '../canvas-utils.js'
import type { RenderContext } from '../render-context.js'
import type { ImageElement, ImageFilter } from '../types.js'

export async function renderImage(
  ctx: SKRSContext2D,
  el: ImageElement,
  rc: RenderContext,
): Promise<void> {
  const img = rc.imageCache.get(el.src)
  if (!img) return

  ctx.save()

  if (el.filter) ctx.filter = buildFilterString(el.filter)

  if (el.borderRadius) {
    applyClip(ctx, el.x, el.y, el.width, el.height, { type: 'rect', radius: el.borderRadius })
  }

  ctx.drawImage(img, el.x, el.y, el.width, el.height)
  ctx.restore()
}

function buildFilterString(f: ImageFilter): string {
  const parts: string[] = []
  if (f.blur != null)       parts.push(`blur(${f.blur}px)`)
  if (f.brightness != null) parts.push(`brightness(${f.brightness})`)
  if (f.contrast != null)   parts.push(`contrast(${f.contrast})`)
  if (f.saturate != null)   parts.push(`saturate(${f.saturate})`)
  if (f.grayscale != null)  parts.push(`grayscale(${f.grayscale})`)
  return parts.join(' ') || 'none'
}
