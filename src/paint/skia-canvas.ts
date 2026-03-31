import type { CanvasRenderingContext2D } from 'skia-canvas'

import type {
  PaintBlockFragment,
  PaintCodeFragment,
  PaintHeadingFragment,
  PaintImageFragment,
  PaintLineBox,
  PaintLineRun,
  PaintListFragment,
  PaintListItemFragment,
  PaintPage,
  PaintTableFragment,
  PaintTableRowFragment,
  PaintThematicBreakFragment,
  Painter,
} from './types'
import { defaultTheme } from '../theme/default-theme'

const COLORS = {
  background: '#ffffff',
  text: '#111827',
  link: '#2563eb',
  mutedText: '#6b7280',
  border: '#d1d5db',
  subtleBorder: '#e5e7eb',
  quoteBorder: '#9ca3af',
  codeBackground: '#f8fafc',
  imageBackground: '#f9fafb',
  imageAccent: '#cbd5e1',
}

const PNG_SCALE = 2

type SkiaCanvasModule = {
  Canvas: new (width?: number, height?: number) => {
    getContext(type?: '2d'): CanvasRenderingContext2D
    toBuffer(format: 'png' | 'svg'): Promise<Buffer>
  }
}

let skiaCanvasLoader: Promise<SkiaCanvasModule> | null = null

export function createSkiaCanvasPainter(theme = defaultTheme): Painter {
  return {
    renderPng(page: PaintPage): Promise<Buffer> {
      return renderWithSkia(page, theme, 'png')
    },
    renderSvg(page: PaintPage): Promise<string> {
      return renderWithSkia(page, theme, 'svg').then((buffer) => buffer.toString('utf8'))
    },
  }
}

async function loadSkiaCanvas(): Promise<SkiaCanvasModule> {
  if (!skiaCanvasLoader) {
    skiaCanvasLoader = import('skia-canvas')
      .then((module) => module as unknown as SkiaCanvasModule)
      .catch((error) => {
        throw new Error('marknative requires skia-canvas to render pages', { cause: error })
      })
  }

  return skiaCanvasLoader
}

async function renderWithSkia(
  page: PaintPage,
  theme: typeof defaultTheme,
  format: 'png' | 'svg',
): Promise<Buffer> {
  const skiaCanvas = await loadSkiaCanvas()
  const scale = format === 'png' ? PNG_SCALE : 1
  const canvas = new skiaCanvas.Canvas(Math.ceil(page.width * scale), Math.ceil(page.height * scale))
  const context = canvas.getContext('2d')

  prepareContext(context)
  if (scale !== 1) {
    context.scale(scale, scale)
  }
  drawPage(context, page, theme)

  return canvas.toBuffer(format)
}

function prepareContext(context: CanvasRenderingContext2D): void {
  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
  context.lineJoin = 'round'
  context.lineCap = 'round'
  context.imageSmoothingEnabled = true
}

function drawPage(context: CanvasRenderingContext2D, page: PaintPage, theme: typeof defaultTheme): void {
  context.fillStyle = COLORS.background
  context.fillRect(0, 0, page.width, page.height)

  for (const fragment of page.fragments) {
    drawFragment(context, fragment, theme)
  }
}

function drawFragment(
  context: CanvasRenderingContext2D,
  fragment: PaintBlockFragment,
  theme: typeof defaultTheme,
): void {
  if (fragment.kind === 'heading') {
    drawLines(context, fragment.lines, resolveHeadingTypography(fragment, theme), theme)
    return
  }

  if (fragment.kind === 'paragraph') {
    drawLines(context, fragment.lines, theme.typography.body, theme)
    return
  }

  switch (fragment.kind) {
    case 'code':
      drawCodeFragment(context, fragment, theme)
      return
    case 'list':
      drawListFragment(context, fragment, theme)
      return
    case 'blockquote':
      drawBlockquoteFragment(context, fragment, theme)
      return
    case 'table':
      drawTableFragment(context, fragment, theme)
      return
    case 'image':
      drawImageFragment(context, fragment, theme)
      return
    case 'thematicBreak':
      drawThematicBreak(context, fragment)
      return
  }
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: PaintLineBox[] | undefined,
  baseTypography: typeof defaultTheme.typography.body,
  theme: typeof defaultTheme,
): void {
  if (!lines) return

  for (const line of lines) {
    drawLine(context, line, baseTypography, theme)
  }
}

