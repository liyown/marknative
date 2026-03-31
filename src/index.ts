// New direct rendering API
export { renderDoc, renderDocFromBlocks, renderDocFromJson } from './pipeline/render-doc'

// Legacy rendering API (for backward compatibility)
export { renderMarkdown, renderContent, renderJson } from './pipeline/render-one'

// Content parsers (still useful standalone)
export { parseMarkdown } from './content/parse-markdown'
export { parseJson } from './content/parse-json'

// Low-level building blocks
export { blockToNodes } from './pipeline/block-to-nodes'
export { measureBlocks } from './pipeline/measure'
export { paginateByHeights } from './pipeline/paginate'
export { computeLayoutBoxes, initLayoutEngine } from './layout/engine'
export { registerFont } from './setup'
export { defaultTokens, makeTokens } from './templates/tokens/default'

// Types
export type {
  ContentBlock,
  Span,
  DesignTokens,
  RenderConfig,
  LayoutSpec,
  LayoutSpecNode,
  LayoutBox,
  TextLine,
  ResolvedPaint,
  Shadow,
  RenderOptions,
  RenderOutput,
  IRenderer,
} from './types'
