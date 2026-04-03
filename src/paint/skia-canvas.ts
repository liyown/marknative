import type { CanvasRenderingContext2D, Image as SkiaImage } from 'skia-canvas'

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
import type { GradientFill, ThemeColors } from '../theme/default-theme'
import { defaultTheme, type Theme } from '../theme/default-theme'
import { withFontStyle, withFontWeight } from '../layout/font-utils'

const PNG_SCALE = 2

type SkiaCanvasModule = {
  Canvas: new (width?: number, height?: number) => {
    getContext(type?: '2d'): CanvasRenderingContext2D
    toBuffer(format: 'png' | 'svg'): Promise<Buffer>
  }
  loadImage: (src: string | Buffer) => Promise<SkiaImage>
}

let skiaCanvasLoader: Promise<SkiaCanvasModule> | null = null

export function createSkiaCanvasPainter(theme: Theme = defaultTheme): Painter {
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
      .catch((error: unknown) => {
        const reason = error instanceof Error ? `: ${error.message}` : ''
        throw new Error(`marknative requires skia-canvas to render pages${reason}`, { cause: error })
      })
  }

  return skiaCanvasLoader
}

async function renderWithSkia(
  page: PaintPage,
  theme: Theme,
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

  const images = await preloadPageImages(page, skiaCanvas)
  drawPage(context, page, theme, images)

  return canvas.toBuffer(format)
}

async function preloadPageImages(page: PaintPage, skiaCanvas: SkiaCanvasModule): Promise<Map<string, SkiaImage>> {
  const urls = new Set<string>()
  for (const fragment of page.fragments) {
    collectImageUrls(fragment, urls)
  }

  const entries = await Promise.all(
    [...urls].map(async (url) => {
      try {
        const src = await fetchImageSource(url)
        const image = await skiaCanvas.loadImage(src)
        return [url, image] as const
      } catch {
        return null
      }
    }),
  )

  return new Map(entries.filter((e): e is [string, SkiaImage] => e !== null))
}

async function fetchImageSource(url: string): Promise<string | Buffer> {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }

  // local file path or file:// URL — pass through directly
  return url.startsWith('file://') ? new URL(url).pathname : url
}

function collectImageUrls(fragment: PaintBlockFragment, urls: Set<string>): void {
  switch (fragment.kind) {
    case 'image':
      urls.add(fragment.url)
      return
    case 'list':
      for (const item of fragment.items) {
        for (const child of item.children) {
          collectImageUrls(child, urls)
        }
      }
      return
    case 'blockquote':
      for (const child of fragment.children) {
        collectImageUrls(child, urls)
      }
      return
  }
}

function prepareContext(context: CanvasRenderingContext2D): void {
  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
  context.lineJoin = 'round'
  context.lineCap = 'round'
  context.imageSmoothingEnabled = true
}

/**
 * Build a fill value for the page background — either a plain color string
 * or a CanvasGradient when `backgroundGradient` is defined in the theme.
 *
 * Linear gradient angle convention: 0° = top→bottom, 90° = left→right.
 * The gradient line is sized so it fully covers the page rectangle at any angle.
 */
function resolveBackgroundFill(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: ThemeColors,
): string | ReturnType<CanvasRenderingContext2D['createLinearGradient']> {
  const spec = colors.backgroundGradient
  if (!spec) return colors.background

  if (spec.type === 'linear') {
    const angle = spec.angle ?? 0
    const rad = (angle * Math.PI) / 180
    const dx = Math.sin(rad)
    const dy = Math.cos(rad)
    // Gradient line length to guarantee full rectangle coverage at any angle
    const length = Math.abs(dx) * width + Math.abs(dy) * height
    const cx = width / 2
    const cy = height / 2
    const gradient = context.createLinearGradient(
      cx - (dx * length) / 2,
      cy - (dy * length) / 2,
      cx + (dx * length) / 2,
      cy + (dy * length) / 2,
    )
    for (const stop of spec.stops) {
      gradient.addColorStop(stop.offset, stop.color)
    }
    return gradient
  }

  // Radial gradient — centred on the page, radius reaches the farthest corner
  const cx = width / 2
  const cy = height / 2
  const radius = Math.sqrt(cx * cx + cy * cy)
  const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius)
  for (const stop of spec.stops) {
    gradient.addColorStop(stop.offset, stop.color)
  }
  return gradient
}

function drawPage(context: CanvasRenderingContext2D, page: PaintPage, theme: Theme, images: Map<string, SkiaImage>): void {
  context.fillStyle = resolveBackgroundFill(context, page.width, page.height, theme.colors)
  context.fillRect(0, 0, page.width, page.height)

  for (const fragment of page.fragments) {
    drawFragment(context, fragment, theme, images)
  }
}

