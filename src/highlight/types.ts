export type CodeToken = {
  text: string
  color?: string
  fontStyle?: 'italic'
  fontWeight?: 'bold'
}

export type HighlightedCodeLine = {
  tokens: CodeToken[]
}

export type HighlightedCodeBlock = {
  lang: string | null
  lines: HighlightedCodeLine[]
}
