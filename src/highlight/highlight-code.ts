import type { CodeToken, HighlightedCodeBlock, HighlightedCodeLine } from './types'

// FontStyle bitmask constants from @shikijs/vscode-textmate (FontStyle.Italic = 1, Bold = 2)
const SHIKI_ITALIC = 1
const SHIKI_BOLD = 2

type ShikiHighlighter = {
  codeToTokensBase(
    code: string,
    opts: { lang: string; theme: string },
  ): Array<Array<{ content: string; color?: string; fontStyle?: number }>>
}

type ShikiModule = {
  getSingletonHighlighter(opts: { themes: string[]; langs: string[] }): Promise<ShikiHighlighter>
}

export async function highlightCodeBlock(
  source: string,
  lang: string,
  shikiTheme: string,
): Promise<HighlightedCodeBlock | null> {
  try {
    const shiki = (await import('shiki')) as unknown as ShikiModule
    const highlighter = await shiki.getSingletonHighlighter({ themes: [shikiTheme], langs: [lang] })
    const rawLines = highlighter.codeToTokensBase(source, { lang, theme: shikiTheme })

    const lines: HighlightedCodeLine[] = rawLines.map((lineTokens) => ({
      tokens: lineTokens.map(
        (token): CodeToken => ({
          text: token.content,
          color: token.color,
          fontStyle: (token.fontStyle ?? 0) & SHIKI_ITALIC ? 'italic' : undefined,
          fontWeight: (token.fontStyle ?? 0) & SHIKI_BOLD ? 'bold' : undefined,
        }),
      ),
    }))

    return { lang, lines }
  } catch {
    return null
  }
}
