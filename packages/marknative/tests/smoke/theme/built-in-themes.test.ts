import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { BUILT_IN_THEME_NAMES, getBuiltInTheme, isBuiltInThemeName, renderMarkdown } from '../../../src'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'built-in-themes')

// Covers every themed visual element: headings, prose, links, inline styles,
// unordered list, task list, ordered list, blockquote, code block, table,
// thematic break, image placeholder.
const FIXTURE = `# Built-in Theme Showcase

## Headings & Inline Styles

This paragraph contains **bold**, *italic*, ***bold-italic***, \`inline code\`,
~~strikethrough~~, and a [hyperlink](https://example.com).

---

## Lists

- Plain item
- Item with **bold** and \`code\`
  - Nested item
  - Another nested item

**Task list:**

- [x] Completed task
- [ ] Pending task
- [x] Another done item

**Ordered list:**

1. First step
2. Second step with \`code\`
3. Third step

---

## Blockquote

> This is a blockquote. It spans two lines to verify both the background
> fill and the left accent bar colors.

---

## Code Block

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

---

## Table

| Theme      | Style   | Background |
| :--------- | :-----: | :--------: |
| default    | Light   | White      |
| github     | Light   | White      |
| solarized  | Light   | Cream      |
| sepia      | Light   | Amber      |
| rose       | Light   | Blush      |
| dark       | Dark    | Navy       |
| nord       | Dark    | Arctic     |
| dracula    | Dark    | Near-black |
| ocean      | Dark    | Deep blue  |
| forest     | Dark    | Deep green |

---

## Image Placeholder

![Placeholder](https://example.com/does-not-exist.png "Theme placeholder")
`

describe('smoke: built-in themes', () => {
  // Render every built-in theme by passing its name string directly
  for (const name of BUILT_IN_THEME_NAMES) {
    test(`theme: "${name}"`, async () => {
      if (name === BUILT_IN_THEME_NAMES[0]) {
        // Prepare output dir once before the first test
        await prepareSmokeOutputDir(outputDir)
      }

      const pages = await renderMarkdown(FIXTURE, { theme: name })
      await writeSmokePages(outputDir, `theme-${name}`, pages)
    })
  }

  // Verify the name guard and lookup helpers
  test('isBuiltInThemeName — accepts all registered names', () => {
    for (const name of BUILT_IN_THEME_NAMES) {
      expect(isBuiltInThemeName(name)).toBe(true)
    }
  })

  test('isBuiltInThemeName — rejects unknown names', () => {
    expect(isBuiltInThemeName('does-not-exist')).toBe(false)
    expect(isBuiltInThemeName('')).toBe(false)
    expect(isBuiltInThemeName('Dark')).toBe(false) // case-sensitive
  })

  test('getBuiltInTheme — returns a fully populated Theme', () => {
    for (const name of BUILT_IN_THEME_NAMES) {
      const theme = getBuiltInTheme(name)
      expect(theme.page.width).toBeGreaterThan(0)
      expect(theme.page.height).toBeGreaterThan(0)
      expect(theme.colors.background).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.colors.text).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.colors.link).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  test('resolveTheme — unknown name throws a helpful error', async () => {
    await expect(
      renderMarkdown('# test', { theme: 'invalid-theme' as never }),
    ).rejects.toThrow('Unknown built-in theme "invalid-theme"')
  })

  test('10 built-in themes are registered', () => {
    expect(BUILT_IN_THEME_NAMES).toHaveLength(10)
  })
})
