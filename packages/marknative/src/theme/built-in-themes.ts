import { defaultTheme, type Theme, type ThemeOverrides } from './default-theme'
import { mergeTheme } from './merge-theme'

// ── Theme registry ────────────────────────────────────────────────────────────

export const BUILT_IN_THEME_NAMES = [
  'default',
  'github',
  'solarized',
  'sepia',
  'rose',
  'dark',
  'nord',
  'dracula',
  'ocean',
  'forest',
] as const

export type BuiltInThemeName = (typeof BUILT_IN_THEME_NAMES)[number]

export function isBuiltInThemeName(value: string): value is BuiltInThemeName {
  return (BUILT_IN_THEME_NAMES as readonly string[]).includes(value)
}

// ── Light themes ──────────────────────────────────────────────────────────────

/**
 * github — Clean and familiar, modelled after GitHub's Primer design system.
 * Crisp white surface with GitHub's signature blue links and green checkboxes.
 */
const github: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#ffffff',
    text: '#1f2328',
    link: '#0969da',
    mutedText: '#59636e',
    border: '#d1d9e0',
    subtleBorder: '#e7ecf0',
    codeBackground: '#f6f8fa',
    quoteBackground: '#f6f8fa',
    quoteBorder: '#d1d9e0',
    imageBackground: '#f6f8fa',
    imageAccent: '#d1d9e0',
    checkboxChecked: '#1f883d',
    checkboxCheckedMark: '#ffffff',
    checkboxUnchecked: '#d1d9e0',
  },
})

/**
 * solarized — Ethan Schoonover's Solarized Light.
 * Warm cream background with carefully chosen muted tones that reduce eye strain.
 */
const solarized: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#fdf6e3',
    text: '#657b83',
    link: '#268bd2',
    mutedText: '#93a1a1',
    border: '#e8e2cf',
    subtleBorder: '#eee8d5',
    codeBackground: '#eee8d5',
    quoteBackground: '#eee8d5',
    quoteBorder: '#2aa198',
    imageBackground: '#eee8d5',
    imageAccent: '#93a1a1',
    checkboxChecked: '#859900',
    checkboxCheckedMark: '#fdf6e3',
    checkboxUnchecked: '#93a1a1',
  },
})

/**
 * sepia — Aged manuscript paper.
 * Warm amber tones with dark-brown ink evoke an analogue reading experience.
 */
const sepia: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#f8f1e3',
    text: '#3b2a1a',
    link: '#8b4513',
    mutedText: '#876b55',
    border: '#d4c4a8',
    subtleBorder: '#e2d5bc',
    codeBackground: '#f0e8d4',
    quoteBackground: '#f0e8d4',
    quoteBorder: '#b8860b',
    imageBackground: '#e8ddc8',
    imageAccent: '#d4c4a8',
    checkboxChecked: '#8b4513',
    checkboxCheckedMark: '#f8f1e3',
    checkboxUnchecked: '#c4ae90',
  },
})

/**
 * rose — Soft blush and petal pink.
 * Delicate rose hues with deep crimson accents for a refined, feminine aesthetic.
 * The background fades from near-white at the top to a soft pink blush at the bottom.
 */
const rose: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#fff8f9',
    backgroundGradient: {
      type: 'linear',
      angle: 0,
      stops: [
        { offset: 0, color: '#ffffff' },
        { offset: 1, color: '#ffe8f0' },
      ],
    },
    text: '#2d1b25',
    link: '#c2185b',
    mutedText: '#8e6674',
    border: '#f5c2ce',
    subtleBorder: '#fce4ec',
    codeBackground: '#fce4ec',
    quoteBackground: '#fce4ec',
    quoteBorder: '#e91e63',
    imageBackground: '#fce4ec',
    imageAccent: '#f5c2ce',
    checkboxChecked: '#c2185b',
    checkboxCheckedMark: '#fff8f9',
    checkboxUnchecked: '#f5c2ce',
  },
})

// ── Dark themes ───────────────────────────────────────────────────────────────

/**
 * dark — Catppuccin Mocha.
 * A rich dark theme with a purple-navy base and pastel accents, easy on the eyes.
 */
const dark: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#1e1e2e',
    text: '#cdd6f4',
    link: '#89b4fa',
    mutedText: '#a6adc8',
    border: '#45475a',
    subtleBorder: '#313244',
    codeBackground: '#313244',
    quoteBackground: '#181825',
    quoteBorder: '#cba6f7',
    imageBackground: '#181825',
    imageAccent: '#45475a',
    checkboxChecked: '#a6e3a1',
    checkboxCheckedMark: '#1e1e2e',
    checkboxUnchecked: '#585b70',
  },
})

