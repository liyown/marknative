# Story Template System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a high-level `renderStory(...)` API that composes templates, themes, and flow content into multi-page story output without breaking the existing direct rendering pipeline.

**Architecture:** Keep the current `renderDoc(...)` pipeline as the low-level renderer and build a thin orchestration layer on top: resolve template + theme, normalize input, build a `StoryPlan`, expand sections into page specs, then render those page specs through the existing layout engine and page renderers. The MVP only needs one built-in template (`xhs-article`), one theme (`clean-red`), and three page templates (`article-cover`, `article-content`, `article-ending`).

**Tech Stack:** Bun, TypeScript strict, existing `renderDoc(...)` pipeline, `textura`, `@chenglou/pretext`, `@napi-rs/canvas`

---

## File Map

**Create:**
- `src/story/render-story.ts` — high-level entry point and orchestration
- `src/story/resolve-theme.ts` — merge template default theme + registered theme + user override
- `src/story/resolve-template.ts` — resolve template/page template/theme from registries
- `src/story/expand-sections.ts` — expand `StoryPlan.sections` into page specs / rendered outputs
- `src/themes/define-theme.ts` — identity helper for theme authoring
- `src/themes/registry.ts` — in-memory theme registry
- `src/themes/presets/clean-red.ts` — MVP built-in theme
- `src/templates/define-template.ts` — identity helpers for story/page templates
- `src/templates/registry.ts` — in-memory template + page template registry
- `src/templates/stories/xhs-article.ts` — MVP story template
- `src/templates/pages/article-cover.ts` — cover page template
- `src/templates/pages/article-content.ts` — content page template
- `src/templates/pages/article-ending.ts` — ending page template
- `tests/story/render-story.test.ts` — end-to-end API tests for `renderStory(...)`
- `tests/story/resolve-theme.test.ts` — theme resolution tests
- `tests/story/expand-sections.test.ts` — section expansion tests
- `tests/smoke/story-template-system.test.ts` — real output smoke for cover + long markdown + ending

**Modify:**
- `src/types.ts` — add Story/Theme/Template types
- `src/index.ts` — export new story/template/theme API

---

## Task 1: Add story/template/theme types

**Files:**
- Modify: `src/types.ts`
- Test: `bun run typecheck`

- [ ] **Step 1: Add the failing type usage in a new test file**

Create `tests/story/resolve-theme.test.ts` with the imports and a minimal compile-target test:

```ts
import { describe, expect, test } from 'bun:test'
import type { Theme, ThemeOverride, StoryTemplate, StoryPlan } from '../../src/types'

describe('story type surface', () => {
  test('theme and template types are assignable', () => {
    const theme: Theme = {
      id: 'clean-red',
      tokens: {
        colors: {
          bg: '#fff',
          text: '#111',
          subtext: '#666',
          primary: '#ef4444',
          accent: '#f97316',
          border: '#eee',
          codeBg: '#f5f5f5',
        },
        typography: {
          h1: { font: 'bold 52px Heiti SC', lineHeight: 72 },
          h2: { font: 'bold 38px Heiti SC', lineHeight: 54 },
          body: { font: '28px Heiti SC', lineHeight: 44 },
          caption: { font: '22px Heiti SC', lineHeight: 34 },
          code: { font: '24px monospace, Heiti SC', lineHeight: 36 },
        },
        spacing: { xs: 8, sm: 16, md: 24, lg: 40, xl: 64 },
        radius: { sm: 8, md: 16, lg: 24 },
      },
    }

    const override: ThemeOverride = { page: { blockGap: 28 } }

    const template: StoryTemplate = {
      id: 'xhs-article',
      defaultTheme: 'clean-red',
      build() {
        const plan: StoryPlan = { sections: [{ type: 'markdown', content: '# Hello' }] }
        return plan
      },
    }

    expect(theme.id).toBe('clean-red')
    expect(override.page?.blockGap).toBe(28)
    expect(template.build({} as never).sections).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
bun test tests/story/resolve-theme.test.ts
```

Expected: FAIL because `Theme`, `ThemeOverride`, `StoryTemplate`, and `StoryPlan` are not exported from `src/types.ts`.

- [ ] **Step 3: Add the new core types to `src/types.ts`**

Append the following after the existing renderer types in `src/types.ts`:

