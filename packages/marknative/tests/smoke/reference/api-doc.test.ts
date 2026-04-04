import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../../src'
import { expectExactSmokeOutputs, pageFragmentKinds, prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'reference')

describe('smoke: api doc', () => {
  test('renders a reference-style api document to png pages', async () => {
    await prepareSmokeOutputDir(outputDir)

    const pages = await renderMarkdown(
      `# Render API

## Overview

The API accepts markdown input and returns a paginated set of rendered pages.
It is designed for callers that need deterministic output and stable layout behavior.

### renderMarkdown

Signature:

\`\`\`ts
renderMarkdown(markdown: string, options?: { format?: 'png' | 'svg' })
\`\`\`

Returns:

- A list of pages.
- Each page contains encoded output and layout metadata.
- The format defaults to PNG when omitted.

### Options

1. \`format\`
   - Selects the output backend.
   - Use \`png\` for raster smoke coverage.
   - Use \`svg\` when you want text-friendly output.
2. \`painter\`
   - Overrides the backend painter.
   - Useful for integration tests and custom export paths.

### Behavior

Pagination is page-oriented, not paragraph-oriented. That means a dense document should still preserve section hierarchy:

1. Headings introduce a new topic.
2. Bullet lists can describe implementation notes.
   - Sub-bullets clarify edge cases.
   - Nested items remain part of the same contract.
3. Ordered steps explain the invocation flow.

The intent is simple: given the same markdown, callers should get the same layout shape every time.
`,
      { format: 'png' },
    )

    expect(pages).toHaveLength(2)
    expect(pageFragmentKinds(pages[0]!)).toEqual([
      'heading',
      'heading',
      'paragraph',
      'heading',
      'paragraph',
      'code',
      'paragraph',
      'list',
      'heading',
      'list',
      'heading', // ### Behavior — heading marginTop now pushes it to the end of page 1
    ])
    expect(pageFragmentKinds(pages[1]!)).toEqual(['paragraph', 'list', 'paragraph'])

    await writeSmokePages(outputDir, 'api-doc', pages)
    await expectExactSmokeOutputs(outputDir, ['api-doc-01.png', 'api-doc-02.png'])
  })
})
