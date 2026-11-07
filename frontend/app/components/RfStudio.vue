<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'
import { aspectSize, defaultSettings, globalInfoText, photoLabel, templateOptions, type StudioPhoto, type StudioSettings, type TemplateId } from '~/composables/useStudio'
import { drawFramedPhoto, photoFrameLayout, resolvePhotoFrame, type PhotoCrop } from '~/composables/usePhotoFrame'
import { canvasFont, loadStudioFont, studioTextSize } from '~/composables/useStudioFont'

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
const isCompact = ref(false)
const shell = ref<HTMLElement | null>(null)
let panelTrigger: HTMLElement | null = null
const exportDialog = ref<HTMLDialogElement | null>(null)
const theme = ref<'dark' | 'light'>('dark')
const route = useRoute()
const history = ref<StudioSettings[]>([])
const future = ref<StudioSettings[]>([])
let mobileMedia: MediaQueryList | null = null
let compactMedia: MediaQueryList | null = null
let globalInfoRegions: CanvasBounds[] = []
const globalInfoSelected = ref(false)
const contextMenu = ref<{ x: number; y: number } | null>(null)
const croppingPhoto = ref<StudioPhoto | null>(null)
let nextPhotoNumber = 1
const selectedLayerIndex = computed(() => settings.photos.findIndex((photo) => photo.id === activePhotoId.value))

function syncMobile(): void {
  isMobile.value = mobileMedia?.matches ?? false
  isCompact.value = compactMedia?.matches ?? false
  showSettings.value = false
  showMaterials.value = false
}

const panelOpen = computed(() => (isCompact.value && showMaterials.value) || (isMobile.value && showSettings.value))

function closePanels(): void { showMaterials.value = false; showSettings.value = false }

function handlePanelKeys(event: KeyboardEvent): void {
  if (!panelOpen.value || croppingPhoto.value !== null || showExport.value) return
  if (event.key === 'Escape') { event.preventDefault(); closePanels(); return }
  if (event.key !== 'Tab') return
  const panel = shell.value?.querySelector(showMaterials.value ? '.studio-sidebar' : '.inspector')
  const controls = Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, [tabindex="0"]') ?? []).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0)
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}

watch(showMaterials, (open) => { if (open) showSettings.value = false })
watch(showSettings, (open) => { if (open) showMaterials.value = false })
watch(panelOpen, async (open) => {
  if (open) {
    panelTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    shell.value?.querySelector<HTMLElement>(showMaterials.value ? '.studio-sidebar button' : '.sheet-close')?.focus()
  } else {
    await nextTick()
    panelTrigger?.focus({ preventScroll: true })
  }
})

function drawLines(context: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2, draw = (text: string, tx: number, ty: number) => context.fillText(text, tx, ty)): void {
  wrapCanvasText(context, value, maxWidth, maxLines).forEach((line, row) => {
    if (line !== '') draw(line, x, y + row * lineHeight)
  })
}

function wrapCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines = 2): string[] {
  if (value === '' || maxLines < 1) return []
  const result: string[] = []
  let line = ''
  for (const character of Array.from(value.replace(/\r\n?/g, '\n'))) {
    if (character === '\n') {
      result.push(line)
      if (result.length === maxLines) return result
      line = ''
      continue
    }
    const next = line + character
    if (context.measureText(next).width <= maxWidth || line === '') { line = next; continue }
    result.push(line)
    if (result.length === maxLines) return result
    line = character
  }
  result.push(line)
  return result
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
    context.font = canvasFont(settings.font, index === 0 ? 18 : 12, index === 0 ? 'Georgia' : 'monospace')
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
  const lines = (value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2): void => drawLines(context, value, x, y, maxWidth, lineHeight, maxLines, text)
  const margin = Math.min(settings.border, width * 0.08)
  const editorial = settings.template === 'editorial'
  const titleSize = studioTextSize(settings, 'title')
  const noteSize = studioTextSize(settings, 'note')
  const infoSize = studioTextSize(settings, 'info')
  const titleLineHeight = Math.ceil(titleSize * 1.2)
  const noteLineHeight = Math.ceil(noteSize * 1.3)
  const infoLineHeight = Math.ceil(infoSize * 1.3)
  if (settings.template === 'technical-exif') {
    context.font = canvasFont(settings.font, infoSize, 'monospace')
    const infoTop = Math.max(32, infoSize + 12)
    const stacked = settings.ratio === '9:16' || infoSize > 15
    if (stacked) {
      lines(globalInfoText(settings, ['date', 'camera', 'lens'], '  '), margin, infoTop, width - margin * 2, infoLineHeight)
      lines(globalInfoText(settings, ['aperture', 'shutter', 'iso'], '  '), margin, infoTop + infoLineHeight * 2 + 10, width - margin * 2, infoLineHeight)
    } else {
      text(globalInfoText(settings, ['date', 'camera', 'lens'], '  '), margin, infoTop)
      text(globalInfoText(settings, ['aperture', 'shutter', 'iso'], '  '), width - 310, infoTop)
    }
    context.font = canvasFont(settings.font, noteSize, 'monospace')
    lines(globalInfoText(settings, ['note']), margin, infoTop + (stacked ? infoLineHeight * 4 + 20 : infoSize + 10) + noteSize, width - margin * 2, noteLineHeight)
    return
  }
  if (editorial) {
    context.font = canvasFont(settings.font, titleSize)
    const title = globalInfoText(settings, ['title'])
    const titleRows = wrapCanvasText(context, title, 185, 4)
    const titleTop = margin + Math.max(44, titleSize)
    lines(title, width - 230, titleTop, 185, titleLineHeight, 4)
    const noteTop = Math.max(margin + 145, titleTop + (Math.max(1, titleRows.length) - 1) * titleLineHeight + noteSize + 20)
    context.font = canvasFont(settings.font, noteSize)
    const note = globalInfoText(settings, ['note'])
    const noteRows = wrapCanvasText(context, note, 185, 2)
    lines(note, width - 230, noteTop, 185, noteLineHeight)
    context.font = canvasFont(settings.font, infoSize, 'monospace')
    lines(globalInfoText(settings, ['date', 'camera', 'lens']), width - 230, Math.max(height - 150, noteTop + (Math.max(1, noteRows.length) - 1) * noteLineHeight + infoSize + 16), 185, infoLineHeight)
    return
  }
  if (settings.template === 'signature') {
    const title = globalInfoText(settings, ['title'])
    context.font = canvasFont(settings.font, noteSize)
    const note = globalInfoText(settings, ['note'])
    const noteRows = wrapCanvasText(context, note, width - margin * 2, 2)
    const noteTop = height - 24 - (Math.max(1, noteRows.length) - 1) * noteLineHeight
    const titleBottom = Math.min(height - 48, noteTop - noteSize - 10)
    context.font = canvasFont(settings.font, titleSize)
    const titleRows = wrapCanvasText(context, title, (width - margin * 2) * 0.68, 4)
    titleRows.forEach((line, index) => {
      if (line !== '') text(line, width - margin - context.measureText(line).width, titleBottom - (titleRows.length - 1 - index) * titleLineHeight)
    })
    context.font = canvasFont(settings.font, infoSize, 'monospace')
    const date = globalInfoText(settings, ['date'])
    const dateWidth = (width - margin * 2) * 0.28
    const dateRows = wrapCanvasText(context, date, dateWidth, 2)
    lines(date, margin, titleBottom - (Math.max(1, dateRows.length) - 1) * infoLineHeight, dateWidth, infoLineHeight)
    context.font = canvasFont(settings.font, noteSize)
    lines(note, margin, noteTop, width - margin * 2, noteLineHeight)
    return
  }
  context.font = canvasFont(settings.font, titleSize)
  const title = globalInfoText(settings, ['title'])
  const titleRows = wrapCanvasText(context, title, width - margin * 2, 4)
  const info = globalInfoText(settings, ['date', 'camera', 'aperture', 'shutter', 'iso'])
  context.font = canvasFont(settings.font, infoSize, 'monospace')
  const infoRows = wrapCanvasText(context, info, width - margin * 2, 2)
  const infoTop = height - 30 - (Math.max(1, infoRows.length) - 1) * infoLineHeight
  const titleTop = infoTop - infoSize - 9 - (Math.max(1, titleRows.length) - 1) * titleLineHeight
  const label = settings.template === 'film-archive' ? globalInfoText(settings, ['frameLabel']) : ''
  const labelRows = wrapCanvasText(context, label, width - margin * 2, 2)
  const labelTop = titleTop - titleSize - 2 - (Math.max(1, labelRows.length) - 1) * infoLineHeight
  context.font = canvasFont(settings.font, noteSize)
  const note = globalInfoText(settings, ['note'])
  const noteRows = wrapCanvasText(context, note, width - margin * 2, 2)
  const noteBottom = (labelRows.length > 0 ? labelTop - infoSize : titleTop - titleSize) - 14
  lines(note, margin, noteBottom - (Math.max(1, noteRows.length) - 1) * noteLineHeight, width - margin * 2, noteLineHeight)
  if (settings.template === 'film-archive') {
    context.font = canvasFont(settings.font, infoSize, 'monospace')
    lines(label, margin, labelTop, width - margin * 2, infoLineHeight)
  }
  context.font = canvasFont(settings.font, titleSize)
  lines(title, margin, titleTop, width - margin * 2, titleLineHeight, 4)
  context.font = canvasFont(settings.font, infoSize, 'monospace')
  lines(info, margin, infoTop, width - margin * 2, infoLineHeight)
}