```ts
export type Theme = {
  id: string
  label?: string
  tokens: DesignTokens
  page?: {
    background?: ResolvedPaint
    blockGap?: number
  }
}

export type ThemeOverride = Partial<{
  tokens: Partial<DesignTokens>
  page: {
    background?: ResolvedPaint
    blockGap?: number
  }
}>

export type TemplateSchema = {
  required?: string[]
  optional?: string[]
}

export type StoryInput = {
  template: string | StoryTemplate
  theme?: string | ThemeOverride
  content?: string
  blocks?: ContentBlock[]
  data?: Record<string, unknown>
  output?: {
    size?: { width: number; height: number } | string
    format?: 'png' | 'jpeg' | 'svg' | 'html'
    scale?: number
  }
}

export type StorySection =
  | { type: 'cover'; template?: string; data?: Record<string, unknown> }
  | { type: 'markdown'; content: string; pageTemplate?: string }
  | { type: 'blocks'; blocks: ContentBlock[]; pageTemplate?: string }
  | { type: 'page'; template: string; data?: Record<string, unknown> }
  | { type: 'ending'; template?: string; data?: Record<string, unknown> }

export type StoryPlan = {
  sections: StorySection[]
}

export type ResolvedStoryInput = {
  content?: string
  blocks?: ContentBlock[]
  data: Record<string, unknown>
  theme?: ThemeOverride
}

export type StoryTemplate = {
  id: string
  label?: string
  defaultTheme?: string
  schema?: TemplateSchema
  defaults?: Record<string, unknown>
  build(input: ResolvedStoryInput): StoryPlan
}

export type PageTemplateContext = {
  size: { width: number; height: number }
  contentArea: { x: number; y: number; width: number; height: number }
  tokens: DesignTokens
  page: {
    background?: ResolvedPaint
    blockGap?: number
  }
  data: Record<string, unknown>
  content?: ContentBlock[]
}

export type PageTemplate = {
  id: string
  kind: 'cover' | 'content' | 'ending' | 'custom'
  render(ctx: PageTemplateContext): LayoutSpecNode
}
```

- [ ] **Step 4: Re-run the test and typecheck**

Run:

```bash
bun test tests/story/resolve-theme.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/story/resolve-theme.test.ts
git commit -m "feat: add story template system core types"
```

---

## Task 2: Add theme and template registries

**Files:**
- Create: `src/themes/define-theme.ts`
- Create: `src/themes/registry.ts`
- Create: `src/templates/define-template.ts`
- Create: `src/templates/registry.ts`
- Modify: `src/index.ts`
- Test: `tests/story/resolve-theme.test.ts`

- [ ] **Step 1: Extend the failing test to cover registries**

Replace `tests/story/resolve-theme.test.ts` with:

```ts
import { describe, expect, test } from 'bun:test'
import { defineTheme, registerTheme, getTheme, defineTemplate, definePageTemplate, registerTemplate, registerPageTemplate, getTemplate, getPageTemplate } from '../../src'
import { defaultTokens } from '../../src/templates/tokens/default'

describe('theme and template registries', () => {
  test('registers and resolves theme/template/page template by id', () => {
    const theme = defineTheme({ id: 'test-theme', tokens: defaultTokens })
    registerTheme(theme)

    const storyTemplate = defineTemplate({
      id: 'test-story',
      build() {
        return { sections: [{ type: 'markdown', content: '# Hello' }] }
      },
    })
    registerTemplate(storyTemplate)

    const pageTemplate = definePageTemplate({
      id: 'test-page',
      kind: 'content',
      render() {
        return { type: 'container', width: 100, height: 100, children: [] }
      },
    })
    registerPageTemplate(pageTemplate)

    expect(getTheme('test-theme')?.id).toBe('test-theme')
    expect(getTemplate('test-story')?.id).toBe('test-story')
    expect(getPageTemplate('test-page')?.id).toBe('test-page')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test tests/story/resolve-theme.test.ts
```

Expected: FAIL because the registry helpers do not exist.

- [ ] **Step 3: Implement theme helpers**

Create `src/themes/define-theme.ts`:

```ts
import type { Theme } from '../types'

export function defineTheme(theme: Theme): Theme {
  return theme
}
```

Create `src/themes/registry.ts`:

