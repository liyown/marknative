import { test, expect, describe } from 'bun:test'
import { measureTextHeight, getTextLines } from '../../src/layout/measure-text'

describe('measureTextHeight', () => {
  test('single line text has height ≈ lineHeight', () => {
    const h = measureTextHeight('Hello', 'bold 40px sans-serif', 60, 1000)
    expect(h).toBeGreaterThanOrEqual(55)
    expect(h).toBeLessThan(90)
  })

  test('wider text wraps to more lines', () => {
    const narrow = measureTextHeight('ABCDEF GHIJKL MNOPQR', 'bold 40px sans-serif', 60, 200)
    const wide = measureTextHeight('ABCDEF GHIJKL MNOPQR', 'bold 40px sans-serif', 60, 2000)
    expect(narrow).toBeGreaterThan(wide)
  })

  test('empty string returns 0', () => {
    expect(measureTextHeight('', 'bold 40px sans-serif', 60, 500)).toBe(0)
  })
})

describe('getTextLines', () => {
  test('returns array of lines', () => {
    const lines = getTextLines('Hello world', 'bold 40px sans-serif', 60, 500)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    const reconstructed = lines.map(line => line.text).join(' ')
    expect(reconstructed).toContain('Hello')
    expect(reconstructed).toContain('world')
    expect(reconstructed.indexOf('Hello')).toBeLessThan(reconstructed.indexOf('world'))
  })
})
