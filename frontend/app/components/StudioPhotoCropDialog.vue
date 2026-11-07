<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { PhotoCrop } from '~/composables/usePhotoFrame'

const props = defineProps<{ src: string; label: string; crop: PhotoCrop | null }>()
const emit = defineEmits<{ apply: [crop: PhotoCrop | null]; close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const selection = ref<PhotoCrop>(props.crop === null ? { x: 0, y: 0, width: 1, height: 1 } : { ...props.crop })
let drag: { x: number; y: number; previous: PhotoCrop; pointerId: number } | null = null
function point(event: PointerEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) }
}
function start(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  drag = { ...point(event), previous: { ...selection.value }, pointerId: event.pointerId }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent): void {
  if (drag === null || drag.pointerId !== event.pointerId) return
  const end = point(event)
  selection.value = { x: Math.min(drag.x, end.x), y: Math.min(drag.y, end.y), width: Math.abs(end.x - drag.x), height: Math.abs(end.y - drag.y) }
}
function finish(event: PointerEvent, cancel = false): void {
  if (drag === null) return
  if (cancel || selection.value.width < 0.02 || selection.value.height < 0.02) selection.value = drag.previous
  drag = null
  const element = event.currentTarget as HTMLElement
  if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
}
function apply(): void {
  const crop = selection.value
  emit('apply', crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1 ? null : { ...crop })
}
onMounted(() => dialog.value?.showModal())
</script>

<template>
  <dialog ref="dialog" class="photo-crop-dialog" aria-labelledby="crop-heading" @cancel.prevent="emit('close')">
    <h2 id="crop-heading" class="mt-0 mb-2 text-lg font-bold">裁切 {{ label }}</h2>
    <p class="my-3 text-xs text-studio-muted">在原圖上拖拉選取保留範圍。原始照片不會被修改。</p>
    <div class="my-5 grid min-w-0 place-items-center">
      <div class="relative max-w-full cursor-crosshair touch-none overflow-hidden select-none" @pointerdown="start" @pointermove="move" @pointerup="finish($event)" @pointercancel="finish($event, true)">
        <img :src="src" class="block h-auto max-h-[40dvh] w-auto max-w-full" alt="待裁切原始照片" draggable="false">
        <div class="pointer-events-none absolute border-2 border-studio-paper shadow-[0_0_0_2000px_#0000008c]" :style="{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }"></div>
      </div>
    </div>
    <div class="crop-fields grid grid-cols-2 gap-4">
      <StudioNumberControl v-for="field in (['x', 'y', 'width', 'height'] as const)" :key="field" :label="({ x: '左緣', y: '上緣', width: '寬度', height: '高度' })[field]" :model-value="Math.round(selection[field] * 100)" :min="field === 'x' || field === 'y' ? 0 : 2" :max="Math.floor((field === 'x' ? 1 - selection.width : field === 'y' ? 1 - selection.height : field === 'width' ? 1 - selection.x : 1 - selection.y) * 100)" unit="%" @update:model-value="selection[field] = $event / 100" />
    </div>
    <div class="crop-actions mt-6 flex flex-wrap justify-end gap-2"><button type="button" @click="selection = { x: 0, y: 0, width: 1, height: 1 }">還原完整照片</button><button type="button" @click="emit('close')">取消</button><button class="primary-action" type="button" @click="apply">套用裁切</button></div>
  </dialog>
</template>

<style scoped>
@reference "../assets/rfstory.css";
.photo-crop-dialog { @apply max-h-[90dvh] w-[min(720px,calc(100%_-_32px))] overflow-auto p-6; }
.crop-fields :deep(input) { @apply w-full rounded-md border border-studio-border bg-studio-bg text-studio-fg; }
.crop-actions button { @apply min-h-9 rounded-md border border-studio-border bg-studio-surface px-3 py-2 text-xs text-studio-fg; }
@media (max-width: 767px), (max-width: 980px) and (max-height: 500px) {
  .photo-crop-dialog { padding: 16px; }
  .crop-fields { grid-template-columns: minmax(0, 1fr); }
  .crop-actions button { min-height: 44px; }
}
</style>
