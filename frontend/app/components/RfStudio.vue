<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'
import { aspectSize, defaultSettings, photoLabel, templateOptions, type StudioPhoto, type StudioSettings, type TemplateId } from '~/composables/useStudio'
import { drawFramedPhoto, photoFrameLayout, resolvePhotoFrame, type PhotoCrop } from '~/composables/usePhotoFrame'

type CanvasBounds = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type DragTarget = { readonly kind: 'photo' | 'info' | 'resize' | 'global'; readonly photoId: string; readonly bounds: CanvasBounds; readonly corner?: { x: number; y: number } }
type DragState = DragTarget & { readonly previous: StudioSettings; readonly startX: number; readonly startY: number; moved: boolean }

const settings = reactive<StudioSettings>({ ...defaultSettings })
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const sourceImages = new Map<string, HTMLImageElement>()
const sourceUrls = new Map<string, string>()
const activePhotoId = ref<string | null>(null)
const dragging = ref<DragState | null>(null)
const hasImage = computed(() => settings.photos.length > 0)
const selectedPhoto = computed(() => settings.photos.find((photo) => photo.id === activePhotoId.value) ?? null)
const notice = ref('')
const showExport = ref(false)
const showSettings = ref(false)
const showMaterials = ref(false)
const isMobile = ref(false)
const exportDialog = ref<HTMLDialogElement | null>(null)
const theme = ref<'dark' | 'light'>('dark')
const route = useRoute()
const history = ref<StudioSettings[]>([])
const future = ref<StudioSettings[]>([])
let mobileMedia: MediaQueryList | null = null
let globalInfoRegions: CanvasBounds[] = []
const globalInfoSelected = ref(false)
const contextMenu = ref<{ x: number; y: number } | null>(null)
const croppingPhoto = ref<StudioPhoto | null>(null)
let nextPhotoNumber = 1
const selectedLayerIndex = computed(() => settings.photos.findIndex((photo) => photo.id === activePhotoId.value))

function syncMobile(): void {
  isMobile.value = mobileMedia?.matches ?? false
  if (isMobile.value) showSettings.value = false
}

function drawLines(context: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2, draw = (text: string, tx: number, ty: number) => context.fillText(text, tx, ty)): void {
  let line = ''
  let row = 0
  for (const character of Array.from(value)) {
    const next = line + character
    if (context.measureText(next).width <= maxWidth || line === '') { line = next; continue }
    draw(line, x, y + row * lineHeight)
    row += 1
    if (row === maxLines) return
    line = character
  }
  if (line !== '') draw(line, x, y + row * lineHeight)
}

function snapshot(): StudioSettings {
  return structuredClone(toRaw(settings))
}

function addHistory(previous: StudioSettings): void {
  history.value.push(previous)
  if (history.value.length > 20) history.value.shift()
  future.value = []
}

function imageBounds(photo: StudioPhoto, width: number, height: number): CanvasBounds | null {
  const image = sourceImages.get(photo.id)
  if (image === undefined) return null
  const layout = photoFrameLayout(image.width * (photo.crop?.width ?? 1), image.height * (photo.crop?.height ?? 1), resolvePhotoFrame(photo.frame, settings.template), photo.frameBorder)
  const scale = Math.min((photo.width * width) / layout.width, (height * 0.9) / layout.height)
  return { x: photo.x * width, y: photo.y * height, width: layout.width * scale, height: layout.height * scale }
}

// Transform around the original image centre, keeping its position stable while scaling.
function transformPhoto(context: CanvasRenderingContext2D, photo: StudioPhoto, bounds: CanvasBounds): void {
  context.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  context.rotate(photo.rotation * Math.PI / 180)
  context.scale(photo.scale, photo.scale)
  context.translate(-bounds.width / 2, -bounds.height / 2)
}

function photoCorners(photo: StudioPhoto, bounds: CanvasBounds): { x: number; y: number }[] {
  const angle = photo.rotation * Math.PI / 180
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx = 1, sy = 1]) => {
    const dx = sx * bounds.width * photo.scale / 2
    const dy = sy * bounds.height * photo.scale / 2
    return {
      x: bounds.x + bounds.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: bounds.y + bounds.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle)
    }
  })
}

