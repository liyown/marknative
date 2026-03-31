import type { DesignTokens } from '../../types'

// 字体名 placeholder — 使用者需在 registerFont() 后覆盖
const FONT = 'Heiti SC'

export const defaultTokens: DesignTokens = {
  colors: {
    bg:      '#ffffff',
    text:    '#1a1a1a',
    subtext: '#6b7280',
    primary: '#ef4444',
    accent:  '#f97316',
    border:  '#e5e7eb',
  },
  typography: {
    h1:      { font: `bold 52px ${FONT}`,  lineHeight: 72 },
    h2:      { font: `bold 38px ${FONT}`,  lineHeight: 54 },
    body:    { font: `28px ${FONT}`,        lineHeight: 44 },
    caption: { font: `22px ${FONT}`,        lineHeight: 34 },
    code:    { font: `24px monospace`,      lineHeight: 36 },
  },
  spacing: { xs: 8, sm: 16, md: 24, lg: 40, xl: 64 },
  radius:  { sm: 8, md: 16, lg: 24 },
}

export function makeTokens(font: string, overrides?: Partial<DesignTokens>): DesignTokens {
  const base: DesignTokens = {
    ...defaultTokens,
    typography: {
      h1:      { font: `bold 52px ${font}`,  lineHeight: 72 },
      h2:      { font: `bold 38px ${font}`,  lineHeight: 54 },
      body:    { font: `28px ${font}`,        lineHeight: 44 },
      caption: { font: `22px ${font}`,        lineHeight: 34 },
      code:    { font: `24px monospace`,      lineHeight: 36 },
    },
  }
  return overrides ? { ...base, ...overrides } : base
}
