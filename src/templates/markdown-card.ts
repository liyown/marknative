import { marked } from 'marked'
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import type { Background, CardElement, CardSchema, TextSpan } from '../types.js'
import '../setup.js' // ensure OffscreenCanvas polyfill is initialized before pretext calls

// ── Types ────────────────────────────────────────────────────────────────────

export type MarkdownCardOptions = {
  markdown: string
  fontFamily?: string
  size?: { width: number; height: number }
  background?: Background
  /** H1 font size multiplier (default 0.060) */
  h1Size?: number
  /** H2 font size multiplier (default 0.048) */
  h2Size?: number
  /** Body font size multiplier (default 0.032) */
  bodySize?: number
  /** Line height multiplier (default 1.6) */
  lineHeight?: number
  /** Vertical gap between blocks (default 20) */
  blockGap?: number
  /** Horizontal padding (default 60) */
  padding?: number
  /** Body text color */
  textColor?: string
  /** Heading text color override */
  headingColor?: string
  /** Code block background (default #f3f4f6) */
  codeBg?: string
  /** Show page numbers (default true) */
  pageNumbers?: boolean
}

// marked token kinds we handle
type Token =
  | { type: 'heading'; raw: string; depth: 1 | 2; text: string }
  | { type: 'paragraph'; raw: string; text: string }
  | { type: 'list'; raw: string; items: { type: 'list_item'; raw: string; text: string; task: boolean; checked?: boolean }[]; ordered: boolean }
  | { type: 'blockquote'; raw: string; text: string }
  | { type: 'code'; raw: string; text: string; lang?: string }
  | { type: 'space' | 'hr' | 'html' | undefined }

// ── Span Builder (inline markdown) ──────────────────────────────────────────

