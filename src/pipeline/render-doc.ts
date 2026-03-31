import type { ContentBlock, RenderConfig, RenderOptions, RenderOutput, LayoutBox, LayoutSpecNode } from '../types'
import { parseMarkdown } from '../content/parse-markdown'
import { parseJson } from '../content/parse-json'
import { computeLayoutBoxes } from '../layout/engine'
import { renderPageCanvas } from '../renderer/canvas'
import { renderPageSvg } from '../renderer/svg'
import { renderPageHtml } from '../renderer/html'
import { measureBlocks } from './measure'
import { paginateByHeights } from './paginate'
import { blockToNodes } from './block-to-nodes'
import { validateRenderOptions } from './render-one'

function blocksToSpec(blocks: ContentBlock[], config: RenderConfig): LayoutSpecNode {
  const { ds, size, contentArea } = config
  const gap = config.blockGap ?? ds.spacing.md

  return {
    type: 'container',
    direction: 'column',
    width: size.width,
    height: size.height,
    padding: {
      top: contentArea.y,
      right: size.width - contentArea.x - contentArea.width,
      bottom: size.height - contentArea.y - contentArea.height,
      left: contentArea.x,
    },
    gap,
    background: config.background ?? { type: 'color', value: ds.colors.bg },
    children: blocks.flatMap(block => blockToNodes(block, ds, contentArea.width)),
  }
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

export async function renderDocFromBlocks(
  blocks: ContentBlock[],
  config: RenderConfig,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  const { contentArea, ds } = config
  const blockGap = config.blockGap ?? ds.spacing.md

  const heights = await measureBlocks(blocks, ds, contentArea.width)
  const pages = paginateByHeights(blocks, heights, contentArea.height, blockGap)

  return Promise.all(
    pages.map(async pageBlocks => {
      const spec = blocksToSpec(pageBlocks, config)
      const boxes = await computeLayoutBoxes(spec, config.size)
      return renderBoxes(boxes, config.size, options)
    }),
  )
}

export async function renderDoc(
  markdown: string,
  config: RenderConfig,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  return renderDocFromBlocks(parseMarkdown(markdown), config, options)
}

export async function renderDocFromJson(
  raw: unknown,
  config: RenderConfig,
  options: RenderOptions = {},
): Promise<RenderOutput[]> {
  return renderDocFromBlocks(parseJson(raw), config, options)
}
