/**
 * Generates per-syntax-element PNG examples for the VitePress docs gallery.
 * Output: docs/public/examples/syntax/*.png
 *
 * Run: bun scripts/generate-syntax-examples.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { renderMarkdown } from '../src'

const OUT = resolve(import.meta.dir, '..', 'docs', 'public', 'examples', 'syntax')
await mkdir(OUT, { recursive: true })

async function save(
  name: string,
  md: string,
  opts: Parameters<typeof renderMarkdown>[1] = {},
): Promise<void> {
  const pages = await renderMarkdown(md, { format: 'png', singlePage: true, ...opts })
  const page = pages[0]
  if (!page || page.format !== 'png') throw new Error('no page')
  await writeFile(resolve(OUT, `${name}.png`), page.data)
  console.log('wrote', name)
}

// Headings — all six levels, showing distinct sizes for H1–H4 and H5–H6
await save('headings', `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
`)

await save('inline', `## Inline Styles

**Bold text** stands out from surrounding prose.
*Italic text* adds emphasis without weight.
***Bold and italic*** applies both simultaneously.
~~Strikethrough~~ marks removed content.
\`inline code\` renders in monospace.
[A hyperlink](https://example.com) navigates to a URL.
`)

await save('unordered-list', `## Unordered List

- First item at the top level
- Second item with **bold** content
- Third item with \`inline code\`
  - Nested item one level deep
  - Another nested item
    - Doubly nested item
  - Back to the first level
- Fourth item at the top level
`)

await save('ordered-list', `## Ordered List

1. Install dependencies
2. Run the development server
3. Open your browser
4. Edit any source file
   1. Sub-step one
   2. Sub-step two
5. Run the test suite
6. Push and open a pull request
`)

await save('task-list', `## Task List

- [x] Parse CommonMark block structure
- [x] Parse GFM extensions
- [x] Build internal document model
- [x] Implement block-level layout engine
- [x] Implement inline line-breaking
- [x] Public theme and page configuration API
- [ ] Improve paragraph line-breaking quality
- [ ] Refine CJK line-breaking rules
`)

await save('blockquote', `## Blockquotes

> A single-line blockquote.

> A multi-line blockquote wraps across several lines.
> Each line begins with a greater-than sign.
> The visual treatment uses a left border.

> **Blockquotes support inline styles.**
> You can use *italic*, \`code\`, and [links](https://example.com).

> Nested blockquotes are valid:
>
> > This is the inner quote, one level deeper.
> >
> > > And this is two levels deep.
`)

await save(
  'code',
  `## Code Blocks

\`\`\`typescript
import { renderMarkdown } from 'marknative'

const pages = await renderMarkdown(markdown, { format: 'png' })
for (const [i, page] of pages.entries()) {
  writeFileSync(\`page-\${i + 1}.png\`, page.data)
}
\`\`\`

\`\`\`bash
bun add marknative
bun run render.ts
\`\`\`
`,
  { codeHighlighting: { theme: 'github-light' } },
)

await save('table', `## Tables

| Syntax Element | CommonMark | GFM |
| :--- | :---: | :---: |
| Headings | ✓ | ✓ |
| Bold / Italic | ✓ | ✓ |
| Strikethrough | ✗ | ✓ |
| Tables | ✗ | ✓ |
| Task Lists | ✗ | ✓ |

| Name | Role | Lines |
| :--- | :---: | ---: |
| parse-markdown.ts | Parser | 42 |
| layout-document.ts | Layout | 511 |
| paginate.ts | Pagination | 95 |
| skia-canvas.ts | Painting | 340 |
`)

await save('image', `## Images

![Landscape](https://picsum.photos/id/10/560/240 "A scenic landscape")

Block images are fetched via HTTP and drawn with aspect-ratio-preserving fit.
`)

await save('thematic-break', `## Thematic Breaks

Three styles of thematic break are all equivalent:

---

(above: hyphens)

***

(above: asterisks)

___

(above: underscores)

All three render identically as a horizontal rule.
`)

await save('math', `## Math

Block formulas:

$$
\\int_a^b f'(x)\\,dx = f(b) - f(a)
$$

$$
p(\\mathbf{x}) = \\frac{1}{(2\\pi)^{d/2}|\\Sigma|^{1/2}}
\\exp\\!\\left(-\\tfrac{1}{2}(\\mathbf{x}-\\boldsymbol{\\mu})^T\\Sigma^{-1}(\\mathbf{x}-\\boldsymbol{\\mu})\\right)
$$

Inline: the gradient $\\nabla f$, entropy $H(X) = -\\sum p \\log p$,
and norm $\\|\\mathbf{x}\\|_2 = \\sqrt{\\sum x_i^2}$.
`)

console.log('✓ all syntax examples generated')
