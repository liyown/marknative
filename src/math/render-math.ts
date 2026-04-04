import type { InlineMathNode, MathBlockNode, MarkdownDocument, BlockNode, InlineNode } from '../document/types'

export type RenderedMath = {
  /** PNG buffer rendered from the SVG at 2× for retina display */
  svgBuffer: Buffer
  /** Rendered width in CSS pixels */
  width: number
  /** Rendered height in CSS pixels */
  height: number
  /**
   * For inline math: how far the formula descends below the text baseline (px).
   * Used to vertically align the formula with surrounding text.
   */
  depth: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MathJaxDocument = any

let mathJaxDocPromise: Promise<{ doc: MathJaxDocument; adaptor: MathJaxDocument }> | null = null

async function getMathJax(): Promise<{ doc: MathJaxDocument; adaptor: MathJaxDocument }> {
  if (mathJaxDocPromise) return mathJaxDocPromise

  mathJaxDocPromise = (async () => {
    const [
      { mathjax },
      { TeX },
      { SVG },
      { liteAdaptor },
      { RegisterHTMLHandler },
      { AllPackages },
    ] = await Promise.all([
      import('mathjax-full/js/mathjax.js'),
      import('mathjax-full/js/input/tex.js'),
      import('mathjax-full/js/output/svg.js'),
      import('mathjax-full/js/adaptors/liteAdaptor.js'),
      import('mathjax-full/js/handlers/html.js'),
      import('mathjax-full/js/input/tex/AllPackages.js'),
    ])

    const adaptor = liteAdaptor()
    RegisterHTMLHandler(adaptor)

    const doc = mathjax.document('', {
      InputJax: new TeX({ packages: AllPackages }),
      OutputJax: new SVG({ fontCache: 'none' }),
    })

    return { doc, adaptor }
  })()

  return mathJaxDocPromise
}

/**
 * Pre-render all math nodes in the document to SVG buffers.
 * Returns a Map keyed by node reference so the layout engine can look up
 * dimensions and buffers without re-rendering.
 */
export async function prerenderMath(
  document: MarkdownDocument,
  fontSize: number,
  textColor: string,
): Promise<Map<MathBlockNode | InlineMathNode, RenderedMath>> {
  const nodes = collectMathNodes(document)
  if (nodes.length === 0) return new Map()

  const { doc, adaptor } = await getMathJax()
  const map = new Map<MathBlockNode | InlineMathNode, RenderedMath>()

  // ex ≈ 0.45em is a good approximation for sans-serif at common sizes
  const ex = fontSize * 0.45

  for (const node of nodes) {
    const isBlock = node.type === 'mathBlock'
    try {
      const rendered = renderFormula(node.value, isBlock, doc, adaptor, ex, textColor)
      map.set(node, rendered)
    } catch {
      // Skip formulas that fail to render — the layout falls back to empty space
    }
  }

  return map
}

function renderFormula(
  formula: string,
  display: boolean,
  doc: MathJaxDocument,
  adaptor: MathJaxDocument,
  ex: number,
  textColor: string,
): RenderedMath {
  const node = doc.convert(formula, { display, em: ex / 0.45, ex })
  const rawSvg: string = adaptor.outerHTML(adaptor.firstChild(node))

  const widthEx = parseExValue(rawSvg, 'width')
  const heightEx = parseExValue(rawSvg, 'height')
  const depthEx = parseDepthEx(rawSvg)

  // 1× logical pixel dimensions — used for layout and positioning
  const width = Math.ceil(widthEx * ex)
  const height = Math.ceil(heightEx * ex)
  const depth = Math.ceil(depthEx * ex)

  // 2× physical pixel dimensions written into the SVG so skia-canvas rasterizes
  // at double density.  drawImage is always called with the 1× logical size, so
  // the canvas downsamples 2→1, giving noticeably sharper formula rendering.
  const svgWidth = width * 2
  const svgHeight = height * 2

  const svg = rawSvg
    .replace(/(<svg[^>]*)\swidth="[\d.]+ex"/, `$1 width="${svgWidth}"`)
    .replace(/(<svg[^>]*)\sheight="[\d.]+ex"/, `$1 height="${svgHeight}"`)
    .replaceAll('currentColor', textColor)

  return {
    svgBuffer: Buffer.from(svg, 'utf8'),
    width,
    height,
    depth,
  }
}

function parseExValue(svg: string, attr: 'width' | 'height'): number {
  const match = svg.match(new RegExp(`${attr}="([\\d.]+)ex"`))
  return match ? parseFloat(match[1]!) : 0
}

function parseDepthEx(svg: string): number {
  // MathJax encodes the descent below baseline as `vertical-align: -Xex`
  const match = svg.match(/vertical-align:\s*-([\d.]+)ex/)
  return match ? parseFloat(match[1]!) : 0
}

// ─── Node collection ─────────────────────────────────────────────────────────

function collectMathNodes(doc: MarkdownDocument): Array<MathBlockNode | InlineMathNode> {
  const result: Array<MathBlockNode | InlineMathNode> = []
  collectFromBlockNodes(doc.children, result)
  return result
}

function collectFromBlockNodes(nodes: BlockNode[], result: Array<MathBlockNode | InlineMathNode>): void {
  for (const node of nodes) {
    if (node.type === 'mathBlock') {
      result.push(node)
    } else if (node.type === 'heading' || node.type === 'paragraph') {
      collectFromInlineNodes(node.children, result)
    } else if (node.type === 'blockquote') {
      collectFromBlockNodes(node.children, result)
    } else if (node.type === 'list') {
      for (const item of node.items) {
        collectFromBlockNodes(item.children, result)
      }
    } else if (node.type === 'table') {
      const allRows = [node.header, ...node.rows]
      for (const row of allRows) {
        for (const cell of row.cells) {
          collectFromInlineNodes(cell.children, result)
        }
      }
    }
  }
}

function collectFromInlineNodes(nodes: InlineNode[], result: Array<MathBlockNode | InlineMathNode>): void {
  for (const node of nodes) {
    if (node.type === 'inlineMath') {
      result.push(node)
    } else if (node.type === 'strong' || node.type === 'emphasis' || node.type === 'delete' || node.type === 'link') {
      collectFromInlineNodes(node.children, result)
    }
  }
}
