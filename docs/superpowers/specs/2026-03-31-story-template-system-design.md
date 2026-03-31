# NoteCard Story Template System — 设计文档

**日期**：2026-03-31
**状态**：待评审
**项目**：NoteCard（小红书风格卡片渲染库）

---

## 1. 背景与目标

### 现状

NoteCard 当前已经具备一条稳定的直接渲染链路：

- `renderDoc(markdown, config, options)`
- `renderDocFromBlocks(blocks, config, options)`
- `renderDocFromJson(raw, config, options)`

这条链路适合“正文流式分页”，但它的能力边界也很明确：

- 强项是长文档、自动分页、全局设计令牌控制
- 弱项是封面页、结束页、分隔页、品牌页、强设计页面编排
- 页面背景目前主要是全局配置，不适合“不同页类型不同背景”
- 用户缺少一个真正面向模板和主题的高层入口

对于小红书内容卡片，真实需求并不是“只有正文 flow”，而是：

1. 普通用户希望给 Markdown 或内容块后直接出图
2. 模板作者希望决定封面页、正文页、结束页怎么组合
3. 用户希望切换整套视觉风格，而不是逐个 block 手工改样式
4. 不同模板会要求不同的补充字段，例如封面图、作者、标签、CTA 文案

### 目标

新增一套以 `renderStory(...)` 为主入口的模板系统，满足以下约束：

1. 默认体验简单，用户不需要手工定义每一页
2. 模板可以编排“封面 + flow 正文 + 结束页”等混合页面序列
3. 主题只负责全局 token，不引入单个 block 局部样式系统
4. 模板可以声明默认主题，用户仍然可以覆盖
5. 不同模板可以声明不同字段 schema
6. 与现有 `renderDoc(...)` 直接渲染 API 共存，不破坏当前调用方

### 非目标

本阶段明确不做以下内容：

1. 不提供单个 block 的局部 style 覆写
2. 不把所有用户都暴露到页面级 builder API
3. 不引入模板 DSL 或配置文件语法，模板仍以 TypeScript 对象为主
4. 不替换现有 `renderDoc(...)` 低层渲染链路

---

## 2. 设计原则

### 分层清晰

系统拆成四层：

- `Content`：内容是什么
- `Theme`：整套视觉 token 是什么
- `Template`：页面如何编排
- `Renderer`：最终如何输出 PNG / SVG / HTML

这四层不能混淆。尤其是：

- Theme 不负责编排页面
- Template 不负责单个 block 的局部 style
- Content 不携带视觉样式

### 混合优先

高层使用模型不是“纯 flow”，也不是“纯 page builder”，而是：

- 默认正文是 flow 内容
- 模板可以在关键位置插入强设计页面

典型序列：

```text
封面页 → 正文 flow 页 → 引言页 / 分隔页 → 正文 flow 页 → 结尾页
```

### 简单入口优先

对外主推一个入口：

```ts
renderStory(...)
```

不要求大多数用户理解 `LayoutSpecNode`、分页器、布局树、页面模板渲染细节。

### 默认可用，进阶可扩展

- 新手：只传 `template + content + data`
- 进阶：覆盖主题
- 模板作者：注册模板
- 后续高级能力：开放页面模板注册，但不作为主入口

---

## 3. 用户视角 API

### 3.1 主入口

```ts
type StoryInput = {
  template: string | StoryTemplate
  theme?: string | ThemeOverride
  content?: string
  blocks?: ContentBlock[]
  data?: Record<string, unknown>
  output?: OutputConfig
}

type OutputConfig = {
  size?: PresetSize | { width: number; height: number }
  format?: 'png' | 'jpeg' | 'svg' | 'html'
  scale?: number
}
```

约束：

1. `content` 与 `blocks` 至少提供一个
2. 同时提供时，以 `blocks` 为准，`content` 作为备用原始输入保留给模板使用
3. `template` 可以传已注册模板名，也可以直接传模板对象
4. `theme` 可以传已注册主题名，也可以传局部 override

### 3.2 最常见用法

```ts
import { renderStory } from 'notecard'

const pages = await renderStory({
  template: 'xhs-article',
  content: markdown,
  data: {
    title: '为什么长期主义更难',
    subtitle: '写给内容创作者的排版实验',
    author: 'Liu',
    coverImage: 'https://example.com/cover.jpg',
    tags: ['长期主义', '内容创作'],
  },
  output: {
    size: 'xhs-portrait',
    format: 'png',
  },
})
```

这里模板内部可以带默认主题，用户无需显式传 `theme`。

### 3.3 覆盖主题

```ts
const pages = await renderStory({
  template: 'xhs-article',
  theme: 'clean-blue',
  content: markdown,
  data: { title: '标题' },
})
```

