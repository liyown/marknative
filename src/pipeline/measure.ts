import type { ContentBlock, DesignTokens, LayoutSpecNode } from '../types'
import { computeLayoutBoxes } from '../layout/engine'
import { blockToNodes } from './block-to-nodes'

async function measureBlock(
  block: ContentBlock,
  ds: DesignTokens,
  contentWidth: number,
): Promise<number> {
  const nodes = blockToNodes(block, ds, contentWidth)
  if (nodes.length === 0) return 0

  // Wrap in a hug-height container with a background so boxes[0]
  // is a rect whose height equals the container's total height (including padding)
  const spec: LayoutSpecNode = {
    type: 'container',
    direction: 'column',
    width: contentWidth,
    height: 'hug',
    gap: 0,
    background: { type: 'color', value: '#000000' },
    children: nodes,
  }

  // Yoga assigns the root node the full available height even when height is 'auto'.
  // Find natural content height as the max bottom-edge of leaf boxes (text, images, fixed rects).
  // The root background rect (height === AVAILABLE_HEIGHT) is skipped by the filter.
  const AVAILABLE_HEIGHT = 99999
  const boxes = await computeLayoutBoxes(spec, { width: contentWidth, height: AVAILABLE_HEIGHT })
  let maxBottom = 0
  for (const box of boxes) {
    if (box.height === AVAILABLE_HEIGHT) continue
    maxBottom = Math.max(maxBottom, box.y + box.height)
  }
  return maxBottom
}

export async function measureBlocks(
  blocks: ContentBlock[],
  ds: DesignTokens,
  contentWidth: number,
): Promise<number[]> {
  return Promise.all(blocks.map(block => measureBlock(block, ds, contentWidth)))
}
