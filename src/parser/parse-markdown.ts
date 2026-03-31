import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'

import { fromMdast } from '../document/from-mdast'
import type { MarkdownDocument } from '../document/types'

export function parseMarkdown(markdown: string): MarkdownDocument {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })

  return fromMdast(tree as unknown as Parameters<typeof fromMdast>[0])
}
