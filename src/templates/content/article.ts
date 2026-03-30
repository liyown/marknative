import type { Template } from '../../types'
import { defaultTokens } from '../tokens/default'

export function makeArticleTemplate(fontFamily: string = 'Heiti SC'): Template {
  const t = {
    colors: { ...defaultTokens.colors },
    spacing: { ...defaultTokens.spacing },
    radius: { ...defaultTokens.radius },
    typography: {
      h1:      { font: `bold 52px ${fontFamily}`,  lineHeight: 72 },
      h2:      { font: `bold 38px ${fontFamily}`,  lineHeight: 54 },
      body:    { font: `28px ${fontFamily}`,        lineHeight: 44 },
      caption: { font: `22px ${fontFamily}`,        lineHeight: 34 },
      code:    { font: `24px monospace`,            lineHeight: 36 },
    },
  }

  return {
    id: 'content.article.basic',
    size: { width: 1080, height: 1440 },
    tokens: t,
    contentArea: { x: 72, y: 72, width: 936, height: 1296 },
    root: {
      type: 'container',
      direction: 'column',
      width: 1080,
      height: 1440,
      padding: 72,
      gap: 24,
      background: { type: 'color', value: t.colors.bg },
      children: [
        { type: 'slot', name: 'title' },
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

export const articleTemplate = makeArticleTemplate()
