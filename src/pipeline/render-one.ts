import type { ContentBlock, TemplateFamily, RenderOptions, RenderOutput, LayoutBox } from '../types'
import { parseMarkdown } from '../content/parse-markdown'
import { parseJson } from '../content/parse-json'
import { applyTemplate } from '../template/engine'
import { paginateContent } from '../template/paginator'
import { selectTemplates } from '../template/selector'
import { computeLayoutBoxes } from '../layout/engine'
import { renderPageCanvas } from '../renderer/canvas'
import { renderPageSvg } from '../renderer/svg'
import { renderPageHtml } from '../renderer/html'

export function validateRenderOptions(
  options: RenderOptions,
): { backend: NonNullable<RenderOptions['renderer']>; format: RenderOutput['format'] } {
  const backend = options.renderer ?? 'canvas'
  const format = options.format ?? (backend === 'canvas' ? 'png' : backend)

  if (backend === 'svg' && format !== 'svg') {
    throw new Error(`Cannot use renderer 'svg' with format '${format}'`)
  }
  if (backend === 'html' && format !== 'html') {
    throw new Error(`Cannot use renderer 'html' with format '${format}'`)
  }
  if (backend === 'canvas' && (format === 'svg' || format === 'html')) {
    throw new Error(`Cannot use renderer 'canvas' with vector format '${format}'`)
  }

  return { backend, format }
}

async function renderBoxes(
  boxes: LayoutBox[],
  size: { width: number; height: number },
  options: RenderOptions,
): Promise<RenderOutput> {
  const { backend } = validateRenderOptions(options)
  if (backend === 'svg') return renderPageSvg(boxes, size)
  if (backend === 'html') return renderPageHtml(boxes, size)
  return renderPageCanvas(boxes, size, options)
}

function splitCoverBlocks(
  blocks: ContentBlock[],
  family: TemplateFamily,
): {
  coverBlocks: ContentBlock[]
  remainingBlocks: ContentBlock[]
} {
  if (!family.cover) {
    return { coverBlocks: [], remainingBlocks: blocks }
  }

  const imageIndex = blocks.findIndex(block => block.type === 'image')
  const heroTitleIndex = blocks.findIndex(block => block.type === 'heroTitle')

  if (imageIndex === -1 || heroTitleIndex === -1) {
    return { coverBlocks: [], remainingBlocks: blocks }
  }

  const coverIndexes = new Set([imageIndex, heroTitleIndex])
  const coverBlocks = blocks.filter((_, index) => coverIndexes.has(index))
  const remainingBlocks = blocks.filter((_, index) => !coverIndexes.has(index))

  return { coverBlocks, remainingBlocks }
}

export async function renderContent(
  blocks: ContentBlock[],
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const { coverBlocks, remainingBlocks } = splitCoverBlocks(blocks, family)
  const paginatedBlocks = coverBlocks.length > 0 ? remainingBlocks : blocks
  const pages = paginateContent(paginatedBlocks, family.content, {
    endingTemplate: family.ending,
  })
  const assignments = selectTemplates(
    pages,
    coverBlocks.length > 0
      ? { content: family.content, ending: family.ending }
      : family,
  )
  const allAssignments =
    coverBlocks.length > 0 && family.cover
      ? [{ blocks: coverBlocks, template: family.cover }, ...assignments]
      : assignments

  return Promise.all(
    allAssignments.map(async ({ blocks: pageBlocks, template }) => {
      const spec = applyTemplate(pageBlocks, template)
      const boxes = await computeLayoutBoxes(spec, template.size)
      return renderBoxes(boxes, template.size, options)
    }),
  )
}

export async function renderMarkdown(
  markdown: string,
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const blocks = parseMarkdown(markdown)
  return renderContent(blocks, family, options)
}

export async function renderJson(
  raw: unknown,
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const blocks = parseJson(raw)
  return renderContent(blocks, family, options)
}
