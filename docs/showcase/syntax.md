# Markdown Syntax

Every standard Markdown element rendered by marknative. Each section shows the Markdown source and the actual rendered PNG output.

## Headings

All six heading levels — H1 through H6.

:::tabs
== Markdown
```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```
== Rendered
![Headings rendered output](/examples/syntax/headings.png)
:::

## Inline Styles

Bold, italic, strikethrough, inline code, and links.

:::tabs
== Markdown
```markdown
**Bold text** stands out from surrounding prose.
*Italic text* adds emphasis without weight.
***Bold and italic*** applies both simultaneously.
~~Strikethrough~~ marks removed content.
`inline code` renders in monospace.
[A hyperlink](https://example.com) navigates to a URL.
```
== Rendered
![Inline styles rendered output](/examples/syntax/inline.png)
:::

## Unordered List

Bullet lists with unlimited nesting depth.

:::tabs
== Markdown
```markdown
- Item
- Item with **bold**
  - Nested item
    - Doubly nested
  - Back to level 2
- Final item
```
== Rendered
![Unordered list rendered output](/examples/syntax/unordered-list.png)
:::

## Ordered List

Numbered lists with nested sub-steps.

:::tabs
== Markdown
```markdown
1. Step one
2. Step two
   1. Sub-step
   2. Sub-step
3. Step three
```
== Rendered
![Ordered list rendered output](/examples/syntax/ordered-list.png)
:::

## Task List

GFM task lists with checked and unchecked items.

:::tabs
== Markdown
```markdown
- [x] Done
- [x] Also done
- [ ] Not yet
- [ ] Pending
```
== Rendered
![Task list rendered output](/examples/syntax/task-list.png)
:::

## Blockquote

Single-level and nested blockquotes.

:::tabs
== Markdown
```markdown
> Simple quote

> **Bold** inside a quote.
> With *italic* too.

> Outer
>
> > Inner nested quote
```
== Rendered
![Blockquote rendered output](/examples/syntax/blockquote.png)
:::

## Code Block

Fenced code blocks with syntax-highlighted language tags.

:::tabs
== Markdown
````markdown
```typescript
const pages = await renderMarkdown(md)
```

```bash
bun add marknative
```
````
== Rendered
![Code block rendered output](/examples/syntax/code.png)
:::

## Table

GFM tables with left, center, and right column alignment.

:::tabs
== Markdown
```markdown
| Name       |  Type   | Default |
| :--------- | :-----: | ------: |
| format     | string  |   'png' |
| singlePage | boolean |   false |
```
== Rendered
![Table rendered output](/examples/syntax/table.png)
:::

## Image

Block-level images fetched from remote HTTP URLs.

:::tabs
== Markdown
```markdown
![Landscape](https://picsum.photos/id/10/560/240 "A scenic landscape")
```
== Rendered
![Image rendered output](/examples/syntax/image.png)
:::

## Thematic Break

Horizontal rules — `---`, `***`, and `___` all render identically.

:::tabs
== Markdown
```markdown
Above

---

Middle

***

Below
```
== Rendered
![Thematic break rendered output](/examples/syntax/thematic-break.png)
:::
