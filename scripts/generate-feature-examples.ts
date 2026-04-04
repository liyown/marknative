/**
 * Generates feature showcase PNG examples for the VitePress docs gallery.
 * Output: docs/public/examples/features/*.png
 *
 * Run: bun scripts/generate-feature-examples.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { mergeTheme, renderMarkdown } from '../src'

const OUT = resolve(import.meta.dir, '..', 'docs', 'public', 'examples', 'features')
await mkdir(OUT, { recursive: true })

async function save(name: string, data: Buffer): Promise<void> {
  await writeFile(resolve(OUT, `${name}.png`), data)
  console.log('wrote', name)
}

async function png(md: string, opts: Parameters<typeof renderMarkdown>[1] = {}): Promise<Buffer[]> {
  const pages = await renderMarkdown(md, { format: 'png', ...opts })
  return pages.filter((p) => p.format === 'png').map((p) => (p.format === 'png' ? p.data : Buffer.alloc(0)))
}

const LONG_MD = `# Long Document Rendering

marknative automatically paginates content that exceeds a single page height.
Each page is a fixed-size PNG or SVG image.

## Section 1 — Prose

Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.

**Bold text** and *italic text* and \`inline code\` all in one paragraph.

## Section 2 — Lists

- First item at the top level
- Second item with **bold** content
  - Nested item one level deep
  - Another nested item
- Third item at the top level

1. Install dependencies with \`bun install\`
2. Run the development server
3. Open your browser and navigate to the local port
4. Edit any source file — hot reload kicks in automatically

## Section 3 — Code Block

\`\`\`typescript
import { renderMarkdown } from 'marknative'
import { writeFileSync } from 'node:fs'

const pages = await renderMarkdown(longMarkdownDocument)

for (const [i, page] of pages.entries()) {
  writeFileSync(\`page-\${i + 1}.png\`, page.data)
}

console.log(\`Rendered \${pages.length} page(s)\`)
\`\`\`

## Section 4 — Table

| Feature | marknative | Browser-based |
| :--- | :---: | :---: |
| Server-side rendering | ✓ | ✗ |
| Deterministic output | ✓ | ✗ |
| No browser required | ✓ | ✗ |
| Fast batch rendering | ✓ | slow |

## Section 5 — Blockquote

> Long documents paginate automatically. Each page corresponds to one output image.
> Fragments that are too tall to fit on a remaining page are moved to the next page.

---

*Page 1 of a multi-page render.*
`

// ─── Paginated rendering (show page 1 and 2) ────────────────────────────────

const paginatedPages = await png(LONG_MD)
await save('paginated-p1', paginatedPages[0]!)
if (paginatedPages[1]) await save('paginated-p2', paginatedPages[1])

// ─── Single-page rendering ───────────────────────────────────────────────────

const [singleBuf] = await png(LONG_MD, { singlePage: true })
await save('single-page', singleBuf!)

// ─── Custom page width (narrow) ─────────────────────────────────────────────

const narrowTheme = mergeTheme(
  (await import('../src')).defaultTheme,
  { page: { width: 480 } },
)

const [narrowBuf] = await png(
  `# Custom Page Width

This page uses a **480 px** width instead of the default 1080 px.

The layout engine adapts — text wraps earlier, code blocks reflow,
and all block widths are recalculated automatically.

- Line breaking adapts to the narrower column
- Images scale down to fit the available width
- Tables reflow within the reduced content area
`,
  { theme: narrowTheme },
)
await save('custom-width', narrowBuf!)

// ─── Custom page size (tall / portrait) ─────────────────────────────────────

const tallTheme = mergeTheme(
  (await import('../src')).defaultTheme,
  { page: { width: 600, height: 1200 } },
)

const [tallBuf] = await png(
  `# Custom Page Height

This page uses a **600 × 1200 px** size — taller than the default portrait ratio.

More content fits on a single page when the page height is increased.
Pagination still works the same way — the engine simply has more vertical
space available before creating a new page.

## Benefits

- Fewer pages for the same content
- Better fit for long-form documents
- Matches custom card or poster formats
`,
  { theme: tallTheme },
)
await save('custom-height', tallBuf!)

// ─── Math rendering ──────────────────────────────────────────────────────────

const [mathBuf] = await png(
  `# Math Rendering

Block formula:

$$
\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi ix\\xi}\\,dx
$$

$$
D_{\\mathrm{KL}}(P\\|Q) = \\int p(x)\\log\\frac{p(x)}{q(x)}\\,dx
$$

The KL divergence $D_{\\mathrm{KL}}(P\\|Q) \\geq 0$ (Gibbs' inequality).
Gradient: $\\nabla f = \\left(\\frac{\\partial f}{\\partial x_1}, \\ldots, \\frac{\\partial f}{\\partial x_n}\\right)$.

Mixed with code:

\`\`\`python
import numpy as np
def dft(x):
    N, n = len(x), np.arange(len(x))
    return np.exp(-2j * np.pi * n.reshape(N,1) * n / N) @ x
\`\`\`

Complexity: $O(N^2)$ naïve, $O(N\\log N)$ FFT.
`,
  { singlePage: true },
)
await save('math', mathBuf!)

// ─── PNG scale 1 vs 2 ────────────────────────────────────────────────────────

const SCALE_MD = `# PNG Resolution

The \`scale\` option controls pixel density for PNG output.

- \`scale: 1\` — 1080 × 1440 px, ~29 ms/page
- \`scale: 2\` — 2160 × 2880 px, ~99 ms/page (default)
- \`scale: 3\` — 3240 × 4320 px, ~214 ms/page

Use \`scale: 1\` for fast previews; \`scale: 2\` for retina output.
`

const [scale1Buf] = await png(SCALE_MD, { scale: 1, singlePage: true })
await save('scale-1', scale1Buf!)

const [scale2Buf] = await png(SCALE_MD, { scale: 2, singlePage: true })
await save('scale-2', scale2Buf!)

// ─── Code highlighting: light and dark ───────────────────────────────────────

const CODE_MD = `# Syntax Highlighting

\`\`\`typescript
import { renderMarkdown } from 'marknative'

const pages = await renderMarkdown(markdown, { theme: 'dark' })

for (const [i, page] of pages.entries()) {
  writeFileSync(\`page-\${i + 1}.png\`, page.data)
}
\`\`\`

\`\`\`python
import numpy as np

def create_matrix(n: int) -> np.ndarray:
    return np.array([[1 / (i + j + 1) for j in range(n)] for i in range(n)])
\`\`\`
`

const [codeLightBuf] = await png(CODE_MD, { singlePage: true })
await save('code-light', codeLightBuf!)

const [codeDarkBuf] = await png(CODE_MD, { theme: 'dark', singlePage: true })
await save('code-dark', codeDarkBuf!)

console.log('✓ all feature examples generated')
