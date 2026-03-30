# NoteCard

小红书风格卡片渲染库。声明式 JSON Schema → PNG/JPEG 图片，**纯服务端运行**，无需浏览器。

基于 [@chenglou/pretext](https://github.com/chenglou/pretext) 实现精准 CJK 文字排版。

## 特性

- **声明式** — 用纯 JSON 描述卡片，无需 DOM
- **服务端** — 基于 `@napi-rs/canvas` + `OffscreenCanvas`，Bun/Node 均可
- **CJK 友好** — pretext 提供逐字符宽度测量，精准换行
- **7 种模板** — basic / quote / list / step / diary / gradient-text / cover
- **可扩展** — 注册自定义元素渲染器（插件系统）
- **图片支持** — 背景图、元素填充、边框圆角、滤镜、混合模式

## 安装

```bash
bun install
```

## 快速上手

```ts
import { renderCard, registerFont, templates } from 'notecard'

// 注册中文字体（必需）
registerFont('/System/Library/Fonts/STHeiti Light.ttc', 'Heiti SC')

// 使用模板
const png = await renderCard(
  templates.basicCard({
    title: '今日份灵感',
    body: '每一个清晨都是一次新的开始...',
    tags: ['每日灵感', '正能量'],
    fontFamily: 'Heiti SC',
  }),
)

// 自定义卡片
const custom = await renderCard({
  width: 1080,
  height: 1440,
  background: { type: 'color', value: '#f0f9ff' },
  elements: [
    { type: 'rect', x: 0, y: 0, width: 1080, height: 200, fill: { type: 'color', value: '#0ea5e9' } },
    {
      type: 'text',
      x: 60, y: 60, width: 960,
      lineHeight: 50,
      spans: [{ content: '你好，世界', font: 'bold 40px Heiti SC', fill: { type: 'color', value: '#fff' } }],
    },
  ],
}, { format: 'jpeg', quality: 0.92 })

require('node:fs').writeFileSync('out.png', png)
```

## 模板一览

| 模板 | 描述 |
|------|------|
| `basicCard` | 白色卡片 + 渐变背景，标题 + 正文 + 标签 |
| `quoteCard` | 居中引言，装饰引号，渐变填充 + 作者 |
| `listCard` | 编号列表，圆角徽章，标题下划线 |
| `stepCard` | 分步指南，大号数字，连接点 |
| `diaryCard` | 日期/星期/天气/心情，内容 + 标签 |
| `gradientTextCard` | 渐变背景 + 居中大文字，10 种预设 |
| `coverCard` | 背景图 + 渐变叠加层，标题描边 + 阴影 |

### gradientTextCard 渐变预设

`sakura` `sunset` `ocean` `mint` `rose` `lemon` `matcha` `sky` `coral` `peach`

## 声明式 Schema

核心类型：

```ts
// 卡片根
type CardSchema = {
  width: number
  height: number
  background: Background
  elements: CardElement[]
}

// 背景
type Background =
  | { type: 'color'; value: string }
  | { type: 'linear-gradient'; angle: number; stops: GradientStop[] }
  | { type: 'radial-gradient'; cx: number; cy: number; r: number; stops: GradientStop[] }
  | { type: 'image'; src: string; fit?: 'cover' | 'contain' | 'fill' }

// 填充（背景/文字/元素均用此类型）
type Paint =
  | { type: 'color'; value: string }
  | { type: 'linear-gradient'; angle: number; stops: GradientStop[] }
  | { type: 'radial-gradient'; cx: number; cy: number; r: number; stops: GradientStop[] }
  | { type: 'image'; src: string; repeat?: 'repeat' | 'no-repeat' }

// 元素
type CardElement = TextElement | ImageElement | RectElement | GroupElement | CustomElement

// 文字
type TextElement = {
  type: 'text'
  x: number; y: number; width: number; lineHeight: number
  align?: 'left' | 'center' | 'right'
  maxLines?: number
  display?: 'block' | 'inline'   // block=每 span 独立段落，inline=多 span 混排
  spans: TextSpan[]
}

// 图片
type ImageElement = {
  type: 'image'
  x: number; y: number; width: number; height: number
  src: string
  borderRadius?: number
  filter?: ImageFilter
}

// 矩形
type RectElement = {
  type: 'rect'
  x: number; y: number; width: number; height: number
  borderRadius?: number
  fill: Paint
  blendMode?: BlendMode
  shadow?: Shadow
  transform?: Transform
  clip?: ClipConfig
}

// 编组（子元素使用相对坐标）
type GroupElement = {
  type: 'group'
  x: number; y: number; width: number; height: number
  children: CardElement[]
}
```

## 文字渲染（pretext）

文字换行由 [pretext](https://github.com/chenglou/pretext) 处理：

- **CJK 断行** — `Intl.Segmenter` grapheme 粒度分割
- **宽度测量** — `canvas.measureText()` 逐字符测量
- **换行计算** — 根据 `maxWidth` 自动决定断行位置
- **`display: inline`** — 多个 `span` 混合排版（粗体/颜色不同的文字同处一行）
- **显式换行** — `\n` 在 `white-space: pre-wrap` 模式下被识别为硬换行

## 字体注册

CJK 字体必须显式注册（服务端无法访问系统字体）：

```ts
import { registerFont } from 'notecard'

// macOS
registerFont('/System/Library/Fonts/STHeiti Light.ttc', 'Heiti SC')
registerFont('/System/Library/Fonts/Hiragino Sans GB.ttc', 'Hiragino Sans GB')

// Windows
registerFont('C:/Windows/Fonts/msyh.ttc', 'Microsoft YaHei')

// Linux
registerFont('/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 'WenQuanYi Micro Hei')
```

**Emoji** — 如需 emoji 支持，需额外注册 emoji 字体（如 macOS 的 Apple Color Emoji）。

## 服务端渲染

```ts
// index.ts
import { renderCard, registerFont, templates } from './index.js'
import index from './index.html'

registerFont('/System/Library/Fonts/Hiragino Sans GB.ttc', 'Hiragino Sans GB')

Bun.serve({
  port: 3000,
  routes: {
    '/': index,
    '/api/card': async (req) => {
      const body = await req.json()
      const image = await renderCard(body.schema, body.options)
      return new Response(image, {
        headers: { 'Content-Type': `image/${body.options?.format ?? 'png'}` },
      })
    },
  },
})
```

## 插件系统

注册自定义元素类型渲染器：

```ts
import { registerRenderer } from 'notecard'

registerRenderer('watermark', (ctx, el, rc) => {
  const { x, y, text, font, color } = el
  ctx.font = font
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
})
```

## API

```ts
// 渲染卡片
renderCard(schema: CardSchema, options?: ExportOptions): Promise<Buffer>

// 注册字体
registerFont(path: string, family: string): void

// 注册自定义渲染器
registerRenderer(type: string, renderer: PluginRenderer): void
```

### ExportOptions

```ts
{ format?: 'png' | 'jpeg', quality?: number }
// quality 仅对 jpeg 有效，范围 0–1
```

## 项目结构

```
src/
├── types.ts          # 所有类型定义
├── setup.ts          # OffscreenCanvas polyfill + registerFont
├── renderer.ts       # renderCard 入口
├── paint.ts          # Paint → canvas fillStyle
├── image-cache.ts    # 图片预加载
├── render-context.ts # RenderContext 类型
├── canvas-utils.ts   # roundedRectPath / applyClip
├── plugins.ts        # registerRenderer / getRenderer
└── elements/
    ├── text.ts       # pretext-powered 文字渲染
    ├── rect.ts       # 矩形/圆角/阴影/变换
    ├── image.ts      # 图片/滤镜/圆角
    └── group.ts      # 编组（相对坐标）
```