// Keep handles usable even when a high-resolution portrait canvas is fitted to a small preview.
function previewPixelSize(canvas: HTMLCanvasElement): number {
  return canvas.width / (canvas.getBoundingClientRect().width || canvas.width)
}

function photoInfoLines(photo: StudioPhoto): string[] {
  const exposure = [photo.camera, photo.lens, photo.aperture, photo.shutter, photo.iso, photo.date].filter((value) => value !== '').join(' · ')
  return [photo.title, photo.note, exposure].filter((value) => value !== '')
}

function infoBounds(photo: StudioPhoto, width: number, height: number): CanvasBounds | null {
  const lines = photoInfoLines(photo)
  if (lines.length === 0) return null
  const scale = typographyScale()
  return { x: photo.infoX * width, y: photo.infoY * height, width: Math.min(300 * scale, width * (scale > 1 ? 0.72 : 0.42)), height: (lines.length * 20 + 16) * scale }
}

function typographyScale(): number { return settings.ratio === '9:16' ? 2.5 : 1 }

function drawPhotoInfo(context: CanvasRenderingContext2D, photo: StudioPhoto, width: number, height: number, color: string): void {
  const lines = photoInfoLines(photo)
  const bounds = infoBounds(photo, width, height)
  if (bounds === null) return
  context.save()
  context.fillStyle = color
  const scale = typographyScale()
  context.translate(bounds.x, bounds.y)
  context.scale(scale, scale)
  lines.forEach((line, index) => {
    context.font = index === 0 ? '18px Georgia' : '12px monospace'
    drawLines(context, line, 0, 18 + index * 20, bounds.width / scale, 16, 1)
  })
  context.restore()
}

