/**
 * Generates PNG example images for the VitePress documentation.
 * Output: docs/public/examples/*.png
 *
 * Run: bun scripts/generate-docs-examples.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../marknative/src/index.ts'

const OUT = resolve(import.meta.dir, '..', 'public', 'examples')
await mkdir(OUT, { recursive: true })

async function save(name: string, data: Buffer): Promise<void> {
  const path = resolve(OUT, name)
  await writeFile(path, data)
  console.log('wrote', path)
}

async function first(md: string, opts: Parameters<typeof renderMarkdown>[1] = {}): Promise<Buffer> {
  const pages = await renderMarkdown(md, { format: 'png', ...opts })
  const page = pages[0]
  if (!page || page.format !== 'png') throw new Error('no page')
  return page.data
}

// ─── Getting Started ────────────────────────────────────────────────────────

await save(
  'getting-started.png',
  await first(`# Hello, marknative

A native Markdown rendering engine that produces **paginated PNG pages**
without a browser.

- CommonMark + GFM support
- Deterministic layout and pagination
- PNG and SVG output
`),
)

// ─── Options — paginated ─────────────────────────────────────────────────────

const optionsMd = `# Render Options

## format: 'png' (default)

Returns a \`Buffer\` for each page. Perfect for saving to disk,
uploading to object storage, or embedding in a response.

## format: 'svg'

Returns a UTF-8 SVG string. Useful when you need a vector
output that scales without pixelation.

## singlePage: true

Combines all content into one image instead of paginating
across multiple fixed-height pages.
`

await save('options-paginated.png', await first(optionsMd))

// ─── Single-page ─────────────────────────────────────────────────────────────

await save(
  'single-page.png',
  await first(
    `# Single-Page Mode

The entire document renders into **one image**.

## Section A

Regular paragraph text with **bold**, *italic*, and \`inline code\`.

## Section B

- Item one
- Item two
  - Nested item
- Item three

## Section C

\`\`\`typescript
const [page] = await renderMarkdown(markdown, {
  singlePage: true,
})
\`\`\`

---

*End of document. Height adapts to content.*
`,
    { singlePage: true },
  ),
)

// ─── Images ──────────────────────────────────────────────────────────────────

await save(
  'image-block.png',
  await first(`# Image Rendering

A block-level image fetched from a remote URL:

![Scenic landscape](https://picsum.photos/id/10/560/280 "A scenic landscape")

The image above is fetched via HTTP and drawn with aspect-ratio-preserving fit.
A placeholder is shown when the URL is unreachable.
`),
)

await save(
  'image-placeholder.png',
  await first(`# Image Placeholder Fallback

When a URL cannot be loaded, a placeholder is shown:

![Broken image](https://example.com/does-not-exist.png "Placeholder fallback")

The title or alt text is displayed inside the placeholder box.
`),
)

// ─── API — comprehensive ─────────────────────────────────────────────────────

await save(
  'api-overview.png',
  await first(`# marknative API

## renderMarkdown(markdown, options?)

| Option | Type | Default |
| :--- | :--- | :--- |
| format | 'png' \\| 'svg' | 'png' |
| singlePage | boolean | false |

## RenderPage

Each page in the returned array has:

- \`format\` — the output format
- \`data\` — Buffer (PNG) or string (SVG)
- \`page\` — internal paint-layer descriptor
`),
)

console.log('✓ all examples generated')
