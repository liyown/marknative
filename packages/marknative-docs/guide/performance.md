# Performance

## Benchmark Results

All numbers are measured on Apple M-series hardware (warm singletons, all caches populated). Run `bun bench` to reproduce on your machine.

### Throughput by document type — PNG, scale 2 (default)

| Document type | mean | p50 | p90 |
| :--- | ---: | ---: | ---: |
| Plain text (prose + lists + blockquotes) | 116 ms | 115 ms | 120 ms |
| Code-heavy (3 languages, shiki) | 101 ms | 101 ms | 104 ms |
| Math-heavy (4 block + 3 inline formulas) | 100 ms | 99 ms | 103 ms |
| Mixed (math + code) | 98 ms | 97 ms | 100 ms |

### Output format — mixed document

| Format | mean | p50 | p90 | note |
| :--- | ---: | ---: | ---: | :--- |
| SVG | 5.6 ms | 5.6 ms | 6.5 ms | layout + serialize only |
| PNG scale 2 | 99 ms | 98 ms | 102 ms | full rasterize + encode |

SVG is ~17× faster than PNG because it skips rasterisation entirely.

### PNG scale factor — mixed document

| `scale` | Resolution | mean |
| :--- | :--- | ---: |
| 1 | 1080 × ~650 (0.7 MP) | 29 ms |
| 1.5 | 1620 × ~975 (1.6 MP) | 58 ms |
| **2** (default) | **2160 × ~1300 (2.8 MP)** | **99 ms** |
| 3 | 3240 × ~1950 (6.3 MP) | 214 ms |

### Concurrency — plain document, PNG scale 2

| Mode | mean per batch |
| :--- | ---: |
| 1× sequential | 118 ms |
| 2× parallel | 127 ms |
| 4× parallel | 192 ms |
| 8× parallel | 363 ms |

---

## Where the time goes

The rendering pipeline has five stages. Their relative cost for a typical PNG render:

| Stage | Approx. time | Notes |
| :--- | ---: | :--- |
| Markdown parse + model build | < 1 ms | micromark + mdast |
| Syntax highlighting (shiki) | < 1 ms | lazy singleton, cached per language |
| Math pre-render (MathJax) | < 2 ms | lazy singleton, SVG cached per formula |
| Layout + pagination | 2–4 ms | block engine, line-breaking, pagination |
| Canvas draw (skia-canvas) | 1–2 ms | paint operations |
| **PNG encode** (`toBuffer`) | **~93 ms** | **pure CPU PNG compression — ~94% of total** |

**`canvas.toBuffer('png')` dominates.** Everything else — parsing, Shiki, MathJax, layout, and drawing — totals less than 8 ms per page. PNG compression scales linearly with pixel count (proportional to `scale²`).

### Implications

- **Use SVG for previews**: at 5–6 ms per page, SVG gives near-instant output for pipelines that do not need raster images.
- **Use `scale: 1` for batch drafts**: cuts encode time from ~99 ms to ~29 ms while producing full-resolution layout.
- **Use `scale: 2` (default) for final output**: retina quality at ~100 ms/page.
- **Parallel renders scale well**: 4 simultaneous renders complete in ~192 ms (vs ~470 ms sequential) on an 8-core M-series chip.

---

## Cold-start overhead

On first render after process start, two lazy singletons must initialise:

| Singleton | Cold-start cost | Trigger |
| :--- | ---: | :--- |
| MathJax | ~180 ms | First render containing `$` or `$$` math |
| Shiki | ~80 ms | First render containing a fenced code block |

Both singletons are initialised at most once per process. Subsequent renders pay no initialisation cost.

If your application renders many documents, a single warm-up call at startup eliminates cold-start latency for all user-facing renders:

```ts
import { renderMarkdown } from 'marknative'

// Call once at startup to initialise all lazy singletons
await renderMarkdown('# Warm-up\n\n```ts\nconst x = 1\n```\n\n$E = mc^2$')

// All subsequent renders start immediately
```

---

## Tuning recommendations

| Use case | Recommended settings |
| :--- | :--- |
| Fast preview (draft quality) | `format: 'svg'` or `scale: 1` |
| Standard output (retina) | `scale: 2` (default) |
| Print / high-DPI export | `scale: 3` |
| Batch processing (throughput) | `Promise.all` up to CPU core count |
| Single-image output (long doc) | `singlePage: true`, note height capped at 16 384 px |
