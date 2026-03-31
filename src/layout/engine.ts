import { init, computeLayout } from 'textura'
import type { BoxNode, TextNode, LayoutNode, ComputedLayout } from 'textura'
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import type { LayoutSpec, LayoutSpecNode, LayoutBox, TextLine } from '../types'
import { spansToPlainText } from './measure-text'

let initialized = false
let idCounter = 0

function nextId(): string {
  idCounter += 1
  return `box-${idCounter}`
}

export async function initLayoutEngine(): Promise<void> {
  if (!initialized) {
    await init()
    initialized = true
  }
}

function specToTextura(node: LayoutSpecNode): LayoutNode {
  const padding =
    node.type === 'container' && typeof node.padding === 'number' ? node.padding : undefined
  const paddingInset =
    node.type === 'container' && typeof node.padding === 'object' && node.padding
      ? node.padding
      : null

  switch (node.type) {
    case 'container': {
      const box: BoxNode = {
        flexDirection: node.direction === 'row' ? 'row' : 'column',
        width: node.width === 'fill' ? undefined : (node.width ?? 'auto'),
        height:
          node.height === 'fill' || node.height === 'hug'
            ? undefined
            : node.height ?? 'auto',
        ...(node.height === 'fill' ? { flexGrow: 1 } : {}),
        gap: node.gap,
        alignItems:
          node.align === 'start'
            ? 'flex-start'
            : node.align === 'end'
              ? 'flex-end'
              : node.align === 'center'
                ? 'center'
                : node.align === 'stretch'
                  ? 'stretch'
                  : undefined,
        justifyContent:
          node.justify === 'start'
            ? 'flex-start'
            : node.justify === 'end'
              ? 'flex-end'
              : node.justify === 'center'
                ? 'center'
                : node.justify === 'space-between'
                  ? 'space-between'
                  : undefined,
        position: node.position === 'absolute' ? 'absolute' : undefined,
        left: node.position === 'absolute' ? node.x : undefined,
        top: node.position === 'absolute' ? node.y : undefined,
        ...(padding != null ? { padding } : {}),
        ...(paddingInset
          ? {
              paddingTop: paddingInset.top,
              paddingRight: paddingInset.right,
              paddingBottom: paddingInset.bottom,
              paddingLeft: paddingInset.left,
            }
          : {}),
        overflow: 'hidden',
        children: node.children.map(child => specToTextura(child)),
      }
      return box
    }
    case 'text': {
      const textNode: TextNode = {
        text: spansToPlainText(node.spans),
        font: node.font,
        lineHeight: node.lineHeight,
        flexGrow: 0,
        flexShrink: 0,
        width: 'auto',
      }
      return textNode
    }
    case 'image': {
      const box: BoxNode = {
        width: node.width,
        height: node.height,
        flexShrink: 0,
      }
      return box
    }
    case 'rect': {
      const box: BoxNode = {
        width: node.width === 'fill' ? undefined : node.width,
        height: node.height === 'fill' || node.height === 'hug' ? undefined : node.height,
        ...(node.height === 'fill' ? { flexGrow: 1 } : {}),
        flexShrink: 0,
      }
      return box
    }
  }
}

function countRenderedLines(spec: Extract<LayoutSpecNode, { type: 'text' }>, width: number): number {
  const plainText = spansToPlainText(spec.spans)
  if (!plainText.trim()) return 0

  const prepared = prepareWithSegments(plainText, spec.font)
  return layoutWithLines(prepared, width, spec.lineHeight).lines.length
}

function specToTexturaWithMeasuredHeights(
  node: LayoutSpecNode,
  computed: ComputedLayout,
): LayoutNode {
  const texturaNode = specToTextura(node)

  if (node.type === 'text' && node.maxLines != null) {
    const lineCount = countRenderedLines(node, computed.width)
    texturaNode.height = Math.min(lineCount, node.maxLines) * node.lineHeight
    return texturaNode
  }

  if (node.type === 'container') {
    const boxNode = texturaNode as BoxNode
    boxNode.children = node.children.map((child, index) =>
      specToTexturaWithMeasuredHeights(
        child,
        computed.children[index]!,
      ),
    )
  }

  return texturaNode
}

function walkTree(
  spec: LayoutSpecNode,
  computed: ComputedLayout,
  parentX: number,
  parentY: number,
): LayoutBox[] {
  const absX = parentX + computed.x
  const absY = parentY + computed.y
  const boxes: LayoutBox[] = []

  switch (spec.type) {
    case 'container': {
      if (spec.background) {
        boxes.push({
          id: nextId(),
          kind: 'rect',
          x: absX,
          y: absY,
          width: computed.width,
          height: computed.height,
          fill: spec.background,
        })
      }

      for (let index = 0; index < spec.children.length; index += 1) {
        const child = spec.children[index]!
        const childComputed = computed.children[index]
        if (!childComputed) continue
        boxes.push(...walkTree(child, childComputed, absX, absY))
      }
      break
    }
    case 'text': {
      const plainText = spansToPlainText(spec.spans)
      const lines: TextLine[] = []
      let textHeight = computed.height

      if (plainText.trim()) {
        const prepared = prepareWithSegments(plainText, spec.font)
        const result = layoutWithLines(prepared, computed.width, spec.lineHeight)
        const renderedLines =
          spec.maxLines != null ? result.lines.slice(0, spec.maxLines) : result.lines
        let lineY = 0

        for (const line of renderedLines) {
          lines.push({
            y: lineY,
            height: spec.lineHeight,
            spans: [{ text: line.text, font: spec.font, color: spec.color, x: 0 }],
          })
          lineY += spec.lineHeight
        }

        if (spec.maxLines != null) {
          textHeight = renderedLines.length * spec.lineHeight
        }
      }

      boxes.push({
        id: nextId(),
        kind: 'text',
        x: absX,
        y: absY,
        width: computed.width,
        height: textHeight,
        lines,
        textAlign: spec.align,
      })
      break
    }
    case 'image': {
      boxes.push({
        id: nextId(),
        kind: 'image',
        x: absX,
        y: absY,
        width: computed.width,
        height: computed.height,
        src: spec.src,
        fit: spec.fit,
        borderRadius: spec.borderRadius,
      })
      break
    }
    case 'rect': {
      boxes.push({
        id: nextId(),
        kind: 'rect',
        x: absX,
        y: absY,
        width: computed.width,
        height: computed.height,
        fill: spec.fill,
        borderRadius: spec.borderRadius,
        shadow: spec.shadow,
      })
      break
    }
  }

  return boxes
}

export async function computeLayoutBoxes(
  spec: LayoutSpec,
  size: { width: number; height: number },
): Promise<LayoutBox[]> {
  await initLayoutEngine()
  idCounter = 0

  const tree = specToTextura(spec)
  const initialComputed = computeLayout(tree, { width: size.width, height: size.height })
  const cappedTree = specToTexturaWithMeasuredHeights(spec, initialComputed)
  const computed = computeLayout(cappedTree, { width: size.width, height: size.height })
  return walkTree(spec, computed, 0, 0)
}
