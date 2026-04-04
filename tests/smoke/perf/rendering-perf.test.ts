/**
 * Rendering performance smoke tests.
 *
 * These tests guard against significant regressions in render time.
 * Budgets are set at ~2× the observed baseline on a MacBook M-series:
 *
 *   Observed baselines (warm, PNG):
 *     plain / code / math / mixed  ≈ 115–120 ms
 *     SVG output                   ≈  11 ms
 *     singlePage (long doc)        ≈ 181 ms
 *     4× parallel renders          ≈ 200 ms
 *
 * CI machines may be slower; budgets have further headroom for that.
 * If a budget is regularly exceeded, investigate before raising it —
 * that's the point.
 */
import { describe, expect, test } from 'bun:test'

import { renderMarkdown } from '../../../src'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PLAIN_MD = `# Performance Fixture — Plain

${Array.from({ length: 8 }, (_, i) => `## Section ${i + 1}\n\n` +
  '> A blockquote to exercise blockquote rendering.\n\n' +
  '- First bullet with **bold** and *italic* text\n' +
  '- Second bullet with a \`code snippet\` inline\n\n' +
  'The quick brown fox jumps over the lazy dog. '.repeat(6),
).join('\n\n')}
`

const CODE_MD = `# Performance Fixture — Code

\`\`\`typescript
interface RenderOptions {
  theme?: string
  format?: 'png' | 'svg'
  singlePage?: boolean
}

export async function renderCard(md: string, opts: RenderOptions = {}): Promise<Buffer[]> {
  const pages = await renderMarkdown(md, opts)
  return pages.filter((p) => p.format === 'png').map((p) => p.data as Buffer)
}
\`\`\`

\`\`\`python
import numpy as np
from typing import Optional

def create_matrix(n: int) -> np.ndarray:
    return np.array([[1 / (i + j + 1) for j in range(n)] for i in range(n)])

def solve(A: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.linalg.solve(A, b)
\`\`\`

\`\`\`rust
use std::collections::HashMap;

fn word_count(text: &str) -> HashMap<&str, usize> {
    let mut map = HashMap::new();
    for word in text.split_whitespace() {
        *map.entry(word).or_insert(0) += 1;
    }
    map
}
\`\`\`
`

const MATH_MD = `# Performance Fixture — Math

Block formulas:

$$
\\int_a^b f'(x)\\, dx = f(b) - f(a)
$$

$$
A^\\dagger = (A^T A)^{-1} A^T
$$

$$
p(\\mathbf{x}) = \\frac{1}{(2\\pi)^{d/2}|\\Sigma|^{1/2}}
\\exp\\!\\left(-\\tfrac{1}{2}(\\mathbf{x}-\\boldsymbol{\\mu})^T\\Sigma^{-1}(\\mathbf{x}-\\boldsymbol{\\mu})\\right)
$$

$$
D_{\\mathrm{KL}}(P\\|Q) = \\sum_x P(x)\\log\\frac{P(x)}{Q(x)}
$$

$$
\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi ix\\xi}\\,dx
$$

$$
\\nabla^2 f = \\sum_{i=1}^n \\frac{\\partial^2 f}{\\partial x_i^2}
$$

Inline: the gradient $\\nabla f$, entropy $H(X) = -\\sum p \\log p$,
and norm $\\|\\mathbf{x}\\|_2 = \\sqrt{\\sum x_i^2}$.
`

const MIXED_MD = `# Performance Fixture — Mixed

The transform $\\hat{f}(\\xi) = \\int f(x) e^{-2\\pi ix\\xi}\\,dx$ is computed as:

\`\`\`python
import numpy as np
def dft(x):
    N = len(x)
    n, k = np.arange(N), np.arange(N).reshape(N, 1)
    return np.exp(-2j * np.pi * k * n / N) @ x
\`\`\`

Complexity: $O(N^2)$ naïve, $O(N \\log N)$ FFT. Update rule: $\\theta_{t+1} = \\theta_t - \\eta\\nabla\\mathcal{L}$.

\`\`\`typescript
function gradientDescent(grad: (t: number[]) => number[], theta: number[], lr = 0.01, steps = 100): number[] {
  for (let i = 0; i < steps; i++) theta = theta.map((v, j) => v - lr * grad(theta)[j]!)
  return theta
}
\`\`\`

Convergence guaranteed when $\\eta < 2/L$ where $L$ is the Lipschitz constant of $\\nabla\\mathcal{L}$.
`

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Run fn once for warm-up then measure `runs` times; return sorted ms array. */
async function measure(fn: () => Promise<void>, runs: number): Promise<number[]> {
  await fn() // warm-up
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    await fn()
    times.push(performance.now() - t0)
  }
  return times.sort((a, b) => a - b)
}

function p50(times: number[]): number { return times[Math.floor(times.length * 0.5)]! }
function p90(times: number[]): number { return times[Math.floor(times.length * 0.9)]! }

// ─── Cold start ───────────────────────────────────────────────────────────────

