export type TypographyStyle = {
  font: string
  lineHeight: number
}

export type DefaultTheme = {
  page: {
    width: number
    height: number
    margin: {
      top: number
      right: number
      bottom: number
      left: number
    }
  }
  typography: {
    h1: TypographyStyle
    h2: TypographyStyle
    body: TypographyStyle
    code: TypographyStyle
  }
  blocks: {
    paragraph: { marginBottom: number }
    heading: { marginTop: number; marginBottom: number }
    list: { marginBottom: number; itemGap: number; indent: number }
    code: { marginBottom: number; padding: number }
    quote: { marginBottom: number; padding: number }
    table: { marginBottom: number; cellPadding: number }
    image: { marginBottom: number }
  }
}

export const defaultTheme: DefaultTheme = {
  page: {
    width: 1080,
    height: 1440,
    margin: {
      top: 80,
      right: 72,
      bottom: 80,
      left: 72,
    },
  },
  typography: {
    h1: { font: 'bold 52px sans-serif', lineHeight: 72 },
    h2: { font: 'bold 38px sans-serif', lineHeight: 54 },
    body: { font: '28px sans-serif', lineHeight: 44 },
    code: { font: '24px monospace', lineHeight: 36 },
  },
  blocks: {
    paragraph: { marginBottom: 24 },
    heading: { marginTop: 40, marginBottom: 20 },
    list: { marginBottom: 24, itemGap: 8, indent: 36 },
    code: { marginBottom: 24, padding: 24 },
    quote: { marginBottom: 24, padding: 24 },
    table: { marginBottom: 24, cellPadding: 16 },
    image: { marginBottom: 24 },
  },
}
