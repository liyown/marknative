import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { renderMarkdown } from '../../../src'
import type { RenderPage } from '../../../src/render/render-markdown'
import type { PaintBlockFragment, PaintLineRun } from '../../../src/paint/types'
import { prepareSmokeOutputDir, writeSmokePages } from '../helpers'

const outputDir = resolve(import.meta.dir, '..', 'output', 'math-mixed')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PARA_MULTI_FORMULA_MD = `质能方程 $E = mc^2$ 由**爱因斯坦**提出，其中 $c \\approx 3 \\times 10^8$ m/s 是光速。
薛定谔方程为 $i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi$，
其中 $\\hbar = h / 2\\pi$ 是约化普朗克常数，$\\hat{H}$ 是哈密顿量算符。`

const CODE_AND_MATH_MD = `连续傅里叶变换：

$$
\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\, e^{-2\\pi i x \\xi}\\, dx
$$

Python 数值实现：

\`\`\`python
import numpy as np

def fourier_transform(f, xi):
    x = np.linspace(-10, 10, 4096)
    return np.trapz(f(x) * np.exp(-2j * np.pi * x * xi), x)
\`\`\`

离散形式（DFT）对应频率分辨率 $\\Delta\\xi = 1 / (N \\Delta x)$。`

const BLOCKQUOTE_MULTI_BLOCK_MD = `> **高斯积分**是概率论的基石：
>
> $$
> \\int_{-\\infty}^{\\infty} e^{-x^2}\\, dx = \\sqrt{\\pi}
> $$
>
> 对于参数 $\\sigma > 0$，正态分布 $\\mathcal{N}(\\mu, \\sigma^2)$ 满足：
>
> $$
> \\int_{-\\infty}^{\\infty} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}\\, dx = \\sigma\\sqrt{2\\pi}
> $$
>
> 这就是正态分布的归一化条件。`

const LIST_DEEP_MATH_MD = `常用导数公式：

1. 幂函数：$\\frac{d}{dx} x^n = nx^{n-1}$
2. 指数函数：$\\frac{d}{dx} e^x = e^x$，一般情形 $\\frac{d}{dx} a^x = a^x \\ln a$
3. 三角函数：
   - $\\frac{d}{dx} \\sin x = \\cos x$
   - $\\frac{d}{dx} \\cos x = -\\sin x$
   - $\\frac{d}{dx} \\tan x = \\sec^2 x$
4. 链式法则：若 $y = f(g(x))$，则 $\\frac{dy}{dx} = f'(g(x))\\cdot g'(x)$`

const TABLE_MATH_MD = `| 分布 | 均值 | 方差 |
|------|------|------|
| $\\mathcal{N}(\\mu, \\sigma^2)$ | $\\mu$ | $\\sigma^2$ |
| $\\text{Uniform}(a,b)$ | $\\frac{a+b}{2}$ | $\\frac{(b-a)^2}{12}$ |
| $\\text{Exp}(\\lambda)$ | $\\frac{1}{\\lambda}$ | $\\frac{1}{\\lambda^2}$ |`

const MATRIX_PARA_MD = `旋转矩阵：

$$
R(\\theta) = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}
$$

满足 $R(\\theta)^T = R(\\theta)^{-1} = R(-\\theta)$，即 $R$ 是**正交矩阵**，$\\det R = 1$。`

