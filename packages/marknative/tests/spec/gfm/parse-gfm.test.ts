import { expect, test } from 'bun:test'

import { parseMarkdown } from '../../../src/parser/parse-markdown'

test('parses GFM tables', () => {
  const document = parseMarkdown(`| Left | Right |
| :--- | ----: |
| a | b |
`)

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'table',
        align: ['left', 'right'],
        header: {
          type: 'tableRow',
          cells: [
            {
              type: 'tableCell',
              children: [{ type: 'text', value: 'Left' }],
            },
            {
              type: 'tableCell',
              children: [{ type: 'text', value: 'Right' }],
            },
          ],
        },
        rows: [
          {
            type: 'tableRow',
            cells: [
              {
                type: 'tableCell',
                children: [{ type: 'text', value: 'a' }],
              },
              {
                type: 'tableCell',
                children: [{ type: 'text', value: 'b' }],
              },
            ],
          },
        ],
      },
    ],
  })
})

test('preserves GFM strikethrough semantics', () => {
  const document = parseMarkdown('Keep ~~deleted~~ text.')

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Keep ' },
          {
            type: 'delete',
            children: [{ type: 'text', value: 'deleted' }],
          },
          { type: 'text', value: ' text.' },
        ],
      },
    ],
  })
})

test('preserves GFM task list checked state', () => {
  const document = parseMarkdown(`- [x] done
- [ ] todo
`)

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'list',
        ordered: false,
        start: null,
        spread: false,
        items: [
          {
            type: 'listItem',
            checked: true,
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'done' }],
              },
            ],
          },
          {
            type: 'listItem',
            checked: false,
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'todo' }],
              },
            ],
          },
        ],
      },
    ],
  })
})

test('throws on unsupported GFM footnotes instead of dropping them', () => {
  expect(() =>
    parseMarkdown(`Paragraph with a footnote.[^note]

[^note]: Footnote body
`),
  ).toThrow(/Unsupported mdast node/)
})