或传部分覆写：

```ts
const pages = await renderStory({
  template: 'xhs-article',
  theme: {
    tokens: {
      colors: {
        primary: '#0ea5e9',
        codeBg: '#ecfeff',
      },
    },
    page: {
      background: { type: 'color', value: '#f8fafc' },
      blockGap: 28,
    },
  },
  content: markdown,
  data: { title: '标题' },
})
```

---

## 4. 核心抽象

### 4.1 Theme

Theme 只控制全局 token 和页面级默认值，不控制单个 block 局部样式。

```ts
type Theme = {
  id: string
  label?: string
  tokens: DesignTokens
  page?: {
    background?: ResolvedPaint
    blockGap?: number
  }
}

type ThemeOverride = Partial<{
  tokens: Partial<DesignTokens>
  page: {
    background?: ResolvedPaint
    blockGap?: number
  }
}>
```

Theme 负责：

- `h1 / h2 / body / code` 的字体与行高
- 整套色板
- 全局圆角、间距
- 正文页默认背景
- 正文页默认块间距

Theme 不负责：

- 某个标题单独改颜色
- 某个代码块单独换皮肤
- 某一页的具体编排逻辑

### 4.2 StoryTemplate

StoryTemplate 负责把输入转换成页面序列计划，而不是直接绘图。

```ts
type StoryTemplate = {
  id: string
  label?: string
  defaultTheme?: string
  schema?: TemplateSchema
  defaults?: Record<string, unknown>
  build(input: ResolvedStoryInput): StoryPlan
}

type TemplateSchema = {
  required?: string[]
  optional?: string[]
}
```

责任：

- 声明自己需要哪些字段
- 决定页面结构
- 决定封面 / 正文 / 结束页怎么组合
- 给不同 section 选择不同页面模板

不负责：

- 逐个 block 局部 style
- 最终绘制
- 分页算法本身

### 4.3 StoryPlan

StoryPlan 是模板层与渲染层之间的中间层。

```ts
type StoryPlan = {
  sections: StorySection[]
}

type StorySection =
  | CoverSection
  | MarkdownSection
  | BlocksSection
  | PageSection
  | EndingSection

type CoverSection = {
  type: 'cover'
  template?: string
  data?: Record<string, unknown>
}

type MarkdownSection = {
  type: 'markdown'
  content: string
  pageTemplate?: string
}

type BlocksSection = {
  type: 'blocks'
  blocks: ContentBlock[]
  pageTemplate?: string
}

type PageSection = {
  type: 'page'
  template: string
  data?: Record<string, unknown>
}

type EndingSection = {
  type: 'ending'
  template?: string
  data?: Record<string, unknown>
}
```

关键点：

- `markdown` / `blocks` 是 flow 内容段
- `cover` / `page` / `ending` 是强设计页面段
- StoryTemplate 只负责产生 `sections`
- 渲染器负责把 `sections` 展开成最终页面数组

### 4.4 PageTemplate

PageTemplate 是“某类页面长什么样”的定义。

```ts
type PageTemplate = {
  id: string
  kind: 'cover' | 'content' | 'ending' | 'custom'
  render(ctx: PageTemplateContext): LayoutSpecNode
}

type PageTemplateContext = {
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
```

约束：

- `content` 只会出现在 `content` 页面模板上下文中
- `cover` / `ending` / `custom` 模板主要消费 `data`
- 页面模板输出仍然是底层已存在的 `LayoutSpecNode`

这样可以复用当前的：

- `computeLayoutBoxes(...)`
- Canvas / SVG / HTML renderer

---

## 5. 渲染流程

目标是复用现有直接渲染链路，不另起一套引擎。

### 流程

```text
StoryInput
  │
  ├─ resolve template
  ├─ resolve theme（模板默认主题 + 用户 override）
  ├─ normalize content（markdown -> blocks）
  ▼
StoryTemplate.build(...)
  ▼
StoryPlan.sections
  ▼
expand sections to pages
  ├─ cover/page/ending -> PageTemplate.render(...)
  └─ markdown/blocks -> flow paginate with selected content page template
  ▼
LayoutSpecNode[]
  ▼
computeLayoutBoxes(...)
  ▼
renderPageCanvas / SVG / HTML
  ▼
RenderOutput[]
```

### 与现有 `renderDoc(...)` 的关系

`renderDoc(...)` 保留，继续作为低层直接渲染入口。

新系统对 `renderDoc(...)` 的关系应当是“包装与复用”，而不是替换：

- flow 正文仍然复用当前 block 测高与分页能力
- 新增的是 section 编排、模板解析、主题解析
- 页面模板最终仍然走现有布局与 renderer

