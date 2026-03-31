import type { ContentBlock, Template, TemplateFamily } from '../types'

function hasImageBlock(blocks: ContentBlock[]): boolean {
  return blocks.some(block => block.type === 'image')
}

export function selectTemplates(
  pages: ContentBlock[][],
  family: TemplateFamily,
): Array<{ blocks: ContentBlock[]; template: Template }> {
  const pageCount = pages.length

  return pages.map((blocks, index) => {
    let template = family.content

    if (pageCount > 1 && index === 0 && family.cover && hasImageBlock(blocks)) {
      template = family.cover
    } else if (pageCount > 1 && index === pageCount - 1 && family.ending) {
      template = family.ending
    }

    return { blocks, template }
  })
}