function drawLine(
  context: CanvasRenderingContext2D,
  line: PaintLineBox,
  baseTypography: typeof defaultTheme.typography.body,
  theme: typeof defaultTheme,
): void {
  for (const run of line.runs) {
    drawRun(context, line, run, baseTypography, theme)
  }
}

function drawRun(
  context: CanvasRenderingContext2D,
  line: PaintLineBox,
  run: PaintLineRun,
  baseTypography: typeof defaultTheme.typography.body,
  theme: typeof defaultTheme,
): void {
  const font = fontForRun(run, baseTypography, theme)
  const fillStyle = colorForRun(run)
  const baseline = line.baseline

  context.font = font
  context.fillStyle = fillStyle

  if (run.styleKind === 'inlineCode') {
    const metrics = context.measureText(run.text)
    const paddingX = 4
    const paddingY = 2
    const ascent = metrics.actualBoundingBoxAscent || line.height * 0.72
    const descent = metrics.actualBoundingBoxDescent || line.height * 0.22
    const top = baseline - ascent - paddingY
    const height = ascent + descent + paddingY * 2

    context.fillStyle = COLORS.codeBackground
    context.fillRect(run.x - paddingX, top, metrics.width + paddingX * 2, height)
    context.fillStyle = COLORS.text
    context.fillText(run.text, run.x, baseline)
    return
  }

  context.fillText(run.text, run.x, baseline)

  if (run.styleKind === 'link') {
    const metrics = context.measureText(run.text)
    context.strokeStyle = COLORS.link
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(run.x, baseline + 2)
    context.lineTo(run.x + metrics.width, baseline + 2)
    context.stroke()
  }

  if (run.styleKind === 'delete') {
    const metrics = context.measureText(run.text)
    context.strokeStyle = COLORS.text
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(run.x, baseline - line.height * 0.35)
    context.lineTo(run.x + metrics.width, baseline - line.height * 0.35)
    context.stroke()
  }
}

function drawCodeFragment(context: CanvasRenderingContext2D, fragment: PaintCodeFragment, theme: typeof defaultTheme): void {
  context.fillStyle = COLORS.codeBackground
  context.fillRect(fragment.box.x, fragment.box.y, fragment.box.width, fragment.box.height)
  context.strokeStyle = COLORS.subtleBorder
  context.lineWidth = 1
  context.strokeRect(fragment.box.x, fragment.box.y, fragment.box.width, fragment.box.height)
  drawLines(context, fragment.lines, theme.typography.code, theme)
}

function drawListFragment(context: CanvasRenderingContext2D, fragment: PaintListFragment, theme: typeof defaultTheme): void {
  for (const item of fragment.items) {
    drawListMarker(context, item, theme)
    for (const child of item.children) {
      drawFragment(context, child, theme)
    }
  }
}

function drawListMarker(
  context: CanvasRenderingContext2D,
  item: PaintListItemFragment,
  theme: typeof defaultTheme,
): void {
  const firstLine = findFirstLine(item.children)
  const baseline = firstLine?.baseline ?? item.box.y + theme.typography.body.lineHeight * 0.8
  const markerX = item.box.x + 4

  context.font = theme.typography.body.font
  context.fillStyle = COLORS.text

  switch (item.marker.kind) {
    case 'bullet':
      context.fillText('•', markerX, baseline)
      return
    case 'ordered':
      context.fillText(`${item.marker.ordinal}.`, markerX, baseline)
      return
    case 'task':
      context.fillText(item.marker.checked ? '☑' : '☐', markerX, baseline)
      return
  }
}

