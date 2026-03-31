import type { Template } from '../../types'
import { defaultTokens } from '../tokens/default'

export function makeHeroTemplate(fontFamily: string = 'Heiti SC'): Template {
  const t = {
    colors: { ...defaultTokens.colors },
    spacing: { ...defaultTokens.spacing },
    radius: { ...defaultTokens.radius },
    typography: {
      ...defaultTokens.typography,
      h1: { font: `bold 64px ${fontFamily}`, lineHeight: 88 },
      h2: { font: `bold 40px ${fontFamily}`, lineHeight: 56 },
      body: { font: `28px ${fontFamily}`, lineHeight: 44 },
      caption: { font: `22px ${fontFamily}`, lineHeight: 34 },
      code: { font: '24px monospace', lineHeight: 36 },
    },
  }

  return {
    id: 'cover.hero',
    size: { width: 1080, height: 1440 },
    tokens: t,
    contentArea: { x: 72, y: 800, width: 936, height: 560 },
    root: {
      type: 'container',
      direction: 'column',
      width: 1080,
      height: 1440,
      background: { type: 'color', value: t.colors.bg },
      children: [
        { type: 'slot', name: 'cover-image' },
        {
          type: 'container',
          direction: 'column',
          width: 'fill',
          height: 'fill',
          padding: 72,
          gap: 16,
          background: { type: 'color', value: t.colors.bg },
          children: [
            { type: 'slot', name: 'title' },
            { type: 'slot', name: 'subtitle' },
          ],
        },
      ],
    },
  }
}

export const heroTemplate = makeHeroTemplate()