```ts
import type { Theme } from '../types'

const themes = new Map<string, Theme>()

export function registerTheme(theme: Theme): void {
  themes.set(theme.id, theme)
}

export function getTheme(id: string): Theme | undefined {
  return themes.get(id)
}

export function clearThemeRegistry(): void {
  themes.clear()
}
```

- [ ] **Step 4: Implement template helpers**

Create `src/templates/define-template.ts`:

```ts
import type { PageTemplate, StoryTemplate } from '../types'

export function defineTemplate(template: StoryTemplate): StoryTemplate {
  return template
}

export function definePageTemplate(template: PageTemplate): PageTemplate {
  return template
}
```

Create `src/templates/registry.ts`:

```ts
import type { PageTemplate, StoryTemplate } from '../types'

const storyTemplates = new Map<string, StoryTemplate>()
const pageTemplates = new Map<string, PageTemplate>()

export function registerTemplate(template: StoryTemplate): void {
  storyTemplates.set(template.id, template)
}

export function getTemplate(id: string): StoryTemplate | undefined {
  return storyTemplates.get(id)
}

export function registerPageTemplate(template: PageTemplate): void {
  pageTemplates.set(template.id, template)
}

export function getPageTemplate(id: string): PageTemplate | undefined {
  return pageTemplates.get(id)
}

export function clearTemplateRegistry(): void {
  storyTemplates.clear()
  pageTemplates.clear()
}
```

- [ ] **Step 5: Export the new API from `src/index.ts`**

Add:

```ts
export { defineTheme } from './themes/define-theme'
export { registerTheme, getTheme, clearThemeRegistry } from './themes/registry'
export { defineTemplate, definePageTemplate } from './templates/define-template'
export {
  registerTemplate,
  getTemplate,
  registerPageTemplate,
  getPageTemplate,
  clearTemplateRegistry,
} from './templates/registry'
```

- [ ] **Step 6: Re-run the test and typecheck**

Run:

```bash
bun test tests/story/resolve-theme.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/themes src/templates src/index.ts tests/story/resolve-theme.test.ts
git commit -m "feat: add theme and template registries"
```

---

## Task 3: Resolve template + theme and validate input

**Files:**
- Create: `src/story/resolve-template.ts`
- Create: `src/story/resolve-theme.ts`
- Create: `tests/story/render-story.test.ts`

- [ ] **Step 1: Write the failing resolution tests**

Create `tests/story/render-story.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'bun:test'
import { clearTemplateRegistry, clearThemeRegistry, defineTemplate, defineTheme, getTemplate, registerTemplate, registerTheme } from '../../src'
import { resolveTheme } from '../../src/story/resolve-theme'
import { resolveTemplate } from '../../src/story/resolve-template'
import { defaultTokens } from '../../src/templates/tokens/default'

describe('story resolution', () => {
  beforeEach(() => {
    clearThemeRegistry()
    clearTemplateRegistry()
  })

  test('resolveTemplate gets registered template by id', () => {
    registerTemplate(defineTemplate({
      id: 'xhs-article',
      build() {
        return { sections: [{ type: 'markdown', content: '# Hello' }] }
      },
    }))

    expect(resolveTemplate('xhs-article')?.id).toBe('xhs-article')
  })

  test('resolveTheme applies template default theme then user override', () => {
    registerTheme(defineTheme({
      id: 'clean-red',
      tokens: defaultTokens,
      page: { blockGap: 24 },
    }))

    const resolved = resolveTheme(
      { defaultTheme: 'clean-red', build() { return { sections: [] } }, id: 'xhs-article' },
      { page: { blockGap: 40 } },
    )

    expect(resolved.page.blockGap).toBe(40)
    expect(resolved.tokens.colors.primary).toBe(defaultTokens.colors.primary)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test tests/story/render-story.test.ts
```

Expected: FAIL because `resolveTheme` and `resolveTemplate` do not exist.

- [ ] **Step 3: Implement template resolution**

Create `src/story/resolve-template.ts`:

```ts
import { getTemplate } from '../templates/registry'
import type { StoryTemplate } from '../types'

export function resolveTemplate(template: string | StoryTemplate): StoryTemplate {
  if (typeof template !== 'string') return template
  const resolved = getTemplate(template)
  if (!resolved) {
    throw new Error(`Unknown story template "${template}"`)
  }
  return resolved
}
```

