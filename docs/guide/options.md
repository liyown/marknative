# Render Options

`renderMarkdown` accepts an optional second argument of type [`RenderMarkdownOptions`](/api/reference#rendermarkdownoptions):

```ts
const pages = await renderMarkdown(markdown, {
  format: 'png',                          // 'png' | 'svg'
  singlePage: false,                      // render into one image instead of paginating
  theme: 'dark',                          // built-in theme name or ThemeOverrides object
  codeHighlighting: { theme: 'nord' },    // Shiki theme for fenced code blocks
})
```

## `format`

**Type:** `'png' | 'svg'`  
**Default:** `'png'`

Controls the output format for each page.

| Value | Output | `page.data` type |
| :--- | :--- | :--- |
| `'png'` | Raster image | `Buffer` |
| `'svg'` | Vector markup | `string` (UTF-8) |

```ts
// PNG (default)
const pngPages = await renderMarkdown(markdown, { format: 'png' })
pngPages[0].data // Buffer

// SVG
const svgPages = await renderMarkdown(markdown, { format: 'svg' })
svgPages[0].data // string
```

**Rendered output (PNG):**

![PNG render output](/examples/options-paginated.png)

## `singlePage`

**Type:** `boolean`  
**Default:** `false`

When `true`, all content is placed into a single image whose height adapts to the content, rather than being split across multiple fixed-height pages.

```ts
const [page] = await renderMarkdown(markdown, { singlePage: true })
```

- The image height is capped at [`MAX_SINGLE_PAGE_HEIGHT`](/api/reference#max_single_page_height) (16 384 px). Content beyond that point is clipped.
- The width is always the page width from the active theme.

See [Single-Page Mode](/guide/single-page) for more details.

## `theme`

**Type:** `BuiltInThemeName | ThemeOverrides`  
**Default:** `defaultTheme`

Controls all visual properties: colors, typography, spacing, page size, and background gradients.

**Built-in theme by name:**

```ts
const pages = await renderMarkdown(markdown, { theme: 'dark' })
const pages = await renderMarkdown(markdown, { theme: 'nord' })
```

Available names: `'default'`, `'github'`, `'solarized'`, `'sepia'`, `'rose'`, `'dark'`, `'nord'`, `'dracula'`, `'ocean'`, `'forest'`.

**Partial override (merged onto `defaultTheme`):**

```ts
const pages = await renderMarkdown(markdown, {
  theme: {
    colors: { background: '#1e1e2e', text: '#cdd6f4' },
    page: { width: 800 },
  },
})
```

**Full control with `mergeTheme`:**

```ts
import { mergeTheme, getBuiltInTheme } from 'marknative'

const myTheme = mergeTheme(getBuiltInTheme('nord'), {
  colors: { link: '#ff6b6b' },
})

const pages = await renderMarkdown(markdown, { theme: myTheme })
```

See the [Themes guide](/guide/themes) for the complete reference.

## `codeHighlighting`

**Type:** `{ theme?: string }`  
**Default:** `{ theme: 'github-light' }`

Enables syntax highlighting for fenced code blocks, powered by [Shiki](https://shiki.style/).

| Sub-option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `theme` | `string` | `'github-light'` | Any Shiki-supported theme name |

Shiki is loaded lazily on first use — there is no extra overhead when no code blocks are present.

**Default (github-light):**

```ts
const pages = await renderMarkdown(md)
// codeHighlighting: { theme: 'github-light' } is the implicit default
```

**Dark theme pairing** — combine a dark marknative theme with a matching Shiki theme:

```ts
const pages = await renderMarkdown(md, {
  format: 'png',
  theme: 'dark',
  codeHighlighting: { theme: 'github-dark' },
})
```

**Popular Shiki theme names:**

| Light | Dark |
| :--- | :--- |
| `github-light` | `github-dark` |
| `min-light` | `one-dark-pro` |
| `catppuccin-latte` | `nord` |
| | `dracula` |
| | `tokyo-night` |

For the full list, see the [Shiki themes reference](https://shiki.style/themes).

**Fallback behaviour:** code blocks without a language tag, or with an unrecognised language, are rendered as plain monochrome text (no highlighting applied).

---

## `painter`

**Type:** `Painter` (internal interface)  
**Default:** skia-canvas painter

Advanced option for supplying a custom paint backend. Useful for testing or alternative rendering targets.

> This option is intended for library integrators. Most users should not need it.
