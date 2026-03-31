// Phase 1: paginateContent / selectTemplates 尚未创建，注释保留到 Phase 2 解注释
export { renderMarkdown, renderContent, renderJson } from './pipeline/render-one'
export { parseMarkdown } from './content/parse-markdown'
export { parseJson } from './content/parse-json'
export { applyTemplate } from './template/engine'
export { computeLayoutBoxes, initLayoutEngine } from './layout/engine'
export { registerFont } from './setup'
export { defaultTokens, makeTokens } from './templates/tokens/default'
export { paginateContent } from './template/paginator'
export { selectTemplates } from './template/selector'
export type {
  ContentBlock,
  Span,
  DesignTokens,
  Template,
  TemplateFamily,
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
