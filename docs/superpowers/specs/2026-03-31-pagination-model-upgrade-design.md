# NoteCard Pagination Model Upgrade — 设计文档

**日期**：2026-03-31
**状态**：待评审
**项目**：NoteCard（Markdown / 内容卡片服务端渲染）

---

## 1. 背景与问题

### 现状

当前分页链路是：

```text
ContentBlock[]
-> measureBlocks()
-> paginateByHeights()
-> ContentBlock[][]
-> blockToNodes()
-> render
```

这条链路的核心假设是：

- 一个 `ContentBlock` 只能整体放到某一页
- 分页器只在 block 边界切页

这会直接导致两个问题：

1. **超长单段落溢出**
   一个 `paragraph` block 如果高度大于可用页面高度，当前分页器会把它整块放进单页，最终渲染超出显示区域。

2. **Markdown 长文质量不稳定**
   真正的长 Markdown 通常是“少量标题 + 很长正文段落 + 列表 + 代码块”，而不是天然切成很多短 block。只做 block 级分页会让长文档质量明显劣化。

### 根因

[paginate.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/src/pipeline/paginate.ts) 目前的行为是纯粹的 block 贪心装箱：

- 放得下就放
- 放不下就下一页
- block 本身高于一页时，直接整块占一页

它没有“block 拆分”这个能力。

### 目标

这次升级不是做一个“标题特殊规则”补丁，而是把分页模型升级成：

- block 明确分成 `atomic` 与 `splittable`
- `splittable` block 可以被拆成跨页 fragment
- 分页器按 fragment 分页，而不是只按 block 分页
- 渲染层消费 fragment，而不是强依赖原始 block

---

## 2. 设计目标

### 必须实现

1. `paragraph` 支持按行拆页
2. `codeBlock` 支持按代码行拆页
3. `bulletList / orderedList / steps` 支持按 item 拆页
4. 其余 block 仍然保持原子块分页
5. 分页结果不再是 `ContentBlock[][]`，而是可渲染 fragment 的页数组

### 明确不做

1. 不做 `keepWithNext`
2. 不做 heading 孤儿控制
3. 不做 quoteCard 跨页
4. 不做 image 跨页
5. 不做模板级分页偏好系统
6. 不做复杂软约束引擎

这次升级的目标是先把 Markdown 长正文、长列表、长代码块渲染稳定下来。

---

## 3. 核心思路

### 3.1 语义层与分页层分离

保留现有 `ContentBlock` 作为语义层输入，不污染原始内容模型。

新增一层分页产物：

```text
ContentBlock
-> PageFragment
-> LayoutSpecNode
```

这样：

- Markdown 解析器仍然只负责生成语义 block
- 分页器只负责“怎么拆页”
- 渲染器只负责“怎么画已经拆好的片段”

### 3.2 block 两类策略

每个 block 都先映射成一个默认分页策略：

```ts
type PaginationPolicy =
  | { mode: 'atomic' }
  | { mode: 'splittable'; splitBy: 'lines' | 'items' }
```

默认映射：

- `paragraph`: `splittable-by-lines`
- `codeBlock`: `splittable-by-lines`
- `bulletList`: `splittable-by-items`
- `orderedList`: `splittable-by-items`
- `steps`: `splittable-by-items`
- `heading`: `atomic`
- `heroTitle`: `atomic`
- `quoteCard`: `atomic`
- `tags`: `atomic`
- `image`: `atomic`
- `metric`: `atomic`
- `divider`: `atomic`

---

## 4. 新的数据类型

### 4.1 PageFragment

分页器的输出单元不再是 `ContentBlock`，而是 `PageFragment`：

```ts
type PageFragment =
  | { type: 'block'; block: ContentBlock }
  | {
      type: 'paragraph-fragment'
      spans: Span[]
      continuedFromPrev?: boolean
      continuesToNext?: boolean
    }
  | {
      type: 'code-fragment'
      code: string
      language?: string
      continuedFromPrev?: boolean
      continuesToNext?: boolean
    }
  | {
      type: 'list-fragment'
      listType: 'bullet' | 'ordered' | 'steps'
      items: string[]
      startIndex?: number
      continuedFromPrev?: boolean
      continuesToNext?: boolean
    }
```

说明：

- `block`：用于原子块，直接保留原 block
- `paragraph-fragment`：一个 paragraph 的部分行
- `code-fragment`：一个 codeBlock 的部分代码行
- `list-fragment`：一个列表块的部分 item

