import { createCanvas } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import type { LayoutBox, RenderOptions, RenderOutput, ResolvedPaint, Shadow } from '../types'
import { preloadImageForCanvas } from '../layout/preload-images'

type Ctx = SKRSContext2D

type CanvasImage = {
  width: number
  height: number
}

function clampQuality(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 0.9
  return Math.min(1, Math.max(0, value))
}

async function preloadImages(boxes: LayoutBox[]): Promise<void> {
  const cache = new Map<string, Promise<unknown>>()
  const tasks: Array<Promise<void>> = []

  const walk = (box: LayoutBox): void => {
    if (box.kind === 'image' && box.loadedImage) return

    if (box.kind === 'image' && box.src) {
      const promise = cache.get(box.src) ?? preloadImageForCanvas(box.src)
      if (!cache.has(box.src)) cache.set(box.src, promise)
      tasks.push(
        promise.then(image => {
          box.loadedImage = image
        }),
      )
    }

    box.children?.forEach(walk)
  }

  boxes.forEach(walk)
  await Promise.all(tasks)
}

function applyPaint(ctx: Ctx, paint: ResolvedPaint, x: number, y: number, w: number, h: number): void {
  if (paint.type === 'color') {
    ctx.fillStyle = paint.value
    return
  }

  if (paint.type !== 'linear-gradient') {
    ctx.fillStyle = '#cccccc'
    return
  }

  const angle = ((paint.angle - 90) * Math.PI) / 180
  const halfW = w / 2
  const halfH = h / 2
  const centerX = x + halfW
  const centerY = y + halfH
  const gradient = ctx.createLinearGradient(
    centerX - Math.cos(angle) * halfW,
    centerY - Math.sin(angle) * halfH,
    centerX + Math.cos(angle) * halfW,
    centerY + Math.sin(angle) * halfH,
  )

  for (const stop of paint.stops) {
    gradient.addColorStop(stop.offset, stop.color)
  }

  ctx.fillStyle = gradient
}

function drawShadow(ctx: Ctx, shadow: Shadow): void {
  ctx.shadowOffsetX = shadow.x
  ctx.shadowOffsetY = shadow.y
  ctx.shadowBlur = shadow.blur
  ctx.shadowColor = shadow.color
}

function clearShadow(ctx: Ctx): void {
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

function drawTextBox(ctx: Ctx, box: LayoutBox): void {
  if (!box.lines || box.lines.length === 0) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(box.x, box.y, box.width, box.height)
  ctx.clip()
  ctx.textBaseline = 'top'

  for (const line of box.lines) {
    const lineWidth = line.spans.reduce((max, span) => {
      ctx.font = span.font
      const spanWidth = ctx.measureText(span.text).width
      return Math.max(max, span.x + spanWidth)
    }, 0)
    const alignOffset =
      box.textAlign === 'center'
        ? (box.width - lineWidth) / 2
        : box.textAlign === 'right'
          ? box.width - lineWidth
          : 0

    for (const span of line.spans) {
      ctx.font = span.font
      ctx.fillStyle = span.color
      ctx.fillText(span.text, box.x + span.x + alignOffset, box.y + line.y)
    }
  }

  ctx.restore()
}

function drawImageBox(ctx: Ctx, box: LayoutBox): void {
  if (!box.loadedImage) return

  const image = box.loadedImage as CanvasImage
  if (!image || image.width <= 0 || image.height <= 0) return

  ctx.save()
  if (box.borderRadius && box.borderRadius > 0) {
    roundedRect(ctx, box.x, box.y, box.width, box.height, box.borderRadius)
    ctx.clip()
  }

  if (box.fit === 'contain') {
    const scale = Math.min(box.width / image.width, box.height / image.height)
    const dw = image.width * scale
    const dh = image.height * scale
    const dx = box.x + (box.width - dw) / 2
    const dy = box.y + (box.height - dh) / 2
    ctx.drawImage(box.loadedImage as Parameters<Ctx['drawImage']>[0], dx, dy, dw, dh)
  } else {
    const scale = Math.max(box.width / image.width, box.height / image.height)
    const sourceWidth = box.width / scale
    const sourceHeight = box.height / scale
    const sourceX = (image.width - sourceWidth) / 2
    const sourceY = (image.height - sourceHeight) / 2
    ctx.drawImage(
      box.loadedImage as Parameters<Ctx['drawImage']>[0],
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      box.x,
      box.y,
      box.width,
      box.height,
    )
  }

  ctx.restore()
}

function drawRectBox(ctx: Ctx, box: LayoutBox): void {
  if (!box.fill) return

  ctx.save()
  if (box.shadow) drawShadow(ctx, box.shadow)
  applyPaint(ctx, box.fill, box.x, box.y, box.width, box.height)

  if (box.borderRadius && box.borderRadius > 0) {
    roundedRect(ctx, box.x, box.y, box.width, box.height, box.borderRadius)
    ctx.fill()
  } else {
    ctx.fillRect(box.x, box.y, box.width, box.height)
  }

  if (box.shadow) clearShadow(ctx)
  ctx.restore()
}

function drawBox(ctx: Ctx, box: LayoutBox): void {
  switch (box.kind) {
    case 'rect':
      drawRectBox(ctx, box)
      return
    case 'text':
      drawTextBox(ctx, box)
      return
    case 'image':
      drawImageBox(ctx, box)
      return
    case 'group': {
      ctx.save()
      const children = [...(box.children ?? [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      for (const child of children) {
        drawBox(ctx, child)
      }
      ctx.restore()
      return
    }
  }
}

export async function renderPageCanvas(
  boxes: LayoutBox[],
  size: { width: number; height: number },
  options: RenderOptions = {},
): Promise<RenderOutput> {
  await preloadImages(boxes)

  const canvas = createCanvas(size.width, size.height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size.width, size.height)

  const sorted = [...boxes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  for (const box of sorted) {
    drawBox(ctx, box)
  }

  const format = options.format ?? 'png'
  if (format === 'jpeg') {
    const data = await canvas.encode('jpeg', Math.round(clampQuality(options.quality) * 100))
    return { format: 'jpeg', data }
  }

  const data = await canvas.encode('png')
  return { format: 'png', data }
}
