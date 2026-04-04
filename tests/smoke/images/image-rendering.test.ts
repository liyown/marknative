import { describe, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../../src'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'images')

const IMAGE_MARKDOWN = `# Image Rendering

## Block Image — Landscape (640×480)

![Landscape photo](https://picsum.photos/id/10/640/480 "A scenic landscape")

## Block Image — Portrait (300×500)

![Portrait photo](https://picsum.photos/id/20/300/500 "A tall portrait image")

## Block Image — Square (400×400)

![Square photo](https://picsum.photos/id/30/400/400 "A square image")

## Broken URL — Should Show Placeholder

![Broken image](https://example.com/does-not-exist.png "Placeholder fallback")

## Image Followed by Prose

![Another photo](https://picsum.photos/id/40/640/320 "Image before text")

This paragraph follows immediately after the block image above.
`

describe('smoke: image rendering', () => {
  test('renders block images — HTTP, placeholder fallback', async () => {
    await prepareSmokeOutputDir(outputDir)
    const pages = await renderMarkdown(IMAGE_MARKDOWN, { format: 'png' })
    await writeSmokePages(outputDir, 'image-rendering', pages)
  }, 30_000)
})
