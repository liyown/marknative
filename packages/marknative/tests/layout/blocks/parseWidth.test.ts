import { test, expect } from "bun:test";

// Copy parseWidth function for testing
function parseWidth(width: number | string, containerWidth: number): number {
  if (typeof width === 'number') {
    return width > 0 ? width : containerWidth
  }
  if (width === 'fit-content') {
    return -1 // Special marker for caller to handle
  }
  // Support percentage format like "50%", "80%"
  const match = width.match(/^(\d+(?:\.\d+)?)%$/)
  if (match && match[1]) {
    const percentage = parseFloat(match[1])
    if (!isNaN(percentage) && percentage > 0) {
      return (containerWidth * percentage) / 100
    }
  }
  // Default to container width
  return containerWidth
}

test("parseWidth: number > 0 returns the number itself", () => {
  expect(parseWidth(100, 500)).toBe(100)
  expect(parseWidth(300, 500)).toBe(300)
})

test("parseWidth: number <= 0 returns container width", () => {
  expect(parseWidth(0, 500)).toBe(500)
  expect(parseWidth(-10, 500)).toBe(500)
})

test("parseWidth: fit-content returns -1", () => {
  expect(parseWidth('fit-content', 500)).toBe(-1)
})

test("parseWidth: percentage strings", () => {
  expect(parseWidth('50%', 500)).toBe(250)
  expect(parseWidth('100%', 500)).toBe(500)
  expect(parseWidth('25%', 400)).toBe(100)
})

test("parseWidth: decimal percentages", () => {
  expect(parseWidth('33.33%', 300)).toBeCloseTo(99.99)
  expect(parseWidth('66.66%', 300)).toBeCloseTo(199.98)
})

test("parseWidth: invalid percentages return container width", () => {
  expect(parseWidth('abc', 500)).toBe(500)
  expect(parseWidth('50', 500)).toBe(500)
  expect(parseWidth('50 px', 500)).toBe(500)
  expect(parseWidth('', 500)).toBe(500)
})
