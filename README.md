<p align="center">
  <img src="./logo.png" alt="marknative" width="480" />
</p>

**A native Markdown rendering engine that produces paginated PNG/SVG documents — no browser, no Chromium, no DOM.**

📖 **[Documentation](https://liyown.github.io/marknative/)** — Guide · Showcase · API Reference

Most Markdown rendering pipelines go through a browser:

```
Markdown → HTML → DOM/CSS → browser layout → screenshot
```

`marknative` takes a different path. It parses Markdown directly into a typed document model, runs its own block and inline layout engine, paginates the result into fixed-size pages, and paints each page using a native 2D canvas API.

The result is deterministic, server-renderable, and completely headless.

---

## Gallery

<table>
  <tr>
    <td width="25%"><img src="https://oss.liuyaowen.cn/images/full-syntax-01.png" alt="Headings" /></td>
    <td width="25%"><img src="https://oss.liuyaowen.cn/images/full-syntax-02.png" alt="Inline styles and lists" /></td>
    <td width="25%"><img src="https://oss.liuyaowen.cn/images/full-syntax-03.png" alt="Ordered lists and task lists" /></td>
    <td width="25%"><img src="https://oss.liuyaowen.cn/images/full-syntax-04.png" alt="Blockquotes" /></td>
  </tr>
  <tr>
    <td width="25%"><img src="https://oss.liuyaowen.cn/images/full-syntax-05.png" alt="Code blocks" /></td>
    <td width="25%"><img src="https://oss.liuyaowen.cn/images/full-syntax-06.png" alt="Tables" /></td>
    <td width="25%"><img src="https://oss.liuyaowen.cn/images/full-syntax-07.png" alt="Tables and thematic breaks" /></td>
    <td width="25%"><img src="https://oss.liuyaowen.cn/images/api-doc-01.png" alt="API documentation" /></td>
  </tr>
</table>

---

## Why

| Requirement | Browser-based | marknative |
| --- | :---: | :---: |
| Runs on the server without a browser | ✗ | ✓ |
| Deterministic page breaks across runs | ✗ | ✓ |
| Direct PNG / SVG output | ✗ | ✓ |
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
    format?: 'png' | 'svg'   // default: 'png'
    painter?: Painter         // override the paint backend
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

The built-in theme object. Page size is 1080 × 1440 px (portrait card ratio). Font sizes, line heights, margins, and block spacing are all defined here.

```ts
import { defaultTheme } from 'marknative'

console.log(defaultTheme.page)
// { width: 1080, height: 1440, margin: { top: 80, right: 72, bottom: 80, left: 72 } }
```

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

---

## Tech Stack

| Layer | Library |
| --- | --- |
| Markdown parsing | [`micromark`](https://github.com/micromark/micromark) + [`mdast-util-from-markdown`](https://github.com/syntax-tree/mdast-util-from-markdown) |
| GFM extensions | [`micromark-extension-gfm`](https://github.com/micromark/micromark-extension-gfm) + [`mdast-util-gfm`](https://github.com/syntax-tree/mdast-util-gfm) |
| Text shaping | [`@chenglou/pretext`](https://github.com/chenglou/pretext) |
| 2D rendering | [`skia-canvas`](https://github.com/samizdatco/skia-canvas) |
| Language | TypeScript |

---

## Roadmap

- [ ] Improve paragraph line-breaking quality for English prose
- [ ] Refine CJK and mixed Chinese-English line-breaking rules
- [ ] Improve code block and table rendering quality
- [ ] Expose public theme and page configuration API
- [ ] Support custom fonts
- [ ] Complete GFM coverage (footnotes, autolinks)

---

## License

MIT & Linux Do
