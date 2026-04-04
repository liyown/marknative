import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('package metadata does not declare marknative as its own dependency', () => {
  const packageJsonPath = resolve(import.meta.dir, '..', '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name?: string
    dependencies?: Record<string, string>
  }

  expect(packageJson.name).toBe('marknative')
  expect(packageJson.dependencies?.marknative).toBeUndefined()
})
