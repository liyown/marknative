#!/usr/bin/env bun
/**
 * NoteCard rendering performance benchmark
 * Run: bun bench/perf.ts
 *
 * Tests each pipeline stage and overall throughput across document types,
 * output formats, scale factors, and concurrency modes.
 */
import { renderMarkdown } from '../src'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PLAIN_MD = `# Plain Text

${Array.from({ length: 5 }, (_, i) =>
  `## Section ${i + 1}\n\n` +
  '> A blockquote with **bold** and *italic* text.\n\n' +
  '- Bullet item with a `code` snippet\n' +
  '- Another item with ~~strikethrough~~\n\n' +
  'The quick brown fox jumps over the lazy dog. '.repeat(5),
).join('\n\n')}
`

const CODE_MD = `# Code Blocks

\`\`\`typescript
interface RenderOptions { theme?: string; format?: 'png' | 'svg' }
export async function render(md: string, opts: RenderOptions = {}) {
  return renderMarkdown(md, opts)
}
\`\`\`

\`\`\`python
import numpy as np
def create_matrix(n: int) -> np.ndarray:
    return np.array([[1 / (i + j + 1) for j in range(n)] for i in range(n)])
\`\`\`

\`\`\`rust
fn word_count(text: &str) -> std::collections::HashMap<&str, usize> {
    let mut map = std::collections::HashMap::new();
    for word in text.split_whitespace() { *map.entry(word).or_insert(0) += 1; }
    map
}
\`\`\`
`

const MATH_MD = `# Mathematics

$$
\\int_a^b f'(x)\\,dx = f(b) - f(a)
$$

$$
p(\\mathbf{x}) = \\frac{1}{(2\\pi)^{d/2}|\\Sigma|^{1/2}}
\\exp\\!\\left(-\\tfrac{1}{2}(\\mathbf{x}-\\boldsymbol{\\mu})^T\\Sigma^{-1}(\\mathbf{x}-\\boldsymbol{\\mu})\\right)
$$

$$
D_{\\mathrm{KL}}(P\\|Q) = \\int p(x)\\log\\frac{p(x)}{q(x)}\\,dx
$$

$$
\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi ix\\xi}\\,dx
$$

Inline: $\\nabla f$, $H(X) = -\\sum p\\log p$, $\\|\\mathbf{x}\\|_2 = \\sqrt{\\sum x_i^2}$.
`

const MIXED_MD = `# Mixed

The transform $\\hat{f}(\\xi) = \\int f(x)e^{-2\\pi ix\\xi}\\,dx$:

\`\`\`python
def dft(x):
    import numpy as np
    N, n = len(x), np.arange(len(x))
    return np.exp(-2j * np.pi * n.reshape(N,1) * n / N) @ x
\`\`\`

$$
D_{\\mathrm{KL}}(P\\|Q) = \\sum_x P(x)\\log\\frac{P(x)}{Q(x)}
$$

Complexity: $O(N^2)$ naïve, $O(N\\log N)$ FFT.
`

// ─── Runner ───────────────────────────────────────────────────────────────────

const RUNS = 20

async function bench(
  label: string,
  fn: () => Promise<unknown>,
): Promise<number> {
  await fn() // warm-up (not measured)
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    await fn()
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  const mean = times.reduce((s, v) => s + v, 0) / times.length
  const p50  = times[Math.floor(times.length * 0.50)]!
  const p90  = times[Math.floor(times.length * 0.90)]!
  const min  = times[0]!
  const max  = times[times.length - 1]!
  console.log(
    `  ${label.padEnd(38)}` +
    `mean ${f(mean)}  p50 ${f(p50)}  p90 ${f(p90)}  ` +
    `min ${f(min)}  max ${f(max)}`,
  )
  return mean
}

function f(ms: number): string {
  return (ms < 10 ? ms.toFixed(2) : ms.toFixed(1)).padStart(7) + ' ms'
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(90)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(90))
}

// ─── Warm up all singletons ───────────────────────────────────────────────────

