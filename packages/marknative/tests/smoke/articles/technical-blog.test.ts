import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../../src'
import { expectExactSmokeOutputs, pageFragmentKinds, prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'articles')

describe('smoke: technical blog', () => {
  test('renders a multi-section technical article to png pages', async () => {
    await prepareSmokeOutputDir(outputDir)

    const pages = await renderMarkdown(
      `# Shipping a Markdown Renderer

We rebuilt the rendering pipeline around a document model so layout can be tested independently from output encoding.

## Parsing

The parser keeps the source tree small and predictable, which makes downstream layout easier to reason about.

1. Accept CommonMark input.
2. Normalize block structure.
3. Preserve inline intent for later rendering.

> The point of the smoke test is not to prove correctness in detail.
> It is to catch obvious regressions in paragraph flow and page breaking.

\`\`\`ts
export function renderMarkdown(markdown: string) {
  return markdown.trim()
}
\`\`\`

## Pagination

Page boundaries should stay stable when content grows, even if the article contains dense prose and code.

## Release Notes

This article doubles as a regression fixture for long-form technical writing.
`,
      { format: 'png' },
    )

    expect(pages).toHaveLength(1)
    expect(pageFragmentKinds(pages[0]!)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'paragraph',
      'list',
      'blockquote',
      'code',
      'heading',
      'paragraph',
      'heading',
      'paragraph',
    ])

    await writeSmokePages(outputDir, 'technical-blog', pages)
    await expectExactSmokeOutputs(outputDir, ['technical-blog-01.png'])
  }, 30_000)
})
