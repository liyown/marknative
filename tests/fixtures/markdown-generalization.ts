import { articleTemplate } from '../../src/templates/content/article'
import { heroTemplate } from '../../src/templates/cover/hero'
import { summaryTemplate } from '../../src/templates/ending/summary'
import type { TemplateFamily } from '../../src/types'

export type MarkdownGeneralizationCase = {
  name: string
  markdown: string
  family: TemplateFamily
  minPages: number
  expectedText: string[]
}

const family: TemplateFamily = { content: articleTemplate }
const multiPageFamily: TemplateFamily = {
  cover: heroTemplate,
  content: articleTemplate,
  ending: summaryTemplate,
}

const COVER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#102a43"/><stop offset="100%" stop-color="#ef8354"/>' +
      '</linearGradient></defs>' +
      '<rect width="1200" height="675" fill="url(#g)"/>' +
      '<circle cx="920" cy="180" r="140" fill="rgba(255,255,255,0.2)"/>' +
      '<rect x="80" y="460" width="460" height="88" rx="24" fill="rgba(255,255,255,0.18)"/>' +
      '</svg>',
  )

export const markdownGeneralizationCases: MarkdownGeneralizationCase[] = [
  {
    name: 'title and paragraph flow',
    family,
    minPages: 1,
    expectedText: ['泛化测试', '第一段正文', '第二段正文'],
    markdown: `
# 泛化测试

第一段正文，用于验证标题和段落的顺序能保持稳定。

第二段正文，检查单页渲染不会丢字。
`.trim(),
  },
  {
    name: 'mixed blocks stay renderable',
    family,
    minPages: 1,
    expectedText: ['混合内容', '引用内容', 'console.log', '分隔线之后'],
    markdown: `
# 混合内容

> 引用内容

- 列表项一
- 列表项二

1. 步骤一
2. 步骤二

\`\`\`ts
console.log("hello")
\`\`\`

---

分隔线之后还有正文。
`.trim(),
  },
  {
    name: 'cover and long sections paginate across pages',
    family: multiPageFamily,
    minPages: 3,
    expectedText: ['长文分页泛化', '第 1 节', '第 8 节'],
    markdown: `
![封面图](${COVER_IMAGE})

# 长文分页泛化

这是一段开场正文，用于验证封面页之后正文可以继续分页。

${Array.from({ length: 8 }, (_, index) => `## 第 ${index + 1} 节

本节内容用于测试分页是否能覆盖不同 markdown 文章。

正文重复一次，确保每节至少占据一定高度。`).join('\n\n')}
`.trim(),
  },
  {
    name: 'quote list code article without cover still paginates',
    family,
    minPages: 2,
    expectedText: ['无封面长文', '第 1 章', '第 6 章'],
    markdown: `
# 无封面长文

> 先给一个引用块，观察正文流的稳定性。

${Array.from({ length: 6 }, (_, index) => `## 第 ${index + 1} 章

- 列表项 A
- 列表项 B

\`\`\`js
const value = ${index + 1}
\`\`\`

这一章的正文用于测试无封面、多结构混排时的泛化性。`).join('\n\n')}
`.trim(),
  },
]