/**
 * nord — Nord dark.
 * Arctic, north-bluish palette with a cold, serene atmosphere and frost-blue accents.
 */
const nord: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#2e3440',
    text: '#eceff4',
    link: '#88c0d0',
    mutedText: '#9099a7',
    border: '#434c5e',
    subtleBorder: '#3b4252',
    codeBackground: '#3b4252',
    quoteBackground: '#272c36',
    quoteBorder: '#81a1c1',
    imageBackground: '#3b4252',
    imageAccent: '#4c566a',
    checkboxChecked: '#a3be8c',
    checkboxCheckedMark: '#2e3440',
    checkboxUnchecked: '#4c566a',
  },
})

/**
 * dracula — Dracula dark.
 * The iconic dark theme with a near-black background and vivid purple/cyan/green accents.
 * Background drifts from pure Dracula black at the top to a hint of deep purple at the bottom.
 */
const dracula: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#282a36',
    backgroundGradient: {
      type: 'linear',
      angle: 0,
      stops: [
        { offset: 0, color: '#282a36' },
        { offset: 1, color: '#1e1a2e' },
      ],
    },
    text: '#f8f8f2',
    link: '#8be9fd',
    mutedText: '#9097bc',
    border: '#44475a',
    subtleBorder: '#3a3d4d',
    codeBackground: '#44475a',
    quoteBackground: '#21222c',
    quoteBorder: '#bd93f9',
    imageBackground: '#21222c',
    imageAccent: '#44475a',
    checkboxChecked: '#50fa7b',
    checkboxCheckedMark: '#282a36',
    checkboxUnchecked: '#6272a4',
  },
})

/**
 * ocean — Deep ocean.
 * Midnight navy depths with aqua light and soft sea-blue text.
 * The background radiates from a slightly lighter deep-blue centre outward to near-black,
 * evoking light filtering down through open water.
 */
const ocean: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#0d1b2a',
    backgroundGradient: {
      type: 'radial',
      stops: [
        { offset: 0, color: '#0d2540' },
        { offset: 1, color: '#060e18' },
      ],
    },
    text: '#b8d4e8',
    link: '#4fc3f7',
    mutedText: '#6b90aa',
    border: '#1e3a52',
    subtleBorder: '#172f43',
    codeBackground: '#0a1a2a',
    quoteBackground: '#091523',
    quoteBorder: '#0288d1',
    imageBackground: '#0a1a2a',
    imageAccent: '#1e3a52',
    checkboxChecked: '#26c6da',
    checkboxCheckedMark: '#0d1b2a',
    checkboxUnchecked: '#1e3a52',
  },
})

/**
 * forest — Dark forest.
 * Deep canopy greens with sage text and bright leaf-green accents.
 * The background fades from rich forest-floor dark at the top to deep undergrowth at the bottom.
 */
const forest: Theme = mergeTheme(defaultTheme, {
  colors: {
    background: '#141f0f',
    backgroundGradient: {
      type: 'linear',
      angle: 0,
      stops: [
        { offset: 0, color: '#1a2a10' },
        { offset: 1, color: '#0a1307' },
      ],
    },
    text: '#c4d9b0',
    link: '#73b955',
    mutedText: '#7a9968',
    border: '#253d1a',
    subtleBorder: '#1d3015',
    codeBackground: '#0f1a0a',
    quoteBackground: '#0c1507',
    quoteBorder: '#4a8c35',
    imageBackground: '#0f1a0a',
    imageAccent: '#253d1a',
    checkboxChecked: '#73b955',
    checkboxCheckedMark: '#141f0f',
    checkboxUnchecked: '#2e4d20',
  },
})

// ── Registry ──────────────────────────────────────────────────────────────────

const registry: Record<BuiltInThemeName, Theme> = {
  default: defaultTheme,
  github,
  solarized,
  sepia,
  rose,
  dark,
  nord,
  dracula,
  ocean,
  forest,
}

/** Return a built-in theme by name. Throws if the name is unknown. */
export function getBuiltInTheme(name: BuiltInThemeName): Theme {
  return registry[name]
}

/**
 * Resolve a `theme` option value into a fully populated `Theme`.
 *
 * - `undefined` → `defaultTheme`
 * - `BuiltInThemeName` string → the named built-in theme
 * - `ThemeOverrides` object → merged onto `defaultTheme`
 */
export function resolveTheme(theme?: ThemeOverrides | BuiltInThemeName): Theme {
  if (!theme) return defaultTheme
  if (typeof theme === 'string') {
    if (!isBuiltInThemeName(theme)) {
      throw new Error(
        `Unknown built-in theme "${theme}". Valid names: ${BUILT_IN_THEME_NAMES.join(', ')}`,
      )
    }
    return registry[theme]
  }
  return mergeTheme(defaultTheme, theme)
}
