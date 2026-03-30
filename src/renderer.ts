import { createCanvas } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import { setup } from './setup.js'
import { applyPaint } from './paint.js'
import { applyClip } from './canvas-utils.js'
import { renderText } from './elements/text.js'
import { renderImage } from './elements/image.js'
import { renderRect } from './elements/rect.js'
import { renderGroup } from './elements/group.js'
import { getRenderer } from './plugins.js'
import { buildImageCache } from './image-cache.js'
import type { RenderContext } from './render-context.js'
import type { Background, CardElement, CardSchema, ExportOptions } from './types.js'

export async function renderCard(schema: CardSchema, options?: ExportOptions): Promise<Buffer> {
  setup()

  const imageCache = await buildImageCache(schema)
  const canvas = createCanvas(schema.width, schema.height)
  const ctx = canvas.getContext('2d')

  const rc: RenderContext = {
    imageCache,
    drawElement: (c, el) => drawElement(c, el, rc),
  }

  await drawBackground(ctx, schema.background, schema.width, schema.height, rc)

  for (const el of schema.elements) {
    await drawElement(ctx, el, rc)
  }

  const fmt = options?.format ?? 'png'
  if (fmt === 'jpeg') {
    return canvas.toBuffer('image/jpeg', options?.quality ?? 0.92)
  }
  return canvas.toBuffer('image/png')
}

// ── Background ────────────────────────────────────────────────────────────────

async function drawBackground(
  ctx: SKRSContext2D,
  bg: Background,
  width: number,
  height: number,
  rc: RenderContext,
): Promise<void> {
  if (bg.type === 'image') {
    const img = rc.imageCache.get(bg.src)
    if (!img) return
    const fit = bg.fit ?? 'cover'

    if (fit === 'fill') {
      ctx.drawImage(img, 0, 0, width, height)
    } else if (fit === 'cover') {
      const scale = Math.max(width / img.width, height / img.height)
      const sw = img.width * scale
      const sh = img.height * scale
      ctx.drawImage(img, (width - sw) / 2, (height - sh) / 2, sw, sh)
    } else {
      const scale = Math.min(width / img.width, height / img.height)
      const sw = img.width * scale
      const sh = img.height * scale
      ctx.drawImage(img, (width - sw) / 2, (height - sh) / 2, sw, sh)
    }
    return
  }

  // color / linear-gradient / radial-gradient are structurally identical to Paint variants
  ctx.fillStyle = applyPaint(ctx, bg as unknown as import('./types.js').Paint, 0, 0, width, height, rc.imageCache)
  ctx.fillRect(0, 0, width, height)
}

// ── Element ───────────────────────────────────────────────────────────────────

async function drawElement(
  ctx: SKRSContext2D,
  el: CardElement,
  rc: RenderContext,
): Promise<void> {
  ctx.save()

  if (el.opacity !== undefined) ctx.globalAlpha = el.opacity
  if (el.blendMode) ctx.globalCompositeOperation = el.blendMode

  if (el.shadow) {
    ctx.shadowOffsetX = el.shadow.dx
    ctx.shadowOffsetY = el.shadow.dy
    ctx.shadowBlur = el.shadow.blur
    ctx.shadowColor = el.shadow.color
  }

  applyTransform(ctx, el)

  // Clip is applied for elements with known dimensions (not text).
  // For groups, clip is handled inside renderGroup after translating.
  if (el.clip && el.type !== 'group') {
    const w = 'width' in el ? el.width : 0
    const h = 'height' in el ? el.height : 0
    applyClip(ctx, el.x, el.y, w, h, el.clip)
  }

  switch (el.type) {
    case 'text':
      renderText(ctx, el, rc)
      break
    case 'image':
      await renderImage(ctx, el, rc)
      break
    case 'rect':
      renderRect(ctx, el, rc)
      break
    case 'group':
      await renderGroup(ctx, el, rc)
      break
    default: {
      const plugin = getRenderer((el as { type: string }).type)
      if (plugin) await plugin(ctx, el as Record<string, unknown>, rc)
    }
  }

  ctx.restore()
}

// ── Transform ─────────────────────────────────────────────────────────────────

function applyTransform(ctx: SKRSContext2D, el: CardElement): void {
  const t = el.transform
  if (!t) return

  const anchor = t.anchor ?? [0.5, 0.5]
  const w = 'width' in el ? el.width : 0
  const h = el.type === 'text' ? 0 : ('height' in el ? el.height : 0)
  const px = el.x + w * anchor[0]
  const py = el.y + h * anchor[1]

  if (t.rotate) {
    ctx.translate(px, py)
    ctx.rotate((t.rotate * Math.PI) / 180)
    ctx.translate(-px, -py)
  }

  if (t.scaleX != null || t.scaleY != null) {
    ctx.translate(px, py)
    ctx.scale(t.scaleX ?? 1, t.scaleY ?? 1)
    ctx.translate(-px, -py)
  }
}
