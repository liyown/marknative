import { layoutNextLine, prepareWithSegments } from '@chenglou/pretext'

import type { InlineNode } from '../../document/types'
import type { LineBox, LineRun } from '../types'
import { defaultTheme } from '../../theme/default-theme'

type StyleContext = {
  kind: LineRun['styleKind']
  font: string
  lineHeight: number
}

type PreparedSegment = {
  type: 'text'
  tokenKind: 'space' | 'word' | 'text'
  kind: LineRun['styleKind']
  font: string
  lineHeight: number
  text: string
}

type BreakSegment = {
  type: 'break'
}

type StyledLineRun = LineRun & {
  font: string
}

type MutableLineBox = {
  type: 'line'
  x: number
  y: number
  width: number
  height: number
  baseline: number
  runs: StyledLineRun[]
}

const EPSILON = 0.001

export function layoutInlineRuns(
  runs: InlineNode[],
  width: number,
  theme: typeof defaultTheme,
): LineBox[] {
  const segments = flattenInlineRuns(runs, theme)
  const maxWidth = width > 0 ? width : 1
  const lines: MutableLineBox[] = []

  let currentLine = createLineBox(0)
  let pendingTrailingBreak = false

  for (const segment of segments) {
    if (segment.type === 'break') {
      const finalized = finalizeLine(currentLine, theme.typography.body.lineHeight)
      lines.push(finalized)
      currentLine = createLineBox(finalized.y + finalized.height)
      pendingTrailingBreak = true
      continue
    }

    pendingTrailingBreak = false

    if (segment.tokenKind === 'space' && currentLine.runs.length === 0) {
      continue
    }

    assertTextMeasurementSupport()

    if (segment.tokenKind === 'space') {
      const spaceWidth = measureTextWidth(segment.text, segment.font)

      if (currentLine.width + spaceWidth > maxWidth + EPSILON && currentLine.runs.length > 0) {
        const lastRun = currentLine.runs[currentLine.runs.length - 1]

        if (lastRun && lastRun.styleKind === segment.kind && lastRun.font === segment.font) {
          lastRun.text += segment.text
        }

        const finalized = finalizeLine(currentLine, theme.typography.body.lineHeight)
        lines.push(finalized)
        currentLine = createLineBox(finalized.y + finalized.height)
        continue
      }

      if (currentLine.runs.length === 0) {
        continue
      }

      currentLine.runs.push({
        type: 'text',
        text: segment.text,
        x: currentLine.width,
        y: 0,
        width: spaceWidth,
        height: 0,
        styleKind: segment.kind,
        font: segment.font,
      })
      currentLine.width += spaceWidth
      currentLine.height = Math.max(currentLine.height, segment.lineHeight)
      continue
    }

    const prepared = prepareWithSegments(segment.text, segment.font)
    const fullPreparedWidth = measurePreparedTextWidth(prepared)
    let cursor = { segmentIndex: 0, graphemeIndex: 0 }

    if (
      segment.tokenKind === 'word' &&
      currentLine.runs.length > 0 &&
      fullPreparedWidth <= maxWidth + EPSILON &&
      currentLine.width + fullPreparedWidth > maxWidth + EPSILON
    ) {
      const finalized = finalizeLine(currentLine, theme.typography.body.lineHeight)
      lines.push(finalized)
      currentLine = createLineBox(finalized.y + finalized.height)
    }

    while (true) {
      const remainingWidth = maxWidth - currentLine.width

      if (remainingWidth <= EPSILON) {
        if (currentLine.runs.length > 0) {
          const finalized = finalizeLine(currentLine, theme.typography.body.lineHeight)
          lines.push(finalized)
          currentLine = createLineBox(finalized.y + finalized.height)
          continue
        }

        break
      }

      const laidOut = layoutNextLine(prepared, cursor, remainingWidth)

      if (laidOut === null || laidOut.text.length === 0 || laidOut.width <= EPSILON) {
        break
      }

      if (laidOut.width > remainingWidth + EPSILON && currentLine.runs.length > 0) {
        const finalized = finalizeLine(currentLine, theme.typography.body.lineHeight)
        lines.push(finalized)
        currentLine = createLineBox(finalized.y + finalized.height)
        continue
      }

      const run: StyledLineRun = {
        type: 'text',
        text: laidOut.text,
        x: currentLine.width,
        y: 0,
        width: laidOut.width,
        height: 0,
        styleKind: segment.kind,
        font: segment.font,
      }

      currentLine.runs.push(run)
      currentLine.width += laidOut.width
      currentLine.height = Math.max(currentLine.height, segment.lineHeight)
      cursor = laidOut.end

      if (!isPreparedTextFullyConsumed(prepared, cursor)) {
        const finalized = finalizeLine(currentLine, theme.typography.body.lineHeight)
        lines.push(finalized)
        currentLine = createLineBox(finalized.y + finalized.height)
      }
    }
  }

  if (currentLine.runs.length > 0) {
    lines.push(finalizeLine(currentLine, theme.typography.body.lineHeight))
  } else if (pendingTrailingBreak) {
    lines.push(finalizeLine(currentLine, theme.typography.body.lineHeight))
  }

  return lines
}