function renderFrame(canvas: HTMLCanvasElement, showSelection = false): void {
  const [width, height] = aspectSize(settings.ratio)
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) return
  const palette = getComputedStyle(document.querySelector('.studio-shell') ?? document.documentElement)
  const darkGallery = settings.template === 'dark-gallery'
  const classicWhite = settings.template === 'classic-white'
  context.fillStyle = darkGallery ? palette.getPropertyValue('--template-dark-bg') : classicWhite ? palette.getPropertyValue('--paper') : palette.getPropertyValue('--bg')
  context.fillRect(0, 0, width, height)
  context.fillStyle = darkGallery ? palette.getPropertyValue('--template-dark-fg') : classicWhite ? palette.getPropertyValue('--ink') : palette.getPropertyValue('--fg')
  for (const photo of settings.photos) {
    const image = sourceImages.get(photo.id)
    const bounds = imageBounds(photo, width, height)
    if (image !== undefined && bounds !== null) {
      context.save()
      transformPhoto(context, photo, bounds)
      const frame = resolvePhotoFrame(photo.frame, settings.template)
      const layout = photoFrameLayout(image.width * (photo.crop?.width ?? 1), image.height * (photo.crop?.height ?? 1), frame, photo.frameBorder)
      context.scale(bounds.width / layout.width, bounds.height / layout.height)
      drawFramedPhoto(context, image, frame, photo.frameBorder, photo.crop)
      context.restore()
    }
  }
  for (const photo of settings.photos) drawPhotoInfo(context, photo, width, height, context.fillStyle)
  if (showSelection && activePhotoId.value !== null) {
    const photo = settings.photos.find((item) => item.id === activePhotoId.value)
    if (photo !== undefined) {
      const bounds = dragging.value?.kind === 'info' ? infoBounds(photo, width, height) : imageBounds(photo, width, height)
      if (bounds !== null) {
        context.save()
        context.setLineDash([8, 6])
        context.lineWidth = 2
        context.strokeStyle = context.fillStyle
        if (dragging.value?.kind === 'info') context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
        else {
          transformPhoto(context, photo, bounds)
          context.lineWidth = 2 / photo.scale
          context.strokeRect(0, 0, bounds.width, bounds.height)
        }
        context.restore()
        if (dragging.value?.kind !== 'info') {
          const size = 10 * previewPixelSize(canvas)
          context.save()
          context.fillStyle = palette.getPropertyValue('--accent')
          context.strokeStyle = palette.getPropertyValue('--bg')
          context.lineWidth = previewPixelSize(canvas)
          for (const corner of photoCorners(photo, bounds)) {
            context.fillRect(corner.x - size / 2, corner.y - size / 2, size, size)
            context.strokeRect(corner.x - size / 2, corner.y - size / 2, size, size)
          }
          context.restore()
        }
      }
    }
  }
  const textScale = typographyScale()
  globalInfoRegions = []
  context.save()
  context.translate(settings.globalInfoOffsetX * width / 100, settings.globalInfoOffsetY * height / 100)
  context.scale(textScale, textScale)
  drawFrameText(context, width / textScale, height / textScale)
  context.restore()
  if (showSelection && globalInfoSelected.value && selectedPhoto.value === null) {
    context.save()
    context.strokeStyle = palette.getPropertyValue('--accent')
    context.lineWidth = previewPixelSize(canvas)
    context.setLineDash([5 * previewPixelSize(canvas), 4 * previewPixelSize(canvas)])
    for (const bounds of globalInfoRegions) context.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8)
    context.restore()
  }
  if (showSelection && selectedPhoto.value !== null) {
    const photo = selectedPhoto.value
    const bounds = imageBounds(photo, width, height)
    if (bounds !== null) {
      const unit = previewPixelSize(canvas)
      const label = photoLabel(settings.photos, photo.id)
      const corners = photoCorners(photo, bounds)
      context.save()
      context.font = `600 ${12 * unit}px monospace`
      const labelWidth = context.measureText(label).width + 16 * unit
      const labelHeight = 26 * unit
      const x = Math.max(0, Math.min(width - labelWidth, Math.min(...corners.map((corner) => corner.x))))
      const y = Math.max(0, Math.min(height - labelHeight, Math.min(...corners.map((corner) => corner.y)) - labelHeight - 8 * unit))
      context.fillStyle = palette.getPropertyValue('--accent')
      context.fillRect(x, y, labelWidth, labelHeight)
      context.fillStyle = palette.getPropertyValue('--bg')
      context.textBaseline = 'middle'
      context.fillText(label, x + 8 * unit, y + labelHeight / 2)
      context.restore()
    }
  }
}

function drawFrameText(context: CanvasRenderingContext2D, width: number, height: number): void {
  const text = (value: string, x: number, y: number): void => {
    context.fillText(value, x, y)
    if (value === '') return
    const metrics = context.measureText(value)
    const transform = context.getTransform()
    const ascent = metrics.actualBoundingBoxAscent || parseFloat(context.font) || 16
    const descent = metrics.actualBoundingBoxDescent || 4
    globalInfoRegions.push({ x: x * transform.a + transform.e, y: (y - ascent) * transform.d + transform.f, width: metrics.width * transform.a, height: (ascent + descent) * transform.d })
  }
  const lines = (value: string, x: number, y: number, maxWidth: number, lineHeight: number): void => drawLines(context, value, x, y, maxWidth, lineHeight, 2, text)
  const margin = Math.min(settings.border, width * 0.08)
  const editorial = settings.template === 'editorial'
  if (settings.template === 'technical-exif') {
    context.font = '15px monospace'
    if (settings.ratio === '9:16') {
      lines(`${settings.date}  ${settings.camera}  ${settings.lens}`, margin, 32, width - margin * 2, 22)
      lines(`${settings.aperture}  ${settings.shutter}  ${settings.iso}`, margin, 82, width - margin * 2, 22)
    } else {
      text(`${settings.date}  ${settings.camera}  ${settings.lens}`, margin, 32)
      text(`${settings.aperture}  ${settings.shutter}  ${settings.iso}`, width - 310, 32)
    }
    return
  }
  if (editorial) {
    context.font = '32px Georgia'
    lines(settings.title || 'Untitled Frame', width - 230, margin + 44, 185, 38)
    context.font = '16px Georgia'
    lines(settings.note, width - 230, margin + 145, 185, 24)
    context.font = '13px monospace'
    lines(`${settings.date} · ${settings.camera} · ${settings.lens}`, width - 230, height - 150, 185, 20)
    return
  }
  if (settings.template === 'signature') {
    const title = settings.title || 'Untitled Frame'
    context.font = '26px Georgia'
    text(title, width - margin - context.measureText(title).width, height - 48)
    context.font = '14px monospace'
    text(settings.date, margin, height - 48)
    return
  }
  if (settings.template === 'film-archive') {
    context.font = '13px monospace'
    text('RFSTORY / FRAME 01', margin, height - 82)
  }
  context.font = settings.template === 'classic-white' ? '30px Georgia' : '28px Georgia'
  lines(settings.title || 'Untitled Frame', margin, height - 52, width - margin * 2, 34)
  context.font = '13px monospace'
  lines(`${settings.date} · ${settings.camera} · ${settings.aperture} · ${settings.shutter} · ${settings.iso}`, margin, height - 30, width - margin * 2, 16)
}

