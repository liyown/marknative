import type { LayoutBox, RenderOutput, ResolvedPaint } from '../types'

let defCounter = 0

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function paintToSvgFill(paint: ResolvedPaint, id: string): { fill: string; def?: string } {
  if (paint.type === 'color') {
    return { fill: paint.value }
  }

  if (paint.type === 'linear-gradient') {
    const gradId = `grad-${id}`
    const radians = ((paint.angle - 90) * Math.PI) / 180
    const x1 = 50 - Math.cos(radians) * 50
    const y1 = 50 - Math.sin(radians) * 50
    const x2 = 50 + Math.cos(radians) * 50
    const y2 = 50 + Math.sin(radians) * 50
    const stops = paint.stops
      .map(stop => `<stop offset="${stop.offset}" stop-color="${escapeXml(stop.color)}"/>`)
      .join('')

    return {
      fill: `url(#${gradId})`,
      def: `<linearGradient id="${gradId}" gradientUnits="objectBoundingBox" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`,
    }
  }

  return { fill: '#cccccc' }
}

function shadowToStyle(x: number, y: number, blur: number, color: string): string {
  return `filter: drop-shadow(${x}px ${y}px ${blur}px ${color});`
}

function boxToSvg(box: LayoutBox, defs: string[], parentX = 0, parentY = 0): string {
  const x = box.x - parentX
  const y = box.y - parentY
  const { width: w, height: h } = box

  switch (box.kind) {
    case 'rect': {
      if (!box.fill) return ''

      const { fill, def } = paintToSvgFill(box.fill, `${++defCounter}`)
      if (def) defs.push(def)

      const rx = box.borderRadius && box.borderRadius > 0 ? ` rx="${box.borderRadius}" ry="${box.borderRadius}"` : ''
      const style = box.shadow
        ? ` style="${escapeXml(shadowToStyle(box.shadow.x, box.shadow.y, box.shadow.blur, box.shadow.color))}"`
        : ''

      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx} fill="${fill}"${style}/>`
    }
    case 'text': {
      if (!box.lines || box.lines.length === 0) return ''

      const parts: string[] = []
      for (const line of box.lines) {
        const lineY = y + line.y + line.height * 0.8
        const lineWidth = line.spans.reduce((max, span) => Math.max(max, span.x), 0)
        const alignOffset =
          box.textAlign === 'center'
            ? (w - lineWidth) / 2
            : box.textAlign === 'right'
              ? w - lineWidth
              : 0

        for (const span of line.spans) {
          const textX = x + span.x + alignOffset
          const anchor =
            box.textAlign === 'center'
              ? ' text-anchor="middle"'
              : box.textAlign === 'right'
                ? ' text-anchor="end"'
                : ''

          parts.push(
            `<text x="${textX}" y="${lineY}" font="${escapeXml(span.font)}" fill="${escapeXml(span.color)}"${anchor}>` +
              `<tspan>${escapeXml(span.text)}</tspan></text>`,
          )
        }
      }

      return parts.join('\n')
    }
    case 'image': {
      if (!box.src && typeof box.loadedImage !== 'string') return ''

      const src = typeof box.loadedImage === 'string' ? box.loadedImage : box.src ?? ''
      const rx = box.borderRadius && box.borderRadius > 0 ? ` rx="${box.borderRadius}" ry="${box.borderRadius}"` : ''
      const preserveAspectRatio = box.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'

      return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(src)}"${rx} preserveAspectRatio="${preserveAspectRatio}"/>`
    }
    case 'group': {
      const children = (box.children ?? [])
        .slice()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map(child => boxToSvg(child, defs, box.x, box.y))
        .join('\n')

      return `<g transform="translate(${x},${y})">${children}</g>`
    }
  }
}

export async function renderPageSvg(
  boxes: LayoutBox[],
  size: { width: number; height: number },
): Promise<RenderOutput> {
  defCounter = 0

  const defs: string[] = []
  const sorted = [...boxes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  const body = sorted.map(box => boxToSvg(box, defs)).filter(Boolean).join('\n')
  const defsBlock = defs.length > 0 ? `<defs>${defs.join('')}</defs>` : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">` +
    `${defsBlock ? `\n${defsBlock}` : ''}` +
    `${body ? `\n${body}` : ''}` +
    `\n</svg>`

  return { format: 'svg', data: svg }
}