- [ ] **Step 4: Implement theme resolution**

Create `src/story/resolve-theme.ts`:

```ts
import { defaultTokens } from '../templates/tokens/default'
import { getTheme } from '../themes/registry'
import type { StoryTemplate, Theme, ThemeOverride } from '../types'

function mergeTheme(base: Theme, override?: ThemeOverride): Theme {
  if (!override) return base
  return {
    ...base,
    tokens: {
      ...base.tokens,
      ...override.tokens,
      colors: { ...base.tokens.colors, ...override.tokens?.colors },
      typography: { ...base.tokens.typography, ...override.tokens?.typography },
      spacing: { ...base.tokens.spacing, ...override.tokens?.spacing },
      radius: { ...base.tokens.radius, ...override.tokens?.radius },
    },
    page: {
      ...base.page,
      ...override.page,
    },
  }
}

export function resolveTheme(template: StoryTemplate, override?: ThemeOverride): Theme {
  const base = template.defaultTheme ? getTheme(template.defaultTheme) : undefined
  const fallback: Theme = { id: 'default', tokens: defaultTokens, page: {} }
  return mergeTheme(base ?? fallback, override)
}
```

- [ ] **Step 5: Re-run the tests and typecheck**

Run:

```bash
bun test tests/story/render-story.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/story/resolve-template.ts src/story/resolve-theme.ts tests/story/render-story.test.ts
git commit -m "feat: add story template and theme resolution"
```

---

## Task 4: Add built-in theme and built-in templates

**Files:**
- Create: `src/themes/presets/clean-red.ts`
- Create: `src/templates/stories/xhs-article.ts`
- Create: `src/templates/pages/article-cover.ts`
- Create: `src/templates/pages/article-content.ts`
- Create: `src/templates/pages/article-ending.ts`
- Modify: `tests/story/render-story.test.ts`

- [ ] **Step 1: Extend the tests to validate built-in template shape**

Append to `tests/story/render-story.test.ts`:

```ts
import { cleanRedTheme } from '../../src/themes/presets/clean-red'
import { xhsArticleTemplate } from '../../src/templates/stories/xhs-article'

test('built-in xhs article template declares default theme and cover/markdown/ending sections', () => {
  const plan = xhsArticleTemplate.build({
    content: '# Hello',
    data: { title: 'Title', author: 'Liu', tags: ['a'] },
  })

  expect(cleanRedTheme.id).toBe('clean-red')
  expect(xhsArticleTemplate.defaultTheme).toBe('clean-red')
  expect(plan.sections.map(section => section.type)).toEqual(['cover', 'markdown', 'ending'])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test tests/story/render-story.test.ts
```

Expected: FAIL because built-in theme and templates do not exist.

- [ ] **Step 3: Implement the built-in theme**

Create `src/themes/presets/clean-red.ts`:

```ts
import { defineTheme } from '../define-theme'
import { defaultTokens } from '../../templates/tokens/default'

export const cleanRedTheme = defineTheme({
  id: 'clean-red',
  label: 'Clean Red',
  tokens: defaultTokens,
  page: {
    background: { type: 'color', value: defaultTokens.colors.bg },
    blockGap: defaultTokens.spacing.md,
  },
})
```

- [ ] **Step 4: Implement the built-in story template**

Create `src/templates/stories/xhs-article.ts`:

```ts
import { defineTemplate } from '../define-template'

export const xhsArticleTemplate = defineTemplate({
  id: 'xhs-article',
  label: 'XHS Article',
  defaultTheme: 'clean-red',
  schema: {
    required: ['title'],
    optional: ['subtitle', 'author', 'coverImage', 'tags'],
  },
  build(input) {
    return {
      sections: [
        {
          type: 'cover',
          template: 'article-cover',
          data: input.data,
        },
        {
          type: 'markdown',
          content: input.content ?? '',
          pageTemplate: 'article-content',
        },
        {
          type: 'ending',
          template: 'article-ending',
          data: input.data,
        },
      ],
    }
  },
})
```

- [ ] **Step 5: Implement the three page templates**

Create `src/templates/pages/article-cover.ts`:

