# NoteCard 模板化内容渲染引擎 — 设计文档

**日期**：2026-03-30
**状态**：已审批，待实现
**项目**：NoteCard（小红书风格卡片渲染库）

---

## 1. 背景与目标

### 现状

NoteCard 当前是一个"Markdown → 卡片图片"工具：8 个 TypeScript 函数各自硬编码一套模板，用 `@napi-rs/canvas` 绘制，用 `@chenglou/pretext` 做文本换行。扩展性差——新增模板要改核心代码，分页靠截断，换渲染目标需重写。

### 目标

构建一个**模板化内容渲染引擎**，满足以下五条扩展性标准：

1. 新增模板不修改核心代码
2. 换渲染目标（Canvas / SVG / HTML）不重写布局逻辑
3. 内容长度变化时版式稳定
4. 同一份内容可套不同风格模板
5. 支持批量生成和自动分页

---

## 2. 整体架构

### 流水线（Pipeline）

```
输入（Markdown string / ContentBlock[] JSON）
    │
    ▼
┌─────────────────┐
│  Content Layer  │  解析 / 规范化 → ContentBlock[]
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│  Content Paginator   │  粗估分页 → ContentBlock[][]
│  （模板感知）        │  依赖 content template 的 tokens + contentArea
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│  Template Selector   │  按页号选模板 → (ContentBlock[], Template)[]
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐  × N 页（可并行）
│  Template Engine     │  绑定 slot + 解析 token + 执行 rules → LayoutSpec
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐  × N 页（可并行）
│  Layout Engine       │  Textura（Yoga + Pretext）→ LayoutBox[]
│  + 图片预加载        │
└────────┬─────────────┘
         │
         ▼
┌─────────────────────────────────┐  × N 页（可并行）
│           Renderer              │
│  Canvas   SVG   HTML            │
└─────────────────────────────────┘
         │
         ▼
Buffer[] / SVG string[] / HTML string[]
```

### 层职责一览

| 层 | 输入 | 输出 | 核心依赖 |
|---|---|---|---|
| Content Layer | raw string / JSON | `ContentBlock[]` | `marked` |
| Content Paginator | `ContentBlock[]` + content template | `ContentBlock[][]` | Pretext `prepare()` / `layout()` |
| Template Selector | `ContentBlock[][]` + 模板族配置 | `(ContentBlock[], Template)[]` | — |
| Template Engine | `ContentBlock[]` + `Template` | `LayoutSpec` | — |
| Layout Engine | `LayoutSpec` | `LayoutBox[]` | Textura（Yoga + Pretext） |
| Renderer | `LayoutBox[]` | bytes / string | `@napi-rs/canvas` / 字符串生成 |

---

## 3. 核心数据类型

### 3.1 ContentBlock

语义层，描述"内容是什么"，与排版无关。

```ts
type Span = {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  color?: string
  link?: string
}

type ContentBlock =
  | { type: 'heading';    level: 1 | 2 | 3; text: string }
  | { type: 'paragraph';  spans: Span[] }
  | { type: 'bulletList'; items: string[] }
  | { type: 'orderedList'; items: string[] }
  | { type: 'steps';      items: string[] }
  | { type: 'quoteCard';  text: string; author?: string }
  | { type: 'metric';     label: string; value: string }
  | { type: 'tags';       items: string[] }
  | { type: 'image';      src: string; alt?: string }
  | { type: 'codeBlock';  code: string; language?: string }
  | { type: 'divider' }
  | { type: 'heroTitle';  title: string; subtitle?: string }
```

Span[] 从 ContentBlock 一路流转到 LayoutBox，不在中间层丢失。

### 3.2 DesignTokens

所有视觉参数的统一来源。模板通过引用 token key 而非硬编码数字来定义样式。

```ts
type DesignTokens = {
  colors: {
    bg: string; text: string; subtext: string
    primary: string; accent: string; border: string
  }
  typography: {
    h1: { font: string; lineHeight: number }
    h2: { font: string; lineHeight: number }
    body: { font: string; lineHeight: number }
    caption: { font: string; lineHeight: number }
    code: { font: string; lineHeight: number }
  }
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number }
  radius:  { sm: number; md: number; lg: number }
}
```

### 3.3 Template

模板是 TypeScript 对象（主体为纯数据，rules 为函数）。

