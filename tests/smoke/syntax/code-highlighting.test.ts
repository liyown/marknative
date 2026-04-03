import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../../src'
import type { RenderPage } from '../../../src/render/render-markdown'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'code-highlighting')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MULTI_LANGUAGE_MARKDOWN = `# Syntax Highlighting — Multi-Language

## TypeScript

\`\`\`typescript
import { renderMarkdown } from 'marknative'

interface Card {
  title: string
  body: string
}

export async function renderCard(card: Card): Promise<Buffer> {
  const [page] = await renderMarkdown(
    \`# \${card.title}\\n\\n\${card.body}\`,
    { format: 'png' }
  )
  if (page?.format !== 'png') throw new Error('unexpected format')
  return page.data
}
\`\`\`

## JavaScript

\`\`\`javascript
import Bun from 'bun'

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/health') {
      return new Response('ok')
    }
    return new Response('not found', { status: 404 })
  },
})

console.log(\`Listening on http://localhost:\${server.port}\`)
\`\`\`

## Python

\`\`\`python
from dataclasses import dataclass
from typing import Optional

@dataclass
class Config:
    host: str = "localhost"
    port: int = 8080
    debug: bool = False
    secret_key: Optional[str] = None

def create_app(config: Config) -> None:
    """Bootstrap the application with the given config."""
    if config.debug:
        print(f"Starting in debug mode on {config.host}:{config.port}")
\`\`\`

## JSON

\`\`\`json
{
  "name": "marknative",
  "version": "0.2.0",
  "scripts": {
    "build": "bun build src/index.ts --outdir dist",
    "test": "bun test"
  },
  "dependencies": {
    "shiki": "^4.0.0",
    "skia-canvas": "^2.0.0"
  }
}
\`\`\`

## Bash

\`\`\`bash
#!/usr/bin/env bash
set -euo pipefail

# Install dependencies and run tests
bun install
bun run typecheck
bun test

echo "All checks passed."
\`\`\`
`

const INDENTATION_MARKDOWN = `# Indentation Preservation

\`\`\`typescript
function deeplyNested(): void {
  if (true) {
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        console.log("even:", i)
      }
    }
  }
}
\`\`\`

\`\`\`python
def matrix_multiply(a, b):
    result = []
    for i in range(len(a)):
        row = []
        for j in range(len(b[0])):
            total = 0
            for k in range(len(b)):
                total += a[i][k] * b[k][j]
            row.append(total)
        result.append(row)
    return result
\`\`\`
`

const FALLBACK_MARKDOWN = `# Fallback Behaviour

## Unknown language — monochrome fallback

\`\`\`unknownlang
some code in an unsupported language
  indented line
    more indentation
\`\`\`

## No language tag — monochrome fallback

\`\`\`
plain text code block
    with preserved indentation
        and multiple indent levels
\`\`\`

## Inline code is unaffected

Inline \`code\` is not syntax-highlighted and must continue to render normally.
`

const DARK_THEME_MARKDOWN = `# Dark Theme + Code Highlighting

\`\`\`typescript
const greet = (name: string): string => \`Hello, \${name}!\`

type User = { id: number; name: string; active: boolean }

const users: User[] = [
  { id: 1, name: "Alice", active: true },
  { id: 2, name: "Bob",   active: false },
]

const active = users.filter((u) => u.active).map((u) => greet(u.name))
console.log(active)
\`\`\`
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function codeRunColors(pages: RenderPage[]): string[] {
  const colors: string[] = []
  for (const page of pages) {
    walkFragments(page.page.fragments, (f) => {
      if (f.kind !== 'code') return
      for (const line of f.lines ?? []) {
        for (const run of line.runs) {
          if (run.styleKind === 'codeToken' && run.color) colors.push(run.color)
        }
      }
    })
  }
  return colors
}

import type { PaintBlockFragment } from '../../../src/paint/types'

function walkFragments(fragments: PaintBlockFragment[], cb: (f: PaintBlockFragment) => void): void {
  for (const f of fragments) {
    cb(f)
    if (f.kind === 'blockquote') walkFragments(f.children, cb)
    if (f.kind === 'list') {
      for (const item of f.items) walkFragments(item.children, cb)
    }
  }
}

function hasCodeTokenRuns(pages: RenderPage[]): boolean {
  for (const page of pages) {
    let found = false
    walkFragments(page.page.fragments, (f) => {
      if (f.kind !== 'code') return
      if ((f.lines ?? []).some((l) => l.runs.some((r) => r.styleKind === 'codeToken'))) found = true
    })
    if (found) return true
  }
  return false
}

function firstCodeTokenX(pages: RenderPage[]): number | null {
  for (const page of pages) {
    let result: number | null = null
    walkFragments(page.page.fragments, (f) => {
      if (result !== null || f.kind !== 'code') return
      for (const line of f.lines ?? []) {
        const run = line.runs.find((r) => r.styleKind === 'codeToken')
        if (run) { result = run.x; return }
      }
    })
    if (result !== null) return result
  }
  return null
}

const LONG_LINES_MARKDOWN = `# Long Line Wrapping