function renderPreview(): void { if (previewCanvas.value !== null) renderFrame(previewCanvas.value, true) }
function commit(next: StudioSettings): void { addHistory(snapshot()); Object.assign(settings, next) }
function updateSettings(next: StudioSettings): void { commit(next) }
function selectTemplate(template: TemplateId): void { commit({ ...settings, template }) }
function undo(): void { const previous = history.value.pop(); if (previous !== undefined) { future.value.push({ ...settings }); Object.assign(settings, previous) } }
function redo(): void { const next = future.value.pop(); if (next !== undefined) { history.value.push({ ...settings }); Object.assign(settings, next) } }

function updatePhoto(nextPhoto: StudioPhoto): void {
  const next = snapshot()
  next.photos = next.photos.map((photo) => photo.id === nextPhoto.id ? nextPhoto : photo)
  commit(next)
}

function newPhoto(id: string): StudioPhoto {
  const index = settings.photos.length
  const offset = index % 5
  return {
    id,
    displayNumber: nextPhotoNumber++,
    crop: null,
    x: 0.05 + offset * 0.04,
    y: 0.05 + offset * 0.04,
    width: Math.max(0.42, 0.82 - index * 0.06),
    scale: 1,
    rotation: 0,
    frame: 'auto',
    frameBorder: 4,
    infoX: 0.08 + offset * 0.04,
    infoY: 0.72 + offset * 0.04,
    title: '',
    note: '',
    camera: '',
    lens: '',
    aperture: '',
    shutter: '',
    iso: '',
    date: ''
  }
}

function upload(event: Event): void {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return
  const previous = snapshot()
  let added = false
  let invalid = false
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.raw') || file.name.toLowerCase().endsWith('.dng') || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      invalid = true
      continue
    }
    const id = crypto.randomUUID()
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      if (!added) { addHistory(previous); added = true }
      sourceImages.set(id, image)
      sourceUrls.set(id, url)
      settings.photos.push(newPhoto(id))
      activePhotoId.value = id
      notice.value = ''
      renderPreview()
    }
    image.onerror = () => { URL.revokeObjectURL(url); notice.value = '圖片無法解碼，請重新選擇 JPEG、PNG 或 WebP。' }
    image.src = url
  }
  input.value = ''
  if (invalid) notice.value = '僅支援 JPEG、PNG 或 WebP；RAW 與 DNG 請先轉檔。'
}

function canvasPoint(event: MouseEvent): { readonly x: number; readonly y: number; readonly canvas: HTMLCanvasElement } | null {
  const canvas = event.currentTarget
  if (!(canvas instanceof HTMLCanvasElement)) return null
  const rect = canvas.getBoundingClientRect()
  return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height, canvas }
}

function contains(bounds: CanvasBounds, x: number, y: number): boolean {
  return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height
}