```ts
import { definePageTemplate } from '../define-template'

export const articleCoverPage = definePageTemplate({
  id: 'article-cover',
  kind: 'cover',
  render(ctx) {
    return {
      type: 'container',
      width: ctx.size.width,
      height: ctx.size.height,
      background: ctx.page.background,
      padding: ctx.contentArea.x,
      justify: 'end',
      children: [
        {
          type: 'text',
          spans: [{ text: String(ctx.data.title ?? '') }],
          font: ctx.tokens.typography.h1.font,
          lineHeight: ctx.tokens.typography.h1.lineHeight,
          color: ctx.tokens.colors.text,
        },
      ],
    }
  },
})
```

Create `src/templates/pages/article-content.ts`:

```ts
import { definePageTemplate } from '../define-template'

export const articleContentPage = definePageTemplate({
  id: 'article-content',
  kind: 'content',
  render(ctx) {
    return {
      type: 'container',
      width: ctx.size.width,
      height: ctx.size.height,
      padding: {
        top: ctx.contentArea.y,
        right: ctx.size.width - ctx.contentArea.x - ctx.contentArea.width,
        bottom: ctx.size.height - ctx.contentArea.y - ctx.contentArea.height,
        left: ctx.contentArea.x,
      },
      gap: ctx.page.blockGap,
      background: ctx.page.background,
      children: ctx.content ?? [],
    }
  },
})
```

Create `src/templates/pages/article-ending.ts`:

```ts
import { definePageTemplate } from '../define-template'

export const articleEndingPage = definePageTemplate({
  id: 'article-ending',
  kind: 'ending',
  render(ctx) {
    const tags = Array.isArray(ctx.data.tags) ? ctx.data.tags.join(' ') : ''
    return {
      type: 'container',
      width: ctx.size.width,
      height: ctx.size.height,
      background: ctx.page.background,
      padding: ctx.contentArea.x,
      justify: 'center',
      children: [
        {
          type: 'text',
          spans: [{ text: String(ctx.data.author ? `作者：${ctx.data.author}` : '感谢阅读') }],
          font: ctx.tokens.typography.h2.font,
          lineHeight: ctx.tokens.typography.h2.lineHeight,
          color: ctx.tokens.colors.text,
        },
        {
          type: 'text',
          spans: [{ text: tags }],
          font: ctx.tokens.typography.caption.font,
          lineHeight: ctx.tokens.typography.caption.lineHeight,
          color: ctx.tokens.colors.subtext,
        },
      ],
    }
  },
})
```

- [ ] **Step 6: Re-run the tests and typecheck**

Run:

```bash
bun test tests/story/render-story.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/themes/presets/clean-red.ts src/templates/stories/xhs-article.ts src/templates/pages/article-cover.ts src/templates/pages/article-content.ts src/templates/pages/article-ending.ts tests/story/render-story.test.ts
git commit -m "feat: add built-in story template and default theme"
```

---

## Task 5: Implement section expansion and renderStory

**Files:**
- Create: `src/story/expand-sections.ts`
- Create: `src/story/render-story.ts`
- Modify: `src/index.ts`
- Modify: `tests/story/render-story.test.ts`

- [ ] **Step 1: Write the failing end-to-end tests**

Replace `tests/story/render-story.test.ts` with:

```ts
import { beforeEach, describe, expect, test } from 'bun:test'
import { clearTemplateRegistry, clearThemeRegistry, registerPageTemplate, registerTemplate, registerTheme, renderStory } from '../../src'
import { cleanRedTheme } from '../../src/themes/presets/clean-red'
import { xhsArticleTemplate } from '../../src/templates/stories/xhs-article'
import { articleCoverPage } from '../../src/templates/pages/article-cover'
import { articleContentPage } from '../../src/templates/pages/article-content'
import { articleEndingPage } from '../../src/templates/pages/article-ending'

describe('renderStory', () => {
  beforeEach(() => {
    clearThemeRegistry()
    clearTemplateRegistry()
    registerTheme(cleanRedTheme)
    registerTemplate(xhsArticleTemplate)
    registerPageTemplate(articleCoverPage)
    registerPageTemplate(articleContentPage)
    registerPageTemplate(articleEndingPage)
  })

  test('renders cover + long markdown content + ending to multiple html pages', async () => {
    const pages = await renderStory({
      template: 'xhs-article',
      content: `# Title\n\n${'Long paragraph. '.repeat(400)}`,
      data: { title: 'Title', author: 'Liu', tags: ['a', 'b'] },
      output: { format: 'html', size: { width: 1080, height: 1440 } },
    })

    expect(pages.length).toBeGreaterThan(2)
    expect(pages[0]?.format).toBe('html')
    expect((pages[0] as { data: string }).data).toContain('Title')
    expect((pages.at(-1) as { data: string }).data).toContain('作者：Liu')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test tests/story/render-story.test.ts