function flattenInlineRuns(runs: InlineNode[], theme: typeof defaultTheme): Array<PreparedSegment | BreakSegment> {
  const baseContext: StyleContext = {
    kind: 'text',
    font: theme.typography.body.font,
    lineHeight: theme.typography.body.lineHeight,
  }

  return flattenInlineNodes(runs, theme, baseContext)
}

function flattenInlineNodes(
  runs: InlineNode[],
  theme: typeof defaultTheme,
  context: StyleContext,
): Array<PreparedSegment | BreakSegment> {
  const segments: Array<PreparedSegment | BreakSegment> = []

  for (const run of runs) {
    switch (run.type) {
      case 'text':
        if (run.value.length > 0) {
          for (const token of tokenizeTextForLayout(run.value)) {
            segments.push({
              type: 'text',
              tokenKind: classifyLayoutToken(token),
              kind: context.kind,
              font: context.font,
              lineHeight: context.lineHeight,
              text: token,
            })
          }
        }
        break
      case 'strong':
        segments.push(
          ...flattenInlineNodes(run.children, theme, {
            kind: 'strong',
            font: withFontWeight(context.font, 'bold'),
            lineHeight: context.lineHeight,
          }),
        )
        break
      case 'emphasis':
        segments.push(
          ...flattenInlineNodes(run.children, theme, {
            kind: 'emphasis',
            font: withFontStyle(context.font, 'italic'),
            lineHeight: context.lineHeight,
          }),
        )
        break
      case 'inlineCode':
        if (run.value.length > 0) {
          segments.push({
            type: 'text',
            tokenKind: 'word',
            kind: 'inlineCode',
            font: theme.typography.code.font,
            lineHeight: theme.typography.code.lineHeight,
            text: run.value,
          })
        }
        break
      case 'link':
        segments.push(
          ...flattenInlineNodes(run.children, theme, {
            kind: 'link',
            font: context.font,
            lineHeight: context.lineHeight,
          }),
        )
        break
      case 'delete':
        segments.push(
          ...flattenInlineNodes(run.children, theme, {
            kind: 'delete',
            font: context.font,
            lineHeight: context.lineHeight,
          }),
        )
        break
      case 'inlineImage':
        if ((run.alt ?? '').length > 0) {
          for (const token of tokenizeTextForLayout(run.alt ?? '')) {
            segments.push({
              type: 'text',
              tokenKind: classifyLayoutToken(token),
              kind: 'inlineImage',
              font: context.font,
              lineHeight: context.lineHeight,
              text: token,
            })
          }
        }
        break
      case 'break':
        segments.push({ type: 'break' })
        break
    }
  }

  return segments
}