function dragTarget(x: number, y: number, width: number, height: number): DragTarget | null {
  const globalRegion = globalInfoRegions.find((bounds) => contains({ x: bounds.x - 6, y: bounds.y - 6, width: bounds.width + 12, height: bounds.height + 12 }, x, y))
  if (globalRegion !== undefined) return { kind: 'global', photoId: '', bounds: globalRegion }
  const selected = selectedPhoto.value
  if (selected !== null) {
    const bounds = imageBounds(selected, width, height)
    const radius = 14 * (previewCanvas.value === null ? 1 : previewPixelSize(previewCanvas.value))
    if (bounds !== null) {
      const corner = photoCorners(selected, bounds).find((point) => Math.hypot(x - point.x, y - point.y) <= radius)
      if (corner !== undefined) return { kind: 'resize', photoId: selected.id, bounds, corner }
    }
  }
  for (const photo of [...settings.photos].reverse()) {
    const info = infoBounds(photo, width, height)
    if (info !== null && contains(info, x, y)) return { kind: 'info', photoId: photo.id, bounds: info }
    const image = imageBounds(photo, width, height)
    if (image !== null) {
      const angle = -photo.rotation * Math.PI / 180
      const dx = x - image.x - image.width / 2
      const dy = y - image.y - image.height / 2
      const localX = (dx * Math.cos(angle) - dy * Math.sin(angle)) / photo.scale + image.width / 2
      const localY = (dx * Math.sin(angle) + dy * Math.cos(angle)) / photo.scale + image.height / 2
      if (contains({ ...image, x: 0, y: 0 }, localX, localY)) return { kind: 'photo', photoId: photo.id, bounds: image }
    }
  }
  return null
}

function beginDrag(event: PointerEvent): void {
  const point = canvasPoint(event)
  if (point === null) return
  point.canvas.focus({ preventScroll: true })
  const target = dragTarget(point.x, point.y, point.canvas.width, point.canvas.height)
  globalInfoSelected.value = target?.kind === 'global'
  if (target === null) { activePhotoId.value = null; renderPreview(); return }
  point.canvas.style.cursor = target.kind === 'resize' ? 'nwse-resize' : 'move'
  activePhotoId.value = target.kind === 'global' ? null : target.photoId
  dragging.value = { ...target, previous: snapshot(), startX: point.x, startY: point.y, moved: false }
  point.canvas.setPointerCapture(event.pointerId)
  renderPreview()
}

function moveDrag(event: PointerEvent): void {
  const point = canvasPoint(event)
  const drag = dragging.value
  if (point === null) return
  if (drag === null) {
    const target = dragTarget(point.x, point.y, point.canvas.width, point.canvas.height)
    point.canvas.style.cursor = target?.kind === 'resize' ? 'nwse-resize' : target === null ? 'default' : 'move'
    return
  }
  const offsetX = (point.x - drag.startX) / point.canvas.width
  const offsetY = (point.y - drag.startY) / point.canvas.height
  if (drag.kind === 'global') {
    settings.globalInfoOffsetX = Math.round(Math.min(100, Math.max(-100, drag.previous.globalInfoOffsetX + offsetX * 100)) * 10) / 10
    settings.globalInfoOffsetY = Math.round(Math.min(100, Math.max(-100, drag.previous.globalInfoOffsetY + offsetY * 100)) * 10) / 10
    drag.moved = true
    return
  }
  const photo = settings.photos.find((item) => item.id === drag.photoId)
  if (photo === undefined) return
  if (drag.kind === 'resize' && drag.corner !== undefined) {
    const initial = drag.previous.photos.find((item) => item.id === drag.photoId)
    if (initial === undefined) return
    const dx = drag.corner.x - drag.bounds.x - drag.bounds.width / 2
    const dy = drag.corner.y - drag.bounds.y - drag.bounds.height / 2
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) return
    const factor = 1 + ((point.x - drag.startX) * dx + (point.y - drag.startY) * dy) / lengthSquared
    photo.scale = Math.round(Math.min(3, Math.max(0.1, initial.scale * factor)) * 100) / 100
  } else if (drag.kind === 'photo') {
    photo.x = Math.min(Math.max(-drag.bounds.width / point.canvas.width / 2, drag.bounds.x / point.canvas.width + offsetX), 1 - drag.bounds.width / point.canvas.width / 2)
    photo.y = Math.min(Math.max(-drag.bounds.height / point.canvas.height / 2, drag.bounds.y / point.canvas.height + offsetY), 1 - drag.bounds.height / point.canvas.height / 2)
  } else {
    photo.infoX = Math.min(Math.max(0.02, drag.bounds.x / point.canvas.width + offsetX), 0.8)
    photo.infoY = Math.min(Math.max(0.02, drag.bounds.y / point.canvas.height + offsetY), 0.9)
  }
  drag.moved = true
}

