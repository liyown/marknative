/**
 * Apply or strip a bold weight modifier from a CSS font string.
 * Handles the leading "bold " token produced by the layout engine.
 */
export function withFontWeight(font: string, weight: 'bold' | 'normal'): string {
  if (weight === 'normal') return font.replace(/^bold\s+/, '')
  return font.startsWith('bold ') ? font : `bold ${font}`
}

/**
 * Apply or strip an italic style modifier from a CSS font string.
 * Handles the leading "italic " token produced by the layout engine.
 */
export function withFontStyle(font: string, style: 'italic' | 'normal'): string {
  if (style === 'normal') return font.replace(/^italic\s+/, '')
  return font.startsWith('italic ') ? font : `italic ${font}`
}
