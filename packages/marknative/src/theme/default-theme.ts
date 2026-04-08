export type TypographyStyle = {
  font: string
  lineHeight: number
}

export type ColorStop = {
  /** Position along the gradient, 0 (start) to 1 (end). */
  offset: number
  color: string
}

export type LinearGradientFill = {
  type: 'linear'
  /**
   * Angle in degrees. 0 = top → bottom, 90 = left → right,
   * 180 = bottom → top, 270 = right → left.
   * @default 0
   */
  angle?: number
  stops: ColorStop[]
}

export type RadialGradientFill = {
  type: 'radial'
  stops: ColorStop[]
}

export type GradientFill = LinearGradientFill | RadialGradientFill

export type ThemeColors = {
  /** Page background solid color (used as fallback when no gradient is set). */
  background: string
  /**
   * Optional gradient fill for the page background.
   * When set, takes precedence over `background`.
   */
  backgroundGradient?: GradientFill
  /** Main body text, list markers */
  text: string
  /** Link text and underline */
  link: string
  /** Strikethrough text, image placeholder labels */
  mutedText: string
  /** Table cell borders, thematic break */
  border: string
  /** Code block outline */
  subtleBorder: string
  /** Code block fill, inline code fill */
  codeBackground: string
  /** Blockquote panel fill */
  quoteBackground: string
  /** Blockquote left accent bar */
  quoteBorder: string
  /** Image placeholder fill */
  imageBackground: string
  /** Image placeholder border */
  imageAccent: string
  /** Checked task-list checkbox fill */
  checkboxChecked: string
  /** Checkmark stroke inside a checked checkbox */
  checkboxCheckedMark: string
  /** Unchecked task-list checkbox border */
  checkboxUnchecked: string
  /**
   * Table header row background.
   * Defaults to `codeBackground` when not set.
   */
  tableHeaderBackground?: string
}

export type Theme = {
  page: {
    width: number
    height: number
    margin: {
      top: number
      right: number
      bottom: number
      left: number
    }
  }
  typography: {
    h1: TypographyStyle
    h2: TypographyStyle
    /** H3 headings. */
    h3: TypographyStyle
    /** H4–H6 headings (h5 and h6 share this style). */
    h4: TypographyStyle
    body: TypographyStyle
    code: TypographyStyle
  }
  blocks: {
    paragraph: { marginBottom: number }
    heading: { marginTop: number; marginBottom: number }
    list: { marginBottom: number; itemGap: number; indent: number }
    code: { marginBottom: number; padding: number, width: number | string }
    quote: { marginBottom: number; padding: number }
    table: { marginBottom: number; cellPadding: number }
    image: { marginBottom: number }
    math: { marginBottom: number; padding: number }
  }
  colors: ThemeColors
}

/** A recursive partial of Theme — pass as the `theme` option to `renderMarkdown`. */
export type ThemeOverrides = {
  page?: Partial<Omit<Theme['page'], 'margin'>> & { margin?: Partial<Theme['page']['margin']> }
  typography?: {
    h1?: Partial<TypographyStyle>
    h2?: Partial<TypographyStyle>
    h3?: Partial<TypographyStyle>
    h4?: Partial<TypographyStyle>
    body?: Partial<TypographyStyle>
    code?: Partial<TypographyStyle>
  }
  blocks?: {
    [K in keyof Theme['blocks']]?: Partial<Theme['blocks'][K]>
  }
  colors?: Partial<ThemeColors>
}

/** The built-in theme. Page size is 1080 × 1440 px (portrait card ratio). */
export const defaultTheme: Theme = {
  page: {
    width: 1080,
    height: 1440,
    margin: {
      top: 80,
      right: 72,
      bottom: 80,
      left: 72,
    },
  },
  typography: {
    h1: { font: 'bold 52px sans-serif', lineHeight: 72 },
    h2: { font: 'bold 38px sans-serif', lineHeight: 54 },
    h3: { font: 'bold 30px sans-serif', lineHeight: 44 },
    h4: { font: 'bold 26px sans-serif', lineHeight: 38 },
    body: { font: '28px sans-serif', lineHeight: 44 },
    code: { font: '24px monospace', lineHeight: 36 },
  },
  blocks: {
    paragraph: { marginBottom: 24 },
    heading: { marginTop: 40, marginBottom: 12 },
    list: { marginBottom: 24, itemGap: 8, indent: 36 },
    code: { marginBottom: 24, padding: 24, width: '100%' },
    quote: { marginBottom: 16, padding: 12 },
    table: { marginBottom: 24, cellPadding: 16 },
    image: { marginBottom: 24 },
    math: { marginBottom: 24, padding: 16 },
  },
  colors: {
    background: '#ffffff',
    text: '#111827',
    link: '#2563eb',
    mutedText: '#6b7280',
    border: '#d1d5db',
    subtleBorder: '#e5e7eb',
    codeBackground: '#f8fafc',
    quoteBackground: '#f8fafc',
    quoteBorder: '#9ca3af',
    imageBackground: '#f9fafb',
    imageAccent: '#cbd5e1',
    checkboxChecked: '#374151',
    checkboxCheckedMark: '#ffffff',
    checkboxUnchecked: '#9ca3af',
  },
}