function finishDrag(event: PointerEvent): void {
  const canvas = event.currentTarget
  const drag = dragging.value
  if (canvas instanceof HTMLCanvasElement && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  if (drag?.moved) addHistory(drag.previous)
  dragging.value = null
  renderPreview()
}

function selectPhoto(id: string | null): void {
  cancelDrag()
  contextMenu.value = null
  globalInfoSelected.value = false
  activePhotoId.value = id
  renderPreview()
}

function openPhotoMenu(event: MouseEvent): void {
  cancelDrag()
  contextMenu.value = null
  const point = canvasPoint(event)
  if (point === null) return
  const target = dragTarget(point.x, point.y, point.canvas.width, point.canvas.height)
  if (target === null || target.kind === 'global') return
  selectPhoto(target.photoId)
  contextMenu.value = { x: event.clientX, y: event.clientY }
}

function movePhotoLayer(direction: 1 | -1): void {
  const index = selectedLayerIndex.value
  const destination = index + direction
  if (index < 0 || destination < 0 || destination >= settings.photos.length) return
  const next = snapshot()
  const [photo] = next.photos.splice(index, 1)
  if (photo === undefined) return
  next.photos.splice(destination, 0, photo)
  commit(next)
  closePhotoMenu()
}

function closePhotoMenu(): void {
  contextMenu.value = null
  previewCanvas.value?.focus({ preventScroll: true })
}

function beginCrop(): void {
  croppingPhoto.value = selectedPhoto.value
  contextMenu.value = null
}

function applyCrop(crop: PhotoCrop | null): void {
  const photo = settings.photos.find((item) => item.id === croppingPhoto.value?.id)
  if (photo !== undefined) updatePhoto({ ...photo, crop })
  croppingPhoto.value = null
  previewCanvas.value?.focus({ preventScroll: true })
}

function deleteSelectedPhoto(): void {
  if (selectedPhoto.value === null) return
  const id = selectedPhoto.value.id
  cancelDrag()
  const next = snapshot()
  next.photos = next.photos.filter((photo) => photo.id !== id)
  commit(next)
  activePhotoId.value = null
  // Retain source images for undo; their object URLs are released on unmount.
  notice.value = '已刪除照片，可使用復原還原。'
  renderPreview()
}

function cancelDrag(): void {
  const drag = dragging.value
  if (drag === null) return
  Object.assign(settings, drag.previous)
  dragging.value = null
}

function saveDefault(): void { localStorage.setItem('rfstory-defaults', JSON.stringify({ ...snapshot(), photos: [] })); notice.value = '已將目前設定儲存為此瀏覽器的預設值。' }
function toggleTheme(): void { theme.value = theme.value === 'dark' ? 'light' : 'dark' }
function handleShortcuts(event: KeyboardEvent): void { if (croppingPhoto.value !== null) return; if (!(event.metaKey || event.ctrlKey)) return; if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo() }; if (event.key.toLowerCase() === 'e' && hasImage.value) { event.preventDefault(); showExport.value = true } }

