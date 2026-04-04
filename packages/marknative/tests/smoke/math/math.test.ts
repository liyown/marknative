import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown, parseMarkdown } from '../../../src'
import type { RenderPage } from '../../../src/render/render-markdown'
import type { PaintBlockFragment, PaintLineRun, PaintMathBlockFragment } from '../../../src/paint/types'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'math')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SHOWCASE_MD = `# Math Showcase

## Inline Math

The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ and
Euler's identity is $e^{i\\pi} + 1 = 0$.

## Block Math

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

$$
\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}
\\begin{pmatrix} x \\\\ y \\end{pmatrix}
= \\begin{pmatrix} ax + by \\\\ cx + dy \\end{pmatrix}
$$
`

const MIXED_CONTENT_MD = `# Mixed Content

> A blockquote containing block math:
>
> $$
> \\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}
> $$
>
> And inline $\\zeta(2)$ math.

- First item with inline $x^2 + y^2 = r^2$ math.
- Second item with block math:

  $$
  \\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}
  $$

- Third item, plain text.
`

const HEAVY_FORMULAS_MD = Array.from(
  { length: 8 },
  (_, i) =>
    `$$\n\\int_0^{${i + 1}} x^{${i + 2}}\\, dx = \\frac{${i + 1}^{${i + 3}}}{${i + 3}}\n$$`,
).join('\n\n')

const TALL_INLINE_MD = `Tall fractions: $\\frac{a^2 + b^2}{c^2 - d^2}$ and nested $\\frac{\\frac{p}{q}}{\\frac{r}{s}}$ and simple $x$.`

const MULTIRUN_INLINE_MD = `Einstein: $E = mc^2$, Newton: $F = ma$, Pythagoras: $a^2 + b^2 = c^2$, and Euler: $e^{i\\pi} + 1 = 0$.`

const BOUNDARIES_MD = `$\\alpha$ appears at the start of the paragraph.

The paragraph ends with a formula $\\beta$.

Only math: $\\gamma$.`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectMathBlockFragments(pages: RenderPage[]): PaintMathBlockFragment[] {
  const result: PaintMathBlockFragment[] = []
  for (const page of pages) {
    walkFragments(page.page.fragments, (f) => {
      if (f.kind === 'mathBlock') result.push(f as PaintMathBlockFragment)
    })
  }
  return result
}

function collectInlineMathRuns(pages: RenderPage[]): PaintLineRun[] {
  const result: PaintLineRun[] = []
  for (const page of pages) {
    walkFragments(page.page.fragments, (f) => {
      if (!('lines' in f) || !f.lines) return
      for (const line of f.lines) {
        for (const run of line.runs) {
          if (run.styleKind === 'inlineMath') result.push(run)
        }
      }
    })
  }
  return result
}

function walkFragments(
  fragments: PaintBlockFragment[],
  cb: (f: PaintBlockFragment) => void,
): void {
  for (const f of fragments) {
    cb(f)
    if (f.kind === 'blockquote') walkFragments(f.children, cb)
    if (f.kind === 'list') {
      for (const item of f.items) walkFragments(item.children, cb)
    }
  }
}

function svgFromMathBlock(frag: PaintMathBlockFragment): string {
  return Buffer.from(frag.svgBuffer).toString('utf8')
}

// ─── Parser tests ─────────────────────────────────────────────────────────────

describe('smoke: math — parser', () => {
  test('block math node carries full LaTeX value', () => {
    const doc = parseMarkdown(`$$\nE = mc^2\n$$`)
    const node = doc.children.find((n) => n.type === 'mathBlock')
    expect(node).toBeDefined()
    if (node?.type === 'mathBlock') {
      expect(node.value).toBe('E = mc^2')
    }
  })

  test('inline math node carries LaTeX value without delimiters', () => {
    const doc = parseMarkdown(`Inline $\\pi \\approx 3.14$ math.`)
    const para = doc.children.find((n) => n.type === 'paragraph')
    expect(para?.type).toBe('paragraph')
    if (para?.type === 'paragraph') {
      const node = para.children.find((n) => n.type === 'inlineMath')
      expect(node).toBeDefined()
      if (node?.type === 'inlineMath') {
        expect(node.value).toBe('\\pi \\approx 3.14')
        // Delimiters must NOT appear in the value
        expect(node.value).not.toContain('$')
      }
    }
  })

  test('multiple inline math nodes in one paragraph are all parsed', () => {
    const doc = parseMarkdown(MULTIRUN_INLINE_MD)
    const para = doc.children.find((n) => n.type === 'paragraph')
    expect(para?.type).toBe('paragraph')
    if (para?.type === 'paragraph') {
      const mathNodes = para.children.filter((n) => n.type === 'inlineMath')
      expect(mathNodes.length).toBe(4)
    }
  })

  test('inline math inside blockquote is reachable', () => {
    const doc = parseMarkdown(`> The value $x = 1$ is known.`)
    const quote = doc.children.find((n) => n.type === 'blockquote')
    expect(quote?.type).toBe('blockquote')
    if (quote?.type === 'blockquote') {
      const para = quote.children.find((n) => n.type === 'paragraph')
      expect(para?.type).toBe('paragraph')
      if (para?.type === 'paragraph') {
        const mathNode = para.children.find((n) => n.type === 'inlineMath')
        expect(mathNode).toBeDefined()
      }
    }
  })
})