```

Expected: FAIL because `renderStory` does not exist.

- [ ] **Step 3: Implement section expansion**

Create `src/story/expand-sections.ts`:

```ts
import { parseMarkdown } from '../content/parse-markdown'
import { blockToNodes } from '../pipeline/block-to-nodes'
import { measureBlocks } from '../pipeline/measure'
import { paginateByHeights } from '../pipeline/paginate'
import { getPageTemplate } from '../templates/registry'
import type { ContentBlock, PageTemplateContext, StoryPlan, StorySection, Theme } from '../types'

export async function expandSections(
  plan: StoryPlan,
  ctx: Omit<PageTemplateContext, 'data' | 'content'>,
): Promise<Array<{ spec: unknown }>> {
  const pages: Array<{ spec: unknown }> = []

  for (const section of plan.sections) {
    if (section.type === 'cover' || section.type === 'page' || section.type === 'ending') {
      const templateId =
        section.type === 'page' ? section.template : section.template ?? `article-${section.type}`
      const template = getPageTemplate(templateId)
      if (!template) throw new Error(`Unknown page template "${templateId}" for section "${section.type}"`)
      pages.push({ spec: template.render({ ...ctx, data: section.data ?? {} }) })
      continue
    }

    const blocks: ContentBlock[] =
      section.type === 'markdown' ? parseMarkdown(section.content) : section.blocks
    const blockGap = ctx.page.blockGap ?? ctx.tokens.spacing.md
    const heights = await measureBlocks(blocks, ctx.tokens, ctx.contentArea.width)
    const pagedBlocks = paginateByHeights(blocks, heights, ctx.contentArea.height, blockGap)
    const template = getPageTemplate(section.pageTemplate ?? 'article-content')
    if (!template) throw new Error(`Unknown page template "${section.pageTemplate ?? 'article-content'}" for section "${section.type}"`)

    for (const pageBlocks of pagedBlocks) {
      const content = pageBlocks.flatMap(block => blockToNodes(block, ctx.tokens, ctx.contentArea.width))
      pages.push({ spec: template.render({ ...ctx, data: {}, content }) })
    }
  }

  return pages
}
```

- [ ] **Step 4: Implement `renderStory(...)`**

Create `src/story/render-story.ts`:

```ts
import { computeLayoutBoxes } from '../layout/engine'
import { renderPageCanvas } from '../renderer/canvas'
import { renderPageHtml } from '../renderer/html'
import { renderPageSvg } from '../renderer/svg'
import { resolveTemplate } from './resolve-template'
import { resolveTheme } from './resolve-theme'
import { expandSections } from './expand-sections'
import type { RenderOutput, StoryInput } from '../types'

function renderOne(spec: any, size: { width: number; height: number }, format: 'png' | 'jpeg' | 'svg' | 'html', scale?: number): Promise<RenderOutput> {
  return computeLayoutBoxes(spec, size).then(boxes => {
    if (format === 'svg') return renderPageSvg(boxes, size)
    if (format === 'html') return renderPageHtml(boxes, size)
    return renderPageCanvas(boxes, size, { renderer: 'canvas', format, scale })
  })
}