```ts
// Template.root 可以包含 SlotNode，LayoutSpec 产出后不含 SlotNode
type TemplateNode = LayoutSpecNode | SlotNode
type SlotNode = { type: 'slot'; name: string }

type Template = {
  id: string
  size: { width: number; height: number }
  tokens: DesignTokens
  // Content Paginator 用于粗估分页
  contentArea: { x: number; y: number; width: number; height: number }
  root: TemplateNode
  rules?: Array<(ctx: RuleContext) => void>
}

// LayoutSpec 是 Template Engine 输出的已绑定逻辑树（无 SlotNode，无坐标）
type LayoutSpec = LayoutSpecNode

type RuleContext = {
  blocks: ContentBlock[]
  tokens: DesignTokens
  mutate: (path: string, value: unknown) => void  // 修改 root 中的节点属性
}
```

**模板族**（TemplateFamily）：

```ts
type TemplateFamily = {
  cover?:  Template        // 第 0 页封面（可选；不提供时第 0 页用 content）
  content: Template        // 中间页（必需）
  ending?: Template        // 最后一页（可选）
}
```

### 3.4 LayoutSpec

Template Engine 的输出。逻辑树，所有 token 已解析为实际值，无坐标信息。

```ts
type ResolvedPaint =
  | { type: 'color'; value: string }
  | { type: 'linear-gradient'; angle: number; stops: Array<{ offset: number; color: string }> }
  | { type: 'image'; src: string; fit?: 'cover' | 'contain' | 'fill' }

type LayoutSpecNode =
  | {
      type: 'container'
      direction?: 'row' | 'column'
      gap?: number
      padding?: number | { top: number; right: number; bottom: number; left: number }
      width?: number | 'fill'
      height?: number | 'fill' | 'hug'
      align?: 'start' | 'center' | 'end' | 'stretch'
      justify?: 'start' | 'center' | 'end' | 'space-between'
      position?: 'relative' | 'absolute'
      x?: number; y?: number           // 仅 position: absolute 时有效
      background?: ResolvedPaint
      children: LayoutSpecNode[]
    }
  | {
      type: 'text'
      spans: Span[]
      font: string                     // 已解析，如 "bold 60px Heiti SC"
      lineHeight: number
      color: string
      align?: 'left' | 'center' | 'right'
      maxLines?: number
    }
  | {
      type: 'image'
      src: string
      width: number
      height: number
      fit?: 'cover' | 'contain'
      borderRadius?: number
    }
  | {
      type: 'rect'
      width: number | 'fill'
      height: number | 'fill' | 'hug'
      fill: ResolvedPaint
      borderRadius?: number
      shadow?: { x: number; y: number; blur: number; color: string }
    }
```

### 3.5 LayoutBox

Layout Engine 的输出。几何树，每个节点有绝对坐标，文本节点有 Pretext 计算好的行数据。

```ts
type TextLine = {
  spans: Array<{ text: string; font: string; color: string; x: number }>
  y: number
  height: number
}

type LayoutBox = {
  id: string
  kind: 'text' | 'image' | 'rect' | 'group'
  x: number; y: number
  width: number; height: number
  zIndex?: number
  // text
  lines?: TextLine[]
  textAlign?: 'left' | 'center' | 'right'
  // image
  src?: string
  loadedImage?: unknown | null  // 预加载结果，运行时类型由 Renderer 决定
                                // Canvas: @napi-rs/canvas Image 对象
                                // SVG/HTML: base64 data URL string
  fit?: 'cover' | 'contain'
  borderRadius?: number
  // rect / background
  fill?: ResolvedPaint
  shadow?: { x: number; y: number; blur: number; color: string }
  // group
  children?: LayoutBox[]
}
```

---

## 4. 各层详细设计

### 4.1 Content Layer

**Markdown → ContentBlock[]**

使用 `marked` 的 token walker（非渲染器）遍历 AST：

| Marked token | ContentBlock |
|---|---|
| `heading` (depth 1) | `heroTitle` |
| `heading` (depth 2-3) | `heading` |
| `paragraph` | `paragraph`（inline tokens → Span[]） |
| `list` (unordered) | `bulletList` |
| `list` (ordered) | `orderedList` |
| `blockquote` | `quoteCard` |
| `code` | `codeBlock` |
| `image` | `image` |
| `hr` | `divider` |

