/**
 * Production case smoke tests — generate real-world output files.
 * Run: bun test tests/smoke/production-cases.test.ts
 * Output: tests/smoke/output/cases/
 */
import { test, describe, beforeAll } from 'bun:test'
import { renderDoc, renderDocFromJson } from '../../src'
import { defaultTokens, makeTokens } from '../../src/templates/tokens/default'
import type { DesignTokens, RenderConfig } from '../../src/types'
import { writeFileSync, mkdirSync } from 'node:fs'

// ─── Output dir ───────────────────────────────────────────────────────────────

const OUT = 'tests/smoke/output/cases'

// ─── Canvas presets ───────────────────────────────────────────────────────────

/** 竖版卡片 1080×1440 (3:4) */
const portraitConfig: RenderConfig = {
  ds: defaultTokens,
  size: { width: 1080, height: 1440 },
  contentArea: { x: 72, y: 80, width: 936, height: 1280 },
}

/** 方形卡片 1080×1080 (1:1) */
const squareConfig: RenderConfig = {
  ds: defaultTokens,
  size: { width: 1080, height: 1080 },
  contentArea: { x: 80, y: 80, width: 920, height: 920 },
}

/** 横版卡片 1920×1080 (16:9) */
const landscapeConfig: RenderConfig = {
  ds: defaultTokens,
  size: { width: 1920, height: 1080 },
  contentArea: { x: 120, y: 80, width: 1680, height: 920 },
}

/** Story 竖版 1080×1920 (9:16) */
const storyConfig: RenderConfig = {
  ds: defaultTokens,
  size: { width: 1080, height: 1920 },
  contentArea: { x: 80, y: 160, width: 920, height: 1600 },
}

// ─── Theme presets ────────────────────────────────────────────────────────────

const darkTokens: DesignTokens = {
  ...defaultTokens,
  colors: {
    bg:      '#0f172a',
    text:    '#f1f5f9',
    subtext: '#94a3b8',
    primary: '#60a5fa',
    accent:  '#f472b6',
    border:  '#1e293b',
    codeBg:  '#1e293b',
  },
}

const greenTokens: DesignTokens = {
  ...defaultTokens,
  colors: {
    bg:      '#f0fdf4',
    text:    '#14532d',
    subtext: '#4b7c59',
    primary: '#16a34a',
    accent:  '#84cc16',
    border:  '#bbf7d0',
    codeBg:  '#dcfce7',
  },
}

// ─── Cases ────────────────────────────────────────────────────────────────────

