/**
 * Generates theme showcase PNG examples for the VitePress docs gallery.
 * Output: docs/public/examples/themes/*.png
 *
 * Run: bun scripts/generate-theme-examples.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { BUILT_IN_THEME_NAMES, mergeTheme, renderMarkdown, defaultTheme } from '../../marknative/src/index.ts'
import type { BuiltInThemeName } from '../../marknative/src/index.ts'

const OUT = resolve(import.meta.dir, '..', 'public', 'examples', 'themes')
await mkdir(OUT, { recursive: true })

async function save(name: string, data: Buffer): Promise<void> {
  await writeFile(resolve(OUT, `${name}.png`), data)
  console.log('wrote', name)
}

// Compact fixture that exercises every themed visual element on a single page.
const FIXTURE = `# Theme Showcase

## Headings & Inline Styles

A paragraph with **bold**, *italic*, \`inline code\`, ~~strikethrough~~,
and a [hyperlink](https://example.com) to demonstrate link color.

---

## Lists & Tasks

- First item with **bold** text
- Second item with \`inline code\`
  - Nested item one level deep

- [x] Completed task item
- [ ] Pending task item

## Blockquote

> This blockquote demonstrates the panel background and left accent bar.
> **Inline bold** and \`code\` inside a quote.

## Code Block

\`\`\`ts
const pages = await renderMarkdown(markdown, { theme: 'dark' })
for (const page of pages) {
  await writeFile('output.png', page.data)
}
\`\`\`

## Table

| Theme     | Style | Gradient |
| :-------- | :---: | :------: |
| default   | Light | —        |
| dark      | Dark  | —        |
| ocean     | Dark  | Radial   |
| rose      | Light | Linear   |
`

// ── All 10 built-in themes ────────────────────────────────────────────────────

for (const name of BUILT_IN_THEME_NAMES) {
  const pages = await renderMarkdown(FIXTURE, { theme: name as BuiltInThemeName, singlePage: true })
  const page = pages[0]
  if (page?.format === 'png') await save(`theme-${name}`, page.data)
}

// ── Custom colors example ─────────────────────────────────────────────────────

const customColorPages = await renderMarkdown(FIXTURE, {
  singlePage: true,
  theme: {
    colors: {
      background: '#1a1a2e',
      text: '#e0e0ff',
      link: '#a78bfa',
      mutedText: '#8888bb',
      border: '#2e2e5e',
      subtleBorder: '#252550',
      codeBackground: '#16163a',
      quoteBackground: '#12122e',
      quoteBorder: '#a78bfa',
      imageBackground: '#16163a',
      imageAccent: '#2e2e5e',
      checkboxChecked: '#a78bfa',
      checkboxCheckedMark: '#1a1a2e',
      checkboxUnchecked: '#2e2e5e',
    },
  },
})
const customPage = customColorPages[0]
if (customPage?.format === 'png') await save('theme-custom-colors', customPage.data)

// ── Gradient background example ───────────────────────────────────────────────

const gradientPages = await renderMarkdown(FIXTURE, {
  singlePage: true,
  theme: mergeTheme(defaultTheme, {
    colors: {
      background: '#0f0c29',
      backgroundGradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { offset: 0, color: '#24243e' },
          { offset: 0.5, color: '#302b63' },
          { offset: 1, color: '#0f0c29' },
        ],
      },
      text: '#e8e0ff',
      link: '#c084fc',
      mutedText: '#9980d0',
      border: '#3d3580',
      subtleBorder: '#2e2860',
      codeBackground: '#1a1545',
      quoteBackground: '#150f38',
      quoteBorder: '#c084fc',
      imageBackground: '#1a1545',
      imageAccent: '#3d3580',
      checkboxChecked: '#c084fc',
      checkboxCheckedMark: '#0f0c29',
      checkboxUnchecked: '#3d3580',
    },
  }),
})
const gradPage = gradientPages[0]
if (gradPage?.format === 'png') await save('theme-gradient', gradPage.data)

console.log('✓ all theme examples generated')
