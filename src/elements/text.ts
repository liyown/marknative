import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import type { SKRSContext2D } from '@napi-rs/canvas'
import { applyPaint } from '../paint.js'
import type { RenderContext } from '../render-context.js'
import type { TextElement, TextSpan } from '../types.js'

// Each span rendered as its own paragraph stacked vertically (default).
function renderBlock(ctx: SKRSContext2D, el: TextElement, rc: RenderContext): void {
  let currentY = el.y

  for (const span of el.spans) {
    currentY = renderSpanBlock(ctx, el, span, currentY, rc)
  }
}

function renderSpanBlock(
  ctx: SKRSContext2D,
  el: TextElement,
  span: TextSpan,
  startY: number,
  rc: RenderContext,
): number {
  ctx.save()
  ctx.font = span.font
  ctx.textBaseline = 'top'
  ctx.textAlign = el.align ?? 'left'

  const textX =
    el.align === 'center' ? el.x + el.width / 2
    : el.align === 'right' ? el.x + el.width
    : el.x

  const prepared = prepareWithSegments(span.content, span.font, { whiteSpace: 'pre-wrap' })
  const { lines, lineCount } = layoutWithLines(prepared, el.width, el.lineHeight)
  const visible = el.maxLines != null ? lines.slice(0, el.maxLines) : lines
  const totalH = visible.length * el.lineHeight

  ctx.fillStyle = applyPaint(ctx, span.fill, el.x, startY, el.width, totalH, rc.imageCache)
  if (span.stroke) {
    ctx.strokeStyle = applyPaint(ctx, span.stroke.paint, el.x, startY, el.width, totalH, rc.imageCache)
    ctx.lineWidth = span.stroke.width
  }

  let y = startY
  for (let i = 0; i < visible.length; i++) {
    const line = visible[i]!
    const isLast = i === visible.length - 1
    const needsEllipsis = isLast && el.maxLines != null && lineCount > el.maxLines
    const text = needsEllipsis ? truncate(ctx, line.text, el.width) : line.text

    if (span.stroke) ctx.strokeText(text, textX, y)
    ctx.fillText(text, textX, y)
    y += el.lineHeight
  }

  ctx.restore()
  return y
}

// ── Inline mode: all spans flow on the same lines ────────────────────────────

type InlineUnit = {
  text: string
  width: number
  kind: string
  spanIndex: number
}

type InlineLine = { units: InlineUnit[]; width: number }

function collectSegments(span: TextSpan, spanIndex: number): InlineUnit[] {
  // Access pretext's internal segment arrays via the "unstable escape hatch"
  const prepared = prepareWithSegments(span.content, span.font, { whiteSpace: 'pre-wrap' }) as unknown as {
    segments: string[]
    widths: number[]
    kinds: string[]
  }
  return prepared.segments.map((text, i) => ({
    text,
    width: prepared.widths[i]!,
    kind: prepared.kinds[i]!,
    spanIndex,
  }))
}

function buildInlineLines(el: TextElement, maxLines?: number): InlineLine[] {
  const all: InlineUnit[] = []
  for (let si = 0; si < el.spans.length; si++) {
    all.push(...collectSegments(el.spans[si]!, si))
  }

  const lines: InlineLine[] = []
  let current: InlineUnit[] = []
  let lineW = 0

  const flush = (): void => {
    if (current.length > 0) lines.push({ units: current, width: lineW })
    current = []
    lineW = 0
  }

  for (const unit of all) {
    if (unit.kind === 'hard-break') { flush(); continue }
    if (unit.kind === 'space' && current.length === 0) continue  // skip leading spaces

    if (lineW + unit.width > el.width && current.length > 0 && unit.kind !== 'space') {
      flush()
      if (unit.kind === 'space') continue
    }

    current.push(unit)
    lineW += unit.width
  }
  flush()

  return maxLines != null ? lines.slice(0, maxLines) : lines
}

function renderInline(ctx: SKRSContext2D, el: TextElement, rc: RenderContext): void {
  const totalLineCount = buildInlineLines(el).length
  const lines = buildInlineLines(el, el.maxLines)

  let y = el.y
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!
    const isLast = li === lines.length - 1
    const needsEllipsis = isLast && el.maxLines != null && totalLineCount > el.maxLines

    let x =
      el.align === 'center' ? el.x + (el.width - line.width) / 2
      : el.align === 'right' ? el.x + el.width - line.width
      : el.x

    const units = needsEllipsis ? trimToEllipsis(ctx, line.units, el) : line.units

    for (const unit of units) {
      if (unit.kind === 'space' || unit.kind === 'text') {
        const span = el.spans[unit.spanIndex]!
        ctx.save()
        ctx.font = span.font
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        ctx.fillStyle = applyPaint(ctx, span.fill, x, y, unit.width, el.lineHeight, rc.imageCache)
        if (span.stroke) {
          ctx.strokeStyle = applyPaint(ctx, span.stroke.paint, x, y, unit.width, el.lineHeight, rc.imageCache)
          ctx.lineWidth = span.stroke.width
          ctx.strokeText(unit.text, x, y)
        }
        ctx.fillText(unit.text, x, y)
        ctx.restore()
        x += unit.width
      }
    }
    y += el.lineHeight
  }
}

function trimToEllipsis(ctx: SKRSContext2D, units: InlineUnit[], el: TextElement): InlineUnit[] {
  const ellipsis = '…'
  const ellipsisUnit: InlineUnit = {
    text: ellipsis,
    width: ctx.measureText(ellipsis).width,
    kind: 'text',
    spanIndex: units[units.length - 1]?.spanIndex ?? 0,
  }

  const result: InlineUnit[] = []
  let w = ellipsisUnit.width
  for (const u of units) {
    if (w + u.width > el.width) break
    result.push(u)
    w += u.width
  }
  result.push(ellipsisUnit)
  return result
}

// ── Public ────────────────────────────────────────────────────────────────────

export function renderText(ctx: SKRSContext2D, el: TextElement, rc: RenderContext): void {
  if (el.display === 'inline' && el.spans.length > 1) {
    renderInline(ctx, el, rc)
  } else {
    renderBlock(ctx, el, rc)
  }
}

function truncate(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  const ellipsis = '…'
  if (ctx.measureText(text).width <= maxWidth) return text
  const eW = ctx.measureText(ellipsis).width
  let end = text.length
  while (end > 0 && ctx.measureText(text.slice(0, end)).width + eW > maxWidth) end--
  return text.slice(0, end) + ellipsis
}