---

## 6. 模板默认主题策略

模板和主题保持解耦，但模板可以声明一个默认主题：

```ts
type StoryTemplate = {
  id: string
  defaultTheme?: string
  build(...): StoryPlan
}
```

解析顺序：

1. 取模板默认主题
2. 应用用户传入的 `theme` 名称或 `theme` override
3. 得到最终 `ResolvedTheme`

这样可以兼顾两类体验：

- 新手：只传模板名即可直接得到“作者推荐的默认风格”
- 高级用户：仍然可以切换或覆盖主题

这避免了以下两种极端：

- 模板和主题完全绑死，用户无法复用风格
- 模板和主题完全分离，新手每次都必须同时选两样东西

---

## 7. 字段校验与错误处理

### 模板字段校验

高层入口在执行模板前需要校验 `schema.required`。

规则：

1. 缺少必填字段时直接抛错
2. 错误信息必须包含模板 id 和缺失字段名
3. 不在本阶段引入复杂 JSON Schema 校验器

示例：

```text
Template "xhs-article" requires field "title" in input.data
```

### 内容输入校验

规则：

1. `content` 与 `blocks` 至少提供一个
2. 两者都为空时直接报错
3. `blocks` 优先级高于 `content`

### 页面模板查找失败

规则：

1. section 指定的页面模板不存在时直接报错
2. 错误信息包含 section 类型与模板 id

---

## 8. 最小落地范围（MVP）

第一阶段只实现刚好足以验证架构的最小集合：

### 对外 API

- `renderStory(...)`
- `defineTheme(...)`
- `defineTemplate(...)`
- `definePageTemplate(...)`
- `registerTheme(...)`
- `registerTemplate(...)`
- `registerPageTemplate(...)`

### 内置能力

- 1 个默认 story 模板：`xhs-article`
- 1 个默认主题：`clean-red`
- 3 个页面模板：
  - `article-cover`
  - `article-content`
  - `article-ending`

### 支持的 section

- `cover`
- `markdown`
- `ending`

`page` 和 `blocks` 可以先保留类型定义，但实现优先级低于上述三项。

---

## 9. 测试策略

### 单元测试

1. 模板字段校验
2. 默认主题解析顺序
3. StoryTemplate -> StoryPlan 产出
4. section 展开逻辑
5. `markdown` section 分页行为

### 冒烟测试

新增真实产物测试，至少覆盖：

1. `renderStory` 默认模板 + 默认主题
2. `renderStory` 覆盖主题
3. 封面页 + 长段落正文 + 结尾页

### 回归策略

现有 `renderDoc(...)` 测试必须继续通过，确保新层不破坏旧链路。

---

## 10. 风险与取舍

### 风险 1：抽象过多，首版过重

缓解：

- MVP 只做一个 story 模板、一套主题、三种页面模板
- 不在第一阶段开放过多 section 类型

### 风险 2：模板与页面模板职责混乱

缓解：

- StoryTemplate 只产生 `StoryPlan`
- PageTemplate 只产生 `LayoutSpecNode`
- Theme 只产生 token 与 page defaults

### 风险 3：主题 override 合并规则不清晰

缓解：

- 首版采用浅层可预测合并
- 文档明确“对象字段逐层覆盖，不做智能语义合并”

### 风险 4：用户误以为支持 block 局部 style

缓解：

- 类型层面不暴露 `block.style`
- 文档明确 theme 是全局样式系统

---

## 11. 推荐目录结构

```text
src/story/
  render-story.ts
  resolve-theme.ts
  resolve-template.ts
  expand-sections.ts

src/themes/
  define-theme.ts
  registry.ts
  presets/
    clean-red.ts

src/templates/
  define-template.ts
  registry.ts
  stories/
    xhs-article.ts
  pages/
    article-cover.ts
    article-content.ts
    article-ending.ts
```

说明：

- `story/` 放高层 orchestration
- `themes/` 放主题定义与注册表
- `templates/stories/` 放 story 编排模板
- `templates/pages/` 放页面模板

---

## 12. 决策摘要

本设计确定以下决策：

1. 新增高层入口 `renderStory(...)`
2. 主模型采用“混合优先”：flow 内容 + 强设计页面共存
3. Theme 只负责全局 token，不支持 block 局部 style
4. Template 负责页面编排，并可声明默认主题
5. 模板字段差异通过 `schema.required / optional` 表达
6. 中间层使用 `StoryPlan.sections`
7. 底层继续复用现有 `renderDoc(...)`、布局引擎与 renderer

这套方案的目标不是替换当前直接渲染 API，而是在其上增加一个真正适合模板系统和小红书丰富页面的高层产品形态。
