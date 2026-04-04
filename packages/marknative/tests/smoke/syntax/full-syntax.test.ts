import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../../src'
import { FULL_SYNTAX_CODE_HIGHLIGHT_THEME, FULL_SYNTAX_MARKDOWN } from '../../../src/examples/full-syntax'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'syntax')

describe('smoke: full markdown syntax', () => {
  test('renders all standard markdown elements across multiple pages', async () => {
    await prepareSmokeOutputDir(outputDir)

    const pages = await renderMarkdown(FULL_SYNTAX_MARKDOWN, {
      format: 'png',
      codeHighlighting: { theme: FULL_SYNTAX_CODE_HIGHLIGHT_THEME },
    })

    expect(pages.length).toBeGreaterThanOrEqual(3)

    for (const page of pages) {
      expect(page.format).toBe('png')
      expect(page.page.fragments.length).toBeGreaterThan(0)
    }

    const highlightedCodeRuns = pages.flatMap((page) =>
      page.page.fragments.flatMap((fragment) =>
        fragment.kind === 'code'
          ? fragment.lines.flatMap((line) => line.runs.filter((run) => run.styleKind === 'codeToken' && run.color))
          : [],
      ),
    )

    expect(highlightedCodeRuns.length).toBeGreaterThan(0)

    await writeSmokePages(outputDir, 'full-syntax', pages)
  }, 30_000)
})
