# Themes

All ten built-in themes rendered with the same fixture. Use any name as the `theme` option in `renderMarkdown`.

## default

Clean white — the baseline theme.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown)
// or explicitly:
const pages = await renderMarkdown(markdown, { theme: 'default' })
```
== Rendered
![default theme](/examples/themes/theme-default.png)
:::

## github

GitHub Primer — crisp white with GitHub's blue links and green checkboxes.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'github' })
```
== Rendered
![github theme](/examples/themes/theme-github.png)
:::

## solarized

Ethan Schoonover's Solarized Light — warm cream background, carefully balanced muted tones.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'solarized' })
```
== Rendered
![solarized theme](/examples/themes/theme-solarized.png)
:::

## sepia

Warm aged-paper amber tones with dark-brown ink.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'sepia' })
```
== Rendered
![sepia theme](/examples/themes/theme-sepia.png)
:::

## rose

Soft blush and petal-pink with a subtle top-to-bottom gradient.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'rose' })
```
== Rendered
![rose theme](/examples/themes/theme-rose.png)
:::

## dark

Catppuccin Mocha — rich purple-navy with pastel accents.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'dark' })
```
== Rendered
![dark theme](/examples/themes/theme-dark.png)
:::

## nord

Nord — arctic cool blues, cold and serene.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'nord' })
```
== Rendered
![nord theme](/examples/themes/theme-nord.png)
:::

## dracula

Dracula — near-black background with vivid purple / cyan / green accents and a subtle dark-purple gradient.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'dracula' })
```
== Rendered
![dracula theme](/examples/themes/theme-dracula.png)
:::

## ocean

Deep ocean — midnight navy with aqua accents and a radial centre-glow.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'ocean' })
```
== Rendered
![ocean theme](/examples/themes/theme-ocean.png)
:::

## forest

Dark forest — deep canopy greens with sage text and bright leaf-green accents.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, { theme: 'forest' })
```
== Rendered
![forest theme](/examples/themes/theme-forest.png)
:::

---

## Custom Colors

Override individual color tokens by passing a `ThemeOverrides` object. Unspecified tokens fall back to `defaultTheme`.

:::tabs
== Code
```ts
const pages = await renderMarkdown(markdown, {
  theme: {
    colors: {
      background: '#1a1a2e',
      text: '#e0e0ff',
      link: '#a78bfa',
      codeBackground: '#16163a',
      quoteBackground: '#12122e',
      quoteBorder: '#a78bfa',
      // …other tokens
    },
  },
})
```
== Rendered
![custom colors theme](/examples/themes/theme-custom-colors.png)
:::

## Gradient Background

Set `colors.backgroundGradient` to use a linear or radial gradient fill.

:::tabs
== Code
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
    link: '#c084fc',
    // …other tokens
  },
})

const pages = await renderMarkdown(markdown, { theme })
```
== Rendered
![gradient theme](/examples/themes/theme-gradient.png)
:::
