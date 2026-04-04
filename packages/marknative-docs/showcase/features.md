# Features

Rendered examples for each marknative feature. Each section shows the API usage and the actual output.

## Paginated Rendering

Long documents are automatically split into multiple fixed-height pages. Each page is a separate PNG image.

:::tabs
== Code
```ts
import { renderMarkdown } from 'marknative'
import { writeFileSync } from 'node:fs'

const pages = await renderMarkdown(longDocument)

console.log(`Rendered ${pages.length} page(s)`)

for (const [i, page] of pages.entries()) {
  writeFileSync(`page-${i + 1}.png`, page.data)
}
```
== Page 1
![Paginated rendering — page 1](/examples/features/paginated-p1.png)
== Page 2
![Paginated rendering — page 2](/examples/features/paginated-p2.png)
:::

## Single-Page Mode

Render the entire document into one image whose height adapts to the content. Capped at 16 384 px.

:::tabs
== Code
```ts
import { renderMarkdown } from 'marknative'
import { writeFileSync } from 'node:fs'

const [page] = await renderMarkdown(document, {
  singlePage: true,
})

writeFileSync('output.png', page.data)
```
== Rendered
![Single-page mode output](/examples/features/single-page.png)
:::

## Custom Page Width

Override the default 1080 px page width using the `theme` option. The layout engine recalculates all block widths and line breaks automatically.

:::tabs
== Code
```ts
import { renderMarkdown, mergeTheme, defaultTheme } from 'marknative'

const theme = mergeTheme(defaultTheme, {
  page: { width: 480 },
})

const pages = await renderMarkdown(document, { theme })
```
== Rendered
![Custom page width output](/examples/features/custom-width.png)
:::

## Custom Page Height

Change the page height to fit more content per page — useful for tall card or poster formats.

:::tabs
== Code
```ts
import { renderMarkdown, mergeTheme, defaultTheme } from 'marknative'

const theme = mergeTheme(defaultTheme, {
  page: { width: 600, height: 1200 },
})

const pages = await renderMarkdown(document, { theme })
```
== Rendered
![Custom page height output](/examples/features/custom-height.png)
:::

## Math Rendering

Block and inline LaTeX formulas rendered server-side via MathJax — no browser required. Formula colors follow the active theme automatically.

:::tabs
== Code
```ts
import { renderMarkdown } from 'marknative'

const pages = await renderMarkdown(`
## Fourier Transform

$$
\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi ix\\xi}\\,dx
$$

The KL divergence $D_{\\mathrm{KL}}(P\\|Q) = \\int p(x)\\log\\frac{p(x)}{q(x)}\\,dx$
measures how one distribution differs from another.
`)
```
== Rendered
![Math rendering output](/examples/features/math.png)
:::

See the [Math guide](/guide/math) for block math, inline math, mixed content, and theme integration.

## PNG Resolution (`scale`)

The `scale` option controls the pixel density of PNG output. Higher values produce sharper images at the cost of longer encode times.

:::tabs
== Code
```ts
import { renderMarkdown } from 'marknative'

// Fast preview (~29 ms/page)
const draft = await renderMarkdown(markdown, { scale: 1 })

// Default retina output (~99 ms/page)
const retina = await renderMarkdown(markdown)          // scale: 2 implicit

// Print quality (~214 ms/page)
const print = await renderMarkdown(markdown, { scale: 3 })
```
== scale 1
![scale 1 output](/examples/features/scale-1.png)
== scale 2 (default)
![scale 2 output](/examples/features/scale-2.png)
:::

SVG output (`format: 'svg'`) is unaffected by `scale` and renders in ~6 ms regardless. See [Performance](/guide/performance) for full benchmarks.

## Syntax Highlighting

Fenced code blocks are highlighted server-side with [Shiki](https://shiki.style/). The Shiki theme is auto-selected from the page background luminance, so dark marknative themes automatically get a matching dark code theme.

:::tabs
== Code
```ts
import { renderMarkdown } from 'marknative'

// Auto-detected: light page → github-light
const light = await renderMarkdown(codeDocument)

// Auto-detected: dark page → github-dark
const dark = await renderMarkdown(codeDocument, { theme: 'dark' })

// Override explicitly
const custom = await renderMarkdown(codeDocument, {
  theme: 'nord',
  codeHighlighting: { theme: 'one-dark-pro' },
})
```
== Light (auto)
![Code highlighting light](/examples/features/code-light.png)
== Dark (auto)
![Code highlighting dark](/examples/features/code-dark.png)
:::

## Themes

marknative ships with 10 built-in themes and a full theme customization API. See the [Themes showcase](/showcase/themes) for all themes and the [Themes guide](/guide/themes) for the complete reference.

:::tabs
== Code
```ts
// Built-in theme by name
const pages = await renderMarkdown(markdown, { theme: 'dark' })
const pages = await renderMarkdown(markdown, { theme: 'nord' })

// Partial color override
const pages = await renderMarkdown(markdown, {
  theme: { colors: { background: '#1e1e2e', text: '#cdd6f4' } },
})

// Gradient background
import { mergeTheme, defaultTheme } from 'marknative'
const theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#0d1b2a',
    backgroundGradient: {
      type: 'radial',
      stops: [
        { offset: 0, color: '#0d2540' },
        { offset: 1, color: '#060e18' },
      ],
    },
    text: '#b8d4e8',
  },
})
```
== dark
![dark theme](/examples/themes/theme-dark.png)
== nord
![nord theme](/examples/themes/theme-nord.png)
== ocean
![ocean theme](/examples/themes/theme-ocean.png)
:::
