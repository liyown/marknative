# CLI Reference

`marknative` ships with a command-line interface that renders Markdown files (or stdin) to PNG or SVG pages without writing any Node.js code.

## Installation

```bash
npm install -g marknative
```

Or run without installing:

```bash
npx marknative README.md
```

## Synopsis

```
marknative [options] [input.md]
cat notes.md | marknative [options]
```

When `input.md` is omitted, marknative reads from **stdin**.

## Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--format <fmt>` | `-f` | `png` | Output format: `png` or `svg` |
| `--output <path>` | `-o` | next to input | File or directory path |
| `--theme <name\|json>` | `-t` | `default` | Built-in theme name or a JSON `ThemeOverrides` object |
| `--scale <n>` | `-s` | `2` | PNG pixel-density multiplier |
| `--single-page` | | `false` | Render all content into one image |
| `--code-theme <t>` | | auto | Shiki theme for code blocks |
| `--json` | | `false` | Print a JSON manifest instead of file paths |
| `--help` | `-h` | | Print help |

**Built-in themes:** `default`, `github`, `solarized`, `sepia`, `rose`, `dark`, `nord`, `dracula`, `ocean`, `forest`

## Output path rules

| Condition | Behaviour |
|-----------|-----------|
| No `--output`, single page | File placed next to the source (e.g. `README-01.png`) |
| No `--output`, stdin | File placed in current directory (`output-01.png`) |
| `--output` with extension, single page | Written to that exact path |
| `--output` without extension, or trailing `/` | Treated as directory; files named `<stem>-01.png`, `<stem>-02.png`, … |
| `--format svg`, single page, no `--output` | SVG written to **stdout** |

## Examples

```bash
# Render a file — pages appear next to README.md
marknative README.md

# Write pages into an explicit directory
marknative README.md -o out/

# Single PNG file (one-page document)
marknative slide.md -o slide.png

# SVG output
marknative diagram.md -f svg -o diagram.svg

# Dark theme, lower scale (fast preview)
cat notes.md | marknative -t dark -s 1 -o preview.png

# High-resolution export
marknative doc.md -s 3 -o print/

# Single-page mode — no pagination
marknative long-doc.md --single-page -o poster.png

# Custom code-block theme
marknative doc.md --code-theme dracula

# Inline JSON theme
marknative doc.md -t '{"colors":{"background":"#1e1e2e","text":"#cdd6f4"}}'

# SVG piped to another tool
marknative doc.md -f svg | rsvg-convert -o doc.pdf
```

## JSON output mode

Pass `--json` to get a machine-readable manifest — useful in scripts and agent workflows:

```bash
marknative report.md --json
```

```json
{
  "pages": [
    { "index": 1, "path": "/abs/path/report-01.png", "format": "png" },
    { "index": 2, "path": "/abs/path/report-02.png", "format": "png" }
  ]
}
```

Extract paths with `jq`:

```bash
# All paths as newline-separated list
marknative report.md --json | jq -r '.pages[].path'

# First page only
marknative report.md --json | jq -r '.pages[0].path'
```

## Scale and performance

| `--scale` | Time per page | Typical use |
|-----------|--------------|-------------|
| `1` | ~29 ms | Quick preview |
| `2` | ~99 ms | Default — screen quality |
| `3` | ~214 ms | High-res / print |

The **first render** in a new process takes an extra 1–3 s for cold-start (skia-canvas, MathJax, Shiki). Subsequent renders in the same process are fast.

## Claude Code skill

A companion skill package [`marknative-skill`](https://www.npmjs.com/package/marknative-skill) teaches Claude Code agents how to use the CLI. Install it via the Vercel skills system to let agents render Markdown automatically.