function drawFragment(
  context: CanvasRenderingContext2D,
  fragment: PaintBlockFragment,
  theme: Theme,
  images: Map<string, SkiaImage>,
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
      drawListFragment(context, fragment, theme, images)
      return
    case 'blockquote':
      drawBlockquoteFragment(context, fragment, theme, images)
      return
    case 'table':
      drawTableFragment(context, fragment, theme)
      return
    case 'image':
      drawImageFragment(context, fragment, theme, images)
      return
    case 'thematicBreak':
      drawThematicBreak(context, fragment, theme)
      return
  }
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: PaintLineBox[] | undefined,
  baseTypography: Theme['typography']['body'],
  theme: Theme,
): void {
  if (!lines) return

  for (const line of lines) {
    drawLine(context, line, baseTypography, theme)
  }
}

function drawLine(
  context: CanvasRenderingContext2D,
  line: PaintLineBox,
  baseTypography: Theme['typography']['body'],
  theme: Theme,
): void {
  for (const run of line.runs) {
    drawRun(context, line, run, baseTypography, theme)
  }
}

function drawRun(
  context: CanvasRenderingContext2D,
  line: PaintLineBox,
  run: PaintLineRun,
  baseTypography: Theme['typography']['body'],
  theme: Theme,
): void {
  const font = fontForRun(run, baseTypography, theme)
  const fillStyle = colorForRun(run, theme)
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

    context.fillStyle = theme.colors.codeBackground
    context.fillRect(run.x - paddingX, top, metrics.width + paddingX * 2, height)
    context.fillStyle = theme.colors.text
    context.fillText(run.text, run.x, baseline)
    return
  }

  context.fillText(run.text, run.x, baseline)

  if (run.styleKind === 'link') {
    const metrics = context.measureText(run.text)
    context.strokeStyle = theme.colors.link
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(run.x, baseline + 2)
    context.lineTo(run.x + metrics.width, baseline + 2)
    context.stroke()
  }

  if (run.styleKind === 'delete') {
    const metrics = context.measureText(run.text)
    context.strokeStyle = theme.colors.mutedText
    context.lineWidth = 1.5
    context.beginPath()
    const strikeY = baseline - line.height * 0.22
    context.moveTo(run.x, strikeY)
    context.lineTo(run.x + metrics.width, strikeY)
    context.stroke()
  }
}

function drawCodeFragment(context: CanvasRenderingContext2D, fragment: PaintCodeFragment, theme: Theme): void {
  context.fillStyle = theme.colors.codeBackground
  context.fillRect(fragment.box.x, fragment.box.y, fragment.box.width, fragment.box.height)
  context.strokeStyle = theme.colors.subtleBorder
  context.lineWidth = 1
  context.strokeRect(fragment.box.x, fragment.box.y, fragment.box.width, fragment.box.height)
  drawLines(context, fragment.lines, theme.typography.code, theme)
}

function drawListFragment(context: CanvasRenderingContext2D, fragment: PaintListFragment, theme: Theme, images: Map<string, SkiaImage>): void {
  for (const item of fragment.items) {
    drawListMarker(context, item, theme)
    for (const child of item.children) {
      drawFragment(context, child, theme, images)
    }
  }
}

function drawListMarker(
  context: CanvasRenderingContext2D,
  item: PaintListItemFragment,
  theme: Theme,
): void {
  const firstLine = findFirstLine(item.children)
  const baseline = firstLine?.baseline ?? item.box.y + theme.typography.body.lineHeight * 0.8
  const markerX = item.box.x + 4

  context.font = theme.typography.body.font
  context.fillStyle = theme.colors.text

  switch (item.marker.kind) {
    case 'bullet':
      context.fillText('•', markerX, baseline)
      return
    case 'ordered':
      context.fillText(`${item.marker.ordinal}.`, markerX, baseline)
      return
    case 'task':
      drawTaskCheckbox(context, markerX, baseline, theme.typography.body.lineHeight, item.marker.checked, theme)
      return
  }
}

function drawBlockquoteFragment(
  context: CanvasRenderingContext2D,
  fragment: Extract<PaintBlockFragment, { kind: 'blockquote' }>,
  theme: Theme,
  images: Map<string, SkiaImage>,
): void {
  context.fillStyle = theme.colors.quoteBackground
  context.fillRect(fragment.box.x, fragment.box.y, fragment.box.width, fragment.box.height)
  context.fillStyle = theme.colors.quoteBorder
  context.fillRect(fragment.box.x, fragment.box.y, 4, fragment.box.height)

  for (const child of fragment.children) {
    drawFragment(context, child, theme, images)
  }
}

function drawTableFragment(context: CanvasRenderingContext2D, fragment: PaintTableFragment, theme: Theme): void {
  // Header background — use dedicated token, fall back to codeBackground
  const headerBg = theme.colors.tableHeaderBackground ?? theme.colors.codeBackground
  context.fillStyle = headerBg
  context.fillRect(
    fragment.header.box.x,
    fragment.header.box.y,
    fragment.header.box.width,
    fragment.header.box.height,
  )
  drawTableRow(context, fragment.header, theme)
  for (const row of fragment.rows) {
    drawTableRow(context, row, theme)
  }
}

function drawTableRow(context: CanvasRenderingContext2D, row: PaintTableRowFragment, theme: Theme): void {
  for (const cell of row.cells) {
    context.strokeStyle = theme.colors.border
    context.lineWidth = 1
    context.strokeRect(cell.box.x, cell.box.y, cell.box.width, cell.box.height)
    drawLines(context, cell.lines, theme.typography.body, theme)
  }
}