Inline 格式（`strong`, `em`, `codespan`）转为 `Span` 的 `bold` / `italic` / `code` 字段。

**JSON → ContentBlock[]**

直接输入，需做 schema 校验（zod 或手写 type guard），校验失败抛出明确错误。

### 4.2 Content Paginator

**职责**：粗估每个 ContentBlock 的渲染高度，将 `ContentBlock[]` 切割成多页。

**输入**：`ContentBlock[]` + content `Template`（取其 `tokens` 和 `contentArea`）

**算法**：

```
availableWidth  = template.contentArea.width
availableHeight = template.contentArea.height
threshold       = availableHeight × 0.85   // 保守 buffer

currentPage = []
currentHeight = 0

for each block in ContentBlock[]:
  h = estimateHeight(block, availableWidth, template.tokens)
  if currentHeight + h > threshold AND currentPage.length > 0:
    pages.push(currentPage)
    currentPage = [block]
    currentHeight = h
  else:
    currentPage.push(block)
    currentHeight += h

pages.push(currentPage)
```

**estimateHeight 实现**：

- `heading` / `paragraph`：用 Pretext `prepare()` + `layout(availableWidth)` 计算精确行数 × `lineHeight`（来自 tokens）
- `image`：按声明高度或 `availableWidth × aspectRatio`（默认 9:16）
- `bulletList` / `steps`：`items.length × estimatedItemHeight`
- `divider`：固定 `tokens.spacing.md`
- `codeBlock`：按行数 × `tokens.typography.code.lineHeight`

**溢出策略**：Layout Engine 精确布局后如有轻微溢出，Renderer 在页面底部 clip，不 re-paginate。

### 4.3 Template Selector

```ts
function selectTemplates(
  pages: ContentBlock[][],
  family: TemplateFamily,
  hasHeroImage: boolean,
): Array<{ blocks: ContentBlock[]; template: Template }>
```

规则：

- `pages[0]`：有封面图且 family 有 cover → `family.cover`，否则 `family.content`
- `pages[1..N-1]`：`family.content`
- `pages[N]`（最后页，且 N > 0）：有 `family.ending` → `family.ending`，否则 `family.content`

### 4.4 Template Engine

**职责**：把 `ContentBlock[]` 绑定到 `Template.root` 的 slot 节点，解析所有 token 引用，执行 rules，输出 `LayoutSpec`。

**slot 节点**（仅存在于 Template 定义内部，不出现在 LayoutSpec）：

```ts
type SlotNode = { type: 'slot'; name: string }
```

绑定过程：遍历 template root 树，遇到 SlotNode 时，根据 `name` 从 ContentBlock[] 中查找对应内容，展开为若干 LayoutSpecNode。

**Slot 命名约定**（模板作者遵循）：

| Slot name | 对应 ContentBlock 类型 |
|---|---|
| `title` | 第一个 `heroTitle` 或 `heading` |
| `subtitle` | `heroTitle.subtitle` 或第二个 `heading` |
| `body` | 全部 `paragraph` blocks |
| `list` | 第一个 `bulletList` / `orderedList` / `steps` |
| `quote` | 第一个 `quoteCard` |
| `cover-image` | 第一个 `image` |
| `tags` | 第一个 `tags` |
| `metrics` | 全部 `metric` blocks |

约定之外的 slot name 由模板自定义，Template Engine 按顺序匹配剩余 blocks。

**Token 解析**：模板定义文件（TypeScript）直接引用 `tokens.xxx` 的字段值构造 LayoutSpecNode，不使用字符串 key 引用。例如 `font: tokens.typography.h1.font`。Template Engine 执行 rules 后，LayoutSpec 中所有值均为已解析的原始值，无需运行时查表。

**Rules 执行**：rules 是函数数组，接收 `RuleContext`（含 blocks 和 mutate），执行后可修改 LayoutSpec 中的节点属性（如切换字体变体、隐藏可选元素）。

### 4.5 Layout Engine

**职责**：接收单页 `LayoutSpec`，用 Textura（Yoga flex 布局 + Pretext 文本测量）计算几何信息，输出 `LayoutBox[]`。同时完成图片预加载。

**流程**：