function exportImage(): void {
  if (!hasImage.value) return
  const canvas = document.createElement('canvas')
  renderFrame(canvas)
  canvas.toBlob((blob) => {
    if (blob === null) { notice.value = '匯出失敗，請再試一次。'; return }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rfstory-${Date.now()}.${settings.format.split('/')[1]}`
    link.click()
    URL.revokeObjectURL(link.href)
    showExport.value = false
    notice.value = '已完成下載，原始 EXIF 不會被複製。'
  }, settings.format, 0.92)
}

onMounted(() => {
  mobileMedia = window.matchMedia('(max-width: 680px)')
  mobileMedia.addEventListener('change', syncMobile)
  syncMobile()
  const saved = localStorage.getItem('rfstory-defaults')
  if (saved !== null) {
    try { Object.assign(settings, { ...defaultSettings, ...JSON.parse(saved), photos: [] }) }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      notice.value = '已忽略損壞的本機預設值。'
    }
  }
  const requested = typeof route.query.template === 'string' ? templateOptions.find((template) => template.id === route.query.template) : undefined
  if (requested !== undefined) settings.template = requested.id
  window.addEventListener('keydown', handleShortcuts)
  nextTick(renderPreview)
})
onBeforeUnmount(() => { sourceUrls.forEach((url) => URL.revokeObjectURL(url)); window.removeEventListener('keydown', handleShortcuts); mobileMedia?.removeEventListener('change', syncMobile) })
watch(settings, renderPreview, { deep: true })
watch(theme, () => { nextTick(renderPreview) })
watch(showExport, (open) => { if (open) exportDialog.value?.showModal(); else exportDialog.value?.close() })
</script>

<template>
  <div class="studio-shell" :data-sheet-open="showSettings" :data-template="settings.template" :data-theme="theme">
    <button class="materials-toggle" :aria-expanded="showMaterials" type="button" @click="showMaterials = !showMaterials">{{ showMaterials ? '關閉素材' : '素材與模板' }}</button>
    <StudioSidebar :active-template="settings.template" :theme="theme" @select="selectTemplate" @toggle-theme="toggleTheme" @upload="upload" />
    <StudioCanvas v-model:canvas="previewCanvas" :has-image="hasImage" :settings="settings" @contextmenu="openPhotoMenu" @view-change="renderPreview" @upload="upload" @delete-photo="deleteSelectedPhoto" @pointercancel="cancelDrag" @pointerdown="beginDrag" @pointermove="moveDrag" @pointerup="finishDrag" />
    <StudioPhotoContextMenu v-if="contextMenu !== null && selectedPhoto !== null" :key="`${contextMenu.x}-${contextMenu.y}-${selectedPhoto.id}`" :x="contextMenu.x" :y="contextMenu.y" :label="photoLabel(settings.photos, selectedPhoto.id)" :can-raise="selectedLayerIndex < settings.photos.length - 1" :can-lower="selectedLayerIndex > 0" @crop="beginCrop" @raise="movePhotoLayer(1)" @lower="movePhotoLayer(-1)" @close="closePhotoMenu" />
    <StudioPhotoCropDialog v-if="croppingPhoto !== null" :src="sourceImages.get(croppingPhoto.id)?.src ?? ''" :label="photoLabel(settings.photos, croppingPhoto.id)" :crop="croppingPhoto.crop" @apply="applyCrop" @close="croppingPhoto = null" />
    <StudioInspector v-if="!isMobile || showSettings" :model-value="settings" :selected-photo="selectedPhoto" @close="showSettings = false" @select-photo="selectPhoto" @photo-update="updatePhoto" @redo="redo" @save="saveDefault" @undo="undo" @update="updateSettings" />
    <p v-if="notice && showSettings" class="sheet-notice" aria-live="polite">{{ notice }}</p>
    <footer class="studio-footer"><span v-if="notice" aria-live="polite">{{ notice }}</span><button class="settings-action" :aria-expanded="showSettings" type="button" @click="showSettings = !showSettings">設定</button><button :disabled="!hasImage" type="button" @click="showExport = true">匯出照片 <span class="mono">⌘E</span></button></footer>
    <dialog ref="exportDialog" aria-labelledby="export-title" @close="showExport = false"><form method="dialog" class="export-dialog"><button class="dialog-close" aria-label="關閉匯出視窗" type="submit">×</button><p class="eyebrow">EXPORT PREVIEW</p><h1 id="export-title">將這一格留下來</h1><p>匯出畫面會與目前預覽一致，並且不會複製原始 metadata。</p><label>檔案格式<select v-model="settings.format"><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label><button :disabled="!hasImage" class="primary-action" type="button" @click="exportImage">下載檔案</button></form></dialog>
  </div>
</template>