describe('perf: cold start', () => {
  test('first math render (cold, includes MathJax init) completes within 1 s', async () => {
    // Each test file gets a fresh Bun worker, so this IS a cold start.
    const t0 = performance.now()
    const pages = await renderMarkdown(MATH_MD)
    const elapsed = performance.now() - t0
    expect(pages.length).toBeGreaterThanOrEqual(1)
    expect(elapsed).toBeLessThan(1000)
  })
})

// ─── Warm single-render budgets ───────────────────────────────────────────────

describe('perf: warm render budgets (PNG)', () => {
  // Budget: 2.5× observed baseline (~120 ms) = 300 ms, with CI headroom → 500 ms
  const BUDGET_MS = 500

  test('plain text document p90 < 500 ms', async () => {
    const times = await measure(() => renderMarkdown(PLAIN_MD).then(() => {}), 10)
    expect(p90(times)).toBeLessThan(BUDGET_MS)
  })

  test('code-heavy document (3 languages, shiki) p90 < 500 ms', async () => {
    const times = await measure(() => renderMarkdown(CODE_MD).then(() => {}), 10)
    expect(p90(times)).toBeLessThan(BUDGET_MS)
  })

  test('math-heavy document (6 block formulas) p90 < 500 ms', async () => {
    const times = await measure(() => renderMarkdown(MATH_MD).then(() => {}), 10)
    expect(p90(times)).toBeLessThan(BUDGET_MS)
  })

  test('mixed document (math + code) p90 < 500 ms', async () => {
    const times = await measure(() => renderMarkdown(MIXED_MD).then(() => {}), 10)
    expect(p90(times)).toBeLessThan(BUDGET_MS)
  })
})

// ─── SVG is much faster than PNG ──────────────────────────────────────────────

describe('perf: SVG vs PNG', () => {
  test('SVG render is at least 5× faster than PNG (same content)', async () => {
    const [svgTimes, pngTimes] = await Promise.all([
      measure(() => renderMarkdown(MIXED_MD, { format: 'svg' }).then(() => {}), 10),
      measure(() => renderMarkdown(MIXED_MD, { format: 'png' }).then(() => {}), 10),
    ])
    // SVG skips rasterisation; observed ≈11 ms vs ≈115 ms (10× faster)
    expect(p50(svgTimes) * 5).toBeLessThan(p50(pngTimes))
  })

  test('SVG output p50 < 50 ms', async () => {
    const times = await measure(() => renderMarkdown(MIXED_MD, { format: 'svg' }).then(() => {}), 10)
    expect(p50(times)).toBeLessThan(50)
  })
})

// ─── Math warm ≈ non-math ─────────────────────────────────────────────────────

describe('perf: math overhead after warm-up', () => {
  test('math document is not more than 2× slower than plain (warm)', async () => {
    // Both are warm; MathJax singleton is already initialised.
    // The pre-render pass is fast because formulas are cached from previous tests.
    const [plainTimes, mathTimes] = await Promise.all([
      measure(() => renderMarkdown(PLAIN_MD).then(() => {}), 6),
      measure(() => renderMarkdown(MATH_MD).then(() => {}), 6),
    ])
    expect(p50(mathTimes)).toBeLessThan(p50(plainTimes) * 2)
  }, 60_000)
})

// ─── Parallel render throughput ───────────────────────────────────────────────

describe('perf: concurrency', () => {
  test('4 parallel PNG renders complete within 4000 ms (p90)', async () => {
    // Observed ≈200 ms on M-series, ≈1500 ms on CI (shared runner, ~7× slower).
    // Budget is set to accommodate the slowest expected CI environment.
    const times = await measure(
      () => Promise.all(Array.from({ length: 4 }, () => renderMarkdown(PLAIN_MD))).then(() => {}),
      5,
    )
    expect(p90(times)).toBeLessThan(4000)
  }, 60_000)

  test('4 parallel PNG renders do not regress vs sequential (p50 within 3×)', async () => {
    // On multi-core machines parallel is faster; on CI single-core runners it may be
    // similar or slightly slower due to context-switching. We only guard against a
    // dramatic regression (parallel taking > 3× sequential), not require improvement.
    const [seqTimes, parTimes] = await Promise.all([
      measure(async () => { for (let i = 0; i < 4; i++) await renderMarkdown(PLAIN_MD) }, 4),
      measure(() => Promise.all(Array.from({ length: 4 }, () => renderMarkdown(PLAIN_MD))).then(() => {}), 4),
    ])
    expect(p50(parTimes)).toBeLessThan(p50(seqTimes) * 3)
  }, 60_000)
})

// ─── Theme overhead ───────────────────────────────────────────────────────────

describe('perf: theme switching', () => {
  test('dark theme render time is within 50 ms of default theme', async () => {
    const [defTimes, darkTimes] = await Promise.all([
      measure(() => renderMarkdown(MIXED_MD).then(() => {}), 6),
      measure(() => renderMarkdown(MIXED_MD, { theme: 'dark' }).then(() => {}), 6),
    ])
    // Observed overhead ≈ 0–2 ms; 50 ms gives CI headroom
    expect(Math.abs(p50(darkTimes) - p50(defTimes))).toBeLessThan(50)
  }, 60_000)
})
