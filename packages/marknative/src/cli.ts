#!/usr/bin/env node
/**
 * marknative CLI
 *
 * Render a Markdown file (or stdin) to PNG or SVG pages.
 *
 * Usage:
 *   marknative [options] [input.md]
 *   cat notes.md | marknative [options]
 */

import { parseArgs } from 'node:util'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename, extname } from 'node:path'

// Import from the compiled library bundle at runtime so the CLI does not
// duplicate library code in its own bundle.
import { renderMarkdown, BUILT_IN_THEME_NAMES } from 'marknative'
import type { RenderMarkdownOptions } from 'marknative'

// ─── Argument parsing ─────────────────────────────────────────────────────────

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    format:      { type: 'string',  short: 'f', default: 'png' },
    output:      { type: 'string',  short: 'o' },
    theme:       { type: 'string',  short: 't' },
    scale:       { type: 'string',  short: 's' },
    'single-page': { type: 'boolean' },
    'code-theme':  { type: 'string' },
    json:        { type: 'boolean' },
    help:        { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help) {
  printHelp()
  process.exit(0)
}

// ─── Read input ───────────────────────────────────────────────────────────────

const inputFile = positionals[0]
const markdown = inputFile
  ? await readFile(inputFile, 'utf8')
  : await readStdin()

if (!markdown.trim()) {
  die('No markdown input. Provide a file path or pipe content to stdin.')
}

// ─── Build render options ─────────────────────────────────────────────────────

const format = (values.format ?? 'png') as 'png' | 'svg'
if (format !== 'png' && format !== 'svg') die(`Unknown format "${values.format}". Use png or svg.`)

const options: RenderMarkdownOptions = { format, singlePage: values['single-page'] }

if (values.theme) {
  try {
    options.theme = JSON.parse(values.theme)
  } catch {
    options.theme = values.theme as Parameters<typeof renderMarkdown>[1] extends { theme?: infer T } ? T : never
  }
}

if (values.scale !== undefined) {
  const scale = Number(values.scale)
  if (isNaN(scale) || scale <= 0) die(`Invalid scale "${values.scale}". Must be a positive number.`)
  options.scale = scale
}

if (values['code-theme']) {
  options.codeHighlighting = { theme: values['code-theme'] }
}

// ─── Render ───────────────────────────────────────────────────────────────────

const pages = await renderMarkdown(markdown, options)
const ext = format === 'svg' ? '.svg' : '.png'

// ─── Resolve output paths ─────────────────────────────────────────────────────

// SVG single-page with no --output → write to stdout (pipe-friendly)
const svgToStdout = format === 'svg' && pages.length === 1 && !values.output && !values.json

const outputPaths: string[] = []

if (!svgToStdout) {
  if (values.output) {
    // Treat as directory if: multiple pages, trailing slash, or no file extension
    const asDir = pages.length > 1 || values.output.endsWith('/') || values.output.endsWith('\\') || !extname(values.output)
    if (!asDir) {
      outputPaths.push(resolve(values.output))
    } else {
      const dir = resolve(values.output)
      await mkdir(dir, { recursive: true })
      const stem = inputFile ? basename(inputFile, extname(inputFile)) : 'output'
      for (let i = 0; i < pages.length; i++) {
        const suffix = pages.length === 1 ? '' : `-${pad(i + 1)}`
        outputPaths.push(resolve(dir, `${stem}${suffix}${ext}`))
      }
    }
  } else {
    // Default: next to the input file, or cwd when reading stdin
    const stem = inputFile ? basename(inputFile, extname(inputFile)) : 'output'
    const dir  = inputFile ? dirname(resolve(inputFile)) : process.cwd()
    for (let i = 0; i < pages.length; i++) {
      const suffix = pages.length === 1 ? '' : `-${pad(i + 1)}`
      outputPaths.push(resolve(dir, `${stem}${suffix}${ext}`))
    }
  }
}

// ─── Write output ─────────────────────────────────────────────────────────────

if (svgToStdout) {
  const page = pages[0]!
  if (page.format === 'svg') process.stdout.write(page.data)
} else {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!
    const outPath = outputPaths[i]!
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, page.format === 'png' ? page.data : page.data, page.format === 'png' ? undefined : 'utf8')
  }

  if (values.json) {
    process.stdout.write(
      JSON.stringify({
        pages: outputPaths.map((path, i) => ({ index: i + 1, path, format })),
      }, null, 2) + '\n',
    )
  } else {
    for (const p of outputPaths) process.stdout.write(p + '\n')
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return ''
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function die(msg: string): never {
  process.stderr.write(`error: ${msg}\n`)
  process.exit(1)
}

function printHelp(): void {
  const themes = BUILT_IN_THEME_NAMES.join(', ')
  process.stdout.write(`
marknative — render Markdown to PNG or SVG

USAGE
  marknative [options] [input.md]
  cat notes.md | marknative [options]

INPUT
  [input.md]              Markdown file to render (reads stdin when omitted)

OUTPUT
  -o, --output <path>     Write to this file (single page) or directory (multi-page)
                          SVG single-page is written to stdout when omitted
  --json                  Print a JSON manifest of written files instead of paths

RENDER OPTIONS
  -f, --format <fmt>      Output format: png · svg  (default: png)
  -t, --theme <name|json> Built-in theme name or a JSON ThemeOverrides object
                          Names: ${themes}
  -s, --scale <n>         PNG pixel density multiplier  (default: 2)
                            1 ≈ 29 ms/page   2 ≈ 99 ms   3 ≈ 214 ms
      --single-page       Render into one image instead of paginating
      --code-theme <t>    Shiki theme for code blocks (default: auto from page bg)

  -h, --help              Show this message

EXAMPLES
  # Render a file → page-01.png, page-02.png … next to the source
  marknative README.md

  # Write pages into a directory
  marknative README.md -o out/

  # Single SVG file
  marknative diagram.md -f svg -o diagram.svg

  # Pipe markdown in, dark theme, scale 1 (fast preview)
  cat notes.md | marknative -t dark -s 1 -o preview.png

  # Machine-readable output for agents / scripts
  marknative report.md --json
  # → {"pages":[{"index":1,"path":"/abs/report-01.png","format":"png"},…]}

  # SVG to stdout (pipe into another tool)
  marknative slide.md -f svg | rsvg-convert -o slide.pdf
`.trimStart())
}
