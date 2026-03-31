# marknative

原生 Markdown 渲染引擎。

`marknative` 的目标是把 Markdown 直接变成可分页文档，而不是先变成 HTML 再交给浏览器截图。它关心的是文档排版、分页和输出稳定性，不是网页渲染流程。

## 它要解决什么问题

很多 Markdown 方案本质上依赖浏览器：

- Markdown -> HTML
- HTML -> DOM/CSS
- 浏览器排版
- 截图或导出

但它不适合下面这些需求：

- 需要稳定、可重复的分页结果
- 需要服务端批量渲染
- 需要直接输出 PNG / SVG
- 需要一个原生的 Markdown 排版内核，而不是浏览器工作流

`marknative` 想做的是另一件事：原生渲染 markdown

一句话说，它不是在“渲染网页”，而是在“排版文档”。


## 当前能力

- `CommonMark + GFM` 解析
- 原生文档模型
- block / inline 布局
- 多页分页
- PNG 输出

当前支持的常见 Markdown 语法：

- 标题
- 段落
- 引用
- 有序 / 无序 / 任务列表
- 代码块
- 行内代码
- strong / emphasis / delete
- link
- 图片
- 分隔线

当前还在继续优化的部分：

- 英文段落断行质量
- 更自然的中英混排
- 更成熟的代码块与表格排版
- 公开 theme API

## 5 分钟上手

安装：

```bash
bun add marknative
```

或：

```bash
npm install marknative
```

最小用法：

```ts
import { renderMarkdown } from 'marknative'

const pages = await renderMarkdown(`
# Render API

The API accepts markdown input and returns a paginated set of rendered pages.

## Overview

- Supports CommonMark + GFM
- Produces deterministic page output
- Works without a browser

\`\`\`ts
export async function renderMarkdown(markdown: string) {
  return []
}
\`\`\`
`)

console.log(pages.length)
console.log(pages[0].format) // "png"
console.log(pages[0].data)   // Buffer
```


## API

当前公开 API 很小：

- `renderMarkdown(markdown, options?)`
- `parseMarkdown(markdown)`
- `defaultTheme`

`renderMarkdown()` 签名：

```ts
function renderMarkdown(
  markdown: string,
  options?: {
    format?: 'png' | 'svg'
    painter?: Painter
  },
): Promise<RenderPage[]>
```

返回值是分页数组：

- PNG 页返回 `Buffer`
- SVG 页返回 `string`
- 同时附带布局后的页面元数据

## 技术路线

`marknative` 不自己重写 Markdown parser，也不自己造底层 2D 绘图 API。

当前技术栈：

- `micromark`
- `mdast-util-from-markdown`
- `micromark-extension-gfm`
- `mdast-util-gfm`
- `@chenglou/pretext`
- `skia-canvas`
- `TypeScript`

主链路：

```text
Markdown
-> CommonMark / GFM AST
-> Marknative Document Model
-> Layout
-> Pagination
-> Paint
-> PNG / SVG
```

## 样本与测试

仓库里已经有几组真实场景：

- 技术博客：
  <table>
    <tr>
      <td width="50%">
        <img src="https://oss.liuyaowen.cn/images/20260401004655813.png" alt="技术博客示例第一页" />
      </td>
      <td width="50%">
        <img src="https://oss.liuyaowen.cn/images/20260401004749792.png" alt="技术博客示例第二页" />
      </td>
    </tr>
  </table>

还有几组长文产物可以直接看：

- 全中文：`tests/smoke/output/debug/cn-long-*.png`
- 全英文：`tests/smoke/output/debug/en-long-*.png`
- 中英混排：`tests/smoke/output/debug/mixed-long-*.png`


## Roadmap

接下来优先做的事情：

1. 提升 paragraph line breaking 质量
2. 继续收中英混排规则
3. 提升代码块与表格排版质量
4. 开放 theme 和页面配置
5. 补齐更多标准 Markdown / GFM 细节
