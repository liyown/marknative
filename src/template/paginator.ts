import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext'
import type { ContentBlock, DesignTokens, Template } from '../types'

const CONTENT_BUFFER = 1
const ENDING_BUFFER = 1
const DEFAULT_FONT_SIZE = 28

function extractFontSizePx(font: string): number | null {
  const match = font.match(/(\d+(?:\.\d+)?)px\b/i)
  if (!match) return null

  const size = Number(match[1])
  return Number.isFinite(size) ? size : null
}

function measureText(
  text: string,
  font: string,
  lineHeight: number,
  maxWidth: number,
): number {
  if (!text.trim()) return 0

  try {
    const prepared = prepareWithSegments(text, font)
    return layoutWithLines(prepared, maxWidth, lineHeight).height
  } catch {
    const fontSize = extractFontSizePx(font) ?? DEFAULT_FONT_SIZE
    const avgCharWidth = Math.max(Math.round(fontSize * 0.58), 1)
    const charsPerLine = Math.max(Math.floor(maxWidth / avgCharWidth), 1)
    const lines = Math.ceil(text.length / charsPerLine)
    return lines * lineHeight
  }
}

function estimateListHeight(
  items: string[],
  prefix: (index: number) => string,
  availableWidth: number,
  tokens: DesignTokens,
): number {
  return items.reduce((height, item, index) => {
    const itemText = `${prefix(index)} ${item}`
    return (
      height +
      measureText(
        itemText,
        tokens.typography.body.font,
        tokens.typography.body.lineHeight,
        availableWidth,
      ) +
      tokens.spacing.xs
    )
  }, 0)
}

function estimateBlockHeight(
  block: ContentBlock,
  availableWidth: number,
  tokens: DesignTokens,
): number {
  switch (block.type) {
    case 'heroTitle': {
      const titleHeight = measureText(
        block.title,
        tokens.typography.h1.font,
        tokens.typography.h1.lineHeight,
        availableWidth,
      )
      const subtitleHeight = block.subtitle
        ? measureText(
            block.subtitle,
            tokens.typography.h2.font,
            tokens.typography.h2.lineHeight,
            availableWidth,
          )
        : 0
      return titleHeight + subtitleHeight + tokens.spacing.sm
    }
    case 'heading': {
      const style = block.level === 1 ? tokens.typography.h1 : tokens.typography.h2
      return (
        measureText(block.text, style.font, style.lineHeight, availableWidth) +
        tokens.spacing.xs
      )
    }
    case 'paragraph': {
      const text = block.spans.map(span => span.text).join('')
      return (
        measureText(
          text,
          tokens.typography.body.font,
          tokens.typography.body.lineHeight,
          availableWidth,
        ) + tokens.spacing.xs
      )
    }
    case 'bulletList':
      return estimateListHeight(
        block.items,
        () => '•',
        availableWidth,
        tokens,
      )
    case 'orderedList':
      return estimateListHeight(
        block.items,
        index => `${index + 1}.`,
        availableWidth,
        tokens,
      )
    case 'steps':
      return estimateListHeight(
        block.items,
        () => '•',
        availableWidth,
        tokens,
      )
    case 'quoteCard':
      return (
        measureText(
          block.text,
          tokens.typography.body.font,
          tokens.typography.body.lineHeight,
          availableWidth,
        ) + tokens.spacing.md * 2
      )
    case 'metric':
      return (
        tokens.typography.h1.lineHeight +
        tokens.typography.caption.lineHeight +
        tokens.spacing.sm
      )
    case 'tags':
      return tokens.typography.caption.lineHeight + tokens.spacing.sm
    case 'image':
      return availableWidth * (9 / 16)
    case 'codeBlock': {
      const lines = block.code.split('\n').length
      return lines * tokens.typography.code.lineHeight + tokens.spacing.md
    }
    case 'divider':
      return tokens.spacing.md
    default:
      return tokens.typography.body.lineHeight
  }
}

function thresholdForTemplate(template: Template, buffer: number): number {
  return template.contentArea.height * buffer
}

function paginateWithTemplate(
  blocks: ContentBlock[],
  template: Template,
  threshold = thresholdForTemplate(template, CONTENT_BUFFER),
): ContentBlock[][] {
  if (blocks.length === 0) return [[]]

  const { width } = template.contentArea
  const { tokens } = template

  const pages: ContentBlock[][] = []
  let current: ContentBlock[] = []
  let currentHeight = 0

  for (const block of blocks) {
    const blockHeight = estimateBlockHeight(block, width, tokens)

    if (blockHeight > threshold) {
      if (current.length > 0) {
        pages.push(current)
        current = []
        currentHeight = 0
      }

      pages.push([block])
      continue
    }

    if (current.length > 0 && currentHeight + blockHeight > threshold) {
      pages.push(current)
      current = [block]
      currentHeight = blockHeight
      continue
    }

    current.push(block)
    currentHeight += blockHeight
  }

  if (current.length > 0 || pages.length === 0) {
    pages.push(current)
  }

  return pages
}

export function paginateContent(
  blocks: ContentBlock[],
  contentTemplate: Template,
  options: {
    endingTemplate?: Template
  } = {},
): ContentBlock[][] {
  const pages = paginateWithTemplate(blocks, contentTemplate)
  const endingTemplate = options.endingTemplate

  if (!endingTemplate || pages.length <= 1 || blocks.length <= 1) {
    return pages
  }

  const endingThreshold = thresholdForTemplate(endingTemplate, ENDING_BUFFER)
  const { width } = endingTemplate.contentArea
  const { tokens } = endingTemplate

  const endingPage: ContentBlock[] = []
  let endingHeight = 0
  let splitIndex = blocks.length

  for (let index = blocks.length - 1; index >= 1; index -= 1) {
    const block = blocks[index]!
    const blockHeight = estimateBlockHeight(block, width, tokens)
    const exceedsThreshold =
      endingPage.length > 0 && endingHeight + blockHeight > endingThreshold

    if (exceedsThreshold) break

    endingPage.unshift(block)
    endingHeight += blockHeight
    splitIndex = index
  }

  if (endingPage.length === 0) {
    return pages
  }

  const leadingBlocks = blocks.slice(0, splitIndex)
  const leadingPages = paginateWithTemplate(leadingBlocks, contentTemplate)

  return [...leadingPages, endingPage]
}
