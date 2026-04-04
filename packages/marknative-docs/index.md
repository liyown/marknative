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
      text: CLI Reference
      link: /guide/cli
    - theme: alt
      text: API Reference
      link: /api/reference

features:
  - icon: 🖥️
    title: Truly Headless
    details: Runs anywhere Node.js (≥ 18) or Bun runs — servers, CI, edge functions. No browser or Puppeteer required.
  - icon: 📐
    title: Deterministic Layout
    details: Same Markdown always produces pixel-identical output across machines and runs.
  - icon: ⚡
    title: Fast at Scale
    details: PNG at ~99 ms/page, SVG at ~6 ms/page. Batch hundreds of pages per second with parallel rendering.
  - icon: 🔢
    title: LaTeX Math
    details: Block and inline formulas rendered server-side via MathJax. Colors follow the active theme automatically.
  - icon: 🎨
    title: 10 Built-in Themes
    details: Light and dark themes including GitHub, Nord, Dracula, Solarized, and more. Full override API for custom themes and gradient backgrounds.
  - icon: ✨
    title: Syntax Highlighting
    details: Fenced code blocks highlighted by Shiki. Theme auto-detected from page background — dark pages get dark code themes.
  - icon: 📄
    title: Pagination Built-in
    details: Automatically paginates content into fixed-size pages, or renders everything into a single tall image.
  - icon: 🤖
    title: Agent-ready CLI
    details: JSON output mode makes the CLI easy to use from scripts and AI agents. Install the Claude Code skill for marknative-aware agents.
---

## Quick Start

::: code-group

```bash [CLI]
# Install globally
npm install -g marknative

# Render a file → page-01.png, page-02.png … next to the source
marknative README.md

# Dark theme, single image
marknative README.md -t dark --single-page -o preview.png

# JSON output for scripts / agents
marknative README.md --json
```

```ts [Node.js / Bun]
import { renderMarkdown } from 'marknative'

const pages = await renderMarkdown(`
# Hello, marknative

Produces **paginated PNG pages** without a browser.
`)

for (const [i, page] of pages.entries()) {
  await Bun.write(`page-${i + 1}.png`, page.data)
}
```

:::