function renderPreview(): void { if (previewCanvas.value !== null) renderFrame(previewCanvas.value, true) }
function commit(next: StudioSettings): void { addHistory(snapshot()); Object.assign(settings, next) }
function updateSettings(next: StudioSettings): void { commit(next) }
function selectTemplate(template: TemplateId): void { commit({ ...settings, template }); showMaterials.value = false }
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
  showMaterials.value = false
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
  if (!event.isPrimary || event.button !== 0) return
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
  if (!event.isPrimary) return
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

async function exportImage(): Promise<void> {
  if (!hasImage.value) return
  const font = settings.font
  try { await loadStudioFont(font, document.fonts) }
  catch { notice.value = '字體載入失敗，請重新選用字體後再匯出。'; return }
  if (font !== settings.font) { notice.value = '字體已變更，請重新匯出。'; return }
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
  mobileMedia = window.matchMedia('(max-width: 767px), (max-width: 980px) and (max-height: 500px)')
  compactMedia = window.matchMedia('(max-width: 980px)')
  mobileMedia.addEventListener('change', syncMobile)
  compactMedia.addEventListener('change', syncMobile)
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
  watch(() => settings.font, async (font) => {
    if (font !== 'auto') notice.value = '正在載入畫布字體…'
    try {
      await loadStudioFont(font, document.fonts)
      if (font !== settings.font) return
      if (notice.value === '正在載入畫布字體…') notice.value = '畫布字體已載入。'
      renderPreview()
    } catch {
      if (font === settings.font) notice.value = '字體載入失敗，目前使用替代字體；請重新選用字體再試。'
    }
  }, { immediate: true })
  window.addEventListener('keydown', handleShortcuts)
  window.addEventListener('keydown', handlePanelKeys)
  nextTick(renderPreview)
})
onBeforeUnmount(() => { sourceUrls.forEach((url) => URL.revokeObjectURL(url)); window.removeEventListener('keydown', handleShortcuts); window.removeEventListener('keydown', handlePanelKeys); mobileMedia?.removeEventListener('change', syncMobile); compactMedia?.removeEventListener('change', syncMobile) })
watch(settings, renderPreview, { deep: true })
watch(theme, () => { nextTick(renderPreview) })
watch(showExport, (open) => { if (open) exportDialog.value?.showModal(); else exportDialog.value?.close() })
</script>

