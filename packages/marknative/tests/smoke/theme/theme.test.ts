import { describe, test } from 'bun:test'
import { resolve } from 'node:path'

import { defaultTheme, mergeTheme, renderMarkdown } from '../../../src'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'theme')

// Exercises every themed element in one pass:
// headings, prose, links, inline code, bold/italic/strikethrough,
// unordered list, task list, ordered list, blockquote, code block, table, thematic break
const THEME_FIXTURE = `# Theme System Smoke Test

## Headings & Inline Styles

This paragraph contains **bold**, *italic*, ***bold-italic***, \`inline code\`,
~~strikethrough~~, and a [hyperlink](https://example.com).

---

## Unordered List

- Plain item
- Item with **bold** and \`code\`
- Item with *italic* and a [link](https://example.com)
  - Nested item one
  - Nested item two

## Task List

- [x] Completed task
- [ ] Pending task
- [x] Another done item

## Ordered List

1. First step
2. Second step with \`code\`
3. Third step

---

## Blockquote

> This is a blockquote with **bold** text and \`inline code\` inside.
> It spans two lines to verify background and border colors.

---

## Code Block

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`
}

const message = greet('marknative')
console.log(message)
\`\`\`

---

## Table

| Feature        | Default | Custom |
| :------------- | :-----: | :----: |
| Colors         | ✓       | ✓      |
| Typography     | ✓       | ✓      |
| Page size      | fixed   | free   |
| Spacing        | ✓       | ✓      |

---

## Image Placeholder

![Placeholder — no URL](https://example.com/does-not-exist.png "Theme placeholder")
`

// ── Dark theme ────────────────────────────────────────────────────────────────
const darkTheme = mergeTheme(defaultTheme, {
  colors: {
    background: '#1e1e2e',
    text: '#cdd6f4',
    link: '#89b4fa',
    mutedText: '#a6adc8',
    border: '#45475a',
    subtleBorder: '#313244',
    codeBackground: '#313244',
    quoteBackground: '#181825',
    quoteBorder: '#cba6f7',
    imageBackground: '#181825',
    imageAccent: '#45475a',
    checkboxChecked: '#a6e3a1',
    checkboxCheckedMark: '#1e1e2e',
    checkboxUnchecked: '#585b70',
  },
})

// ── Warm sepia theme ─────────────────────────────────────────────────────────
const sepiaTheme = mergeTheme(defaultTheme, {
  colors: {
    background: '#f5f0e8',
    text: '#3d2b1f',
    link: '#8b4513',
    mutedText: '#8a7560',
    border: '#c8b89a',
    subtleBorder: '#d8ccbb',
    codeBackground: '#ede6d8',
    quoteBackground: '#ede6d8',
    quoteBorder: '#b8860b',
    imageBackground: '#e8e0d0',
    imageAccent: '#c8b89a',
    checkboxChecked: '#8b4513',
    checkboxCheckedMark: '#f5f0e8',
    checkboxUnchecked: '#b8a890',
  },
})

// ── Compact page (narrow card) ────────────────────────────────────────────────
const compactTheme = mergeTheme(defaultTheme, {
  page: {
    width: 720,
    height: 1080,
    margin: { top: 48, right: 48, bottom: 48, left: 48 },
  },
  typography: {
    h1: { font: 'bold 36px sans-serif', lineHeight: 50 },
    h2: { font: 'bold 26px sans-serif', lineHeight: 38 },
    body: { font: '20px sans-serif', lineHeight: 32 },
    code: { font: '17px monospace', lineHeight: 26 },
  },
  blocks: {
    paragraph: { marginBottom: 16 },
    heading: { marginTop: 28, marginBottom: 8 },
    list: { marginBottom: 16, itemGap: 4, indent: 24 },
    code: { marginBottom: 16, padding: 16 },
    quote: { marginBottom: 12, padding: 10 },
    table: { marginBottom: 16, cellPadding: 10 },
    image: { marginBottom: 16 },
  },
})

// ── Wide layout (landscape) ───────────────────────────────────────────────────
const wideTheme = mergeTheme(defaultTheme, {
  page: {
    width: 1440,
    height: 900,
    margin: { top: 64, right: 96, bottom: 64, left: 96 },
  },
})

// ── Custom accent colors ──────────────────────────────────────────────────────
const accentTheme = mergeTheme(defaultTheme, {
  colors: {
    link: '#7c3aed',
    quoteBorder: '#7c3aed',
    quoteBackground: '#f5f3ff',
    checkboxChecked: '#7c3aed',
    checkboxCheckedMark: '#ffffff',
  },
})

describe('smoke: theme system', () => {
  test('default theme — baseline', async () => {
    await prepareSmokeOutputDir(outputDir)
    const pages = await renderMarkdown(THEME_FIXTURE)
    await writeSmokePages(outputDir, 'theme-default', pages)
  }, 30_000)

  test('dark theme (Catppuccin Mocha palette)', async () => {
    const pages = await renderMarkdown(THEME_FIXTURE, { painter: undefined, theme: darkTheme })
    await writeSmokePages(outputDir, 'theme-dark', pages)
  }, 30_000)

  test('warm sepia theme', async () => {
    const pages = await renderMarkdown(THEME_FIXTURE, { theme: sepiaTheme })
    await writeSmokePages(outputDir, 'theme-sepia', pages)
  }, 30_000)

  test('compact page — narrow card with smaller typography', async () => {
    const pages = await renderMarkdown(THEME_FIXTURE, { theme: compactTheme })
    await writeSmokePages(outputDir, 'theme-compact', pages)
  }, 30_000)

  test('wide layout — landscape page', async () => {
    const pages = await renderMarkdown(THEME_FIXTURE, { theme: wideTheme })
    await writeSmokePages(outputDir, 'theme-wide', pages)
  }, 30_000)

  test('custom accent color — purple', async () => {
    const pages = await renderMarkdown(THEME_FIXTURE, { theme: accentTheme })
    await writeSmokePages(outputDir, 'theme-accent', pages)
  }, 30_000)

  test('single-page mode with dark theme', async () => {
    const pages = await renderMarkdown(THEME_FIXTURE, { singlePage: true, theme: darkTheme })
    await writeSmokePages(outputDir, 'theme-dark-singlepage', pages)
  }, 30_000)

  test('mergeTheme — partial override leaves base values intact', async () => {
    // Only override the background color; everything else should stay as defaultTheme
    const minimalTheme = mergeTheme(defaultTheme, { colors: { background: '#fef9ef' } })
    const pages = await renderMarkdown(THEME_FIXTURE, { theme: minimalTheme })
    await writeSmokePages(outputDir, 'theme-minimal-override', pages)
  }, 30_000)
})
