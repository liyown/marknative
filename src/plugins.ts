import type { SKRSContext2D } from '@napi-rs/canvas'
import type { RenderContext } from './render-context.js'

export type PluginRenderer<T = Record<string, unknown>> = (
  ctx: SKRSContext2D,
  el: T,
  rc: RenderContext,
) => Promise<void> | void

const registry = new Map<string, PluginRenderer>()

export function registerRenderer(type: string, renderer: PluginRenderer): void {
  registry.set(type, renderer)
}

export function getRenderer(type: string): PluginRenderer | undefined {
  return registry.get(type)
}