function drawBlockquoteFragment(
  context: CanvasRenderingContext2D,
  fragment: Extract<PaintBlockFragment, { kind: 'blockquote' }>,
  theme: typeof defaultTheme,
): void {
  context.fillStyle = '#f8fafc'
  context.fillRect(fragment.box.x, fragment.box.y, fragment.box.width, fragment.box.height)
  context.fillStyle = COLORS.quoteBorder
  context.fillRect(fragment.box.x, fragment.box.y, 4, fragment.box.height)

  for (const child of fragment.children) {
    drawFragment(context, child, theme)
  }
}

function drawTableFragment(context: CanvasRenderingContext2D, fragment: PaintTableFragment, theme: typeof defaultTheme): void {
  drawTableRow(context, fragment.header, theme)
  for (const row of fragment.rows) {
    drawTableRow(context, row, theme)
  }
}

function drawTableRow(context: CanvasRenderingContext2D, row: PaintTableRowFragment, theme: typeof defaultTheme): void {
  for (const cell of row.cells) {
    context.strokeStyle = COLORS.border
    context.lineWidth = 1
    context.strokeRect(cell.box.x, cell.box.y, cell.box.width, cell.box.height)
    drawLines(context, cell.lines, theme.typography.body, theme)
  }
}

function drawImageFragment(context: CanvasRenderingContext2D, fragment: PaintImageFragment, theme: typeof defaultTheme): void {
  context.fillStyle = COLORS.imageBackground
  context.fillRect(fragment.box.x, fragment.box.y, fragment.box.width, fragment.box.height)
  context.strokeStyle = COLORS.imageAccent
  context.lineWidth = 2
  context.strokeRect(fragment.box.x, fragment.box.y, fragment.box.width, fragment.box.height)

  context.font = theme.typography.body.font
  context.fillStyle = COLORS.mutedText
  const label = fragment.title ?? fragment.alt ?? fragment.url
  context.fillText(label.slice(0, 80), fragment.box.x + 16, fragment.box.y + theme.typography.body.lineHeight)
}

function drawThematicBreak(context: CanvasRenderingContext2D, fragment: PaintThematicBreakFragment): void {
  context.strokeStyle = COLORS.border
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(fragment.box.x, fragment.box.y + 0.5)
  context.lineTo(fragment.box.x + fragment.box.width, fragment.box.y + 0.5)
  context.stroke()
}

function fontForRun(
  run: PaintLineRun,
  baseTypography: typeof defaultTheme.typography.body,
  theme: typeof defaultTheme,
): string {
  switch (run.styleKind) {
    case 'strong':
      return withFontWeight(baseTypography.font, 'bold')
    case 'emphasis':
      return withFontStyle(baseTypography.font, 'italic')
    case 'inlineCode':
      return theme.typography.code.font
    case 'link':
    case 'delete':
    case 'inlineImage':
    case 'text':
    default:
      return baseTypography.font
  }
}

function colorForRun(run: PaintLineRun): string {
  switch (run.styleKind) {
    case 'link':
      return COLORS.link
    case 'delete':
      return COLORS.mutedText
    default:
      return COLORS.text
  }
}

function withFontStyle(font: string, style: 'italic'): string {
  if (new RegExp(`\\b${style}\\b`, 'i').test(font)) {
    return font
  }

  return `${style} ${font}`
}

function withFontWeight(font: string, weight: 'bold'): string {
  if (new RegExp(`\\b${weight}\\b`, 'i').test(font)) {
    return font
  }

  return `${weight} ${font}`
}

function resolveHeadingTypography(
  fragment: PaintHeadingFragment,
  theme: typeof defaultTheme,
): typeof defaultTheme.typography.body {
  return fragment.depth <= 1 ? theme.typography.h1 : theme.typography.h2
}

function findFirstLine(children: PaintBlockFragment[]): PaintLineBox | null {
  for (const child of children) {
    if ('lines' in child && child.lines && child.lines.length > 0) {
      return child.lines[0] ?? null
    }

    if (child.kind === 'blockquote') {
      const nested = findFirstLine(child.children)

      if (nested) {
        return nested
      }
    }
  }

  return null
}

function withItalic(font: string): string {
  if (/\bitalic\b/i.test(font)) {
    return font
  }

  return `italic ${font}`
}
