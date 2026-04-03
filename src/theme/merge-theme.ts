import type { Theme, ThemeOverrides } from './default-theme'

/**
 * Merge a partial theme override onto a base theme.
 * Each nested object is merged shallowly at its own level —
 * you can override individual color tokens, spacing values, or typography
 * without re-specifying the whole tree.
 */
export function mergeTheme(base: Theme, overrides: ThemeOverrides): Theme {
  return {
    page: {
      width: overrides.page?.width ?? base.page.width,
      height: overrides.page?.height ?? base.page.height,
      margin: {
        top: overrides.page?.margin?.top ?? base.page.margin.top,
        right: overrides.page?.margin?.right ?? base.page.margin.right,
        bottom: overrides.page?.margin?.bottom ?? base.page.margin.bottom,
        left: overrides.page?.margin?.left ?? base.page.margin.left,
      },
    },
    typography: {
      h1: { ...base.typography.h1, ...overrides.typography?.h1 },
      h2: { ...base.typography.h2, ...overrides.typography?.h2 },
      h3: { ...base.typography.h3, ...overrides.typography?.h3 },
      h4: { ...base.typography.h4, ...overrides.typography?.h4 },
      body: { ...base.typography.body, ...overrides.typography?.body },
      code: { ...base.typography.code, ...overrides.typography?.code },
    },
    blocks: {
      paragraph: { ...base.blocks.paragraph, ...overrides.blocks?.paragraph },
      heading: { ...base.blocks.heading, ...overrides.blocks?.heading },
      list: { ...base.blocks.list, ...overrides.blocks?.list },
      code: { ...base.blocks.code, ...overrides.blocks?.code },
      quote: { ...base.blocks.quote, ...overrides.blocks?.quote },
      table: { ...base.blocks.table, ...overrides.blocks?.table },
      image: { ...base.blocks.image, ...overrides.blocks?.image },
    },
    colors: { ...base.colors, ...overrides.colors },
  }
}