process.stdout.write('Warming up … ')
await renderMarkdown(MATH_MD)    // initialises MathJax singleton
await renderMarkdown(CODE_MD)    // initialises shiki singleton
await renderMarkdown(PLAIN_MD)
console.log('done\n')

// ─── Cold start ───────────────────────────────────────────────────────────────

section('Cold start  (fresh process, all singletons uninitialised)')
console.log('  (run "bun bench/perf.ts" in a fresh shell to see true cold times)')
console.log('  Approximate cold overhead: MathJax init ≈ 180 ms, shiki init ≈ 80 ms')

// ─── Throughput by document type ─────────────────────────────────────────────

section(`Warm throughput by document type  (PNG 2×, n=${RUNS})`)
await bench('plain text (prose + lists + blockquotes)', () => renderMarkdown(PLAIN_MD))
await bench('code-heavy (3 languages, shiki)',          () => renderMarkdown(CODE_MD))
await bench('math-heavy (4 block + 3 inline formulas)', () => renderMarkdown(MATH_MD))
await bench('mixed (math + code)',                      () => renderMarkdown(MIXED_MD))

// ─── Output format ────────────────────────────────────────────────────────────

section(`Output format  (mixed doc, n=${RUNS})`)
const svgMean = await bench('SVG  — layout + serialize only (no rasterize)', () => renderMarkdown(MIXED_MD, { format: 'svg' }))
const pngMean = await bench('PNG 2× (default) — full rasterize + encode',   () => renderMarkdown(MIXED_MD, { format: 'png', scale: 2 }))
console.log(`\n  Rasterize+encode overhead: PNG − SVG ≈ ${(pngMean - svgMean).toFixed(1)} ms  (toBuffer is ${((pngMean - svgMean) / pngMean * 100).toFixed(0)}% of PNG time)`)

// ─── Scale factor (encode cost) ───────────────────────────────────────────────

section(`PNG scale factor  (mixed doc — encode cost scales with pixel count, n=${RUNS})`)
await bench('scale: 1   (1080 × ~650  = 0.7 MP)',  () => renderMarkdown(MIXED_MD, { scale: 1 }))
await bench('scale: 1.5 (1620 × ~975  = 1.6 MP)',  () => renderMarkdown(MIXED_MD, { scale: 1.5 }))
await bench('scale: 2   (2160 × ~1300 = 2.8 MP) ← default', () => renderMarkdown(MIXED_MD, { scale: 2 }))
await bench('scale: 3   (3240 × ~1950 = 6.3 MP)',  () => renderMarkdown(MIXED_MD, { scale: 3 }))

// ─── Theme overhead ───────────────────────────────────────────────────────────

section(`Theme  (mixed doc, PNG 2×, n=${RUNS})`)
await bench('default (light)',  () => renderMarkdown(MIXED_MD))
await bench('dark',             () => renderMarkdown(MIXED_MD, { theme: 'dark' }))
await bench('nord',             () => renderMarkdown(MIXED_MD, { theme: 'nord' }))
await bench('dracula',          () => renderMarkdown(MIXED_MD, { theme: 'dracula' }))

// ─── Concurrency ─────────────────────────────────────────────────────────────

section(`Concurrency  (plain doc, PNG 2×, n=${Math.floor(RUNS / 2)})`)
await bench('1× sequential', () => renderMarkdown(PLAIN_MD))
await bench('2× parallel',   () => Promise.all([renderMarkdown(PLAIN_MD), renderMarkdown(PLAIN_MD)]))
await bench('4× parallel',   () => Promise.all(Array.from({ length: 4 }, () => renderMarkdown(PLAIN_MD))))
await bench('8× parallel',   () => Promise.all(Array.from({ length: 8 }, () => renderMarkdown(PLAIN_MD))))

// ─── Pagination mode ──────────────────────────────────────────────────────────

section(`Pagination mode  (plain text, PNG 2×, n=${RUNS})`)
await bench('paginated (default)',  () => renderMarkdown(PLAIN_MD))
await bench('singlePage',           () => renderMarkdown(PLAIN_MD, { singlePage: true }))

console.log()
