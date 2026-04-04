import { expect, test } from 'bun:test'

import { parseMarkdown } from '../../../src/parser/parse-markdown'

test('preserves inline markdown semantics', () => {
  const document = parseMarkdown(
    'Paragraph with *emphasis*, **strong**, `code`, [link](https://example.com), ![inline alt](https://example.com/inline.png "inline title"), and a hard break.  \nNext line.',
  )

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Paragraph with ' },
          {
            type: 'emphasis',
            children: [{ type: 'text', value: 'emphasis' }],
          },
          { type: 'text', value: ', ' },
          {
            type: 'strong',
            children: [{ type: 'text', value: 'strong' }],
          },
          { type: 'text', value: ', ' },
          {
            type: 'inlineCode',
            value: 'code',
          },
          { type: 'text', value: ', ' },
          {
            type: 'link',
            url: 'https://example.com',
            title: null,
            children: [{ type: 'text', value: 'link' }],
          },
          { type: 'text', value: ', ' },
          {
            type: 'inlineImage',
            url: 'https://example.com/inline.png',
            alt: 'inline alt',
            title: 'inline title',
          },
          { type: 'text', value: ', and a hard break.' },
          { type: 'break' },
          { type: 'text', value: 'Next line.' },
        ],
      },
    ],
  })
})

test('resolves reference-style links and images', () => {
  const document = parseMarkdown(`Reference [link][docs] and ![diagram][asset].

[docs]: https://example.com/docs "Docs"
[asset]: https://example.com/diagram.png "Diagram"
`)

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Reference ' },
          {
            type: 'link',
            url: 'https://example.com/docs',
            title: 'Docs',
            children: [{ type: 'text', value: 'link' }],
          },
          { type: 'text', value: ' and ' },
          {
            type: 'inlineImage',
            url: 'https://example.com/diagram.png',
            alt: 'diagram',
            title: 'Diagram',
          },
          { type: 'text', value: '.' },
        ],
      },
    ],
  })
})

test('resolves reference definitions declared inside container blocks', () => {
  const document = parseMarkdown(`> Reference [link][docs]
>
> [docs]: https://example.com/docs "Docs"
`)

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Reference ' },
              {
                type: 'link',
                url: 'https://example.com/docs',
                title: 'Docs',
                children: [{ type: 'text', value: 'link' }],
              },
            ],
          },
        ],
      },
    ],
  })
})

test('preserves inline HTML as literal text', () => {
  const document = parseMarkdown('Inline <span>HTML</span> stays literal.')

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Inline ' },
          { type: 'text', value: '<span>' },
          { type: 'text', value: 'HTML' },
          { type: 'text', value: '</span>' },
          { type: 'text', value: ' stays literal.' },
        ],
      },
    ],
  })
})

test('uses the first matching reference definition when labels are duplicated', () => {
  const document = parseMarkdown(`See [docs][ref].

[ref]: https://example.com/first "First"
[ref]: https://example.com/second "Second"
`)

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'See ' },
          {
            type: 'link',
            url: 'https://example.com/first',
            title: 'First',
            children: [{ type: 'text', value: 'docs' }],
          },
          { type: 'text', value: '.' },
        ],
      },
    ],
  })
})

test('keeps earlier top-level definitions over later container duplicates', () => {
  const document = parseMarkdown(`See [docs][ref].

[ref]: https://example.com/first "First"

> [ref]: https://example.com/second "Second"
`)

  expect(document).toEqual({
    type: 'document',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'See ' },
          {
            type: 'link',
            url: 'https://example.com/first',
            title: 'First',
            children: [{ type: 'text', value: 'docs' }],
          },
          { type: 'text', value: '.' },
        ],
      },
      {
        type: 'blockquote',
        children: [],
      },
    ],
  })
})
