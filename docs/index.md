---
layout: home

hero:
  name: marknative
  text: Markdown → PNG / SVG
  tagline: Native rendering engine. No browser. No Chromium. No DOM. Deterministic, headless, fast.
  image:
    src: /logo.png
    alt: marknative
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/reference

features:
  - icon: 🖥️
    title: Truly Headless
    details: Runs anywhere Node.js (≥ 18) runs — servers, CI, edge functions. No browser or Puppeteer required.
  - icon: 📐
    title: Deterministic Layout
    details: Same Markdown always produces pixel-identical output across machines and runs.
  - icon: ⚡
    title: Fast at Scale
    details: Batch-render hundreds of pages per second. Lightweight enough to embed in any service.
  - icon: 📄
    title: Pagination Built-in
    details: Automatically paginates content into fixed-size pages, or outputs everything in a single image.
  - icon: 🖼️
    title: Image Support
    details: Fetch and render remote images (HTTP/HTTPS) and local files in block-level image nodes.
  - icon: 🔤
    title: CommonMark + GFM
    details: Full support for standard Markdown plus GitHub Flavored extensions — tables, task lists, strikethrough.
---

## Quick Start

```bash
npm install marknative
```

```ts
import { renderMarkdown } from 'marknative'
import { writeFileSync } from 'node:fs'

const pages = await renderMarkdown(`
# Hello, marknative

Produces **paginated PNG pages** without a browser.
`)

for (const [i, page] of pages.entries()) {
  writeFileSync(`page-${i + 1}.png`, page.data)
}
```
