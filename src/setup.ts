import { GlobalFonts } from '@napi-rs/canvas'

export function registerFont(path: string, family: string) {
  return GlobalFonts.registerFromPath(path, family)
}
