import type { Image, SKRSContext2D } from '@napi-rs/canvas'
import type { CardElement } from './types.js'

export type RenderContext = {
  imageCache: Map<string, Image>
  drawElement: (ctx: SKRSContext2D, el: CardElement) => Promise<void>
}
