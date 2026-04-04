import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../../src'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'single-page')

const MARKDOWN = `# Single-Page Rendering

This document tests the \`singlePage: true\` option, which renders all content
into one image regardless of length.

## Section 1 — Prose

Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

**Bold text** and *italic text* and \`inline code\` all in one paragraph.

## Section 2 — List

- First item
- Second item with **bold**
  - Nested item
  - Another nested
- Third item

## Section 3 — Code

\`\`\`typescript
import { renderMarkdown } from 'marknative'

const [page] = await renderMarkdown(markdown, { singlePage: true })
\`\`\`

## Section 4 — Blockquote

> This is a blockquote that spans multiple lines.
> It should be rendered without a page break splitting it.

## Section 5 — Image

![Landscape](https://picsum.photos/id/10/640/320 "A landscape photo")

## Section 6 — Table

| Name | Value |
| :--- | ---: |
| alpha | 1 |
| beta | 2 |
| gamma | 3 |

---

*End of document.*
`

describe('smoke: single-page rendering', () => {
  test('normal pagination still works unchanged', async () => {
    const pages = await renderMarkdown(MARKDOWN, { format: 'png' })
    expect(pages.length).toBeGreaterThan(1)
  }, 30_000)
})
