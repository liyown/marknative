export const FULL_SYNTAX_CODE_HIGHLIGHT_THEME = 'github-light'

export const FULL_SYNTAX_MARKDOWN = `# Markdown Complete Syntax Reference

This document exercises every standard Markdown element in a single long-form fixture.
Its purpose is to surface layout regressions across headings, prose, lists, code, tables,
blockquotes, inline styles, images, and thematic breaks.

---

## 1. Headings

# Heading Level 1
## Heading Level 2
### Heading Level 3
#### Heading Level 4
##### Heading Level 5
###### Heading Level 6

All six heading levels should render with visually distinct sizes and weights.

---

## 2. Paragraphs and Inline Styles

Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

**Bold text** stands out from surrounding prose. *Italic text* adds emphasis without weight.
***Bold and italic combined*** applies both styles simultaneously.
~~Strikethrough~~ marks deprecated or removed content.

Inline \`code spans\` render in monospace and highlight short code references like \`useState\`,
\`const x = 42\`, or \`npm install\` without breaking paragraph flow.

Links appear inline: [CommonMark Specification](https://spec.commonmark.org) and
[GitHub Flavored Markdown](https://github.github.com/gfm/) are the two primary standards
this renderer targets.

A hard line break is inserted after this sentence with two trailing spaces.
This line immediately follows the break.

---

## 3. Unordered Lists

- First item at the top level
- Second item continues the list
- Third item with **bold** inline content
- Fourth item with *italic* and \`inline code\` mixed in
  - Nested item one level deep
  - Another nested item
    - Doubly nested item
    - Another doubly nested item
  - Back to the first nesting level
- Fifth item at the top level again

---

## 4. Ordered Lists

1. Install dependencies with \`bun install\`
2. Run the development server using \`bun --hot ./index.ts\`
3. Open your browser and navigate to the local port
4. Edit any source file - hot module replacement kicks in automatically
5. Run the test suite with \`bun test\` before committing
   1. Unit tests cover individual layout functions
   2. Smoke tests render real PNG output for visual inspection
   3. Regression fixtures catch output drift over time
6. Push to the remote branch and open a pull request

---

## 5. Task Lists

- [x] Parse CommonMark block structure
- [x] Parse GFM extensions (tables, strikethrough, task lists)
- [x] Build internal document model from AST
- [x] Implement block-level layout engine
- [x] Implement inline line-breaking with text measurement
- [x] Implement pagination across fixed-size pages
- [ ] Improve paragraph line-breaking quality for English prose
- [ ] Refine CJK and mixed Chinese-English line-breaking rules
- [ ] Polish code block and table rendering
- [ ] Expose public theme and page configuration API
- [ ] Publish first stable release to npm

---

## 6. Blockquotes

> A single-line blockquote is the simplest form.

> A multi-line blockquote wraps across several lines of prose.
> Each line begins with a greater-than sign.
> The visual treatment uses a left border and slightly indented text.

> **Blockquotes support inline styles.**
> You can use *italic*, \`code\`, and even [links](https://example.com) inside a quote.

> Blockquotes can contain block-level children.
>
> A blank line inside the quote separates two distinct paragraphs. This paragraph is
> the second one. Both are visually grouped inside the same blockquote container.
>
> - Lists also work inside blockquotes
> - Each item is indented relative to the quote's own margin

> Nested blockquotes are valid CommonMark:
>
> > This is the inner quote, one level deeper.
> >
> > > And this is two levels deep.

---

## 7. Code Blocks

A fenced code block with a language tag:

\`\`\`typescript
import { renderMarkdown } from 'marknative'

export async function generateCards(markdown: string): Promise<Buffer[]> {
  const pages = await renderMarkdown(markdown, { format: 'png' })
  return pages.map((page) => {
    if (page.format !== 'png') throw new Error('unexpected format')
    return page.data
  })
}
\`\`\`

A JavaScript example using \`Bun.serve()\`:

\`\`\`javascript
import index from './index.html'

Bun.serve({
  routes: {
    '/': index,
    '/api/render': {
      async POST(req) {
        const { markdown } = await req.json()
        const pages = await generateCards(markdown)
        return new Response(pages[0], {
          headers: { 'Content-Type': 'image/png' },
        })
      },
    },
  },
  development: { hmr: true },
})
\`\`\`

A shell script block:

\`\`\`bash
# Install and run
bun add marknative
bun run render.ts

# Run tests
bun test --watch
\`\`\`

A plain code block with no language tag:

\`\`\`
plain text code block
    with preserved indentation
        and multiple indent levels
no syntax highlighting applied
\`\`\`

---

## 8. Tables

A basic three-column table:

| Syntax Element | CommonMark | GFM |
| --- | :---: | :---: |
| Headings | ✓ | ✓ |
| Paragraphs | ✓ | ✓ |
| Bold / Italic | ✓ | ✓ |
| Strikethrough | ✗ | ✓ |
| Tables | ✗ | ✓ |
| Task Lists | ✗ | ✓ |
| Autolinks | ✓ | ✓ |

A table with left, center, and right alignment:

| Name | Role | Lines of Code |
| :--- | :---: | ---: |
| parse-markdown.ts | Parser entry | 42 |
| from-mdast.ts | Document model | 180 |
| layout-document.ts | Block layout | 511 |
| line-layout.ts | Inline layout | 290 |
| paginate.ts | Pagination | 95 |
| skia-canvas.ts | Paint backend | 340 |
| render-markdown.ts | Render pipeline | 429 |

---

## 9. Thematic Breaks

Three styles of thematic break are all equivalent in CommonMark:

***

(above: asterisks)

---

(above: hyphens)

___

(above: underscores)

All three should render identically as a horizontal rule.

---

## 10. Images

A block-level image with alt text and title:

![marknative render pipeline diagram](https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png "Render pipeline overview")

An image inside a paragraph (inline image):

The logo appears here: ![logo](https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Stack_Overflow_icon.svg/64px-Stack_Overflow_icon.svg.png) in the middle of prose.

---

## 11. Mixed Content - Long Prose Section

This section tests how the renderer handles extended paragraph flow with varied inline
content. The goal is to stress the line-breaking algorithm across multiple paragraphs.

In software engineering, a **rendering pipeline** is a sequence of transformations that
converts a high-level description of content - in this case, *Markdown source text* - into
a concrete visual artifact. The pipeline in \`marknative\` is structured in four stages:
parsing, layout, pagination, and painting.

The **parsing** stage accepts raw Markdown and produces an abstract syntax tree (AST).
This project delegates parsing to \`micromark\` and \`mdast-util-from-markdown\`, which
implement the full [CommonMark](https://spec.commonmark.org) specification plus
[GFM extensions](https://github.github.com/gfm/). The AST is then normalized into a
simpler internal document model that is easier to feed into the layout engine.

The **layout** stage walks the document model and assigns each block and inline element
a precise bounding box. Block-level layout handles vertical stacking, margins, padding,
and indentation. Inline layout handles word wrapping, text measurement, and baseline
alignment within a line. Text measurement is critical: without accurate character widths,
line breaks land in the wrong places and text overflows or under-fills the column.

The **pagination** stage slices the laid-out content into fixed-height pages. Each page
corresponds to one output image. Fragments that are too tall to fit on a remaining page
are moved to the next page entirely. No mid-fragment splitting is performed in the current
implementation - this is a known limitation for very tall code blocks or nested lists.

The **painting** stage receives the final page layout and drives a 2D canvas API to draw
all the visual elements: text runs, background fills, borders, bullets, checkboxes, and
images. The default backend uses \`skia-canvas\`, which runs natively in Node.js and Bun
without requiring a browser or a headless Chromium instance.

---

## 12. Inline Edge Cases

Empty list items are handled gracefully:

-
-
- actual content after two empty items

A list with spread items (blank lines between items):

- First spread item

  This paragraph belongs to the first item.

- Second spread item

  This paragraph belongs to the second item.

A blockquote immediately followed by a list:

> This blockquote precedes a list.

- List item right after the blockquote
- Another item
- Final item

A code block immediately followed by a paragraph:

\`\`\`ts
const x = 1
\`\`\`

This paragraph follows the code block without a gap element between them.

---

*End of full syntax fixture.*
`
