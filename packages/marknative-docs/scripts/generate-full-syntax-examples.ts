/**
 * Generates the full multi-page syntax fixture PNG examples for the docs.
 * Output: docs/public/examples/full-syntax/*.png
 *
 * Run: bun scripts/generate-full-syntax-examples.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../marknative/src/index.ts'
import { FULL_SYNTAX_CODE_HIGHLIGHT_THEME, FULL_SYNTAX_MARKDOWN } from '../../marknative/src/examples/full-syntax'

const OUT = resolve(import.meta.dir, '..', 'public', 'examples', 'full-syntax')
await mkdir(OUT, { recursive: true })

const pages = await renderMarkdown(FULL_SYNTAX_MARKDOWN, {
  format: 'png',
  codeHighlighting: { theme: FULL_SYNTAX_CODE_HIGHLIGHT_THEME },
})

for (const [index, page] of pages.entries()) {
  if (page.format !== 'png') {
    throw new Error('Expected png full-syntax output')
  }

  const fileName = `full-syntax-${String(index + 1).padStart(2, '0')}.png`
  await writeFile(resolve(OUT, fileName), page.data)
  console.log('wrote', fileName)
}

console.log('✓ all full syntax examples generated')