1. 将 `LayoutSpec` 树转换为 Textura 接受的输入格式
2. 文本节点注册 Pretext `setMeasureFunc` 回调：`prepare(spans) → layout(width) → 返回 { width, height }`
3. 调用 `computeLayout(root, pageWidth, pageHeight)`
4. 遍历 Textura 输出树，收集每个节点的 `{ x, y, width, height }`
5. 文本节点从 Pretext 缓存中取行数据 → 填充 `LayoutBox.lines`
6. 图片节点：并发 fetch / 读文件 → 解码为 `ImageBitmap` → 存入 `LayoutBox.imageBitmap`
7. 按 DFS 顺序 + zIndex 排序输出 `LayoutBox[]`

**⚠️ 风险项（Phase 1 必须首先验证）**：

- Textura 在 Bun 服务端环境的可用性（Yoga Wasm + Bun）
- Pretext `setMeasureFunc` 是否支持多 Span 混排测量
- 两者联合的 API surface 是否与上述流程匹配

如果 Textura 在 Bun 下不可用，降级方案：用 `yoga-layout-wasm` 直接集成，手写 Pretext measureFunc 桥接层，不依赖 Textura 封装。

### 4.6 Renderer

三个 Renderer 实现同一接口：

```ts
interface Renderer {
  renderPage(
    boxes: LayoutBox[],
    size: { width: number; height: number },
  ): Promise<RenderOutput>
}

type RenderOutput =
  | { format: 'png' | 'jpeg'; data: Buffer }
  | { format: 'svg'; data: string }
  | { format: 'html'; data: string }
```

**CanvasRenderer**（`@napi-rs/canvas`）：

1. 创建 `OffscreenCanvas(width, height)`
2. 按 zIndex 升序遍历 `LayoutBox[]`
3. 按 kind 分发：rect → `fillRect` / path；text → 逐行逐 span `fillText`；image → `drawImage`
4. `canvas.encode('png')` / `canvas.encode('jpeg', quality)` → `Buffer`

**SvgRenderer**（纯字符串）：

1. 生成 `<svg>` 根元素（含 `viewBox`、`xmlns`）
2. 按 zIndex 升序遍历 `LayoutBox[]`
3. rect → `<rect>`；text → `<text>` + `<tspan>`（每 span 一个）；image → `<image>`
4. 渐变 → `<defs>` + `<linearGradient>` / `<radialGradient>`
5. 无外部依赖，纯字符串拼接

**HtmlRenderer**（用于预览）：

1. 生成根 `<div>` + `position: relative; width; height; overflow: hidden`
2. 每个 LayoutBox → `position: absolute` div，带 inline style
3. 文本 → 用已计算好的 `lines` 还原为 `<span>` 结构（不依赖浏览器文本排版）

---

## 5. 公共 API

### 高层 API（推荐）

```ts
// Markdown 输入
renderMarkdown(
  markdown: string,
  family: TemplateFamily,
  options?: RenderOptions,
): Promise<RenderOutput[]>   // 每页一个

// ContentBlock 直接输入
renderContent(
  blocks: ContentBlock[],
  family: TemplateFamily,
  options?: RenderOptions,
): Promise<RenderOutput[]>

type RenderOptions = {
  renderer?: 'canvas' | 'svg' | 'html'   // 默认 'canvas'
  format?: 'png' | 'jpeg'                // 默认 'png'，仅 canvas 有效
  quality?: number                        // jpeg quality 0-1
}
```

### 低层 API（逐步控制）

```ts
parseMarkdown(markdown: string): ContentBlock[]
parseJson(raw: unknown): ContentBlock[]
paginateContent(blocks: ContentBlock[], contentTemplate: Template): ContentBlock[][]
selectTemplates(pages: ContentBlock[][], family: TemplateFamily): Array<{ blocks: ContentBlock[]; template: Template }>
applyTemplate(blocks: ContentBlock[], template: Template): LayoutSpec
computeLayout(spec: LayoutSpec, size: { width: number; height: number }): Promise<LayoutBox[]>
renderPage(boxes: LayoutBox[], size: { width: number; height: number }, options: RenderOptions): Promise<RenderOutput>
```

### 辅助 API

```ts
registerFont(path: string, family: string): void
registerRenderer(type: string, renderer: CustomRenderer): void  // 自定义 LayoutBox 绘制器
```

---

## 6. 目录结构

