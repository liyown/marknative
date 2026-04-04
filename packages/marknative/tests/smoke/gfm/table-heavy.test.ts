import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../../src'
import { expectExactSmokeOutputs, pageFragmentKinds, prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'gfm')

describe('smoke: gfm table heavy', () => {
  test('renders a gfm-heavy document with tables and task lists to png pages', async () => {
    await prepareSmokeOutputDir(outputDir)

    const pages = await renderMarkdown(
      `# GFM Coverage

| Feature | Status | Notes |
| --- | --- | --- |
| Tables | Ready | Multi-column layout stays readable |
| Task lists | Ready | Supports checked and unchecked items |
| Strikethrough | Ready | Useful for deprecated states |

- [x] Capture table rendering
- [ ] Verify task list markers
- [x] Keep ~~legacy~~ content visible as deleted text

Autolink-like content should remain parseable: <https://example.com/docs/rendering> and <support@example.com>.

| Case | Result |
| --- | --- |
| Alpha | Pass |
| Beta | Pass |
`,
      { format: 'png' },
    )

    expect(pages).toHaveLength(1)
    expect(pageFragmentKinds(pages[0]!)).toEqual(['heading', 'table', 'list', 'paragraph', 'table'])

    await writeSmokePages(outputDir, 'table-heavy', pages)
    await expectExactSmokeOutputs(outputDir, ['table-heavy-01.png'])
  })
})
