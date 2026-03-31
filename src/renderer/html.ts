import type { LayoutBox, RenderOutput, ResolvedPaint } from '../types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paintToCss(paint: ResolvedPaint): string {
  if (paint.type === 'color') {
    return `background-color:${paint.value};`
  }

  if (paint.type === 'linear-gradient') {
    const stops = paint.stops.map(stop => `${stop.color} ${stop.offset * 100}%`).join(', ')
    return `background:linear-gradient(${paint.angle}deg, ${stops});`
  }

  return 'background-color:#cccccc;'
}

function shadowToCss(x: number, y: number, blur: number, color: string): string {
  return `box-shadow:${x}px ${y}px ${blur}px ${color};`
}

function imageSrcFromBox(box: LayoutBox): string {
  if (typeof box.loadedImage === 'string') return box.loadedImage
  return box.src ?? ''
}

function baseStyle(box: LayoutBox, x: number, y: number): string {
  return `position:absolute;left:${x}px;top:${y}px;width:${box.width}px;height:${box.height}px;overflow:hidden;`
}

function boxToHtml(box: LayoutBox, parentX = 0, parentY = 0): string {
  const x = box.x - parentX
  const y = box.y - parentY
  const base = baseStyle(box, x, y)

  switch (box.kind) {
    case 'rect': {
      if (!box.fill) return ''

      const radius = box.borderRadius ? `border-radius:${box.borderRadius}px;` : ''
      const shadow = box.shadow ? shadowToCss(box.shadow.x, box.shadow.y, box.shadow.blur, box.shadow.color) : ''
      return `<div style="${base}${paintToCss(box.fill)}${radius}${shadow}"></div>`
    }

    case 'text': {
      if (!box.lines || box.lines.length === 0) return ''

      const linesHtml = box.lines
        .map(line => {
          const align = box.textAlign ? `text-align:${box.textAlign};` : ''
          const useAbsoluteOffsets = !box.textAlign || box.textAlign === 'left'
          const spansHtml = line.spans
            .map(span => {
              const spanStyle = useAbsoluteOffsets
                ? `position:absolute;left:${span.x}px;`
                : ''

              return `<span style="${spanStyle}font:${escapeHtml(span.font)};color:${escapeHtml(span.color)};">${escapeHtml(span.text)}</span>`
            })
            .join('')

          return `<div style="position:absolute;top:${line.y}px;left:0;width:100%;height:${line.height}px;white-space:nowrap;${align}">${spansHtml}</div>`
        })
        .join('')

      return `<div style="${base}">${linesHtml}</div>`
    }

    case 'image': {
      const src = imageSrcFromBox(box)
      const radius = box.borderRadius ? `border-radius:${box.borderRadius}px;` : ''
      const fit = box.fit ?? 'cover'
      return `<div style="${base}${radius}"><img src="${escapeHtml(src)}" style="width:100%;height:100%;object-fit:${fit};" /></div>`
    }

    case 'group': {
      const children = [...(box.children ?? [])]
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map(child => boxToHtml(child, box.x, box.y))
        .join('')

      return `<div style="${base}">${children}</div>`
    }
  }
}

export async function renderPageHtml(
  boxes: LayoutBox[],
  size: { width: number; height: number },
): Promise<RenderOutput> {
  const sorted = [...boxes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  const body = sorted.map(box => boxToHtml(box)).join('\n')
  const html = `<div style="position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:#fff;">\n${body}\n</div>`

  return { format: 'html', data: html }
}
