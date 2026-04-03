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