function parseInline(text: string): { content: string; bold: boolean; italic: boolean; code: boolean }[] {
  const runs: { content: string; bold: boolean; italic: boolean; code: boolean }[] = []
  let remaining = text

  while (remaining.length > 0) {
    // Code: `text`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      runs.push({ content: codeMatch[1]!, bold: false, italic: false, code: true })
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      runs.push({ content: boldMatch[1]!, bold: true, italic: false, code: false })
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^\*([^*]+)\*/)
    if (italicMatch) {
      runs.push({ content: italicMatch[1]!, bold: false, italic: true, code: false })
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Collect plain text until next marker
    const nextSpecial = remaining.search(/[\*`]/)
    if (nextSpecial === -1) {
      runs.push({ content: remaining, bold: false, italic: false, code: false })
      break
    } else if (nextSpecial === 0) {
      runs.push({ content: remaining.slice(0, 1), bold: false, italic: false, code: false })
      remaining = remaining.slice(1)
    } else {
      runs.push({ content: remaining.slice(0, nextSpecial), bold: false, italic: false, code: false })
      remaining = remaining.slice(nextSpecial)
    }
  }

  // Merge consecutive runs with same style
  const merged: { content: string; bold: boolean; italic: boolean; code: boolean }[] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && last.bold === run.bold && last.italic === run.italic && last.code === run.code) {
      last.content += run.content
    } else {
      merged.push({ ...run })
    }
  }
  return merged
}

function buildSpans(
  text: string,
  fontFamily: string,
  baseFontSize: number,
  color: string,
  codeBg: string,
): TextSpan[] {
  const runs = parseInline(text)
  if (runs.length === 0) return []

  return runs.map(run => {
    const style = run.code ? codeBg : color
    const weight = run.bold ? 'bold' : ''
    const style2 = run.italic ? 'italic' : ''
    const fontStr = [weight, style2, `${baseFontSize}px "${fontFamily}"`].filter(Boolean).join(' ')

    return {
      content: run.content,
      font: fontStr,
      fill: { type: 'color' as const, value: style },
    }
  })
}

// ── Height Measurement ───────────────────────────────────────────────────────

function measureTextHeight(
  text: string,
  fontFamily: string,
  fontSize: number,
  width: number,
  lineHeight: number,
): number {
  const plainText = text.trim()
  if (!plainText) return 0

  try {
    const prepared = prepareWithSegments(
      plainText,
      `${fontSize}px "${fontFamily}"`,
      { whiteSpace: 'pre-wrap' },
    )
    const { lineCount } = layoutWithLines(prepared, width, lineHeight)
    return lineCount * lineHeight
  } catch {
    // fallback: rough estimate
    const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.6)))
    const lines = Math.ceil(plainText.length / charsPerLine)
    return lines * lineHeight
  }
}

// ── Block Renderer ──────────────────────────────────────────────────────────

function renderToken(
  token: Token,
  x: number,
  startY: number,
  opts: {
    size: { width: number; height: number }
    padding: number
    fontFamily: string
    h1Size: number
    h2Size: number
    bodySize: number
    lineHeight: number
    blockGap: number
    textColor: string
    headingColor: string
    codeBg: string
  },
): { elements: CardElement[]; height: number } {
  const {
    size,
    padding: pad,
    fontFamily,
    h1Size,
    h2Size,
    bodySize,
    lineHeight,
    blockGap,
    textColor,
    headingColor,
    codeBg,
  } = opts

  const cw = size!.width - pad * 2
  const headingFontColor = headingColor ?? textColor

  switch (token.type) {
    case 'heading': {
      const isH1 = token.depth === 1
      const fs = Math.round(size!.width * (isH1 ? h1Size : h2Size))
      const lh = Math.round(fs * 1.3)
      const spans = buildSpans(token.text, fontFamily, fs, headingFontColor, codeBg)
      return {
        elements: [{
          type: 'text',
          x, y: startY, width: cw,
          lineHeight: lh,
          spans,
        }],
        height: lh + blockGap,
      }
    }

    case 'paragraph': {
      const fs = Math.round(size!.width * bodySize)
      const lh = Math.round(fs * lineHeight)
      const spans = buildSpans(token.text, fontFamily, fs, textColor, codeBg)
      return {
        elements: [{
          type: 'text',
          x, y: startY, width: cw,
          lineHeight: lh,
          spans,
        }],
        height: measureTextHeight(token.text, fontFamily, fs, cw, lh) + blockGap,
      }
    }

    case 'list': {
      const fs = Math.round(size!.width * bodySize)
      const lh = Math.round(fs * lineHeight)
      const bulletW = Math.round(fs * 1.5)
      const indent = bulletW + Math.round(fs * 0.6)
      const elements: CardElement[] = []
      let y = startY

      for (const item of token.items) {
        const bullet = token.ordered
          ? `${item.text.match(/^\d+/)?.[0] ?? '•'}. `
          : '• '
        const text = item.text.replace(/^\d+\.\s/, '')

        elements.push({
          type: 'text',
          x, y,
          width: bulletW,
          lineHeight: lh,
          spans: [{
            content: bullet,
            font: `${fs}px "${fontFamily}"`,
            fill: { type: 'color', value: textColor },
          }],
        })
        elements.push({
          type: 'text',
          x: x + indent, y,
          width: cw - indent,
          lineHeight: lh,
          spans: buildSpans(text, fontFamily, fs, textColor, codeBg),
        })
        y += measureTextHeight(text, fontFamily, fs, cw - indent, lh) + Math.round(blockGap * 0.5)
      }

      return { elements, height: y - startY + blockGap }
    }

    case 'blockquote': {
      const fs = Math.round(size!.width * bodySize)
      const lh = Math.round(fs * lineHeight)
      const barW = 6
      const indent = barW + Math.round(fs * 0.8)
      const spans = buildSpans(token.text, fontFamily, fs, 'rgba(31,41,55,0.7)', codeBg)
      return {
        elements: [
          {
            type: 'rect',
            x, y: startY,
            width: barW, height: lh,
            fill: { type: 'color', value: '#d1d5db' },
          },
          {
            type: 'text',
            x: x + indent, y: startY,
            width: cw - indent,
            lineHeight: lh,
            spans,
          },
        ],
        height: measureTextHeight(token.text, fontFamily, fs, cw - indent, lh) + blockGap,
      }
    }

    case 'code': {
      const fs = Math.round(size!.width * 0.026)
      const lh = Math.round(fs * 1.6)
      const codeLines = token.text.split('\n')
      const codeH = Math.min(codeLines.length, 12) * lh + fs
      return {
        elements: [
          {
            type: 'rect',
            x, y: startY,
            width: cw, height: codeH,
            fill: { type: 'color', value: codeBg },
            borderRadius: 12,
          },
          {
            type: 'text',
            x: x + Math.round(fs), y: startY + Math.round(fs * 0.5),
            width: cw - Math.round(fs * 2),
            lineHeight: lh,
            spans: [{
              content: token.text,
              font: `${fs}px monospace`,
              fill: { type: 'color', value: '#374151' },
            }],
          },
        ],
        height: codeH + blockGap,
      }
    }

    default:
      return { elements: [], height: 0 }
  }
}

// ── Main Export ───────────────────────────────────────────────────────────────

export type MarkdownRenderResult = {
  cards: CardSchema[]
}

export function markdownCard(opts: MarkdownCardOptions): MarkdownRenderResult {
  const fontFamily = opts.fontFamily ?? 'sans-serif'
  const size = opts.size ?? { width: 1080, height: 1440 }
  const pad = opts.padding ?? 60
  const lhMult = opts.lineHeight ?? 1.6
  const gap = opts.blockGap ?? 20
  const textColor = opts.textColor ?? '#1f2937'
  const headingColor = opts.headingColor ?? textColor
  const codeBg = opts.codeBg ?? '#f3f4f6'

  const resolvedOpts = {
    fontFamily,
    size,
    background: opts.background ?? { type: 'color', value: '#ffffff' },
    h1Size: opts.h1Size ?? 0.060,
    h2Size: opts.h2Size ?? 0.048,
    bodySize: opts.bodySize ?? 0.032,
    lineHeight: lhMult,
    blockGap: gap,
    padding: pad,
    textColor,
    headingColor,
    codeBg,
    pageNumbers: opts.pageNumbers ?? true,
  } as const

  // Configure marked to emit tokens
  const lexer = new marked.Lexer()
  const tokens = lexer.lex(opts.markdown)

  // Filter to only the block types we handle
  const blocks: Token[] = []
  for (const tok of tokens) {
    if (
      tok.type === 'heading' ||
      tok.type === 'paragraph' ||
      tok.type === 'list' ||
      tok.type === 'blockquote' ||
      tok.type === 'code'
    ) {
      blocks.push(tok as Token)
    }
  }

  if (blocks.length === 0) {
    return {
      cards: [{
        width: size.width,
        height: size.height,
        background: resolvedOpts.background,
        elements: [],
      }],
    }
  }

  // ── Page splitting ───────────────────────────────────────────────────────

  const pages: Token[][] = []
  let currentPage: Token[] = []
  let currentPageHeight = pad

  for (const block of blocks) {
    const rendered = renderToken(block, pad, 0, resolvedOpts)

    if (currentPageHeight + rendered.height > size.height - pad) {
      if (currentPage.length > 0) pages.push(currentPage)
      currentPage = []
      currentPageHeight = pad
    }

    currentPage.push(block)
    currentPageHeight += rendered.height
  }

  if (currentPage.length > 0) pages.push(currentPage)

  // ── Build card schemas ───────────────────────────────────────────────────

  const totalPages = pages.length
  const cards: CardSchema[] = pages.map((pageTokens, pageIdx) => {
    const pageNum = pageIdx + 1
    const isContinuation = pageIdx > 0
    const elements: CardElement[] = []
    let y = pad

    // Continuation page: repeat last H1 as sticky header
    if (isContinuation) {
      const lastH1 = [...pageTokens].reverse().find(
        t => t.type === 'heading' && (t as { depth: number }).depth === 1,
      ) as (Token & { type: 'heading'; depth: 1; text: string }) | undefined

      if (lastH1) {
        const h1Fs = Math.round(size.width * resolvedOpts.h1Size)
        const h1Lh = Math.round(h1Fs * 1.3)
        const headerH = h1Lh + pad * 2
        elements.push({
          type: 'rect',
          x: 0, y: 0,
          width: size.width, height: headerH,
          fill: { type: 'color', value: 'rgba(249,250,251,0.98)' },
        })
        elements.push({
          type: 'text',
          x: pad, y: pad,
          width: size.width - pad * 2,
          lineHeight: h1Lh,
          spans: buildSpans(lastH1.text, fontFamily, h1Fs, headingColor, codeBg),
        })
        y = pad + headerH + gap
      }
    }

    // Render all tokens
    for (const token of pageTokens) {
      const rendered = renderToken(token, pad, y, resolvedOpts)
      elements.push(...rendered.elements)
      y += rendered.height
    }

    // Page number
    if (resolvedOpts.pageNumbers && totalPages > 1) {
      const numFs = Math.round(size.width * 0.022)
      elements.push({
        type: 'text',
        x: pad, y: size.height - pad - numFs,
        width: size.width - pad * 2,
        lineHeight: numFs,
        align: 'right',
        spans: [{
          content: `${pageNum} / ${totalPages}`,
          font: `${numFs}px "${fontFamily}"`,
          fill: { type: 'color', value: 'rgba(31,41,55,0.35)' },
        }],
      })
    }

    return {
      width: size.width,
      height: size.height,
      background: resolvedOpts.background,
      elements,
    }
  })

  return { cards }
}
