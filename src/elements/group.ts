import type { SKRSContext2D } from '@napi-rs/canvas'
import { applyClip } from '../canvas-utils.js'
import type { RenderContext } from '../render-context.js'
import type { GroupElement } from '../types.js'

export async function renderGroup(
  ctx: SKRSContext2D,
  el: GroupElement,
  rc: RenderContext,
): Promise<void> {
  // Translate to group origin so children use relative coordinates
  ctx.translate(el.x, el.y)

  if (el.clip) {
    applyClip(ctx, 0, 0, el.width, el.height, el.clip)
  }

  for (const child of el.children) {
    await rc.drawElement(ctx, child)
  }
}