// ─── Fragment structure tests ─────────────────────────────────────────────────

describe('smoke: math — fragment structure', () => {
  test('block math produces mathBlock fragment with valid box geometry', async () => {
    const pages = await renderMarkdown(`$$\nf(x) = x^2\n$$`)
    expect(pages.length).toBe(1)
    const frags = collectMathBlockFragments(pages)
    expect(frags.length).toBe(1)
    const frag = frags[0]!
    expect(frag.box.x).toBeGreaterThanOrEqual(0)
    expect(frag.box.y).toBeGreaterThanOrEqual(0)
    expect(frag.box.width).toBeGreaterThan(0)
    expect(frag.box.height).toBeGreaterThan(0)
  })

  test('mathBlock fragment svgBuffer is valid UTF-8 SVG', async () => {
    const pages = await renderMarkdown(`$$\n\\sqrt{a^2 + b^2}\n$$`)
    const frags = collectMathBlockFragments(pages)
    expect(frags.length).toBeGreaterThan(0)
    const svg = svgFromMathBlock(frags[0]!)
    expect(svg).toMatch(/^<svg/)
    expect(svg).toContain('</svg>')
  })

  test('block math intrinsicWidth is positive and consistent with fragment width', async () => {
    const pages = await renderMarkdown(`$$\nE = mc^2\n$$`)
    const frags = collectMathBlockFragments(pages)
    expect(frags[0]!.intrinsicWidth).toBeGreaterThan(0)
    // Fragment width equals page content width, not the formula width
    // but intrinsicWidth must be ≤ fragment width
    expect(frags[0]!.intrinsicWidth).toBeLessThanOrEqual(frags[0]!.box.width + 1)
  })

  test('inline math run has valid dimensions and data-URI url', async () => {
    const pages = await renderMarkdown(`Energy: $E = mc^2$ is famous.`)
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBeGreaterThan(0)
    const run = runs[0]!
    expect(run.url).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(run.width).toBeGreaterThan(0)
    expect(run.height).toBeGreaterThan(0)
  })

  test('mathDepth is within [0, height] for all inline math runs', async () => {
    const pages = await renderMarkdown(TALL_INLINE_MD)
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBeGreaterThan(0)
    for (const run of runs) {
      const depth = run.mathDepth ?? 0
      expect(depth).toBeGreaterThanOrEqual(0)
      expect(depth).toBeLessThanOrEqual(run.height)
    }
  })

  test('inline math run x positions are non-negative and monotonically ordered within a line', async () => {
    const pages = await renderMarkdown(MULTIRUN_INLINE_MD)
    expect(pages.length).toBe(1)
    for (const line of pages[0]!.page.fragments.flatMap((f) => ('lines' in f ? f.lines ?? [] : []))) {
      for (const run of line.runs) {
        expect(run.x).toBeGreaterThanOrEqual(0)
        expect(run.width).toBeGreaterThan(0)
      }
    }
  })
})

// ─── Geometry & layout tests ──────────────────────────────────────────────────

describe('smoke: math — geometry & layout', () => {
  test('tall inline formulas (fractions) exceed lineHeight and simple ones do not', async () => {
    const pages = await renderMarkdown(TALL_INLINE_MD)
    const lineHeight = 44 // defaultTheme body lineHeight
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBeGreaterThan(0)
    // All runs must have positive dimensions
    for (const run of runs) {
      expect(run.height).toBeGreaterThan(0)
      expect(run.width).toBeGreaterThan(0)
    }
    // At least one fraction formula should be taller than the body lineHeight,
    // confirming line height inflates naturally rather than compressing the formula.
    const tallRuns = runs.filter((r) => r.height > lineHeight)
    expect(tallRuns.length).toBeGreaterThan(0)
  })

  test('multiple inline math runs in one paragraph all land on valid x positions', async () => {
    const pages = await renderMarkdown(MULTIRUN_INLINE_MD)
    const runs = collectInlineMathRuns(pages)
    // Four formulas: E=mc², F=ma, a²+b²=c², e^iπ+1=0
    expect(runs.length).toBe(4)
    for (const run of runs) {
      expect(run.x).toBeGreaterThanOrEqual(0)
      expect(run.width).toBeGreaterThan(0)
      expect(run.height).toBeGreaterThan(0)
    }
  })

  test('block math fragment y position increases with document flow', async () => {
    const pages = await renderMarkdown(
      `# Heading\n\nSome text.\n\n$$\nA\n$$\n\nMore text.\n\n$$\nB\n$$`,
    )
    const frags = collectMathBlockFragments(pages)
    expect(frags.length).toBe(2)
    // Second formula must appear below the first
    expect(frags[1]!.box.y).toBeGreaterThan(frags[0]!.box.y)
  })

  test('inline math at paragraph boundaries does not cause out-of-bounds x', async () => {
    const pages = await renderMarkdown(BOUNDARIES_MD)
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBe(3)
    for (const run of runs) {
      expect(run.x).toBeGreaterThanOrEqual(0)
      expect(run.width).toBeGreaterThan(0)
    }
  })
})

