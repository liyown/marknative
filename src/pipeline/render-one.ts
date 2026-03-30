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

async function renderBoxes(
  boxes: LayoutBox[],
  size: { width: number; height: number },
  options: RenderOptions,
): Promise<RenderOutput> {
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
  if (backend === 'svg') return renderPageSvg(boxes, size)
  if (backend === 'html') return renderPageHtml(boxes, size)
  return renderPageCanvas(boxes, size, options)
}

export async function renderContent(
  blocks: ContentBlock[],
  family: TemplateFamily,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const pages = paginateContent(blocks, family.content)
  const assignments = selectTemplates(pages, family)

  return Promise.all(
    assignments.map(async ({ blocks: pageBlocks, template }) => {
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
