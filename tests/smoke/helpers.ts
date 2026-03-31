import { expect } from 'bun:test'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { RenderPage } from '../../src/render/render-markdown'

export async function prepareSmokeOutputDir(outputDir: string): Promise<void> {
  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })
}

export async function writeSmokePages(
  outputDir: string,
  filePrefix: string,
  pages: RenderPage[],
): Promise<string[]> {
  const writtenFiles: string[] = []

  for (const [index, page] of pages.entries()) {
    expect(page.format).toBe('png')

    if (page.format !== 'png') {
      throw new Error('Expected png smoke output')
    }

    expect(Buffer.isBuffer(page.data)).toBe(true)
    expect(page.data.byteLength).toBeGreaterThan(0)

    const filePath = join(outputDir, `${filePrefix}-${String(index + 1).padStart(2, '0')}.png`)
    await writeFile(filePath, page.data)
    expect((await stat(filePath)).size).toBeGreaterThan(0)
    writtenFiles.push(filePath)
  }

  return writtenFiles
}

export async function expectExactSmokeOutputs(outputDir: string, expectedFiles: string[]): Promise<void> {
  const actualFiles = (await readdir(outputDir)).filter((name) => name.endsWith('.png')).sort()
  expect(actualFiles).toEqual(expectedFiles.slice().sort())
}

export function pageFragmentKinds(page: RenderPage): string[] {
  return page.page.fragments.map((fragment) => fragment.kind)
}