function assertTextMeasurementSupport(): void {
  const maybeOffscreenCanvas = (globalThis as typeof globalThis & {
    OffscreenCanvas?: new (width: number, height: number) => {
      getContext: (type: '2d') => unknown
    }
  }).OffscreenCanvas

  if (maybeOffscreenCanvas) {
    const context = new maybeOffscreenCanvas(1, 1).getContext('2d')

    if (context) {
      return
    }
  }

  const maybeDocument = (globalThis as typeof globalThis & {
    document?: { createElement?: (tag: string) => { getContext?: (type: '2d') => unknown } }
  }).document

  if (maybeDocument && typeof maybeDocument.createElement === 'function') {
    const canvas = maybeDocument.createElement('canvas')

    if (canvas?.getContext?.('2d')) {
      return
    }
  }

  throw new Error('marknative line layout requires OffscreenCanvas or a DOM canvas 2d context')
}

function createLineBox(y: number): MutableLineBox {
  return {
    type: 'line',
    x: 0,
    y,
    width: 0,
    height: 0,
    baseline: y,
    runs: [],
  }
}

function tokenizeTextForLayout(text: string): string[] {
  const tokens = text.match(/(\s+|[A-Za-z0-9][A-Za-z0-9._:/#@+-]*|[^\sA-Za-z0-9]+)/g)

  return tokens ?? [text]
}

function classifyLayoutToken(token: string): PreparedSegment['tokenKind'] {
  if (/^\s+$/.test(token)) {
    return 'space'
  }

  if (/^[A-Za-z0-9][A-Za-z0-9._:/#@+-]*$/.test(token.trimEnd())) {
    return 'word'
  }

  return 'text'
}

function isPreparedTextFullyConsumed(
  prepared: ReturnType<typeof prepareWithSegments>,
  end: {
    segmentIndex: number
    graphemeIndex: number
  },
): boolean {
  return end.segmentIndex >= prepared.segments.length
}

function measurePreparedTextWidth(prepared: ReturnType<typeof prepareWithSegments>): number {
  return prepared.widths.reduce((sum, width) => sum + width, 0)
}

function measureTextWidth(text: string, font: string): number {
  const maybeOffscreenCanvas = (globalThis as typeof globalThis & {
    OffscreenCanvas?: new (width: number, height: number) => {
      getContext: (type: '2d') => { font: string; measureText: (text: string) => { width: number } } | null
    }
  }).OffscreenCanvas

  if (maybeOffscreenCanvas) {
    const context = new maybeOffscreenCanvas(1, 1).getContext('2d')

    if (context) {
      context.font = font
      return context.measureText(text).width
    }
  }

  const maybeDocument = (globalThis as typeof globalThis & {
    document?: { createElement?: (tag: string) => { getContext?: (type: '2d') => { font: string; measureText: (text: string) => { width: number } } | null } }
  }).document

  if (maybeDocument && typeof maybeDocument.createElement === 'function') {
    const canvas = maybeDocument.createElement('canvas')
    const context = canvas?.getContext?.('2d')

    if (context) {
      context.font = font
      return context.measureText(text).width
    }
  }

  throw new Error('marknative line layout requires OffscreenCanvas or a DOM canvas 2d context')
}

function finalizeLine(line: MutableLineBox, fallbackLineHeight: number): MutableLineBox {
  const height = line.height > 0 ? line.height : fallbackLineHeight

  return {
    ...line,
    width: line.width,
    height,
    baseline: line.y + height * 0.8,
    runs: line.runs.map((run) => ({
      ...run,
      height,
    })),
  }
}

function withFontWeight(font: string, weight: 'bold' | 'normal'): string {
  if (weight === 'normal') {
    return font.replace(/^bold\s+/, '')
  }

  return font.startsWith('bold ') ? font : `bold ${font}`
}

function withFontStyle(font: string, style: 'italic' | 'normal'): string {
  if (style === 'normal') {
    return font.replace(/^italic\s+/, '')
  }

  return font.startsWith('italic ') ? font : `italic ${font}`
}
