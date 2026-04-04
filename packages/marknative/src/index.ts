export { parseMarkdown } from './parser/parse-markdown'
export { renderMarkdown } from './render/render-markdown'
export { defaultTheme } from './theme/default-theme'
export { mergeTheme } from './theme/merge-theme'
export { getBuiltInTheme, resolveTheme, isBuiltInThemeName, BUILT_IN_THEME_NAMES } from './theme/built-in-themes'
export { MAX_SINGLE_PAGE_HEIGHT } from './layout/pagination/paginate'

export type { Theme, ThemeOverrides, ThemeColors, TypographyStyle, GradientFill, LinearGradientFill, RadialGradientFill, ColorStop } from './theme/default-theme'
export type { BuiltInThemeName } from './theme/built-in-themes'

export type {
  BlockNode,
  BlockquoteNode,
  BreakNode,
  CodeBlockNode,
  DeleteNode,
  EmphasisNode,
  HeadingNode,
  ImageNode,
  InlineCodeNode,
  InlineImageNode,
  InlineNode,
  InlineMathNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MarkdownDocument,
  MathBlockNode,
  ParagraphNode,
  StrongNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  ThematicBreakNode,
  TextNode,
} from './document/types'
export type { RenderMarkdownOptions, RenderPage } from './render/render-markdown'
