import { expect, test } from 'bun:test'

import { parseMarkdown } from '../../../src/parser/parse-markdown'

test('parses block-level markdown nodes', () => {
  const document = parseMarkdown(`# Heading

Paragraph text.

> Quote line

- First item
- Second item

\`\`\`ts
console.log('code')
\`\`\`

---

![Alt text](https://example.com/image.png "Caption")
`)

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'heading',
        depth: 1,
        children: [{ type: 'text', value: 'Heading' }],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'Paragraph text.' }],
      },
      {
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'Quote line' }],
          },
        ],
      },
      {
        type: 'list',
        ordered: false,
        start: null,
        spread: false,
        items: [
          {
            type: 'listItem',
            checked: null,
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'First item' }],
              },
            ],
          },
          {
            type: 'listItem',
            checked: null,
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Second item' }],
              },
            ],
          },
        ],
      },
      {
        type: 'codeBlock',
        lang: 'ts',
        meta: null,
        value: "console.log('code')",
      },
      {
        type: 'thematicBreak',
      },
      {
        type: 'image',
        alt: 'Alt text',
        url: 'https://example.com/image.png',
        title: 'Caption',
      },
    ],
  })
})

test('preserves raw HTML blocks as literal paragraph text', () => {
  const document = parseMarkdown(`<div class="note">
literal html
</div>`)

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', value: '<div class="note">\nliteral html\n</div>' }],
      },
    ],
  })
})
