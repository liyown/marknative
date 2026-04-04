<p align="center">
  <img src="./logo.png" alt="marknative" width="480" />
</p>

**A native Markdown rendering engine that produces paginated PNG/SVG documents — no browser, no Chromium, no DOM.**

Supports CommonMark, GFM (tables, task lists, strikethrough), syntax-highlighted code blocks (Shiki), and LaTeX math formulas (MathJax) — all rendered server-side.

📖 **[Documentation](https://liyown.github.io/marknative/)** — Guide · Showcase · API Reference

Most Markdown rendering pipelines go through a browser:

```
Markdown → HTML → DOM/CSS → browser layout → screenshot
```

`marknative` takes a different path. It parses Markdown directly into a typed document model, runs its own block and inline layout engine, paginates the result into fixed-size pages, and paints each page using a native 2D canvas API.

The result is deterministic, server-renderable, and completely headless.

---

## Gallery

Math formulas (MathJax block + inline) mixed with syntax-highlighted code:

<p align="center">
  <img src="https://liyown.github.io/marknative/examples/features/math.png" alt="Math rendering example" width="60%" />
</p>

Full syntax fixture, rendered across 10 pages with syntax-highlighted fenced code blocks:

<table>
  <tr>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-01.png" alt="Full syntax fixture page 1" /></td>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-02.png" alt="Full syntax fixture page 2" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-03.png" alt="Full syntax fixture page 3" /></td>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-04.png" alt="Full syntax fixture page 4" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-05.png" alt="Full syntax fixture page 5" /></td>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-06.png" alt="Full syntax fixture page 6" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-07.png" alt="Full syntax fixture page 7" /></td>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-08.png" alt="Full syntax fixture page 8" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-09.png" alt="Full syntax fixture page 9" /></td>
    <td width="50%"><img src="https://liyown.github.io/marknative/examples/full-syntax/full-syntax-10.png" alt="Full syntax fixture page 10" /></td>
  </tr>
</table>

---

## Why

| Requirement | Browser-based | marknative |
| --- | :---: | :---: |
| Runs on the server without a browser | ✗ | ✓ |
| Deterministic page breaks across runs | ✗ | ✓ |
| Direct PNG / SVG output | ✗ | ✓ |
| LaTeX math formulas (server-side MathJax) | ✗ | ✓ |
| Syntax-highlighted code blocks (Shiki) | ✗ | ✓ |
| Batch rendering at scale | slow | fast |
| Embeddable as a library | heavy | lightweight |

---

## Installation

```bash
bun add marknative
# or
npm install marknative
```

> **Peer dependency**: `marknative` uses [`skia-canvas`](https://github.com/samizdatco/skia-canvas) as its paint backend. It ships prebuilt native binaries for macOS, Linux, and Windows — no additional setup is needed in most environments.

---

## Quick Start

```ts
import { renderMarkdown } from 'marknative'

const pages = await renderMarkdown(`
# Hello, marknative

A native Markdown rendering engine that produces **paginated PNG pages**
without a browser.

- CommonMark + GFM support
- Deterministic layout and pagination
- PNG and SVG output
`)

console.log(`Rendered ${pages.length} page(s)`)

for (const [i, page] of pages.entries()) {
  // page.format === 'png'
  // page.data   === Buffer
  await Bun.write(`page-${i + 1}.png`, page.data)
}
```

---

## API

### `renderMarkdown(markdown, options?)`

Parses, lays out, paginates, and paints a Markdown document. Returns one output entry per page.

```ts
function renderMarkdown(
  markdown: string,
  options?: {
    format?: 'png' | 'svg'                      // default: 'png'
    singlePage?: boolean                         // render into one image instead of paginating
    theme?: BuiltInThemeName | ThemeOverrides    // default: defaultTheme
    scale?: number                               // PNG pixel density multiplier — default: 2 (retina)
    painter?: Painter                            // override the paint backend
    codeHighlighting?: {
      theme?: string                             // Shiki theme — auto-detected from page background
    }
  },
): Promise<RenderPage[]>
```

**Return type:**

```ts
type RenderPage =
  | { format: 'png'; data: Buffer;  page: PaintPage }
  | { format: 'svg'; data: string;  page: PaintPage }
```

Each entry carries both the raw output (`data`) and the fully resolved page layout (`page`) so you can inspect fragment positions without re-rendering.

---

### `parseMarkdown(markdown)`

Parses Markdown source into `marknative`'s internal document model without running layout or paint. Useful for inspecting document structure or building custom renderers.

```ts
function parseMarkdown(markdown: string): MarkdownDocument
```

---

### `defaultTheme`

The built-in default theme. Page size is 1080 × 1440 px (portrait card ratio). Font sizes, line heights, margins, and block spacing are all defined here.

```ts
import { defaultTheme } from 'marknative'

console.log(defaultTheme.page)
// { width: 1080, height: 1440, margin: { top: 80, right: 72, bottom: 80, left: 72 } }
```

---

### Theme System

marknative ships with 10 built-in themes and a full theme customization API.

**Built-in themes** — pass a name string as the `theme` option:

```ts
// 'default' | 'github' | 'solarized' | 'sepia' | 'rose'
// 'dark' | 'nord' | 'dracula' | 'ocean' | 'forest'
const pages = await renderMarkdown(markdown, { theme: 'dark' })
const pages = await renderMarkdown(markdown, { theme: 'nord' })
```

**Partial overrides** — merged onto `defaultTheme`:

```ts
const pages = await renderMarkdown(markdown, {
  theme: {
    colors: { background: '#1e1e2e', text: '#cdd6f4' },
    page: { width: 800 },
  },
})
```

**Full control with `mergeTheme`**:

```ts
import { mergeTheme, getBuiltInTheme } from 'marknative'

const myTheme = mergeTheme(getBuiltInTheme('nord'), {
  colors: { link: '#ff6b6b' },
})

const pages = await renderMarkdown(markdown, { theme: myTheme })
```

**Gradient backgrounds**:

```ts
import { mergeTheme, defaultTheme } from 'marknative'

const theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#0f0c29',
    backgroundGradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 0,   color: '#24243e' },
        { offset: 0.5, color: '#302b63' },
        { offset: 1,   color: '#0f0c29' },
      ],
    },
    text: '#e8e0ff',
  },
})
```

See the [Themes guide](https://liyown.github.io/marknative/guide/themes) and [Themes showcase](https://liyown.github.io/marknative/showcase/themes) for the full reference.

---

## Performance

Benchmarks run on Apple M-series (warm, singletons already initialised). Run `bun bench/perf.ts` to reproduce.

### Throughput by document type — PNG 2× (default)

| Document type | mean | p50 | p90 |
| --- | ---: | ---: | ---: |
| Plain text (prose + lists + blockquotes) | 116 ms | 115 ms | 120 ms |
| Code-heavy (3 languages, shiki) | 101 ms | 101 ms | 104 ms |
| Math-heavy (4 block + 3 inline formulas) | 100 ms | 99 ms | 103 ms |
| Mixed (math + code) | 98 ms | 97 ms | 100 ms |

### Output format — mixed doc

| Format | mean | p50 | p90 | note |
| --- | ---: | ---: | ---: | --- |
| SVG | 5.6 ms | 5.6 ms | 6.5 ms | layout + serialize only |
| PNG 2× | 99 ms | 98 ms | 102 ms | full rasterize + encode |

SVG is ~17× faster than PNG. `canvas.toBuffer('png')` (pure CPU PNG compression) accounts for **94% of PNG render time**; all parsing, layout, and drawing are <8 ms/page.

### Scale factor — mixed doc, PNG only

| Scale | Resolution | mean |
| --- | --- | ---: |
| 1 | 1080 × ~650 (0.7 MP) | 29 ms |
| 1.5 | 1620 × ~975 (1.6 MP) | 58 ms |
| **2** (default) | **2160 × ~1300 (2.8 MP)** | **99 ms** |
| 3 | 3240 × ~1950 (6.3 MP) | 214 ms |

PNG encode time scales linearly with pixel count. Use `scale: 1` for previews, `scale: 2` for retina output.

### Concurrency — plain doc, PNG 2×

| Mode | mean per batch |
| --- | ---: |
| 1× sequential | 118 ms |
| 2× parallel | 127 ms |
| 4× parallel | 192 ms |
| 8× parallel | 363 ms |

Parallel renders share CPU resources; throughput scales near-linearly up to core count.

---

## Rendering Pipeline

```
Markdown source
  │
  ▼
CommonMark + GFM AST          (micromark, mdast-util-from-markdown)
  │
  ▼
MarkdownDocument               internal typed document model
  │
  ▼
BlockLayoutFragment[]          block + inline layout engine
  │
  ▼
Page[]                         paginator — slices fragments into fixed-height pages
  │
  ▼
PNG Buffer / SVG string        skia-canvas paint backend
```

Each stage is independently testable. The layout engine has no dependency on the paint backend, and the paint backend accepts a plain data structure — it does not re-run layout.

---

## Supported Syntax

### CommonMark

| Element | Support |
| --- | :---: |
| Headings (H1–H6) | ✓ |
| Paragraphs | ✓ |
| **Bold**, *italic*, ***bold italic*** | ✓ |
| `Inline code` | ✓ |
| [Links](https://commonmark.org) | ✓ |
| Fenced code blocks | ✓ |
| Blockquotes (nested) | ✓ |
| Ordered lists | ✓ |
| Unordered lists (nested) | ✓ |
| Images (block + inline) | ✓ |
| Thematic breaks | ✓ |
| Hard line breaks | ✓ |

### GFM Extensions

| Element | Support |
| --- | :---: |
| Tables (with alignment) | ✓ |
| Task lists | ✓ |
| ~~Strikethrough~~ | ✓ |

### Math (LaTeX via MathJax)

| Element | Support |
| --- | :---: |
| Block formulas `$$...$$` | ✓ |
| Inline formulas `$...$` | ✓ |
| Math in blockquotes / lists / tables | ✓ |
| AMSmath, boldsymbol, mathtools | ✓ |

---

## Recipes

### Save all pages as PNG files

```ts
import { renderMarkdown } from 'marknative'
import { writeFile } from 'node:fs/promises'

const markdown = await Bun.file('article.md').text()
const pages = await renderMarkdown(markdown)

await Promise.all(
  pages.map((page, i) =>
    writeFile(`out/page-${String(i + 1).padStart(2, '0')}.png`, page.data)
  )
)
```

### Serve rendered pages over HTTP with Bun

```ts
import { renderMarkdown } from 'marknative'

Bun.serve({
  routes: {
    '/render': {
      async POST(req) {
        const { markdown } = await req.json()
        const pages = await renderMarkdown(markdown, { format: 'png' })
        const first = pages[0]

        if (!first || first.format !== 'png') {
          return new Response('no output', { status: 500 })
        }

        return new Response(first.data, {
          headers: { 'Content-Type': 'image/png' },
        })
      },
    },
  },
})
```

### Export as SVG

```ts
const pages = await renderMarkdown(markdown, { format: 'svg' })

for (const page of pages) {
  if (page.format === 'svg') {
    console.log(page.data) // inline SVG string
  }
}
```

### Math formulas

Block and inline LaTeX — rendered server-side via MathJax, no browser required. Formula colors follow the active theme automatically.

```ts
const pages = await renderMarkdown(`
## Fourier Transform

$$
\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi ix\\xi}\\,dx
$$

The gradient $\\nabla f$ points in the direction of steepest ascent.
Entropy: $H(X) = -\\sum p \\log p$.

\`\`\`python
import numpy as np
def dft(x):
    N, n = len(x), np.arange(len(x))
    return np.exp(-2j * np.pi * n.reshape(N,1) * n / N) @ x
\`\`\`

Complexity: $O(N^2)$ naïve, $O(N\\log N)$ with FFT.
`)
```

MathJax is initialised lazily on first use (~180 ms cold start). All subsequent renders reuse the singleton and cached SVGs — warm overhead is < 2 ms.

See the [Math guide](https://liyown.github.io/marknative/guide/math) for the full reference.

### Syntax highlighting for code blocks

```ts
// Auto-detected from page background (light → github-light, dark → github-dark)
const pages = await renderMarkdown(markdown)
const pages = await renderMarkdown(markdown, { theme: 'dark' })   // uses github-dark automatically

// Override the Shiki theme explicitly
const pages = await renderMarkdown(markdown, {
  codeHighlighting: { theme: 'nord' },
})
```

The Shiki theme is auto-selected based on the WCAG relative luminance of the page background — dark page themes automatically get a dark code theme. Code blocks without a language tag fall back to plain monochrome text.

### Control PNG resolution with `scale`

```ts
const pages = await renderMarkdown(markdown, { scale: 1 })   // ~29 ms/page — fast preview
const pages = await renderMarkdown(markdown, { scale: 2 })   // ~99 ms/page — retina (default)
const pages = await renderMarkdown(markdown, { scale: 3 })   // ~214 ms/page — print quality
```

---

## Tech Stack

| Layer | Library |
| --- | --- |
| Markdown parsing | [`micromark`](https://github.com/micromark/micromark) + [`mdast-util-from-markdown`](https://github.com/syntax-tree/mdast-util-from-markdown) |
| GFM extensions | [`micromark-extension-gfm`](https://github.com/micromark/micromark-extension-gfm) + [`mdast-util-gfm`](https://github.com/syntax-tree/mdast-util-gfm) |
| Math rendering | [`mathjax-full`](https://github.com/mathjax/MathJax-src) (server-side SVG, liteAdaptor) |
| Syntax highlighting | [`shiki`](https://shiki.style/) |
| Text shaping | [`@chenglou/pretext`](https://github.com/chenglou/pretext) |
| 2D rendering | [`skia-canvas`](https://github.com/samizdatco/skia-canvas) |
| Language | TypeScript |

---

## Roadmap

- [ ] Improve paragraph line-breaking quality for English prose
- [ ] Refine CJK and mixed Chinese-English line-breaking rules
- [x] Syntax highlighting for code blocks (Shiki, all themes, auto-detected from theme)
- [x] LaTeX math rendering (MathJax, block + inline, all block types)
- [x] Expose public theme and page configuration API
- [x] PNG resolution control (`scale` option)
- [ ] Support custom fonts
- [ ] Complete GFM coverage (footnotes, autolinks)

---

## License

MIT & Linux Do
