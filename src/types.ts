// ─── Content Layer ────────────────────────────────────────────────────────

export type Span = {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  color?: string
  link?: string
}

export type ContentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; spans: Span[] }
  | { type: 'bulletList'; items: string[] }
  | { type: 'orderedList'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'quoteCard'; text: string; author?: string }
  | { type: 'metric'; label: string; value: string }
  | { type: 'tags'; items: string[] }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'codeBlock'; code: string; language?: string }
  | { type: 'divider' }
  | { type: 'heroTitle'; title: string; subtitle?: string }

// ─── Design Tokens ────────────────────────────────────────────────────────

export type DesignTokens = {
  colors: {
    bg: string
    text: string
    subtext: string
    primary: string
    accent: string
    border: string
  }
  typography: {
    h1: { font: string; lineHeight: number }
    h2: { font: string; lineHeight: number }
    body: { font: string; lineHeight: number }
    caption: { font: string; lineHeight: number }
    code: { font: string; lineHeight: number }
  }
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number }
  radius: { sm: number; md: number; lg: number }
}

// ─── Template & LayoutSpec ────────────────────────────────────────────────

export type ResolvedPaint =
  | { type: 'color'; value: string }
  | {
      type: 'linear-gradient'
      angle: number
      stops: Array<{ offset: number; color: string }>
    }
  | { type: 'image'; src: string; fit?: 'cover' | 'contain' | 'fill' }

export type LayoutSpecNode =
  | {
      type: 'container'
      direction?: 'row' | 'column'
      gap?: number
      padding?: number | { top: number; right: number; bottom: number; left: number }
      width?: number | 'fill'
      height?: number | 'fill' | 'hug'
      align?: 'start' | 'center' | 'end' | 'stretch'
      justify?: 'start' | 'center' | 'end' | 'space-between'
      position?: 'relative' | 'absolute'
      x?: number
      y?: number
      background?: ResolvedPaint
      children: Array<LayoutSpecNode | SlotNode>
    }
  | {
      type: 'text'
      spans: Span[]
      font: string
      lineHeight: number
      color: string
      align?: 'left' | 'center' | 'right'
      maxLines?: number
    }
  | {
      type: 'image'
      src: string
      width: number
      height: number
      fit?: 'cover' | 'contain'
      borderRadius?: number
    }
  | {
      type: 'rect'
      width: number | 'fill'
      height: number | 'fill' | 'hug'
      fill: ResolvedPaint
      borderRadius?: number
      shadow?: Shadow
    }

export type LayoutSpec = LayoutSpecNode

export type SlotNode = { type: 'slot'; name: string }
export type TemplateNode = LayoutSpecNode | SlotNode

export type Shadow = { x: number; y: number; blur: number; color: string }

export type RuleContext = {
  blocks: ContentBlock[]
  tokens: DesignTokens
  mutate: (path: string, value: unknown) => void
}

export type Template = {
  id: string
  size: { width: number; height: number }
  tokens: DesignTokens
  contentArea: { x: number; y: number; width: number; height: number }
  root: TemplateNode
  rules?: Array<(ctx: RuleContext) => void>
}

export type TemplateFamily = {
  cover?: Template
  content: Template
  ending?: Template
}

// ─── Layout Box ───────────────────────────────────────────────────────────

export type TextLine = {
  spans: Array<{ text: string; font: string; color: string; x: number }>
  y: number
  height: number
}

export type LayoutBox = {
  id: string
  kind: 'text' | 'image' | 'rect' | 'group'
  x: number
  y: number
  width: number
  height: number
  zIndex?: number
  // text
  lines?: TextLine[]
  textAlign?: 'left' | 'center' | 'right'
  // image
  src?: string
  loadedImage?: unknown | null
  fit?: 'cover' | 'contain'
  borderRadius?: number
  // rect / background
  fill?: ResolvedPaint
  shadow?: Shadow
  // group
  children?: LayoutBox[]
}

// ─── Renderer ─────────────────────────────────────────────────────────────

export type RenderOptions = {
  renderer?: 'canvas' | 'svg' | 'html'
  format?: RenderOutput['format']
  quality?: number
}

export type RenderOutput =
  | { format: 'png' | 'jpeg'; data: Buffer }
  | { format: 'svg'; data: string }
  | { format: 'html'; data: string }

export interface IRenderer {
  renderPage(
    boxes: LayoutBox[],
    size: { width: number; height: number },
    options?: RenderOptions,
  ): Promise<RenderOutput>
}
