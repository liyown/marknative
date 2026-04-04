import { expect, test } from 'bun:test'

import { fromMdast } from '../../../src/document/from-mdast'

type Root = Parameters<typeof fromMdast>[0]

const root = (children: Root['children']): Root =>
  ({
    type: 'root',
    children,
  }) as Root

test('normalizes ordered list start index', () => {
  expect(
    fromMdast(
      root([
        {
          type: 'list',
          ordered: true,
          start: 3,
          spread: false,
          children: [
            {
              type: 'listItem',
              spread: false,
              checked: null,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'third' }],
                },
              ],
            },
          ],
        },
      ]),
    ),
  ).toEqual({
    type: 'document',
    children: [
      {
        type: 'list',
        ordered: true,
        start: 3,
        spread: false,
        items: [
          {
            type: 'listItem',
            checked: null,
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'third' }],
              },
            ],
          },
        ],
      },
    ],
  })
})

test('normalizes nested list item children', () => {
  expect(
    fromMdast(
      root([
        {
          type: 'list',
          ordered: false,
          spread: false,
          start: null,
          children: [
            {
              type: 'listItem',
              spread: false,
              checked: null,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'parent' }],
                },
                {
                  type: 'list',
                  ordered: false,
                  spread: false,
                  start: null,
                  children: [
                    {
                      type: 'listItem',
                      spread: false,
                      checked: null,
                      children: [
                        {
                          type: 'paragraph',
                          children: [{ type: 'text', value: 'child' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    ),
  ).toEqual({
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
            checked: null,
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'parent' }],
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
                        children: [{ type: 'text', value: 'child' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  })
})

test('normalizes GFM task list checked state', () => {
  expect(
    fromMdast(
      root([
        {
          type: 'list',
          ordered: false,
          spread: false,
          start: null,
          children: [
            {
              type: 'listItem',
              spread: false,
              checked: true,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'done' }],
                },
              ],
            },
            {
              type: 'listItem',
              spread: false,
              checked: false,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'todo' }],
                },
              ],
            },
          ],
        },
      ]),
    ),
  ).toEqual({
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

test('normalizes table rows and cells', () => {
  expect(
    fromMdast(
      root([
        {
          type: 'table',
          align: ['left', 'right'],
          children: [
            {
              type: 'tableRow',
              children: [
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'Header A' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'Header B' }],
                },
              ],
            },
            {
              type: 'tableRow',
              children: [
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'Row A' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'Row B' }],
                },
              ],
            },
          ],
        },
      ]),
    ),
  ).toEqual({
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
              children: [{ type: 'text', value: 'Header A' }],
            },
            {
              type: 'tableCell',
              children: [{ type: 'text', value: 'Header B' }],
            },
          ],
        },
        rows: [
          {
            type: 'tableRow',
            cells: [
              {
                type: 'tableCell',
                children: [{ type: 'text', value: 'Row A' }],
              },
              {
                type: 'tableCell',
                children: [{ type: 'text', value: 'Row B' }],
              },
            ],
          },
        ],
      },
    ],
  })
})

test('normalizes inline link nodes', () => {
  expect(
    fromMdast(
      root([
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'See ' },
            {
              type: 'link',
              url: 'https://example.com/docs',
              title: 'Docs',
              children: [{ type: 'text', value: 'docs' }],
            },
          ],
        },
      ]),
    ),
  ).toEqual({
    type: 'document',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'See ' },
          {
            type: 'link',
            url: 'https://example.com/docs',
            title: 'Docs',
            children: [{ type: 'text', value: 'docs' }],
          },
        ],
      },
    ],
  })
})