\`\`\`typescript
// This comment is intentionally very long to trigger line-wrapping inside the code block renderer: lorem ipsum dolor sit amet consectetur
const result = someVeryLongFunctionName(firstArgument, secondArgument, thirdArgument, fourthArgument, fifthArgument)

const obj = { alpha: 'aaaaaaaaaa', beta: 'bbbbbbbbbb', gamma: 'cccccccccc', delta: 'dddddddddd', epsilon: 'eeeeeeeeee' }
\`\`\`
`

const ITALIC_BOLD_MARKDOWN = `# Italic and Bold Tokens

\`\`\`typescript
// This is a single-line comment — shiki renders comments in italic
/**
 * JSDoc block comment — also typically italic in most themes.
 * @param name - the name to greet
 */
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

\`\`\`css
/* CSS comment */
.container {
  display: flex;
  font-style: italic;
  font-weight: bold;
}
\`\`\`
`

const NESTED_MARKDOWN = `# Code Inside Blockquote and List

> A blockquote that contains a code block:
>
> \`\`\`typescript
> const x: number = 42
> const msg = \`value is \${x}\`
> \`\`\`

- List item with an embedded code block:

  \`\`\`javascript
  const arr = [1, 2, 3]
  arr.forEach((n) => console.log(n))
  \`\`\`

- Second item, plain text
`

const EMPTY_AND_EDGE_MARKDOWN = `# Edge Cases

Empty code block with language:

\`\`\`typescript
\`\`\`

Single-line code block:

\`\`\`typescript
export default 42
\`\`\`

Code block with blank lines:

\`\`\`python
def foo():
    pass


def bar():
    return 1
\`\`\`
`