### 4.2 BlockPaginatorAdapter

分页器本身不理解 paragraph / list / codeBlock 的细节，而是通过 adapter 接入：

```ts
type BlockPaginatorAdapter = {
  getPolicy(block: ContentBlock): PaginationPolicy

  measureBlock(
    block: ContentBlock,
    ds: DesignTokens,
    contentWidth: number,
  ): Promise<number>

  measureFragment(
    fragment: PageFragment,
    ds: DesignTokens,
    contentWidth: number,
  ): Promise<number>

  splitBlock(
    block: ContentBlock,
    availableHeight: number,
    ds: DesignTokens,
    contentWidth: number,
  ): Promise<{ head: PageFragment | null; tail: PageFragment | null }>

  splitFragment(
    fragment: PageFragment,
    availableHeight: number,
    ds: DesignTokens,
    contentWidth: number,
  ): Promise<{ head: PageFragment | null; tail: PageFragment | null }>

  fragmentToNodes(
    fragment: PageFragment,
    ds: DesignTokens,
    contentWidth: number,
  ): LayoutSpecNode[]
}
```

设计目的：

- 分页器不再写死 block 拆分逻辑
- 每种 block 通过 adapter 描述自己的测量 / 拆分 / 渲染方式
- 后续接入新 block 时，不必重写整个分页器

---

## 5. 首版 fragment 规则

### 5.1 paragraph

拆分单位：渲染行

规则：

1. 先用现有文本测量能力算出 paragraph 在给定宽度下的行数组
2. 根据 `availableHeight / lineHeight` 算出当前页最多可容纳多少行
3. 若全部行都放得下，返回完整 paragraph fragment
4. 若只能放下前 N 行：
   - `head` = 前 N 行
   - `tail` = 剩余行
5. `head.continuesToNext = true`
6. `tail.continuedFromPrev = true`

首版不额外加“续页标记”样式，只保留 continuation 元数据。

### 5.2 codeBlock

拆分单位：代码行

规则：

1. 用 `\n` 拆成逻辑代码行
2. 按 code typography 的 `lineHeight` 计算可容纳行数
3. 外层代码块容器的 padding 要计入测量
4. 拆分后两侧都保留 code block 外框样式

首版不做：

- 语法高亮
- continuation header
- 代码块页间连接视觉

### 5.3 list / steps

拆分单位：item

规则：

1. item 是最小不可拆单元
2. 当前页能放几个 item 就放几个
3. 放不下的剩余 item 进入下一页 fragment
4. `orderedList / steps` 需要保留 `startIndex`

例如：

```ts
{
  type: 'list-fragment',
  listType: 'ordered',
  items: ['第三项', '第四项'],
  startIndex: 3,
  continuedFromPrev: true,
}
```

---

## 6. 新分页流程

### 6.1 旧流程

```text
measureBlocks(blocks)
-> paginateByHeights(blocks, heights)
-> ContentBlock[][]
```

### 6.2 新流程

```text
ContentBlock[]
-> walk blocks in order
-> resolve policy
-> atomic: whole block
-> splittable: try split into head/tail
-> emit PageFragment[] per page
-> PageFragment[][] 
```

核心算法：

```text
for each block:
  if atomic:
    measure whole block
    fits -> push current page
    not fit -> new page, push whole block

  if splittable:
    measure whole block
    fits -> push as one fragment
    not fit -> split into head/tail
      head -> current page
      tail -> carry into next page and continue splitting if needed
```

### 6.3 分页器保底规则

对于 `splittable` block：

1. 如果当前页剩余空间不足，尝试拆分
2. 如果拆不出有效 `head`，则换页后再试
3. 如果新页仍然拆不出有效 `head`：
   - 说明 block 的最小片段仍然大于一页
   - 这是 adapter 或样式配置异常
   - 首版允许把最小片段强制占满该页，避免死循环

对于 `atomic` block：

1. 若整块高于一页，保持现状，单独占页
2. 后续如果需要再对 image / quoteCard 单独升级

---

## 7. 渲染链路如何改

### 7.1 现有结构

当前 [block-to-nodes.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/src/pipeline/block-to-nodes.ts) 只接受 `ContentBlock`。

升级后应新增一层：

```ts
fragmentToNodes(fragment: PageFragment, ds: DesignTokens, contentWidth: number): LayoutSpecNode[]
```

策略：

