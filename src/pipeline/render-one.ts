import type { ContentBlock, TemplateFamily, RenderOptions, RenderOutput, LayoutBox } from '../types'
import { parseMarkdown } from '../content/parse-markdown'
import { parseJson } from '../content/parse-json'
import { applyTemplate } from '../template/engine'
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
  if (
    (backend === 'svg' || backend === 'html') &&
    (options.format === 'png' || options.format === 'jpeg')
  ) {
    throw new Error(`Cannot use renderer '${backend}' with raster format '${options.format}'`)
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
  // Phase 1: single page — use content template only
  const template = family.content
  const spec = applyTemplate(blocks, template)
  const boxes = await computeLayoutBoxes(spec, template.size)
  const page = await renderBoxes(boxes, template.size, options)
  return [page]
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
