import { describe, test } from 'bun:test'
import { resolve } from 'node:path'

import { defaultTheme, mergeTheme, renderMarkdown } from '../../../src'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'gradient-backgrounds')

const FIXTURE = `# Gradient Background Test

## Inline Styles

A paragraph with **bold**, *italic*, \`inline code\`, ~~strikethrough~~,
and a [hyperlink](https://example.com).

---

## Lists & Tasks

- First item
- Second item with \`code\`

- [x] Done task
- [ ] Pending task

---

## Blockquote

> Gradient backgrounds add visual depth without distracting from content.

---

## Code Block

\`\`\`ts
const theme = mergeTheme(defaultTheme, {
  colors: {
    backgroundGradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 0, color: '#667eea' },
        { offset: 1, color: '#764ba2' },
      ],
    },
  },
})
\`\`\`

---

## Table

| Gradient | Type   | Direction |
| :------- | :----: | :-------: |
| Purple   | Linear | diagonal  |
| Ocean    | Radial | centre    |
| Sunset   | Linear | vertical  |
| Mint     | Linear | vertical  |
`

describe('smoke: gradient backgrounds', () => {
  test('setup output dir', async () => {
    await prepareSmokeOutputDir(outputDir)
  })

  // ── Built-in themes that include gradients ──────────────────────────────────

  test('built-in: ocean (radial gradient)', async () => {
    const pages = await renderMarkdown(FIXTURE, { theme: 'ocean' })
    await writeSmokePages(outputDir, 'gradient-ocean', pages)
  })

  test('built-in: forest (linear gradient)', async () => {
    const pages = await renderMarkdown(FIXTURE, { theme: 'forest' })
    await writeSmokePages(outputDir, 'gradient-forest', pages)
  })

  test('built-in: dracula (linear gradient)', async () => {
    const pages = await renderMarkdown(FIXTURE, { theme: 'dracula' })
    await writeSmokePages(outputDir, 'gradient-dracula', pages)
  })

  test('built-in: rose (linear gradient)', async () => {
    const pages = await renderMarkdown(FIXTURE, { theme: 'rose' })
    await writeSmokePages(outputDir, 'gradient-rose', pages)
  })

  // ── Custom gradient overrides ───────────────────────────────────────────────

  test('custom: purple diagonal linear gradient', async () => {
    const pages = await renderMarkdown(FIXTURE, {
      theme: {
        colors: {
          background: '#667eea',
          backgroundGradient: {
            type: 'linear',
            angle: 135,
            stops: [
              { offset: 0, color: '#667eea' },
              { offset: 1, color: '#764ba2' },
            ],
          },
          text: '#ffffff',
          link: '#c4e0ff',
          mutedText: '#d0c4e8',
          border: '#8b6fc8',
          subtleBorder: '#7a5ab8',
          codeBackground: '#5a4a8a',
          quoteBackground: '#4a3878',
          quoteBorder: '#c4b0f0',
          imageBackground: '#5a4a8a',
          imageAccent: '#8b6fc8',
          checkboxChecked: '#c4e0ff',
          checkboxCheckedMark: '#667eea',
          checkboxUnchecked: '#8b6fc8',
        },
      },
    })
    await writeSmokePages(outputDir, 'gradient-purple-diagonal', pages)
  })

  test('custom: sunset vertical linear gradient', async () => {
    const pages = await renderMarkdown(FIXTURE, {
      theme: {
        colors: {
          background: '#ff6b6b',
          backgroundGradient: {
            type: 'linear',
            angle: 0,
            stops: [
              { offset: 0, color: '#ff9a9e' },
              { offset: 0.5, color: '#ff6b6b' },
              { offset: 1, color: '#c0392b' },
            ],
          },
          text: '#fff5f5',
          link: '#ffeaa7',
          mutedText: '#ffb3b3',
          border: '#e05555',
          subtleBorder: '#cc4444',
          codeBackground: '#b03030',
          quoteBackground: '#a02828',
          quoteBorder: '#ffeaa7',
          imageBackground: '#b03030',
          imageAccent: '#e05555',
          checkboxChecked: '#ffeaa7',
          checkboxCheckedMark: '#c0392b',
          checkboxUnchecked: '#e05555',
        },
      },
    })
    await writeSmokePages(outputDir, 'gradient-sunset', pages)
  })

  test('custom: mint radial gradient', async () => {
    const pages = await renderMarkdown(FIXTURE, {
      theme: {
        colors: {
          background: '#e8f5e9',
          backgroundGradient: {
            type: 'radial',
            stops: [
              { offset: 0, color: '#ffffff' },
              { offset: 1, color: '#c8e6c9' },
            ],
          },
          text: '#1b5e20',
          link: '#2e7d32',
          mutedText: '#558b2f',
          border: '#a5d6a7',
          subtleBorder: '#c8e6c9',
          codeBackground: '#dcedc8',
          quoteBackground: '#dcedc8',
          quoteBorder: '#43a047',
          imageBackground: '#dcedc8',
          imageAccent: '#a5d6a7',
          checkboxChecked: '#2e7d32',
          checkboxCheckedMark: '#ffffff',
          checkboxUnchecked: '#a5d6a7',
        },
      },
    })
    await writeSmokePages(outputDir, 'gradient-mint-radial', pages)
  })

  test('custom: aurora borealis — multi-stop linear', async () => {
    const pages = await renderMarkdown(FIXTURE, {
      theme: mergeTheme(defaultTheme, {
        colors: {
          background: '#0a1628',
          backgroundGradient: {
            type: 'linear',
            angle: 0,
            stops: [
              { offset: 0,   color: '#0a1628' },
              { offset: 0.4, color: '#0d2e3a' },
              { offset: 0.7, color: '#0f3b2e' },
              { offset: 1,   color: '#0a1628' },
            ],
          },
          text: '#e0f0ea',
          link: '#4dd0e1',
          mutedText: '#80cbc4',
          border: '#1a3a48',
          subtleBorder: '#142e3a',
          codeBackground: '#0d2430',
          quoteBackground: '#0a1e28',
          quoteBorder: '#26c6da',
          imageBackground: '#0d2430',
          imageAccent: '#1a3a48',
          checkboxChecked: '#80cbc4',
          checkboxCheckedMark: '#0a1628',
          checkboxUnchecked: '#1a3a48',
        },
      }),
    })
    await writeSmokePages(outputDir, 'gradient-aurora', pages)
  })

  test('custom: single-page with radial gradient', async () => {
    const pages = await renderMarkdown(FIXTURE, {
      singlePage: true,
      theme: 'ocean',
    })
    await writeSmokePages(outputDir, 'gradient-ocean-singlepage', pages)
  })
})
