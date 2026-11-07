import type { TemplateId } from './useStudio'

export const photoFrameOptions = [
  { id: 'auto', name: '跟隨版面' },
  { id: 'none', name: '無邊框' },
  { id: 'white', name: '經典白框' },
  { id: 'black', name: '畫廊黑框' },
  { id: 'instant', name: '拍立得' },
  { id: 'instant-shadow', name: '拍立得陰影' },
  { id: 'film', name: '底片齒孔' },
  { id: 'double', name: '雙線裝裱' }
] as const

export type PhotoFrameId = (typeof photoFrameOptions)[number]['id']
export type PhotoCrop = { x: number; y: number; width: number; height: number }
type FrameStyle = Exclude<PhotoFrameId, 'auto'>

const templateFrames: Record<TemplateId, FrameStyle> = {
  'film-archive': 'film',
  'classic-white': 'white',
  'dark-gallery': 'black',
  editorial: 'instant',
  'technical-exif': 'double',
  signature: 'white'
}

export function resolvePhotoFrame(frame: PhotoFrameId, template: TemplateId): FrameStyle {
  return frame === 'auto' ? templateFrames[template] : frame
}

export function photoFrameLayout(imageWidth: number, imageHeight: number, style: FrameStyle, border: number) {
  const padding = style === 'none' ? 0 : Math.min(imageWidth, imageHeight) * Math.min(12, Math.max(1, border)) / 100
  const bottom = style === 'instant' || style === 'instant-shadow' ? padding * 4 : padding
  return { padding, bottom, width: imageWidth + padding * 2, height: imageHeight + padding + bottom }
}

export function drawFramedPhoto(context: CanvasRenderingContext2D, image: HTMLImageElement, style: FrameStyle, border: number, crop: PhotoCrop | null = null): void {
  const imageWidth = image.width * (crop?.width ?? 1)
  const imageHeight = image.height * (crop?.height ?? 1)
  const { padding, width, height } = photoFrameLayout(imageWidth, imageHeight, style, border)
  context.save()
  if (style !== 'none') {
    context.save()
    if (style === 'instant-shadow') {
      // Canvas shadows use output pixels, not local coordinates. Match the photo's rendered scale.
      const transform = context.getTransform()
      const scale = Math.hypot(transform.a, transform.b)
      const shortSide = Math.min(imageWidth, imageHeight) * scale
      context.shadowColor = 'rgba(0, 0, 0, 0.32)'
      context.shadowBlur = shortSide * 0.035
      context.shadowOffsetX = shortSide * 0.012
      context.shadowOffsetY = shortSide * 0.022
    }
    context.fillStyle = style === 'black' || style === 'film' ? '#18181B' : '#FAFAF9'
    context.fillRect(0, 0, width, height)
    context.restore()
  }
  if (crop === null) context.drawImage(image, padding, padding, imageWidth, imageHeight)
  else context.drawImage(image, crop.x * image.width, crop.y * image.height, imageWidth, imageHeight, padding, padding, imageWidth, imageHeight)
  if (style === 'double') {
    context.strokeStyle = '#71717A'
    context.lineWidth = Math.max(1, padding * 0.06)
    for (const inset of [padding * 0.25, padding * 0.65]) {
      context.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
    }
  }
  if (style === 'film') {
    context.fillStyle = '#D6D3CD'
    const holeWidth = padding * 0.65
    const holeHeight = padding * 0.45
    const count = Math.max(1, Math.floor(imageWidth / (padding * 1.8)))
    for (let index = 0; index < count; index += 1) {
      const x = padding + (index + 0.5) * imageWidth / count - holeWidth / 2
      context.fillRect(x, (padding - holeHeight) / 2, holeWidth, holeHeight)
      context.fillRect(x, height - (padding + holeHeight) / 2, holeWidth, holeHeight)
    }
  }
  context.restore()
}
