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
  if (!event.isPrimary) return
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
    <div class="canvas-header flex flex-wrap items-center gap-x-2 gap-y-2.5 text-xs text-studio-muted">
      <span class="size-[7px] rounded-full bg-studio-accent"></span><span>本機工作階段</span>
      <span class="mono ml-auto">{{ settings.ratio }}</span>
      <StudioCanvasToolbar v-model="zoom" :pan-mode="panMode" @toggle-pan="panMode = !panMode" @reset="resetView" />
    </div>
    <div class="canvas-stage relative grid min-h-0 min-w-0 place-items-center p-0 max-[680px]:py-4" :data-pan="panMode || spaceHeld" :data-panning="pan !== null">
      <div ref="viewport" class="canvas-viewport absolute inset-x-0 inset-y-2 block [container-type:size]" :style="{ '--canvas-aspect': aspectSize(settings.ratio)[0] / aspectSize(settings.ratio)[1], '--canvas-zoom': zoom / 100 }">
        <div ref="scrollArea" class="absolute inset-0 overflow-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div class="canvas-zoom-surface grid cursor-grab touch-none place-items-center" tabindex="-1" @pointerdown.self="startPan" @pointermove="movePan" @pointerup="finishPan" @pointercancel="finishPan" @lostpointercapture="finishPan">
        <canvas ref="canvas" class="block h-auto cursor-grab touch-none outline outline-studio-border shadow-[0_20px_60px_#00000047] active:cursor-move focus-visible:outline-2 focus-visible:outline-studio-accent focus-visible:outline-offset-4" tabindex="0" aria-label="多照片即時預覽；右鍵編輯照片；空白鍵加拖曳移動畫布；選取照片後按 Delete 刪除" @contextmenu.prevent="emit('contextmenu', $event)" @keydown="handleCanvasKey" @pointercancel="pan === null && emit('pointercancel')" @pointerdown="pointerDown" @pointermove="pan === null && emit('pointermove', $event)" @pointerup="pan === null && emit('pointerup', $event)"></canvas>
          </div>
        </div>
      </div>
      <input ref="fileInput" hidden accept="image/jpeg,image/png,image/webp" multiple type="file" @change="emit('upload', $event)">
      <button v-if="!hasImage" class="group absolute inset-x-0 inset-y-2 grid content-center justify-items-center gap-2 border-0 bg-transparent p-4 text-center text-studio-muted" type="button" aria-label="點選空白畫布上傳照片" @click="fileInput?.click()">
        <span class="grid size-10 place-items-center border border-studio-border text-2xl group-hover:border-studio-accent group-hover:text-studio-fg" aria-hidden="true">+</span>
        <strong class="text-studio-fg">從一張照片開始</strong>
        <p class="m-0 text-[13px]">點選畫布上傳照片 · 影像只會留在你的瀏覽器中。</p>
      </button>
    </div>
  </main>
</template>

<style scoped>
@reference "../assets/rfstory.css";
/* Leave 8px around the fitted canvas so its outline survives the clipped viewport. */
.canvas-zoom-surface {
  --fitted-width: max(1px, min(calc(100cqw - 16px), calc((100cqh - 16px) * var(--canvas-aspect))));
  @apply w-[max(100cqw,calc(var(--fitted-width)*var(--canvas-zoom)))] h-[max(100cqh,calc(var(--fitted-width)*var(--canvas-zoom)/var(--canvas-aspect)))];
}
.canvas-stage[data-pan="true"] canvas { @apply cursor-grab!; }
.canvas-stage[data-panning="true"] canvas, .canvas-stage[data-panning="true"] .canvas-zoom-surface { @apply cursor-grabbing! select-none; }
.canvas-viewport canvas { @apply w-[calc(var(--fitted-width)*var(--canvas-zoom))] max-h-none max-w-none; }
</style>
