export type GradientStop = {
  offset: number // 0–1
  color: string
}

export type Paint =
  | { type: 'color'; value: string }
  | { type: 'linear-gradient'; angle: number; stops: GradientStop[] }
  | { type: 'radial-gradient'; cx: number; cy: number; r: number; stops: GradientStop[] }
  | { type: 'image'; src: string; repeat?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat' }

export type Shadow = {
  dx: number
  dy: number
  blur: number
  color: string
}

export type Transform = {
  rotate?: number           // degrees clockwise
  scaleX?: number
  scaleY?: number
  anchor?: [number, number] // relative pivot [0–1, 0–1], default [0.5, 0.5]
}

export type ClipConfig =
  | { type: 'circle' }
  | { type: 'rect'; radius?: number }

export type BlendMode =
  | 'source-over' | 'source-in' | 'source-out' | 'source-atop'
  | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop'
  | 'lighter' | 'copy' | 'xor'
  | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'

type BaseElement = {
  x: number
  y: number
  opacity?: number
  shadow?: Shadow
  transform?: Transform
  blendMode?: BlendMode
  clip?: ClipConfig
}

export type TextSpan = {
  content: string
  font: string  // CSS font shorthand, e.g. 'bold 32px MiSans'
  fill: Paint
  stroke?: { paint: Paint; width: number }
}

export type TextElement = BaseElement & {
  type: 'text'
  spans: TextSpan[]
  width: number
  lineHeight: number
  align?: 'left' | 'center' | 'right'
  maxLines?: number
  display?: 'block' | 'inline' // 'block' (default): each span is its own paragraph; 'inline': spans flow together
}

export type ImageFilter = {
  blur?: number        // px
  brightness?: number  // 0–2, 1 = normal
  contrast?: number    // 0–2, 1 = normal
  saturate?: number    // 0–2, 1 = normal
  grayscale?: number   // 0–1
}

export type ImageElement = BaseElement & {
  type: 'image'
  src: string
  width: number
  height: number
  borderRadius?: number
  filter?: ImageFilter
}

export type RectElement = BaseElement & {
  type: 'rect'
  width: number
  height: number
  fill?: Paint
  stroke?: { paint: Paint; width: number }
  borderRadius?: number
}

// Forward declaration for recursive type
export type GroupElement = BaseElement & {
  type: 'group'
  width: number
  height: number
  children: CardElement[]
}

export type CardElement = TextElement | ImageElement | RectElement | GroupElement

// Background has its own image variant (with `fit`) separate from Paint's image variant (with `repeat`)
export type Background =
  | { type: 'color'; value: string }
  | { type: 'linear-gradient'; angle: number; stops: GradientStop[] }
  | { type: 'radial-gradient'; cx: number; cy: number; r: number; stops: GradientStop[] }
  | { type: 'image'; src: string; fit?: 'cover' | 'contain' | 'fill' }

export type ExportOptions = {
  format?: 'png' | 'jpeg'
  quality?: number // 0–1, only for jpeg. Default: 0.92
}

export type CardSchema = {
  width: number
  height: number
  background: Background
  elements: CardElement[]
}
