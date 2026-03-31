import type { Template } from '../../types'
import { defaultTokens } from '../tokens/default'

export function makeSummaryTemplate(fontFamily: string = 'Heiti SC'): Template {
  const t = {
    colors: { ...defaultTokens.colors, bg: '#fafafa' },
    spacing: { ...defaultTokens.spacing },
    radius: { ...defaultTokens.radius },
    typography: {
      h1: { font: `bold 52px ${fontFamily}`, lineHeight: 72 },
      h2: { font: `bold 38px ${fontFamily}`, lineHeight: 54 },
      body: { font: `28px ${fontFamily}`, lineHeight: 44 },
      caption: { font: `22px ${fontFamily}`, lineHeight: 34 },
      code: { font: '24px monospace', lineHeight: 36 },
    },
  }

  return {
    id: 'ending.summary',
    size: { width: 1080, height: 1440 },
    tokens: t,
    contentArea: { x: 72, y: 200, width: 936, height: 1040 },
    root: {
      type: 'container',
      direction: 'column',
      width: 1080,
      height: 1440,
      padding: 72,
      gap: 24,
      background: { type: 'color', value: t.colors.bg },
      children: [
        {
          type: 'text',
          spans: [{ text: '— END —' }],
          font: t.typography.caption.font,
          lineHeight: t.typography.caption.lineHeight,
          color: t.colors.subtext,
          align: 'center',
        },
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'hug',
          gap: 4,
          children: [{ type: 'slot', name: 'body' }],
        },
        { type: 'slot', name: 'tags' },
      ],
    },
  }
}

export const summaryTemplate = makeSummaryTemplate()