describe('production cases', () => {
  beforeAll(() => {
    mkdirSync(OUT, { recursive: true })
  })

  // ── 1. 知识卡片 ───────────────────────────────────────────────────────────
  test('01-knowledge-card: 知识卡片 (portrait)', async () => {
    const md = `
# 费曼学习法

> 如果你不能用简单的语言解释一件事，说明你还没有真正理解它。
> — 理查德·费曼

## 四步核心方法

1. 选择你想学习的概念
2. 用最简单的语言解释它（像教小孩一样）
3. 找出卡壳的地方，回头补充知识
4. 简化语言，消除行话

## 为什么有效

费曼技巧强迫你**主动提取**记忆，而不是被动复习。研究表明，主动回忆比重复阅读的记忆效果高出 **2.5 倍**。

---

#学习方法 #费曼 #效率
`.trim()
    const pages = await renderDoc(md, portraitConfig, { renderer: 'canvas' })
    pages.forEach((p, i) => writeFileSync(`${OUT}/01-knowledge-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 2. 技术教程 ───────────────────────────────────────────────────────────
  test('02-tech-tutorial: 技术教程 (portrait, multi-page)', async () => {
    const md = `
# 用 Bun 构建高性能 HTTP 服务

Bun 是一个极速 JavaScript 运行时，内置打包器、测试框架和包管理器。

## 安装

\`\`\`bash
curl -fsSL https://bun.sh/install | bash
\`\`\`

## 创建服务器

\`\`\`typescript
Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/ping') {
      return new Response('pong')
    }
    return new Response('Not found', { status: 404 })
  },
})
\`\`\`

## 核心优势

- **启动速度** 比 Node.js 快 4×
- **内存占用** 减少 30%
- **原生 TypeScript** 无需 ts-node
- **内置 SQLite** 无需安装 better-sqlite3

## 性能对比

| 指标 | Bun | Node.js |
|------|-----|---------|
| 启动时间 | 6ms | 25ms |
| 请求/秒 | 120k | 60k |

---

#Bun #TypeScript #后端开发
`.trim()
    const pages = await renderDoc(md, portraitConfig, { renderer: 'canvas' })
    pages.forEach((p, i) => writeFileSync(`${OUT}/02-tech-tutorial-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 3. 产品发布 ───────────────────────────────────────────────────────────
  test('03-product-launch: 产品发布 (landscape)', async () => {
    const pages = await renderDocFromJson(
      [
        { type: 'heroTitle', title: 'NoteCard 1.0 发布', subtitle: '用设计系统驱动的 Markdown 渲染引擎' },
        { type: 'divider' },
        { type: 'metric', value: '92%', label: '分页精度提升' },
        { type: 'metric', value: '5×', label: '渲染速度提升' },
        { type: 'metric', value: '152', label: '单元测试通过' },
        { type: 'divider' },
        { type: 'heading', level: 2, text: '核心特性' },
        { type: 'bulletList', items: [
          '设计系统驱动：颜色、排版、间距统一管理',
          '精确分页：基于 Yoga 真实布局测量',
          '多格式输出：PNG、SVG、HTML',
          '支持所有 Markdown 内容块类型',
        ]},
        { type: 'tags', items: ['v1.0', 'open-source', 'TypeScript', 'Bun', 'Yoga'] },
      ],
      { ...landscapeConfig },
      { renderer: 'canvas' },
    )
    pages.forEach((p, i) => writeFileSync(`${OUT}/03-product-launch-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 4. 读书笔记 ───────────────────────────────────────────────────────────
  test('04-book-notes: 读书笔记 (portrait)', async () => {
    const md = `
# 《原则》读书笔记

**作者：** 瑞·达利欧 — 桥水基金创始人

## 核心观点

> 痛苦 + 反思 = 进步。大多数人逃避痛苦，但真正的成长来自于直面它。

> 我宁愿雇佣一个有强烈好奇心和思考能力的人，也不愿意雇佣一个只有漂亮简历的人。

## 五步成功流程

1. 设定清晰的目标
2. 发现并正视问题
3. 诊断问题根源
4. 设计解决方案
5. 执行并跟进

## 我的思考

书中「极度透明」的企业文化让我印象深刻。在大多数组织里，人们倾向于**掩盖错误**而非公开讨论。桥水的做法反其道而行之——把每一个错误都当作集体学习的机会。

这对软件团队同样适用：code review 不是审判，是共同进步。

---

#读书笔记 #原则 #管理 #成长
`.trim()
    const pages = await renderDoc(md, portraitConfig, { renderer: 'canvas' })
    pages.forEach((p, i) => writeFileSync(`${OUT}/04-book-notes-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 5. 数据报告 ───────────────────────────────────────────────────────────
  test('05-data-report: 数据报告 (square)', async () => {
    const pages = await renderDocFromJson(
      [
        { type: 'heroTitle', title: '2025 Q1 增长报告', subtitle: '核心业务指标一览' },
        { type: 'divider' },
        { type: 'metric', value: '128万', label: '月活用户 MAU' },
        { type: 'metric', value: '+34%', label: '同比增长率' },
        { type: 'metric', value: '¥2.4M', label: '季度营收' },
        { type: 'divider' },
        { type: 'heading', level: 2, text: '增长亮点' },
        { type: 'bulletList', items: [
          '内容创作者留存率提升至 71%',
          '付费转化率同比提高 12 个百分点',
          '平均会话时长增加至 8.3 分钟',
        ]},
        { type: 'heading', level: 2, text: '下季度重点' },
        { type: 'steps', items: [
          '上线 AI 辅助创作功能',
          '扩展企业版订阅计划',
          '进入东南亚市场',
        ]},
      ],
      squareConfig,
      { renderer: 'canvas' },
    )
    pages.forEach((p, i) => writeFileSync(`${OUT}/05-data-report-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 6. 暗色主题 ───────────────────────────────────────────────────────────
  test('06-dark-theme: 暗色主题 (portrait)', async () => {
    const md = `
# 深夜码字

凌晨两点，窗外的城市已经沉睡，只有显示器的蓝光陪伴着敲击键盘的声音。

## 今天完成了

- 重构了渲染引擎的分页逻辑
- 修复了 Yoga layout 高度测量的边界 bug
- 写了 47 个单元测试

## 代码片段

\`\`\`typescript
const heights = await measureBlocks(blocks, ds, width)
const pages = paginateByHeights(blocks, heights, pageH, gap)
\`\`\`

## 明天继续

> 好的代码不是写出来的，是删出来的。

删掉了 1658 行旧代码，加了 898 行新代码。净减少 760 行，但功能更强了。

---

#编程 #深夜 #重构
`.trim()
    const darkPortrait: RenderConfig = { ...portraitConfig, ds: darkTokens }
    const pages = await renderDoc(md, darkPortrait, { renderer: 'canvas' })
    pages.forEach((p, i) => writeFileSync(`${OUT}/06-dark-theme-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 7. 绿色主题 + Story 竖版 ───────────────────────────────────────────────
  test('07-green-story: 绿色主题 Story 格式', async () => {
    const md = `
# 今日健康打卡

坚持第 **30 天** 🎯

## 今日完成

- 早起 6:30 ✓
- 跑步 5km ✓
- 喝水 2L ✓
- 冥想 10 分钟 ✓
- 阅读 30 分钟 ✓

## 身体数据

> 每一天的坚持，都是在为未来的自己投资。

## 本周目标进度

1. 体重减少 1kg — **达成**
2. 跑步总距离 35km — **进行中 (28km)**
3. 早睡 11 点前 — **5/7 天**

---

#健康 #打卡 #自律 #运动
`.trim()
    const greenStory: RenderConfig = { ...storyConfig, ds: greenTokens }
    const pages = await renderDoc(md, greenStory, { renderer: 'canvas' })
    pages.forEach((p, i) => writeFileSync(`${OUT}/07-green-story-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 8. 代码教学卡片 ───────────────────────────────────────────────────────
  test('08-code-card: 代码教学卡片', async () => {
    const md = `
# TypeScript 实用技巧

## 类型安全的对象合并

\`\`\`typescript
// 用泛型约束实现安全合并
function merge<T extends object, U extends object>(
  base: T,
  override: Partial<U>,
): T & U {
  return { ...base, ...override } as T & U
}
\`\`\`

## 可选链与空值合并

\`\`\`typescript
// 避免 undefined 层层判断
const city = user?.address?.city ?? '未知城市'
const count = data?.items?.length ?? 0
\`\`\`

## 枚举替代方案

\`\`\`typescript
// 使用 const object 替代 enum，更灵活
const Status = {
  Pending: 'pending',
  Done: 'done',
  Failed: 'failed',
} as const

type Status = typeof Status[keyof typeof Status]
\`\`\`

---

#TypeScript #编程技巧 #前端
`.trim()
    const pages = await renderDoc(md, portraitConfig, { renderer: 'canvas' })
    pages.forEach((p, i) => writeFileSync(`${OUT}/08-code-card-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 9. 全块类型展示 ───────────────────────────────────────────────────────
  test('09-all-block-types: 所有内容块类型展示', async () => {
    const pages = await renderDocFromJson(
      [
        { type: 'heroTitle', title: '全内容块展示', subtitle: '覆盖所有支持的 ContentBlock 类型' },
        { type: 'heading', level: 1, text: 'H1 标题：一级标题' },
        { type: 'heading', level: 2, text: 'H2 标题：二级标题' },
        { type: 'paragraph', spans: [
          { text: '普通段落文字，支持 ' },
          { text: '粗体', bold: true },
          { text: '、' },
          { text: '斜体', italic: true },
          { text: '、' },
          { text: '内联代码', code: true },
          { text: ' 等富文本格式。' },
        ]},
        { type: 'bulletList', items: ['无序列表项 A', '无序列表项 B', '无序列表项 C'] },
        { type: 'orderedList', items: ['有序列表第一项', '有序列表第二项', '有序列表第三项'] },
        { type: 'steps', items: ['步骤一：准备环境', '步骤二：安装依赖', '步骤三：运行服务'] },
        { type: 'quoteCard', text: '这是一段引用文字，支持署名作者。', author: '某某某' },
        { type: 'metric', value: '99.9%', label: '服务可用性' },
        { type: 'codeBlock', code: 'const x = 42\nconsole.log(x)', language: 'typescript' },
        { type: 'divider' },
        { type: 'tags', items: ['标签A', '标签B', '标签C', 'tag-d'] },
      ],
      portraitConfig,
      { renderer: 'canvas' },
    )
    pages.forEach((p, i) => writeFileSync(`${OUT}/09-all-blocks-${i + 1}.png`, (p as { data: Buffer }).data))
  })

  // ── 10. SVG 矢量输出 ─────────────────────────────────────────────────────
  test('10-svg-output: SVG 矢量格式输出', async () => {
    const md = `
# SVG 矢量渲染

这是使用 SVG 渲染器生成的矢量图，可以无损缩放到任意尺寸。

## 适用场景

- 网页内嵌展示
- 高清打印输出
- 动态样式修改

> SVG 保持完整的文字可选中性，利于 SEO 和无障碍访问。

#SVG #矢量 #渲染
`.trim()
    const pages = await renderDoc(md, squareConfig, { renderer: 'svg' })
    pages.forEach((p, i) => writeFileSync(`${OUT}/10-svg-output-${i + 1}.svg`, (p as { data: string }).data))
  })
})