<template>
  <div ref="shell" class="studio-shell" :data-sheet-open="showSettings" :data-template="settings.template" :data-theme="theme">
    <button class="materials-toggle" :inert="panelOpen" :aria-expanded="showMaterials" aria-controls="studio-materials" type="button" @click="showMaterials = !showMaterials">素材與模板</button>
    <div v-if="panelOpen" class="panel-backdrop" aria-hidden="true" @click="closePanels"></div>
    <StudioSidebar id="studio-materials" :inert="isCompact && !showMaterials" :active-template="settings.template" :theme="theme" @close="showMaterials = false" @select="selectTemplate" @toggle-theme="toggleTheme" @upload="upload" />
    <StudioCanvas v-model:canvas="previewCanvas" :inert="panelOpen" :has-image="hasImage" :settings="settings" @contextmenu="openPhotoMenu" @view-change="renderPreview" @upload="upload" @delete-photo="deleteSelectedPhoto" @pointercancel="cancelDrag" @pointerdown="beginDrag" @pointermove="moveDrag" @pointerup="finishDrag" />
    <StudioPhotoContextMenu v-if="contextMenu !== null && selectedPhoto !== null" :key="`${contextMenu.x}-${contextMenu.y}-${selectedPhoto.id}`" :x="contextMenu.x" :y="contextMenu.y" :label="photoLabel(settings.photos, selectedPhoto.id)" :can-raise="selectedLayerIndex < settings.photos.length - 1" :can-lower="selectedLayerIndex > 0" @crop="beginCrop" @raise="movePhotoLayer(1)" @lower="movePhotoLayer(-1)" @close="closePhotoMenu" />
    <StudioPhotoCropDialog v-if="croppingPhoto !== null" :src="sourceImages.get(croppingPhoto.id)?.src ?? ''" :label="photoLabel(settings.photos, croppingPhoto.id)" :crop="croppingPhoto.crop" @apply="applyCrop" @close="croppingPhoto = null" />
    <StudioInspector v-if="!isMobile || showSettings" id="studio-settings" :inert="isCompact && showMaterials" :model-value="settings" :selected-photo="selectedPhoto" :can-raise="selectedLayerIndex < settings.photos.length - 1" :can-lower="selectedLayerIndex > 0" @crop="beginCrop" @raise="movePhotoLayer(1)" @lower="movePhotoLayer(-1)" @delete="deleteSelectedPhoto" @close="showSettings = false" @select-photo="selectPhoto" @photo-update="updatePhoto" @redo="redo" @save="saveDefault" @undo="undo" @update="updateSettings" />
    <p v-if="notice && showSettings" class="sheet-notice" aria-live="polite">{{ notice }}</p>
    <footer class="studio-footer" :inert="panelOpen"><span v-if="notice" aria-live="polite">{{ notice }}</span><button class="settings-action" :aria-expanded="showSettings" aria-controls="studio-settings" type="button" @click="showSettings = !showSettings">{{ selectedPhoto ? '照片設定' : '畫布設定' }}</button><button :disabled="!hasImage" type="button" @click="showExport = true">匯出照片 <span class="mono">⌘E</span></button></footer>
    <dialog ref="exportDialog" aria-labelledby="export-title" @close="showExport = false"><form method="dialog" class="export-dialog relative grid gap-[18px] p-8"><button class="dialog-close absolute top-3 right-3 size-8 border-0 bg-transparent text-2xl text-studio-fg" aria-label="關閉匯出視窗" type="submit">×</button><p class="m-0 font-mono text-[11px] tracking-[.08em] text-studio-muted">EXPORT PREVIEW</p><h1 id="export-title" class="m-0 font-serif text-[28px] leading-[1.08]">將這一格留下來</h1><p class="m-0 leading-normal text-studio-muted">匯出畫面會與目前預覽一致，並且不會複製原始 metadata。</p><label>檔案格式<select v-model="settings.format"><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label><button :disabled="!hasImage" class="primary-action" type="button" @click="exportImage">下載檔案</button></form></dialog>
  </div>
</template>
