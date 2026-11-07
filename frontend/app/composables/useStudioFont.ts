export const studioFontOptions = [
  { id: 'auto', name: '跟隨模板', family: '' },
  { id: 'noto-sans-tc', name: '繁中黑體', family: '"RF Noto Sans TC", sans-serif' },
  { id: 'noto-serif-tc', name: '繁中明體', family: '"RF Noto Serif TC", serif' },
  { id: 'wenkai-tc', name: '手寫楷體', family: '"RF WenKai TC", cursive' },
  { id: 'chenyuluoyan-tc', name: '繁中手寫・辰宇落雁', family: '"RF Chen Yuluoyan TC", "RF WenKai TC", cursive', fallback: 'wenkai-tc' },
  { id: 'liu-jian-mao-cao', name: '劉建毛草（簡中草書）', family: '"RF Liu Jian Mao Cao", "RF WenKai TC", cursive', fallback: 'wenkai-tc' }
] as const

export type StudioFontId = (typeof studioFontOptions)[number]['id']

export const studioTextSizeOptions = [
  { key: 'title', label: '作品標題字級', min: 12, max: 72 },
  { key: 'note', label: '敘述字級', min: 8, max: 36 },
  { key: 'info', label: '標記與拍攝資訊字級', min: 8, max: 28 }
] as const

export type StudioTextRole = (typeof studioTextSizeOptions)[number]['key']
export type StudioFontSizes = Partial<Record<StudioTextRole, number>>

export function studioTextSize(settings: { template: string; fontSizes?: StudioFontSizes }, role: StudioTextRole): number {
  const option = studioTextSizeOptions.find((option) => option.key === role)!
  const custom = settings.fontSizes?.[role]
  if (typeof custom === 'number' && Number.isFinite(custom)) return Math.min(option.max, Math.max(option.min, custom))
  if (role === 'title') return settings.template === 'editorial' ? 32 : settings.template === 'signature' ? 26 : settings.template === 'classic-white' ? 30 : 28
  if (role === 'note') return settings.template === 'editorial' ? 16 : settings.template === 'technical-exif' ? 15 : 14
  return settings.template === 'technical-exif' ? 15 : settings.template === 'signature' ? 14 : 13
}

export function studioFontFamily(id: StudioFontId | undefined, fallback = 'Georgia'): string {
  return studioFontOptions.find((option) => option.id === id)?.family || fallback
}

export function canvasFont(id: StudioFontId | undefined, size: number, fallback = 'Georgia'): string {
  return `${size}px ${studioFontFamily(id, fallback)}`
}

// Cache in-flight and successful loads, but allow a failed download to be retried.
const fontLoads = new WeakMap<FontFaceSet, Map<string, Promise<void>>>()

export function loadStudioFont(id: StudioFontId | undefined, fonts: FontFaceSet): Promise<void> {
  const option = studioFontOptions.find((option) => option.id === id)
  const family = option?.family
  if (!family) return Promise.resolve()
  let loads = fontLoads.get(fonts)
  if (!loads) { loads = new Map(); fontLoads.set(fonts, loads) }
  const cache = loads
  const cached = cache.get(family)
  if (cached) return cached
  const requests = [fonts.load(`16px ${family}`)]
  // Load the bundled Traditional Chinese fallback too, before drawing/exporting.
  if (option && 'fallback' in option) requests.push(fonts.load(`16px ${studioFontFamily(option.fallback)}`))
  const pending = Promise.all(requests).then((results) => {
    if (results.some((faces) => faces.length === 0)) throw new Error('Font unavailable')
  }).catch((error) => { cache.delete(family); throw error })
  cache.set(family, pending)
  return pending
}
