export const templateOptions = [
  { id: 'film-archive', name: '底片紀錄', description: '預設 · 柔暖邊界' },
  { id: 'classic-white', name: '經典白框', description: '留白 · 日常收藏' },
  { id: 'dark-gallery', name: '暗室展覽', description: '深色 · 局部聚焦' },
  { id: 'editorial', name: '編輯版面', description: '文字 · 作品敘事' },
  { id: 'technical-exif', name: '技術資訊', description: '資料 · 攝影紀錄' },
  { id: 'signature', name: '署名留白', description: '作者 · 簡潔標記' }
] as const

export type TemplateId = (typeof templateOptions)[number]['id']

export type StudioPhoto = {
  id: string
  x: number
  y: number
  width: number
  infoX: number
  infoY: number
  title: string
  note: string
  camera: string
  lens: string
  aperture: string
  shutter: string
  iso: string
  date: string
}

export type StudioSettings = {
  template: TemplateId
  title: string
  note: string
  camera: string
  lens: string
  aperture: string
  shutter: string
  iso: string
  date: string
  ratio: '3:2' | '4:3' | '1:1' | '16:9'
  border: number
  format: 'image/jpeg' | 'image/png' | 'image/webp'
  photos: StudioPhoto[]
}

export const defaultSettings: StudioSettings = {
  template: 'film-archive',
  title: 'Untitled Frame',
  note: '一格關於光線、時間與此刻的備忘。',
  camera: 'Leica M11',
  lens: 'Summilux 35mm f/1.4',
  aperture: 'f/2.0',
  shutter: '1/250',
  iso: 'ISO 400',
  date: '2026.11.03',
  ratio: '3:2',
  border: 56,
  format: 'image/jpeg',
  photos: []
}

export function aspectSize(ratio: StudioSettings['ratio']): readonly [number, number] {
  switch (ratio) {
    case '3:2': return [1200, 800]
    case '4:3': return [1200, 900]
    case '1:1': return [1000, 1000]
    case '16:9': return [1280, 720]
  }
}