function drawImageFragment(
  context: CanvasRenderingContext2D,
  fragment: PaintImageFragment,
  theme: Theme,
  images: Map<string, SkiaImage>,
): void {
  const { x, y, width, height } = fragment.box
  const image = images.get(fragment.url)

  if (image) {
    const scale = Math.min(width / image.width, height / image.height)
    const drawWidth = image.width * scale
    const drawHeight = image.height * scale
    const drawX = x + (width - drawWidth) / 2
    const drawY = y + (height - drawHeight) / 2
    context.drawImage(image as never, drawX, drawY, drawWidth, drawHeight)
    return
  }

  context.fillStyle = theme.colors.imageBackground
  context.fillRect(x, y, width, height)
  context.strokeStyle = theme.colors.imageAccent
  context.lineWidth = 2
  context.strokeRect(x, y, width, height)

  context.font = theme.typography.body.font
  context.fillStyle = theme.colors.mutedText
  const label = fragment.title ?? fragment.alt ?? fragment.url
  context.fillText(label.slice(0, 80), x + 16, y + theme.typography.body.lineHeight)
}

function drawThematicBreak(context: CanvasRenderingContext2D, fragment: PaintThematicBreakFragment, theme: Theme): void {
  context.strokeStyle = theme.colors.border
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(fragment.box.x, fragment.box.y + 0.5)
  context.lineTo(fragment.box.x + fragment.box.width, fragment.box.y + 0.5)
  context.stroke()
}

function fontForRun(
  run: PaintLineRun,
  baseTypography: Theme['typography']['body'],
  theme: Theme,
): string {
  switch (run.styleKind) {
    case 'strong':
      return withFontWeight(baseTypography.font, 'bold')
    case 'emphasis':
      return withFontStyle(baseTypography.font, 'italic')
    case 'inlineCode':
      return theme.typography.code.font
    case 'codeToken': {
      let font = baseTypography.font
      if (run.fontStyle === 'italic') font = withFontStyle(font, 'italic')
      if (run.fontWeight === 'bold') font = withFontWeight(font, 'bold')
      return font
    }
    case 'link':
    case 'delete':
    case 'inlineImage':
    case 'text':
    default:
      return baseTypography.font
  }
}

function colorForRun(run: PaintLineRun, theme: Theme): string {
  switch (run.styleKind) {
    case 'link':
      return theme.colors.link
    case 'delete':
      return theme.colors.mutedText
    case 'codeToken':
      return run.color ?? theme.colors.text
    default:
      return theme.colors.text
  }
}

function resolveHeadingTypography(
  fragment: PaintHeadingFragment,
  theme: Theme,
): Theme['typography']['body'] {
  if (fragment.depth <= 1) return theme.typography.h1
  if (fragment.depth === 2) return theme.typography.h2
  if (fragment.depth === 3) return theme.typography.h3
  return theme.typography.h4 // h4, h5, h6
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


function drawTaskCheckbox(
  context: CanvasRenderingContext2D,
  x: number,
  baseline: number,
  lineHeight: number,
  checked: boolean,
  theme: Theme,
): void {
  const size = Math.round(lineHeight * 0.42)
  const boxX = x
  const boxY = Math.round(baseline - size * 0.92)
  const r = 3

  if (checked) {
    context.fillStyle = theme.colors.checkboxChecked
    context.beginPath()
    context.moveTo(boxX + r, boxY)
    context.lineTo(boxX + size - r, boxY)
    context.arcTo(boxX + size, boxY, boxX + size, boxY + r, r)
    context.lineTo(boxX + size, boxY + size - r)
    context.arcTo(boxX + size, boxY + size, boxX + size - r, boxY + size, r)
    context.lineTo(boxX + r, boxY + size)
    context.arcTo(boxX, boxY + size, boxX, boxY + size - r, r)
    context.lineTo(boxX, boxY + r)
    context.arcTo(boxX, boxY, boxX + r, boxY, r)
    context.closePath()
    context.fill()

    context.strokeStyle = theme.colors.checkboxCheckedMark
    context.lineWidth = Math.max(1.5, size * 0.11)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(boxX + size * 0.22, boxY + size * 0.52)
    context.lineTo(boxX + size * 0.44, boxY + size * 0.74)
    context.lineTo(boxX + size * 0.78, boxY + size * 0.28)
    context.stroke()
  } else {
    context.strokeStyle = theme.colors.checkboxUnchecked
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(boxX + r, boxY)
    context.lineTo(boxX + size - r, boxY)
    context.arcTo(boxX + size, boxY, boxX + size, boxY + r, r)
    context.lineTo(boxX + size, boxY + size - r)
    context.arcTo(boxX + size, boxY + size, boxX + size - r, boxY + size, r)
    context.lineTo(boxX + r, boxY + size)
    context.arcTo(boxX, boxY + size, boxX, boxY + size - r, r)
    context.lineTo(boxX, boxY + r)
    context.arcTo(boxX, boxY, boxX + r, boxY, r)
    context.closePath()
    context.stroke()
  }
}
