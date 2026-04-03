# API Reference

## `renderMarkdown`

```ts
function renderMarkdown(
  markdown: string,
  options?: RenderMarkdownOptions
): Promise<RenderPage[]>
```

Parses `markdown` and renders it into one or more pages.

### Parameters

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `markdown` | `string` | The Markdown source text to render |
| `options` | `RenderMarkdownOptions` | Optional render configuration |

### Returns

`Promise<RenderPage[]>` — an array of rendered pages, one entry per page.

### Example

```ts
import { renderMarkdown } from 'marknative'

const pages = await renderMarkdown('# Hello\n\nWorld.')

for (const page of pages) {
  if (page.format === 'png') {
    // page.data is a Buffer
  }
}
```

**Rendered output:**

![API overview rendered output](/examples/api-overview.png)

---

## `RenderMarkdownOptions`

```ts
type RenderMarkdownOptions = {
  format?: 'png' | 'svg'
  singlePage?: boolean
  theme?: BuiltInThemeName | ThemeOverrides
  painter?: Painter
  codeHighlighting?: {
    theme?: string  // Shiki theme name — default: 'github-light'
  }
}
```

### Properties

#### `format`

**Type:** `'png' | 'svg'`  
**Default:** `'png'`

Output format for each rendered page.

- `'png'` — raster PNG image; `page.data` is a `Buffer`
- `'svg'` — vector SVG; `page.data` is a `string`

#### `singlePage`

**Type:** `boolean`  
**Default:** `false`

