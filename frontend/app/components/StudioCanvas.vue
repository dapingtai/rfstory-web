<script setup lang="ts">
import { aspectSize, type StudioSettings } from '~/composables/useStudio'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  readonly hasImage: boolean
  readonly settings: StudioSettings
}>()

const canvas = defineModel<HTMLCanvasElement | null>('canvas', { default: null })
const fileInput = ref<HTMLInputElement | null>(null)
const viewport = ref<HTMLDivElement | null>(null)
const scrollArea = ref<HTMLDivElement | null>(null)
const zoom = ref(100)
const panMode = ref(false)
const spaceHeld = ref(false)
const pan = ref<{ element: HTMLElement; pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
let resizeObserver: ResizeObserver | null = null

const emit = defineEmits<{
  pointerdown: [event: PointerEvent]
  pointermove: [event: PointerEvent]
  pointerup: [event: PointerEvent]
  pointercancel: []
  upload: [event: Event]
  deletePhoto: []
  viewChange: []
  contextmenu: [event: MouseEvent]
}>()

async function centerView(): Promise<void> {
  await nextTick()
  const area = scrollArea.value
  if (area !== null) {
    area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2
    area.scrollTop = (area.scrollHeight - area.clientHeight) / 2
  }
  emit('viewChange')
}

function resetView(): void { finishPan(); zoom.value = 100; void centerView() }

function startPan(event: PointerEvent): void {
  if (zoom.value <= 100) return
  if (event.button !== 0 && event.button !== 1) return
  const area = scrollArea.value
  const element = event.currentTarget
  if (area === null || !(element instanceof HTMLElement)) return
  event.preventDefault()
  element.focus({ preventScroll: true })
  pan.value = { element, pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop }
  element.setPointerCapture(event.pointerId)
}

function movePan(event: PointerEvent): void {
  const drag = pan.value
  const area = scrollArea.value
  if (drag === null || area === null || drag.pointerId !== event.pointerId) return
  area.scrollLeft = drag.left - (event.clientX - drag.x)
  area.scrollTop = drag.top - (event.clientY - drag.y)
}

function finishPan(): void {
  const drag = pan.value
  pan.value = null
  if (drag?.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId)
}

function pointerDown(event: PointerEvent): void {
  if (panMode.value || spaceHeld.value || event.button === 1) startPan(event)
  else if (event.button === 0) emit('pointerdown', event)
}

function spaceDown(event: KeyboardEvent): void {
  const target = event.target
  if (event.code !== 'Space' || event.isComposing || !(target instanceof HTMLElement) || !target.closest('.canvas-stage') || target.closest('input,textarea,button,select,[contenteditable="true"]')) return
  event.preventDefault()
  spaceHeld.value = true
}
function spaceUp(event: KeyboardEvent): void { if (event.code === 'Space') spaceHeld.value = false }
function loseFocus(): void { spaceHeld.value = false; finishPan() }
watch(zoom, centerView)
watch(() => props.settings.ratio, resetView)
onMounted(() => {
  window.addEventListener('keydown', spaceDown)
  window.addEventListener('keyup', spaceUp)
  window.addEventListener('blur', loseFocus)
  resizeObserver = new ResizeObserver(() => { void centerView() })
  if (viewport.value !== null) resizeObserver.observe(viewport.value)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  finishPan()
  window.removeEventListener('keydown', spaceDown)
  window.removeEventListener('keyup', spaceUp)
  window.removeEventListener('blur', loseFocus)
})

function handleCanvasKey(event: KeyboardEvent): void {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    emit('deletePhoto')
  }
}
</script>

<template>
  <main class="canvas-panel">
    <div class="canvas-toolbar">
      <span class="status-dot"></span><span>本機工作階段</span>
      <span class="canvas-ratio mono">{{ settings.ratio }}</span>
      <StudioCanvasToolbar v-model="zoom" :pan-mode="panMode" @toggle-pan="panMode = !panMode" @reset="resetView" />
    </div>
    <div class="canvas-stage" :data-pan="panMode || spaceHeld" :data-panning="pan !== null">
      <div ref="viewport" class="canvas-viewport" :style="{ '--canvas-aspect': aspectSize(settings.ratio)[0] / aspectSize(settings.ratio)[1], '--canvas-zoom': zoom / 100 }">
        <div ref="scrollArea" class="canvas-scroll-area">
          <div class="canvas-zoom-surface" tabindex="-1" @pointerdown.self="startPan" @pointermove="movePan" @pointerup="finishPan" @pointercancel="finishPan" @lostpointercapture="finishPan">
        <canvas ref="canvas" tabindex="0" aria-label="多照片即時預覽；右鍵編輯照片；空白鍵加拖曳移動畫布；選取照片後按 Delete 刪除" @contextmenu.prevent="emit('contextmenu', $event)" @keydown="handleCanvasKey" @pointercancel="pan === null && emit('pointercancel')" @pointerdown="pointerDown" @pointermove="pan === null && emit('pointermove', $event)" @pointerup="pan === null && emit('pointerup', $event)"></canvas>
          </div>
        </div>
      </div>
      <input ref="fileInput" hidden accept="image/jpeg,image/png,image/webp" multiple type="file" @change="emit('upload', $event)">
      <button v-if="!hasImage" class="canvas-empty canvas-empty-upload" type="button" aria-label="點選空白畫布上傳照片" @click="fileInput?.click()">
        <span class="empty-glyph" aria-hidden="true">+</span>
        <strong>從一張照片開始</strong>
        <p>點選畫布上傳照片 · 影像只會留在你的瀏覽器中。</p>
      </button>
    </div>
  </main>
</template>

<style scoped>
.canvas-toolbar { flex-wrap:wrap; row-gap:10px; }
.canvas-viewport { display:block; }
.canvas-scroll-area { position:absolute; inset:0; overflow:hidden; overscroll-behavior:contain; scrollbar-width:none; }
.canvas-scroll-area::-webkit-scrollbar { display:none; }
/* Leave 8px around the fitted canvas so its outline survives the clipped viewport. */
.canvas-zoom-surface { --fitted-width:max(1px,min(calc(100cqw - 16px),calc((100cqh - 16px) * var(--canvas-aspect)))); width:max(100cqw,calc(var(--fitted-width) * var(--canvas-zoom))); height:max(100cqh,calc(var(--fitted-width) * var(--canvas-zoom) / var(--canvas-aspect))); display:grid; place-items:center; }
.canvas-zoom-surface { touch-action:none; cursor:grab; }
.canvas-stage[data-pan="true"] canvas { cursor:grab!important; }
.canvas-stage[data-panning="true"] canvas,.canvas-stage[data-panning="true"] .canvas-zoom-surface { cursor:grabbing!important; user-select:none; }
.canvas-viewport canvas { width:calc(var(--fitted-width) * var(--canvas-zoom)); max-width:none; max-height:none; }
.canvas-empty-upload { inset:8px 0; align-content:center; padding:16px; border:0; background:transparent; pointer-events:auto; }
.canvas-empty-upload:hover .empty-glyph { border-color:var(--accent); color:var(--fg); }
.canvas-viewport canvas:focus-visible { outline:2px solid var(--accent); outline-offset:4px; }
</style>