```
src/
├── types.ts                   # 所有公共类型定义（ContentBlock, LayoutSpec, LayoutBox, ...）
│
├── content/
│   ├── parse-markdown.ts      # marked → ContentBlock[]
│   ├── parse-json.ts          # raw JSON → ContentBlock[]（含校验）
│   └── normalize.ts           # 共用规范化逻辑
│
├── template/
│   ├── paginator.ts           # Content Paginator（粗估分页）
│   ├── selector.ts            # Template Selector（按页选模板族）
│   ├── engine.ts              # Template Engine（slot 绑定 + token 解析 + rules）
│   └── tokens.ts              # DesignTokens 默认值与工具函数
│
├── layout/
│   ├── engine.ts              # Layout Engine（Textura 封装）
│   ├── measure-text.ts        # Pretext measureFunc 桥接层
│   └── preload-images.ts      # 图片并发预加载
│
├── renderer/
│   ├── interface.ts           # Renderer 接口定义
│   ├── canvas.ts              # CanvasRenderer
│   ├── svg.ts                 # SvgRenderer
│   ├── html.ts                # HtmlRenderer
│   └── plugins.ts             # 自定义渲染器注册
│
├── templates/
│   ├── tokens/
│   │   ├── default.ts         # 默认 token 集
│   │   └── minimal.ts         # 极简白底 token 集（示例变体）
│   ├── cover/
│   │   ├── hero.ts
│   │   └── image-title.ts
│   ├── content/
│   │   ├── article.ts
│   │   ├── quote.ts
│   │   ├── bullets.ts
│   │   └── metric.ts
│   └── ending/
│       ├── summary.ts
│       └── cta.ts
│
├── pipeline/
│   ├── render-one.ts          # 单次渲染（高层 API 实现）
│   └── render-batch.ts        # 批量渲染
│
└── index.ts                   # 公共 API 导出
```

---

## 7. 已知风险与缓解措施

| 风险 | 严重性 | 缓解措施 |
|---|---|---|
| Textura 在 Bun 下不可用 | 高 | Phase 1 第一个任务验证；降级：直接用 `yoga-layout-wasm` + 手写 Pretext 桥 |
| Pretext 多 Span 混排 measureFunc 不稳定 | 高 | Phase 1 写专项单元测试，覆盖混排 / CJK / Emoji |
| Content Paginator 粗估不准导致溢出 | 中 | 0.85 buffer；Renderer 层 clip 兜底；后期可调整系数 |
| 三端 Renderer LayoutBox 信息不完整 | 中 | LayoutBox 类型一次性定义完整，三端共享，Phase 1 就实现三端防止接口漂移 |
| 模板 rules 函数副作用难以测试 | 低 | `mutate()` 只允许修改白名单路径；rules 纯函数风格，输出可快照测试 |

---

## 8. 实现阶段

### Phase 1：跑通骨架（验证技术选型）

- [ ] 验证 Textura + Bun 兼容性
- [ ] 实现 Content Layer（Markdown + JSON → ContentBlock[]）
- [ ] 实现最简 Template Engine（单模板，无 rules）
- [ ] 实现 Layout Engine（Textura 封装）
- [ ] 实现三端 Renderer 接口（Canvas 完整，SVG / HTML 基础实现）
- [ ] 跑通：Markdown → 单页 PNG / SVG / HTML

### Phase 2：模板系统

- [ ] 实现 Content Paginator
- [ ] 实现 Template Selector（模板族）
- [ ] 实现 Template Rules
- [ ] 迁移 8 个原有模板到新 Template DSL
- [ ] 实现多页输出

### Phase 3：生产强化

- [ ] Content Paginator 准确性调优
- [ ] 批量渲染（`render-batch.ts`）
- [ ] 自定义渲染器插件系统
- [ ] 性能优化（并发页面渲染、图片缓存）
- [ ] 完善 SVG / HTML Renderer

---

## 9. 测试策略

- **单元测试**：每层独立测试，mock 相邻层
  - Content Layer：快照测试 Markdown → ContentBlock[]
  - Template Engine：快照测试 LayoutSpec 输出
  - Layout Engine：测试几何计算正确性
  - Content Paginator：测试边界（单 block 超高、空内容、正好填满）
- **集成测试**：Markdown → LayoutBox[]（不含渲染，纯数据验证）
- **Smoke 测试**：各模板用真实内容端到端渲染，输出 PNG 供人工目视检查
- **覆盖率目标**：80%（Content Layer、Template Engine、Paginator 优先）