When `true`, renders all content into a single image instead of paginating across multiple fixed-height pages. The image height adapts to the content and is capped at [`MAX_SINGLE_PAGE_HEIGHT`](#max_single_page_height).

#### `theme`

**Type:** `BuiltInThemeName | ThemeOverrides`  
**Default:** `defaultTheme`

Controls all visual properties. Accepts either:

- A [`BuiltInThemeName`](#builtinthemename) string such as `'dark'` or `'nord'`
- A [`ThemeOverrides`](#themeoverrides) object that is merged onto `defaultTheme`

```ts
// Built-in name
await renderMarkdown(md, { theme: 'dracula' })

// Partial override
await renderMarkdown(md, { theme: { colors: { background: '#000' } } })
```

#### `codeHighlighting`

**Type:** `{ theme?: string }`  
**Default:** `{ theme: 'github-light' }`

Controls syntax highlighting for fenced code blocks. Highlighting is powered by [Shiki](https://shiki.style/) and runs server-side before layout.

- `theme` — any Shiki-supported theme name (e.g. `'github-dark'`, `'nord'`, `'one-dark-pro'`, `'dracula'`). Defaults to `'github-light'`.
- Code blocks with an **unknown or missing language tag** fall back to plain monochrome text — no `codeToken` runs are produced.

```ts
// Default (github-light)
const pages = await renderMarkdown(md, { format: 'png' })

// Switch to a dark Shiki theme — combine with a dark marknative theme
const pages = await renderMarkdown(md, {
  format: 'png',
  theme: 'dark',
  codeHighlighting: { theme: 'github-dark' },
})

// Nord palette
const pages = await renderMarkdown(md, {
  codeHighlighting: { theme: 'nord' },
})
```

---

#### `painter`

**Type:** `Painter`  
**Default:** internal skia-canvas painter

Advanced: supply a custom paint backend. Intended for library integrators and testing.

---

## `RenderPage`

```ts
type RenderPage =
  | { format: 'png'; data: Buffer; page: PaintPage }
  | { format: 'svg'; data: string; page: PaintPage }
```

A discriminated union based on `format`.

### Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `format` | `'png' \| 'svg'` | The output format of this page |
| `data` | `Buffer \| string` | The rendered image data |
| `page` | `PaintPage` | Internal paint-layer page descriptor |

### Example

```ts
const pages = await renderMarkdown(markdown, { format: 'png' })

for (const [i, page] of pages.entries()) {
  if (page.format === 'png') {
    writeFileSync(`page-${i + 1}.png`, page.data)
  }
}
```

---

## `MAX_SINGLE_PAGE_HEIGHT`

```ts
const MAX_SINGLE_PAGE_HEIGHT: number // 16384
```

The maximum height (in CSS pixels) of a single-page render. Content beyond this height is clipped. Exported for consumers that need to check or display the limit.

```ts
import { MAX_SINGLE_PAGE_HEIGHT } from 'marknative'

console.log(MAX_SINGLE_PAGE_HEIGHT) // 16384
```

---

## `parseMarkdown`

```ts
function parseMarkdown(markdown: string): MarkdownDocument
```

Low-level: parse Markdown source text into the internal `MarkdownDocument` AST. Useful for inspection or custom processing pipelines.

---

## `defaultTheme`

```ts
const defaultTheme: Theme
```

The built-in default theme. Page size is 1080 × 1440 px (portrait card ratio). Exported for use as a base with [`mergeTheme`](#mergetheme).

```ts
import { defaultTheme } from 'marknative'

console.log(defaultTheme.page)
// { width: 1080, height: 1440, margin: { top: 80, right: 72, bottom: 80, left: 72 } }
```

---

## `mergeTheme`

```ts
function mergeTheme(base: Theme, overrides: ThemeOverrides): Theme
```

Merge a partial theme override onto a base theme. Each nested object (`page`, `typography`, `blocks`, `colors`) is merged shallowly at its own level — you only need to supply the keys you want to change.

```ts
import { mergeTheme, defaultTheme, getBuiltInTheme } from 'marknative'

// Build on defaultTheme
const myTheme = mergeTheme(defaultTheme, {
  page: { width: 800 },
  colors: { background: '#1e1e2e', text: '#cdd6f4' },
})

// Build on a built-in theme
const customNord = mergeTheme(getBuiltInTheme('nord'), {
  colors: { link: '#ff6b6b' },
})
```

---

## `getBuiltInTheme`

```ts
function getBuiltInTheme(name: BuiltInThemeName): Theme
```

Return a built-in theme by name. Throws if the name is unknown.

```ts
import { getBuiltInTheme } from 'marknative'

const theme = getBuiltInTheme('dark')
console.log(theme.colors.background) // '#1e1e2e'
```

---

## `resolveTheme`

```ts
function resolveTheme(theme?: BuiltInThemeName | ThemeOverrides): Theme
```

Resolve a `theme` option value into a fully populated `Theme`:

- `undefined` → `defaultTheme`
- `BuiltInThemeName` string → the named built-in theme
- `ThemeOverrides` object → merged onto `defaultTheme`

This is the same resolution that `renderMarkdown` performs internally.

---

## `isBuiltInThemeName`

```ts
function isBuiltInThemeName(value: string): value is BuiltInThemeName
```

Type-guard that checks whether a string is a valid built-in theme name.

```ts
import { isBuiltInThemeName } from 'marknative'

isBuiltInThemeName('dark')    // true
isBuiltInThemeName('custom')  // false
```

---

## `BUILT_IN_THEME_NAMES`

```ts
const BUILT_IN_THEME_NAMES: readonly BuiltInThemeName[]
```

A read-only tuple of all built-in theme name strings, in registration order.

```ts
import { BUILT_IN_THEME_NAMES } from 'marknative'

console.log(BUILT_IN_THEME_NAMES)
// ['default', 'github', 'solarized', 'sepia', 'rose',
//  'dark', 'nord', 'dracula', 'ocean', 'forest']
```

---

## `BuiltInThemeName`

```ts
type BuiltInThemeName =
  | 'default' | 'github' | 'solarized' | 'sepia' | 'rose'
  | 'dark' | 'nord' | 'dracula' | 'ocean' | 'forest'
```

Union type of all valid built-in theme name strings.

---

## `Theme`

```ts
type Theme = {
  page: {
    width: number
    height: number
    margin: { top: number; right: number; bottom: number; left: number }
  }
  typography: {
    h1: TypographyStyle
    h2: TypographyStyle
    h3: TypographyStyle
    h4: TypographyStyle  // also used for H5 and H6
    body: TypographyStyle
    code: TypographyStyle
  }
  blocks: {
    paragraph: { marginBottom: number }
    heading:   { marginTop: number; marginBottom: number }
    list:      { marginBottom: number; itemGap: number; indent: number }
    code:      { marginBottom: number; padding: number }
    quote:     { marginBottom: number; padding: number }
    table:     { marginBottom: number; cellPadding: number }
    image:     { marginBottom: number }
  }
  colors: ThemeColors
}
```

Fully-populated theme object. All fields are required. Use [`ThemeOverrides`](#themeoverrides) when you only want to override a subset.

---

## `ThemeOverrides`

```ts
type ThemeOverrides = {
  page?: Partial<{ width: number; height: number }> & {
    margin?: Partial<{ top: number; right: number; bottom: number; left: number }>
  }
  typography?: {
    h1?: Partial<TypographyStyle>
    h2?: Partial<TypographyStyle>
    h3?: Partial<TypographyStyle>
    h4?: Partial<TypographyStyle>
    body?: Partial<TypographyStyle>
    code?: Partial<TypographyStyle>
  }
  blocks?: { [K in keyof Theme['blocks']]?: Partial<Theme['blocks'][K]> }
  colors?: Partial<ThemeColors>
}
```

Every field is optional. Missing fields inherit from the base theme (usually `defaultTheme`). Pass this as the `theme` option to `renderMarkdown`, or as the second argument to `mergeTheme`.

---

## `ThemeColors`

```ts
type ThemeColors = {
  background: string
  backgroundGradient?: GradientFill
  text: string
  link: string
  mutedText: string
  border: string
  subtleBorder: string
  codeBackground: string
  quoteBackground: string
  quoteBorder: string
  imageBackground: string
  imageAccent: string
  checkboxChecked: string
  checkboxCheckedMark: string
  checkboxUnchecked: string
  tableHeaderBackground?: string  // defaults to codeBackground
}
```

All color values are CSS color strings (hex, rgb, hsl, named colors). See the [Themes guide](/guide/themes#color-tokens) for a description of each token.

---

## `GradientFill`

```ts
type GradientFill = LinearGradientFill | RadialGradientFill

type LinearGradientFill = {
  type: 'linear'
  angle?: number   // degrees; 0 = top→bottom (default), 90 = left→right
  stops: ColorStop[]
}

type RadialGradientFill = {
  type: 'radial'
  stops: ColorStop[]  // radiates from the page centre outward
}

type ColorStop = {
  offset: number  // 0–1
  color: string
}
```

Set on `ThemeColors.backgroundGradient` to apply a gradient page background. See the [gradient section](/guide/themes#gradient-backgrounds) of the Themes guide for examples.

---

## `TypographyStyle`

```ts
type TypographyStyle = {
  font: string        // CSS font shorthand, e.g. 'bold 52px sans-serif'
  lineHeight: number  // line height in pixels
}
```
