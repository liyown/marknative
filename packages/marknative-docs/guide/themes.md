# Themes

marknative ships with a full theme system. Every visual property — colors, typography, spacing, page size, and background gradients — is controlled by a `Theme` object that you can override entirely or partially.

## Quick Start

Pass a built-in theme name or a partial override object as the `theme` option:

```ts
import { renderMarkdown } from 'marknative'

// Built-in theme by name
const pages = await renderMarkdown(markdown, { theme: 'dark' })

// Partial override merged onto defaultTheme
const pages = await renderMarkdown(markdown, {
  theme: { colors: { background: '#1a1a2e', text: '#e0e0ff' } },
})
```

---

## Built-in Themes

Ten themes are included. Pass their name as a string to `theme`:

| Name | Style | Description |
| :--- | :---: | :--- |
| `'default'` | Light | Clean white — the baseline |
| `'github'` | Light | GitHub Primer — crisp, familiar |
| `'solarized'` | Light | Ethan Schoonover's Solarized Light |
| `'sepia'` | Light | Warm aged-paper amber tones |
| `'rose'` | Light | Soft blush and petal-pink gradient |
| `'dark'` | Dark | Catppuccin Mocha — popular purple-navy |
| `'nord'` | Dark | Nord — arctic cool blues |
| `'dracula'` | Dark | Dracula — purple-black with vivid accents |
| `'ocean'` | Dark | Deep ocean with radial centre-glow |
| `'forest'` | Dark | Deep canopy greens |

```ts
// Any of the ten names work
const pages = await renderMarkdown(markdown, { theme: 'nord' })
const pages = await renderMarkdown(markdown, { theme: 'sepia' })
```

You can enumerate all names at runtime:

```ts
import { BUILT_IN_THEME_NAMES, isBuiltInThemeName } from 'marknative'

console.log(BUILT_IN_THEME_NAMES)
// ['default', 'github', 'solarized', 'sepia', 'rose', 'dark', 'nord', 'dracula', 'ocean', 'forest']

isBuiltInThemeName('dark')   // true
isBuiltInThemeName('custom') // false
```

---

## Partial Overrides

Pass a `ThemeOverrides` object to customise individual values. Every field is optional and is merged onto `defaultTheme`:

```ts
// Override just two color tokens
const pages = await renderMarkdown(markdown, {
  theme: {
    colors: {
      background: '#0d1117',
      text: '#e6edf3',
    },
  },
})

// Override page size and body font together
const pages = await renderMarkdown(markdown, {
  theme: {
    page: { width: 800, height: 1000 },
    typography: { body: { font: '24px serif', lineHeight: 36 } },
  },
})
```

---

## `mergeTheme` — Compose from a Base

Use `mergeTheme` when you want to start from a built-in theme rather than `defaultTheme`, or when you want to reuse a theme object across multiple renders:

```ts
import { mergeTheme, getBuiltInTheme, renderMarkdown } from 'marknative'

// Extend a built-in theme
const myTheme = mergeTheme(getBuiltInTheme('nord'), {
  colors: { link: '#ff6b6b' },
})

const pages = await renderMarkdown(markdown, { theme: myTheme })
```

`mergeTheme` performs a **shallow merge at each nested level** — you only need to supply the keys you want to change:

```ts
import { mergeTheme, defaultTheme } from 'marknative'

const compactTheme = mergeTheme(defaultTheme, {
  page: {
    width: 720,
    height: 960,
    margin: { top: 48, right: 48, bottom: 48, left: 48 },
  },
  typography: {
    h1: { font: 'bold 40px sans-serif', lineHeight: 56 },
    body: { font: '22px sans-serif', lineHeight: 34 },
  },
  blocks: {
    paragraph: { marginBottom: 16 },
    heading: { marginTop: 28, marginBottom: 8 },
  },
})
```

---

## Color Tokens

The `colors` object controls every color used during painting:

| Token | Used for |
| :--- | :--- |
| `background` | Page fill (solid fallback) |
| `backgroundGradient` | Optional gradient fill (overrides `background`) |
| `text` | Body text, list markers |
| `link` | Link text and underline |
| `mutedText` | Strikethrough, image placeholder labels |
| `border` | Table cell borders, thematic break |
| `subtleBorder` | Code block outline |
| `codeBackground` | Code block fill, inline code fill |
| `quoteBackground` | Blockquote panel fill |
| `quoteBorder` | Blockquote left accent bar |
| `imageBackground` | Image placeholder fill |
| `imageAccent` | Image placeholder border |
| `checkboxChecked` | Checked task checkbox fill |
| `checkboxCheckedMark` | Checkmark stroke |
| `checkboxUnchecked` | Unchecked task checkbox border |
| `tableHeaderBackground` | Table header row fill (defaults to `codeBackground`) |

---

## Gradient Backgrounds

Set `colors.backgroundGradient` to replace the solid `background` with a linear or radial gradient:

### Linear gradient

```ts
const pages = await renderMarkdown(markdown, {
  theme: {
    colors: {
      background: '#667eea', // fallback
      backgroundGradient: {
        type: 'linear',
        angle: 135, // 0 = top→bottom, 90 = left→right
        stops: [
          { offset: 0, color: '#667eea' },
          { offset: 1, color: '#764ba2' },
        ],
      },
      text: '#ffffff',
      // … other tokens
    },
  },
})
```

### Radial gradient

```ts
backgroundGradient: {
  type: 'radial', // radiates from the page centre outward
  stops: [
    { offset: 0, color: '#0d2540' }, // centre
    { offset: 1, color: '#060e18' }, // edge
  ],
}
```

Multi-stop gradients are supported — add as many `{ offset, color }` pairs as needed.

---

## Typography

Override font strings and line heights for each text style:

```ts
const pages = await renderMarkdown(markdown, {
  theme: {
    typography: {
      h1:   { font: 'bold 48px Georgia, serif', lineHeight: 64 },
      h2:   { font: 'bold 34px Georgia, serif', lineHeight: 50 },
      h3:   { font: 'bold 26px Georgia, serif', lineHeight: 40 },
      h4:   { font: 'bold 22px Georgia, serif', lineHeight: 34 },
      body: { font: '20px Georgia, serif', lineHeight: 32 },
      code: { font: '18px "Courier New", monospace', lineHeight: 28 },
    },
  },
})
```

Heading levels map as follows:

| Heading | Default font | Default lineHeight |
| :--- | :--- | :---: |
| H1 | `bold 52px sans-serif` | 72 |
| H2 | `bold 38px sans-serif` | 54 |
| H3 | `bold 30px sans-serif` | 44 |
| H4 / H5 / H6 | `bold 26px sans-serif` | 38 |

---

## Page Size and Margins

```ts
const pages = await renderMarkdown(markdown, {
  theme: {
    page: {
      width: 1080,   // default
      height: 1440,  // default
      margin: { top: 80, right: 72, bottom: 80, left: 72 }, // default
    },
  },
})
```

The `width` also controls the default content column width — the layout engine subtracts the left and right margins from `width` to compute the available text area.