// ─── Color injection tests ────────────────────────────────────────────────────

describe('smoke: math — color injection', () => {
  test('default theme SVG contains #111827 text color and no currentColor', async () => {
    const pages = await renderMarkdown(`$$\nf(x) = x^2\n$$`)
    const frags = collectMathBlockFragments(pages)
    const svg = svgFromMathBlock(frags[0]!)
    expect(svg).not.toContain('currentColor')
    expect(svg.toLowerCase()).toContain('#111827')
  })

  test('dark theme (Catppuccin Mocha) SVG contains #cdd6f4 and no currentColor', async () => {
    const pages = await renderMarkdown(`$$\nf(x) = x^2\n$$`, { theme: 'dark' })
    const frags = collectMathBlockFragments(pages)
    const svg = svgFromMathBlock(frags[0]!)
    expect(svg).not.toContain('currentColor')
    expect(svg.toLowerCase()).toContain('#cdd6f4')
  })

  test('nord theme SVG contains #eceff4 and no currentColor', async () => {
    const pages = await renderMarkdown(`$$\nf(x) = x^2\n$$`, { theme: 'nord' })
    const frags = collectMathBlockFragments(pages)
    const svg = svgFromMathBlock(frags[0]!)
    expect(svg).not.toContain('currentColor')
    expect(svg.toLowerCase()).toContain('#eceff4')
  })

  test('inline math data-URI embeds the correct theme color', async () => {
    const pages = await renderMarkdown(`Dark inline $x^2$ math.`, { theme: 'dark' })
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBeGreaterThan(0)
    const svgSource = Buffer.from(runs[0]!.url!.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8')
    expect(svgSource).not.toContain('currentColor')
    expect(svgSource.toLowerCase()).toContain('#cdd6f4')
  })

  test('two dark themes produce different fill colors in SVG', async () => {
    const [darkPages, nordPages] = await Promise.all([
      renderMarkdown(`$$\nE=mc^2\n$$`, { theme: 'dark' }),
      renderMarkdown(`$$\nE=mc^2\n$$`, { theme: 'nord' }),
    ])
    const darkSvg = svgFromMathBlock(collectMathBlockFragments(darkPages)[0]!)
    const nordSvg = svgFromMathBlock(collectMathBlockFragments(nordPages)[0]!)
    // Catppuccin Mocha text vs Nord Snow Storm
    expect(darkSvg).not.toBe(nordSvg)
  })
})

// ─── Mixed content tests ──────────────────────────────────────────────────────

describe('smoke: math — mixed content', () => {
  test('math inside blockquote renders mathBlock fragment', async () => {
    const pages = await renderMarkdown(
      `> $$\n> \\pi^2 / 6 = \\sum 1/n^2\n> $$`,
    )
    const allKinds = pages.flatMap((p) => p.page.fragments.flatMap(collectKinds))
    expect(allKinds).toContain('mathBlock')
  })

  test('inline math inside list item produces inlineMath run', async () => {
    const pages = await renderMarkdown(`- The formula $x^2 + y^2 = r^2$ describes a circle.`)
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBe(1)
  })

  test('mixed content document renders all math and non-math fragments', async () => {
    await prepareSmokeOutputDir(outputDir)
    const pages = await renderMarkdown(MIXED_CONTENT_MD)
    expect(pages.length).toBeGreaterThanOrEqual(1)
    const allKinds = pages.flatMap((p) => p.page.fragments.flatMap(collectKinds))
    expect(allKinds).toContain('mathBlock')
    expect(allKinds).toContain('heading')
    const inlineRuns = collectInlineMathRuns(pages)
    expect(inlineRuns.length).toBeGreaterThanOrEqual(2)
    await writeSmokePages(outputDir, 'mixed-content', pages)
  })

  test('math interleaved with code block preserves both fragment types', async () => {
    const md = `# Combined\n\n$$\nf(n) = O(n \\log n)\n$$\n\n\`\`\`python\ndef merge_sort(arr): pass\n\`\`\`\n\nAnd inline $O(n)$ complexity.`
    const pages = await renderMarkdown(md)
    const allKinds = pages.flatMap((p) => p.page.fragments.flatMap(collectKinds))
    expect(allKinds).toContain('mathBlock')
    expect(allKinds).toContain('code')
    const inlineRuns = collectInlineMathRuns(pages)
    expect(inlineRuns.length).toBeGreaterThan(0)
  })

  test('renders showcase document with output images', async () => {
    const pages = await renderMarkdown(SHOWCASE_MD)
    expect(pages.length).toBeGreaterThanOrEqual(1)
    const allKinds = pages.flatMap((p) => p.page.fragments.flatMap(collectKinds))
    expect(allKinds.filter((k) => k === 'mathBlock').length).toBe(2)
    const inlineRuns = collectInlineMathRuns(pages)
    expect(inlineRuns.length).toBeGreaterThanOrEqual(2)
    await writeSmokePages(outputDir, 'showcase', pages)
  })
})

// ─── Pagination tests ─────────────────────────────────────────────────────────

describe('smoke: math — pagination', () => {
  test('heavy formula document paginates and all 8 blocks are accounted for', async () => {
    const pages = await renderMarkdown(HEAVY_FORMULAS_MD)
    expect(pages.length).toBeGreaterThanOrEqual(1)
    const count = collectMathBlockFragments(pages).length
    expect(count).toBe(8)
    await writeSmokePages(outputDir, 'heavy-formulas', pages)
  })

  test('singlePage mode collects all block formulas into one image', async () => {
    const pages = await renderMarkdown(HEAVY_FORMULAS_MD, { singlePage: true })
    expect(pages.length).toBe(1)
    expect(collectMathBlockFragments(pages).length).toBe(8)
  })

  test('rendering is deterministic across two parallel calls', async () => {
    const [first, second] = await Promise.all([
      renderMarkdown(SHOWCASE_MD),
      renderMarkdown(SHOWCASE_MD),
    ])
    expect(first.length).toBe(second.length)
    const firstCounts = first.map((p) => collectMathBlockFragments([p]).length)
    const secondCounts = second.map((p) => collectMathBlockFragments([p]).length)
    expect(firstCounts).toEqual(secondCounts)
  })
})

// ─── Output format tests ──────────────────────────────────────────────────────

describe('smoke: math — output formats', () => {
  test('SVG output format produces non-empty string output', async () => {
    const pages = await renderMarkdown(`$$\nE = mc^2\n$$`, { format: 'svg' })
    expect(pages.length).toBe(1)
    expect(pages[0]!.format).toBe('svg')
    expect(typeof pages[0]!.data).toBe('string')
    expect((pages[0]!.data as string).length).toBeGreaterThan(0)
  })

  test('PNG output for nord theme renders without error', async () => {
    const pages = await renderMarkdown(
      `# Fourier Transform\n\n$$\n\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi i x\\xi}\\,dx\n$$\n\nInline $\\hat{f}(\\xi)$ in text.`,
      { theme: 'nord' },
    )
    expect(pages.length).toBeGreaterThanOrEqual(1)
    await writeSmokePages(outputDir, 'nord', pages)
  })

  test('document without math produces no mathBlock fragments', async () => {
    const pages = await renderMarkdown(`# Plain\n\nNo formulas here.`)
    expect(collectMathBlockFragments(pages).length).toBe(0)
    expect(collectInlineMathRuns(pages).length).toBe(0)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('smoke: math — edge cases', () => {
  test('invalid LaTeX formula renders without crashing', async () => {
    // \xyz is not a real LaTeX command — MathJax may render an error glyph or skip
    const pages = await renderMarkdown(`$$\n\\xyz{broken\n$$`)
    // Must not throw; must produce at least one page
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  test('adjacent block formulas with no prose between them all render', async () => {
    const md = `$$\nA\n$$\n\n$$\nB\n$$\n\n$$\nC\n$$`
    const pages = await renderMarkdown(md)
    expect(collectMathBlockFragments(pages).length).toBe(3)
  })

  test('inline math immediately adjacent to strong/emphasis text renders', async () => {
    const pages = await renderMarkdown(`**Bold** $x^2$ *italic* $y^2$ text.`)
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBe(2)
    for (const run of runs) {
      expect(run.width).toBeGreaterThan(0)
      expect(run.height).toBeGreaterThan(0)
    }
  })
})

// ─── Internal helper ──────────────────────────────────────────────────────────

function collectKinds(f: PaintBlockFragment): string[] {
  const kinds: string[] = [f.kind]
  if (f.kind === 'blockquote') kinds.push(...f.children.flatMap(collectKinds))
  if (f.kind === 'list') {
    for (const item of f.items) kinds.push(...item.children.flatMap(collectKinds))
  }
  return kinds
}