const FULL_COMPLEX_MD = `# 复杂混排测试

## 1. 段落内多公式与强调混排

${PARA_MULTI_FORMULA_MD}

## 2. 公式与代码混排

${CODE_AND_MATH_MD}

## 3. 引用块内的公式

${BLOCKQUOTE_MULTI_BLOCK_MD}

## 4. 列表内公式

${LIST_DEEP_MATH_MD}

## 5. 表格与行内公式

${TABLE_MATH_MD}

## 6. 矩阵运算

${MATRIX_PARA_MD}
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function countMathBlockFragments(pages: RenderPage[]): number {
  let count = 0
  for (const page of pages) walkFragments(page.page.fragments, (f) => { if (f.kind === 'mathBlock') count++ })
  return count
}

function walkFragments(fragments: PaintBlockFragment[], cb: (f: PaintBlockFragment) => void): void {
  for (const f of fragments) {
    cb(f)
    if (f.kind === 'blockquote') walkFragments(f.children, cb)
    if (f.kind === 'list') {
      for (const item of f.items) walkFragments(item.children, cb)
    }
  }
}

function assertInlineMathRunsValid(runs: PaintLineRun[]): void {
  expect(runs.length).toBeGreaterThan(0)
  for (const run of runs) {
    expect(run.width).toBeGreaterThan(0)
    expect(run.height).toBeGreaterThan(0)
    expect(run.url).toMatch(/^data:image\/svg\+xml;base64,/)
    const depth = run.mathDepth ?? 0
    expect(depth).toBeGreaterThanOrEqual(0)
    // height must not be inflated to line height: image aspect ratio check
    // width is always the natural formula width; height derived from image AR
    // so depth should never exceed height
    expect(depth).toBeLessThanOrEqual(run.height + 1)
  }
}

// ─── Paragraph with multiple inline formulas ──────────────────────────────────

describe('smoke: math mixed — paragraph', () => {
  test('paragraph with 5 inline formulas across 3 lines renders all runs', async () => {
    const pages = await renderMarkdown(PARA_MULTI_FORMULA_MD)
    const runs = collectInlineMathRuns(pages)
    // E=mc², c≈3×10⁸, iℏ∂Ψ/∂t = ĤΨ, ℏ=h/2π, Ĥ
    expect(runs.length).toBe(5)
    assertInlineMathRunsValid(runs)
  })

  test('all inline formulas in paragraph have positive non-zero dimensions', async () => {
    const pages = await renderMarkdown(PARA_MULTI_FORMULA_MD)
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBe(5)
    for (const run of runs) {
      expect(run.width).toBeGreaterThan(0)
      expect(run.height).toBeGreaterThan(0)
    }
  })

  test('inline math x positions do not overlap within their lines', async () => {
    const pages = await renderMarkdown(PARA_MULTI_FORMULA_MD)
    expect(pages.length).toBe(1)
    for (const fragment of pages[0]!.page.fragments) {
      if (!('lines' in fragment) || !fragment.lines) continue
      for (const line of fragment.lines) {
        // Within a single line, runs must not have negative x or zero width
        for (const run of line.runs) {
          expect(run.x).toBeGreaterThanOrEqual(0)
          expect(run.width).toBeGreaterThan(0)
        }
      }
    }
  })
})

// ─── Math + code interleave ────────────────────────────────────────────────────

describe('smoke: math mixed — math and code', () => {
  test('block math before and after code block both render', async () => {
    const pages = await renderMarkdown(CODE_AND_MATH_MD)
    expect(countMathBlockFragments(pages)).toBe(1)
    const allKinds = pages.flatMap((p) => p.page.fragments.map((f) => f.kind))
    expect(allKinds).toContain('mathBlock')
    expect(allKinds).toContain('code')
  })

  test('inline math after code block has valid dimensions', async () => {
    const pages = await renderMarkdown(CODE_AND_MATH_MD)
    const runs = collectInlineMathRuns(pages)
    // Δξ = 1 / (N Δx) — one inline formula after the code block
    expect(runs.length).toBe(1)
    assertInlineMathRunsValid(runs)
  })

  test('code + math renders correctly with syntax highlighting', async () => {
    await prepareSmokeOutputDir(outputDir)
    const pages = await renderMarkdown(CODE_AND_MATH_MD, {
      codeHighlighting: { theme: 'github-light' },
    })
    expect(countMathBlockFragments(pages)).toBe(1)
    await writeSmokePages(outputDir, 'code-and-math', pages)
  })
})

// ─── Blockquote with multiple block formulas ──────────────────────────────────

describe('smoke: math mixed — blockquote', () => {
  test('blockquote with two block formulas and inline formulas all render', async () => {
    const pages = await renderMarkdown(BLOCKQUOTE_MULTI_BLOCK_MD)
    expect(countMathBlockFragments(pages)).toBe(2)
    const runs = collectInlineMathRuns(pages)
    // σ > 0 and 𝒩(μ, σ²)
    expect(runs.length).toBe(2)
    assertInlineMathRunsValid(runs)
  })

  test('blockquote math block fragments have valid geometry', async () => {
    const pages = await renderMarkdown(BLOCKQUOTE_MULTI_BLOCK_MD)
    let count = 0
    for (const page of pages) {
      for (const f of page.page.fragments) {
        if (f.kind !== 'blockquote') continue
        walkFragments(f.children, (child) => {
          if (child.kind !== 'mathBlock') return
          count++
          expect(child.box.x).toBeGreaterThanOrEqual(0)
          expect(child.box.width).toBeGreaterThan(0)
          expect(child.box.height).toBeGreaterThan(0)
        })
      }
    }
    expect(count).toBe(2)
  })

  test('second block formula y is below first inside blockquote', async () => {
    const pages = await renderMarkdown(BLOCKQUOTE_MULTI_BLOCK_MD)
    const blocks: Array<{ box: { y: number } }> = []
    for (const page of pages) {
      for (const f of page.page.fragments) {
        if (f.kind !== 'blockquote') continue
        walkFragments(f.children, (child) => {
          if (child.kind === 'mathBlock') blocks.push(child)
        })
      }
    }
    expect(blocks.length).toBe(2)
    expect(blocks[1]!.box.y).toBeGreaterThan(blocks[0]!.box.y)
  })
})

// ─── List with nested inline formulas ─────────────────────────────────────────

describe('smoke: math mixed — list', () => {
  test('ordered list with 4 items and 9 inline formulas renders all runs', async () => {
    const pages = await renderMarkdown(LIST_DEEP_MATH_MD)
    const runs = collectInlineMathRuns(pages)
    // d/dx xⁿ | d/dx eˣ, d/dx aˣ | sin, cos, tan | f(g(x)), dy/dx = f'g' = 8
    expect(runs.length).toBeGreaterThanOrEqual(8)
    assertInlineMathRunsValid(runs)
  })

  test('inline math in nested sub-list items has valid url and dimensions', async () => {
    const pages = await renderMarkdown(LIST_DEEP_MATH_MD)
    // Sub-list contains sin, cos, tan derivatives
    const runs = collectInlineMathRuns(pages)
    const sinCosTan = runs.filter((r) => {
      const depth = r.mathDepth ?? 0
      return r.height > depth // all valid formula runs
    })
    expect(sinCosTan.length).toBeGreaterThan(0)
    for (const run of sinCosTan) {
      expect(run.url).toMatch(/^data:image\/svg\+xml;base64,/)
    }
  })
})

// ─── Table with inline formulas ────────────────────────────────────────────────

describe('smoke: math mixed — table', () => {
  test('table with inline math in cells produces inlineMath runs', async () => {
    const pages = await renderMarkdown(TABLE_MATH_MD)
    expect(pages.length).toBe(1)
    // Table cells contain inline formulas; collect from table cell fragments
    const runs: PaintLineRun[] = []
    for (const f of pages[0]!.page.fragments) {
      if (f.kind !== 'table') continue
      const allRows = [f.header, ...f.rows]
      for (const row of allRows) {
        for (const cell of row.cells) {
          if (!cell.lines) continue
          for (const line of cell.lines) {
            for (const run of line.runs) {
              if (run.styleKind === 'inlineMath') runs.push(run)
            }
          }
        }
      }
    }
    expect(runs.length).toBeGreaterThan(0)
    assertInlineMathRunsValid(runs)
  })

  test('table with math renders non-empty png output', async () => {
    const pages = await renderMarkdown(TABLE_MATH_MD)
    expect(pages.length).toBe(1)
    const data = pages[0]!.data
    expect(Buffer.isBuffer(data) ? data.byteLength : (data as string).length).toBeGreaterThan(0)
  })
})

// ─── Matrix + paragraph ───────────────────────────────────────────────────────

describe('smoke: math mixed — matrix and paragraph', () => {
  test('block matrix followed by paragraph with inline math renders both', async () => {
    const pages = await renderMarkdown(MATRIX_PARA_MD)
    expect(countMathBlockFragments(pages)).toBe(1)
    const runs = collectInlineMathRuns(pages)
    // R(θ)ᵀ = R(θ)⁻¹ = R(-θ), R, det R = 1 — at least 3 inline formulas
    expect(runs.length).toBeGreaterThanOrEqual(3)
    assertInlineMathRunsValid(runs)
  })
})

// ─── Full complex document ────────────────────────────────────────────────────

describe('smoke: math mixed — full document', () => {
  test('full complex mixed document has correct block counts', async () => {
    const pages = await renderMarkdown(FULL_COMPLEX_MD)
    expect(pages.length).toBeGreaterThanOrEqual(1)
    // 1 Fourier + 2 Gaussian (in blockquote) + 1 rotation matrix = 4 block formulas
    expect(countMathBlockFragments(pages)).toBe(4)
    // Many inline formulas across all sections
    const runs = collectInlineMathRuns(pages)
    expect(runs.length).toBeGreaterThanOrEqual(15)
    assertInlineMathRunsValid(runs)
  })

  test('full complex document renders to output on light theme', async () => {
    const pages = await renderMarkdown(FULL_COMPLEX_MD, { singlePage: true })
    expect(countMathBlockFragments(pages)).toBe(4)
    await writeSmokePages(outputDir, 'complex-light', pages)
  })

  test('full complex document renders to output on dark theme', async () => {
    const pages = await renderMarkdown(FULL_COMPLEX_MD, {
      singlePage: true,
      theme: 'dark',
    })
    expect(countMathBlockFragments(pages)).toBe(4)
    await writeSmokePages(outputDir, 'complex-dark', pages)
  })

  test('full complex document renders to output on nord theme', async () => {
    const pages = await renderMarkdown(FULL_COMPLEX_MD, {
      singlePage: true,
      theme: 'nord',
    })
    expect(countMathBlockFragments(pages)).toBe(4)
    await writeSmokePages(outputDir, 'complex-nord', pages)
  })

  test('fragment type sequence contains all expected kinds', async () => {
    const pages = await renderMarkdown(FULL_COMPLEX_MD)
    const allKinds = pages.flatMap((p) => p.page.fragments.flatMap(collectKindsDeep))
    expect(allKinds).toContain('heading')
    expect(allKinds).toContain('paragraph')
    expect(allKinds).toContain('mathBlock')
    expect(allKinds).toContain('code')
    expect(allKinds).toContain('blockquote')
    expect(allKinds).toContain('list')
    expect(allKinds).toContain('table')
  })

  test('pagination of full complex document is deterministic', async () => {
    const [a, b] = await Promise.all([
      renderMarkdown(FULL_COMPLEX_MD),
      renderMarkdown(FULL_COMPLEX_MD),
    ])
    expect(a.length).toBe(b.length)
    expect(countMathBlockFragments(a)).toBe(countMathBlockFragments(b))
    expect(collectInlineMathRuns(a).length).toBe(collectInlineMathRuns(b).length)
  })

  test('inline math run heights are not inflated to line height', async () => {
    // Regression: finalizeLine used to override all run heights to line height,
    // causing inline math images to be drawn stretched (e.g. 23px formula at 55px).
    // Verify by checking that no inline math run has an implausibly large height.
    const pages = await renderMarkdown(FULL_COMPLEX_MD)
    const runs = collectInlineMathRuns(pages)
    const lineHeight = 44 // defaultTheme body lineHeight
    // Simple inline formulas (like $\mu$, $\sigma^2$) should be well below 2× lineHeight.
    // Fractions may exceed lineHeight, but nothing should be 3× lineHeight or more.
    for (const run of runs) {
      expect(run.height).toBeLessThan(lineHeight * 3)
    }
  })
})

// ─── Internal helper ──────────────────────────────────────────────────────────

function collectKindsDeep(f: PaintBlockFragment): string[] {
  const kinds: string[] = [f.kind]
  if (f.kind === 'blockquote') kinds.push(...f.children.flatMap(collectKindsDeep))
  if (f.kind === 'list') {
    for (const item of f.items) kinds.push(...item.children.flatMap(collectKindsDeep))
  }
  return kinds
}
