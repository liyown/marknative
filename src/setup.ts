import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

let initialized = false

// Polyfill OffscreenCanvas for pretext's canvas-based text measurement.
// Must be called before any pretext API (prepare / prepareWithSegments).
export function setup(): void {
  if (initialized) return
  initialized = true

  if (typeof (globalThis as Record<string, unknown>)['OffscreenCanvas'] === 'undefined') {
    // @ts-expect-error – runtime polyfill, no TS declaration needed
    globalThis.OffscreenCanvas = class {
      #canvas

      constructor(width: number, height: number) {
        this.#canvas = createCanvas(width, height)
      }

      getContext(type: '2d') {
        return this.#canvas.getContext(type)
      }
    }
  }
}

export function registerFont(path: string, family: string): void {
  setup()
  GlobalFonts.registerFromPath(path, family)
}