export async function renderStory(input: StoryInput): Promise<RenderOutput[]> {
  const template = resolveTemplate(input.template)
  const theme = resolveTheme(template, typeof input.theme === 'string' ? undefined : input.theme)
  const size = typeof input.output?.size === 'object' ? input.output.size : { width: 1080, height: 1440 }
  const contentArea = { x: 72, y: 80, width: size.width - 144, height: size.height - 160 }

  if (!input.content && !input.blocks) {
    throw new Error('renderStory requires either content or blocks')
  }

  const plan = template.build({
    content: input.content,
    blocks: input.blocks,
    data: input.data ?? {},
    theme: typeof input.theme === 'string' ? undefined : input.theme,
  })

  const expanded = await expandSections(plan, {
    size,
    contentArea,
    tokens: theme.tokens,
    page: {
      background: theme.page?.background,
      blockGap: theme.page?.blockGap,
    },
  })

  const format = input.output?.format ?? 'png'
  return Promise.all(expanded.map(page => renderOne(page.spec, size, format, input.output?.scale)))
}
```

- [ ] **Step 5: Export `renderStory(...)` from `src/index.ts`**

Add:

```ts
export { renderStory } from './story/render-story'
```

- [ ] **Step 6: Re-run the tests and typecheck**

Run:

```bash
bun test tests/story/render-story.test.ts
bun run typecheck
```

Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/story/render-story.ts src/story/expand-sections.ts src/index.ts tests/story/render-story.test.ts
git commit -m "feat: add renderStory orchestration for story templates"
```

---

## Task 6: Add smoke coverage for real output

**Files:**
- Create: `tests/smoke/story-template-system.test.ts`

- [ ] **Step 1: Write the smoke test**

Create `tests/smoke/story-template-system.test.ts`:

```ts
import { beforeAll, describe, test } from 'bun:test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { clearTemplateRegistry, clearThemeRegistry, registerPageTemplate, registerTemplate, registerTheme, renderStory } from '../../src'
import { cleanRedTheme } from '../../src/themes/presets/clean-red'
import { xhsArticleTemplate } from '../../src/templates/stories/xhs-article'
import { articleCoverPage } from '../../src/templates/pages/article-cover'
import { articleContentPage } from '../../src/templates/pages/article-content'
import { articleEndingPage } from '../../src/templates/pages/article-ending'

const OUT = 'tests/smoke/output/story'

describe('story template system smoke', () => {
  beforeAll(() => {
    mkdirSync(OUT, { recursive: true })
    clearThemeRegistry()
    clearTemplateRegistry()
    registerTheme(cleanRedTheme)
    registerTemplate(xhsArticleTemplate)
    registerPageTemplate(articleCoverPage)
    registerPageTemplate(articleContentPage)
    registerPageTemplate(articleEndingPage)
  })

  test('cover + long markdown + ending -> PNG pages', async () => {
    const pages = await renderStory({
      template: 'xhs-article',
      content: `# 为什么长期主义更难\n\n${'长期主义不是慢，而是不短视。'.repeat(240)}`,
      data: {
        title: '为什么长期主义更难',
        author: 'Liu',
        tags: ['长期主义', '内容创作'],
      },
      output: {
        size: { width: 1080, height: 1440 },
        format: 'png',
      },
    })

    pages.forEach((page, index) => {
      writeFileSync(`${OUT}/story-${String(index + 1).padStart(2, '0')}.png`, (page as { data: Buffer }).data)
    })
  })
})
```

- [ ] **Step 2: Run the smoke test**

Run:

```bash
bun test tests/smoke/story-template-system.test.ts
```

Expected: PASS and output PNG files under `tests/smoke/output/story/`.

- [ ] **Step 3: Run the existing pipeline regression tests**

Run:

```bash
bun test tests/pipeline/render-doc.test.ts
bun test tests/smoke/production-cases.test.ts -t "11-long-paragraphs"
bun run typecheck
```

Expected: PASS for all commands.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/story-template-system.test.ts
git commit -m "test: add smoke coverage for story template system"
```

---

## Self-Review Notes

**Spec coverage:**
- `renderStory(...)` entry: Task 5
- template default theme: Task 3 + Task 4
- theme-only global styling: Task 1 + Task 3
- story template + page template split: Task 2 + Task 4
- StoryPlan sections: Task 1 + Task 5
- built-in MVP (`xhs-article`, `clean-red`, cover/content/ending): Task 4
- smoke coverage and regression: Task 6

**Placeholder scan:**
- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes concrete files, commands, and expected outcomes.

**Type consistency:**
- `StoryInput`, `Theme`, `ThemeOverride`, `StoryTemplate`, `PageTemplate`, and `StoryPlan` are introduced in Task 1 and used consistently in later tasks.
- Registry APIs and render entrypoint names are consistent with the spec and the code snippets above.

---

Plan complete and saved to `docs/superpowers/plans/2026-03-31-story-template-system.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