- `block` fragment：继续复用现有 `blockToNodes()`
- `paragraph-fragment`：渲染成 `text` node
- `code-fragment`：渲染成现有 codeBlock 对应容器
- `list-fragment`：渲染成 list container

### 7.2 renderDoc 链路

当前：

```text
blocks -> measureBlocks -> paginateByHeights -> pageBlocks -> blockToNodes
```

升级后：

```text
blocks -> paginateBlocksToFragments -> pageFragments -> fragmentToNodes
```

也就是说：

- `measureBlocks()` 不再是唯一入口
- `paginateByHeights()` 将被新的 fragment-aware paginator 取代

---

## 8. 文件级改动建议

建议新增和重构这些文件：

**Create**

- `src/pipeline/pagination/policies.ts`
  - block -> policy 映射
- `src/pipeline/pagination/fragments.ts`
  - `PageFragment` 类型与 helpers
- `src/pipeline/pagination/adapters/paragraph.ts`
  - paragraph split / measure / render
- `src/pipeline/pagination/adapters/code-block.ts`
  - codeBlock split / measure / render
- `src/pipeline/pagination/adapters/list.ts`
  - bullet/ordered/steps split / measure / render
- `src/pipeline/pagination/paginate-fragments.ts`
  - 新分页器主流程

**Modify**

- [src/types.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/src/types.ts)
  - 增加 `PageFragment` 与相关类型
- [src/pipeline/render-doc.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/src/pipeline/render-doc.ts)
  - 用新分页器替换 `measureBlocks + paginateByHeights`
- [src/pipeline/block-to-nodes.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/src/pipeline/block-to-nodes.ts)
  - 保留原 block 路径，但拆出 fragment 渲染路径

**Keep Temporarily**

- [src/pipeline/measure.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/src/pipeline/measure.ts)
- [src/pipeline/paginate.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/src/pipeline/paginate.ts)

先不删，等新路径完全接管后再移除。

---

## 9. 测试策略

### 单元测试

必须补这些测试：

1. paragraph 可拆分
   - 一页放不下时产生 `head/tail`
   - 多页连续拆分稳定

2. codeBlock 可拆分
   - 按代码行分页
   - continuation 后代码内容完整

3. list 可拆分
   - 按 item 拆分
   - ordered / steps 的 `startIndex` 正确

4. atomic block 行为不变
   - heading / image / metric 等仍整块分页

### 集成测试

新增 smoke case：

1. 超长单段落 markdown 不再溢出
2. 超长代码块 markdown 可分页
3. 超长列表 markdown 可分页

### 回归测试

以下必须继续通过：

- [tests/pipeline/render-doc.test.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/tests/pipeline/render-doc.test.ts)
- [tests/smoke/production-cases.test.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/tests/smoke/production-cases.test.ts)
- [tests/smoke/story-template-system.test.ts](/Users/liuyaowen/Workspace/javascript/NoteCard/tests/smoke/story-template-system.test.ts)

---

## 10. 风险与取舍

### 风险 1：fragment 层把代码复杂度拉高

这是必要复杂度。问题不是能不能避免 fragment，而是如果没有 fragment，就无法正确表达“一个 block 被切成两页”。

### 风险 2：paragraph split 与实际渲染行不一致

必须复用当前真实测量链路，不能单独写一套“估算换行”逻辑。  
paragraph adapter 必须使用与最终渲染一致的文本布局算法。

### 风险 3：codeBlock / list 后续实现差异大

这是 adapter 模式的价值所在：

- 分页器只负责流程
- 各 block 自己实现拆分细节

### 风险 4：一次性改动太大

因此实现顺序应明确分阶段：

1. 先接 `PageFragment` 和新分页器骨架
2. 先落 `paragraph`
3. 再落 `list`
4. 最后落 `codeBlock`

这样即使中途停下，也能先解决最痛的 Markdown 长段落问题。

---

## 11. 决策摘要

本设计确定以下决策：

1. 分页模型升级为 `atomic / splittable`
2. 语义层 `ContentBlock` 与分页层 `PageFragment` 分离
3. 分页器按 fragment 工作，不再只按 block 工作
4. `paragraph` / `codeBlock` 按行拆页
5. `bulletList / orderedList / steps` 按 item 拆页
6. 其余 block 首版保持 atomic
7. 不做 `keepWithNext` 和 heading 特殊规则

这次升级的目标不是“让分页规则更多”，而是把 Markdown 渲染从“只能按 block 硬切”提升为“能正确处理真实长文内容”。
