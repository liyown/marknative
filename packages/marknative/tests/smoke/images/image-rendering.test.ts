import { describe, test, beforeAll } from 'bun:test'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { Canvas } from 'skia-canvas'

import { renderMarkdown } from '../../../src'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'images')
const fixturesDir = resolve(import.meta.dir, 'fixtures')

const LANDSCAPE_PNG = resolve(fixturesDir, 'landscape.png')
const PORTRAIT_PNG  = resolve(fixturesDir, 'portrait.png')

// Generate small local test images once before the suite runs.
beforeAll(async () => {
  const landscape = new Canvas(320, 160)
  const lctx = landscape.getContext('2d')
  lctx.fillStyle = '#4a90d9'
  lctx.fillRect(0, 0, 320, 160)
  lctx.fillStyle = '#ffffff'
  lctx.font = 'bold 20px sans-serif'
  lctx.fillText('landscape 320×160', 20, 90)
  await writeFile(LANDSCAPE_PNG, await landscape.toBuffer('png'))

  const portrait = new Canvas(160, 240)
  const pctx = portrait.getContext('2d')
  pctx.fillStyle = '#e06c75'
  pctx.fillRect(0, 0, 160, 240)
  pctx.fillStyle = '#ffffff'
  pctx.font = 'bold 16px sans-serif'
  pctx.fillText('portrait', 20, 125)
  await writeFile(PORTRAIT_PNG, await portrait.toBuffer('png'))
}, 30_000)

describe('smoke: image rendering', () => {
  test('renders block images — local files, placeholder fallback', async () => {
    await prepareSmokeOutputDir(outputDir)

    const markdown = `# Image Rendering

## Landscape Image

![Landscape](${LANDSCAPE_PNG} "A blue landscape fixture")

## Portrait Image

![Portrait](${PORTRAIT_PNG} "A red portrait fixture")

## Broken URL — Placeholder Fallback

![Broken](https://example.invalid/does-not-exist.png "Placeholder fallback")

This paragraph follows the images above.
`
    const pages = await renderMarkdown(markdown, { format: 'png' })
    await writeSmokePages(outputDir, 'image-rendering', pages)
  }, 30_000)
})