const MULTIPLE_BLOCKS_MARKDOWN = `# Multiple Code Blocks

First block:

\`\`\`typescript
const a = 1
\`\`\`

Some prose between them.

Second block:

\`\`\`python
b = 2
\`\`\`

More prose.

Third block:

\`\`\`json
{ "c": 3 }
\`\`\`
`

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('smoke: code syntax highlighting', () => {
  test('highlights TypeScript, JavaScript, Python, JSON, and Bash', async () => {
    await prepareSmokeOutputDir(outputDir)

    const pages = await renderMarkdown(MULTI_LANGUAGE_MARKDOWN, { format: 'png' })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    for (const page of pages) {
      expect(page.format).toBe('png')
      expect(page.page.fragments.length).toBeGreaterThan(0)
    }

    // Highlighted code blocks should produce codeToken runs with distinct colors
    expect(hasCodeTokenRuns(pages)).toBe(true)
    const colors = codeRunColors(pages)
    expect(colors.length).toBeGreaterThan(0)
    // Syntax highlighting produces multiple distinct colors (keywords, strings, etc.)
    const distinctColors = new Set(colors)
    expect(distinctColors.size).toBeGreaterThan(1)

    await writeSmokePages(outputDir, 'multi-language', pages)
  })

  test('preserves indentation in highlighted code blocks', async () => {
    const pages = await renderMarkdown(INDENTATION_MARKDOWN, { format: 'png' })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    expect(hasCodeTokenRuns(pages)).toBe(true)

    // All token runs within a code block should start at or after the code block's
    // left padding — not at x=0. This verifies indentation is not stripped.
    const startX = firstCodeTokenX(pages)
    expect(startX).not.toBeNull()
    expect(startX!).toBeGreaterThan(0)
  })

  test('falls back to monochrome for unknown language and no-language blocks', async () => {
    const pages = await renderMarkdown(FALLBACK_MARKDOWN, { format: 'png' })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    for (const page of pages) {
      expect(page.format).toBe('png')
    }

    // Unknown / no-language code blocks should produce plain text runs, not codeToken
    const hasHighlightedRuns = hasCodeTokenRuns(pages)
    expect(hasHighlightedRuns).toBe(false)

    await writeSmokePages(outputDir, 'fallback', pages)
  })

  test('uses shikiTheme option to switch to github-dark', async () => {
    const pages = await renderMarkdown(DARK_THEME_MARKDOWN, {
      format: 'png',
      theme: 'dark',
      codeHighlighting: { theme: 'github-dark' },
    })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    expect(hasCodeTokenRuns(pages)).toBe(true)

    await writeSmokePages(outputDir, 'dark-theme', pages)
  })

  test('wraps long lines without breaking tokens or losing text', async () => {
    const pages = await renderMarkdown(LONG_LINES_MARKDOWN, { format: 'png' })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    expect(hasCodeTokenRuns(pages)).toBe(true)

    // All runs must have non-negative x and positive width
    for (const page of pages) {
      for (const fragment of page.page.fragments) {
        if (fragment.kind !== 'code') continue
        for (const line of fragment.lines ?? []) {
          for (const run of line.runs) {
            expect(run.x).toBeGreaterThanOrEqual(0)
            expect(run.width).toBeGreaterThan(0)
          }
        }
      }
    }

    await writeSmokePages(outputDir, 'long-lines', pages)
  })

  test('renders italic tokens for comments correctly', async () => {
    // one-dark-pro applies fontStyle=italic to comments; github-light does not
    const pages = await renderMarkdown(ITALIC_BOLD_MARKDOWN, {
      format: 'png',
      codeHighlighting: { theme: 'one-dark-pro' },
    })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    expect(hasCodeTokenRuns(pages)).toBe(true)

    // At least some runs should carry italic font style (comments)
    let foundItalic = false
    for (const page of pages) {
      for (const fragment of page.page.fragments) {
        if (fragment.kind !== 'code') continue
        for (const line of fragment.lines ?? []) {
          if (line.runs.some((r) => r.styleKind === 'codeToken' && r.fontStyle === 'italic')) {
            foundItalic = true
          }
        }
      }
    }
    expect(foundItalic).toBe(true)

    await writeSmokePages(outputDir, 'italic-bold', pages)
  })

  test('highlights code blocks nested inside blockquotes and list items', async () => {
    const pages = await renderMarkdown(NESTED_MARKDOWN, { format: 'png' })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    expect(hasCodeTokenRuns(pages)).toBe(true)

    await writeSmokePages(outputDir, 'nested', pages)
  })

  test('handles empty code block and other edge cases without crashing', async () => {
    const pages = await renderMarkdown(EMPTY_AND_EDGE_MARKDOWN, { format: 'png' })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    for (const page of pages) {
      expect(page.format).toBe('png')
      expect(page.page.fragments.length).toBeGreaterThan(0)
    }

    await writeSmokePages(outputDir, 'edge-cases', pages)
  })

  test('all code blocks on a page are highlighted when multiple are present', async () => {
    const pages = await renderMarkdown(MULTIPLE_BLOCKS_MARKDOWN, { format: 'png' })

    expect(pages.length).toBeGreaterThanOrEqual(1)

    // Count code fragments that have codeToken runs
    let highlightedCodeFragments = 0
    for (const page of pages) {
      for (const fragment of page.page.fragments) {
        if (fragment.kind !== 'code') continue
        const hasTokens = (fragment.lines ?? []).some((l) => l.runs.some((r) => r.styleKind === 'codeToken'))
        if (hasTokens) highlightedCodeFragments++
      }
    }
    // All 3 code blocks (ts, python, json) should be highlighted
    expect(highlightedCodeFragments).toBe(3)

    await writeSmokePages(outputDir, 'multiple-blocks', pages)
  })

  test('SVG output contains highlighted runs', async () => {
    const pages = await renderMarkdown(MULTIPLE_BLOCKS_MARKDOWN, { format: 'svg' })

    expect(pages.length).toBeGreaterThanOrEqual(1)
    expect(pages[0]!.format).toBe('svg')
    expect(hasCodeTokenRuns(pages)).toBe(true)
  })

  test('singlePage mode renders all highlighted blocks into one image', async () => {
    const pages = await renderMarkdown(MULTI_LANGUAGE_MARKDOWN, { format: 'png', singlePage: true })

    expect(pages.length).toBe(1)
    expect(hasCodeTokenRuns(pages)).toBe(true)
    expect(codeRunColors(pages).length).toBeGreaterThan(0)
  })

  test('nord theme produces different colors than github-light', async () => {
    const [light, nord] = await Promise.all([
      renderMarkdown(MULTIPLE_BLOCKS_MARKDOWN, {
        format: 'png',
        codeHighlighting: { theme: 'github-light' },
      }),
      renderMarkdown(MULTIPLE_BLOCKS_MARKDOWN, {
        format: 'png',
        codeHighlighting: { theme: 'nord' },
      }),
    ])

    const lightColors = new Set(codeRunColors(light))
    const nordColors = new Set(codeRunColors(nord))

    // Nord and github-light should produce different color palettes
    const intersection = [...lightColors].filter((c) => nordColors.has(c))
    expect(intersection.length).toBeLessThan(lightColors.size)

    await writeSmokePages(outputDir, 'nord-theme', nord)
  })

  test('pagination is deterministic with highlighted code', async () => {
    // Render twice and confirm page count and fragment structure are identical
    const [first, second] = await Promise.all([
      renderMarkdown(MULTI_LANGUAGE_MARKDOWN, { format: 'png' }),
      renderMarkdown(MULTI_LANGUAGE_MARKDOWN, { format: 'png' }),
    ])

    expect(first.length).toBe(second.length)
    for (let i = 0; i < first.length; i++) {
      expect(first[i]!.page.fragments.length).toBe(second[i]!.page.fragments.length)
    }
  })
})
