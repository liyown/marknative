import { describe, expect, test } from 'bun:test'
import { renderMarkdown } from '../../src'
import { markdownGeneralizationCases } from '../fixtures/markdown-generalization'
import { mkdirSync, writeFileSync } from 'node:fs'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

describe('markdown generalization', () => {
  mkdirSync('tests/smoke/output', { recursive: true })

  for (const scenario of markdownGeneralizationCases) {
    test(`${scenario.name} → html preserves key text`, async () => {
      const pages = await renderMarkdown(scenario.markdown, scenario.family, {
        renderer: 'html',
      })

      expect(pages.length).toBeGreaterThanOrEqual(scenario.minPages)

      const html = pages.map(page => (page as { data: string }).data).join('\n')
      for (const snippet of scenario.expectedText) {
        expect(html).toContain(snippet)
      }

      writeFileSync(
        `tests/smoke/output/generalization-${slugify(scenario.name)}.html`,
        html,
      )
    })

    test(`${scenario.name} → canvas renders all pages`, async () => {
      const pages = await renderMarkdown(scenario.markdown, scenario.family, {
        renderer: 'canvas',
        format: 'png',
      })

      expect(pages.length).toBeGreaterThanOrEqual(scenario.minPages)
      for (const [index, page] of pages.entries()) {
        expect(page.format).toBe('png')
        expect((page as { data: Buffer }).data.byteLength).toBeGreaterThan(1000)
        writeFileSync(
          `tests/smoke/output/generalization-${slugify(scenario.name)}-${String(index + 1).padStart(2, '0')}.png`,
          (page as { data: Buffer }).data,
        )
      }
    })
  }
})
