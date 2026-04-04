import { describe, expect, test } from 'bun:test'

import { defaultTheme } from '../../src/theme/default-theme'
import type { Theme } from '../../src/theme/default-theme'
import type {
  BlockLayoutFragment,
  Fragment,
  FragmentKind,
  LayoutFragment,
  LineBox,
  PaintBox,
  PageBox,
} from '../../src/layout/types'

const theme: Theme = defaultTheme
type Assert<T extends true> = T
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type _layoutFragmentIsBlock = Assert<IsEqual<LayoutFragment, BlockLayoutFragment>>
type _fragmentAliasIsBlock = Assert<IsEqual<Fragment, BlockLayoutFragment>>
type _fragmentKindIsBlockKind = Assert<IsEqual<FragmentKind, BlockLayoutFragment['kind']>>

describe('defaultTheme', () => {
  test('defines page, typography, and block styles', () => {
    expect(theme.page.width).toBeGreaterThan(0)
    expect(theme.page.height).toBeGreaterThan(0)
    expect(theme.typography.h1.font.length).toBeGreaterThan(0)
    expect(theme.typography.body.lineHeight).toBeGreaterThan(0)
    expect(theme.blocks.list.indent).toBeGreaterThan(0)
    expect(theme.blocks.quote.padding).toBeGreaterThanOrEqual(0)
    expect(theme.blocks.table.cellPadding).toBeGreaterThanOrEqual(0)
    expect(theme.blocks.image.marginBottom).toBeGreaterThan(0)
  })
})

test('exports the shared layout structural types', () => {
  const page: PageBox = {
    type: 'page',
    width: defaultTheme.page.width,
    height: defaultTheme.page.height,
    margin: defaultTheme.page.margin,
    fragments: [],
  }

  const line: LineBox = {
    type: 'line',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    baseline: 0,
    runs: [],
  }

  const paintBox: PaintBox = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }

  const fragment: Fragment = {
    type: 'fragment',
    kind: 'paragraph',
    box: paintBox,
    lines: [line],
  }

  expect(page.fragments).toEqual([])
  expect(fragment.box).toBe(paintBox)
  expect(fragment.lines).toEqual([line])
  expect(paintBox.width).toBe(0)
})
