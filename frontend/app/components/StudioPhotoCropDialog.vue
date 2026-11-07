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
    <h2 id="crop-heading">裁切 {{ label }}</h2>
    <p>在原圖上拖拉選取保留範圍。原始照片不會被修改。</p>
    <div class="crop-stage">
      <div class="crop-preview" @pointerdown="start" @pointermove="move" @pointerup="finish($event)" @pointercancel="finish($event, true)">
        <img :src="src" alt="待裁切原始照片" draggable="false">
        <div class="crop-selection" :style="{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }"></div>
      </div>
    </div>
    <div class="crop-fields">
      <StudioNumberControl v-for="field in (['x', 'y', 'width', 'height'] as const)" :key="field" :label="({ x: '左緣', y: '上緣', width: '寬度', height: '高度' })[field]" :model-value="Math.round(selection[field] * 100)" :min="field === 'x' || field === 'y' ? 0 : 2" :max="Math.floor((field === 'x' ? 1 - selection.width : field === 'y' ? 1 - selection.height : field === 'width' ? 1 - selection.x : 1 - selection.y) * 100)" unit="%" @update:model-value="selection[field] = $event / 100" />
    </div>
    <div class="crop-actions"><button type="button" @click="selection = { x: 0, y: 0, width: 1, height: 1 }">還原完整照片</button><button type="button" @click="emit('close')">取消</button><button class="primary-action" type="button" @click="apply">套用裁切</button></div>
  </dialog>
</template>

<style scoped>
.photo-crop-dialog { width:min(720px,calc(100% - 32px)); max-height:90dvh; overflow:auto; padding:24px; }
h2 { margin:0 0 8px; font-size:18px; } p { color:var(--muted); font-size:12px; }
.crop-stage { display:grid; place-items:center; min-width:0; margin:20px 0; }
.crop-preview { position:relative; max-width:100%; overflow:hidden; cursor:crosshair; touch-action:none; user-select:none; }
.crop-preview img { display:block; max-width:100%; max-height:40dvh; width:auto; height:auto; }
.crop-selection { position:absolute; border:2px solid var(--paper); box-shadow:0 0 0 2000px rgba(0,0,0,.55); pointer-events:none; }
.crop-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.crop-fields :deep(input) { width:100%; color:var(--fg); background:var(--bg); border:1px solid var(--border); border-radius:6px; }
.crop-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; margin-top:24px; }
.crop-actions button { min-height:36px; border:1px solid var(--border); border-radius:6px; padding:8px 12px; background:var(--surface); color:var(--fg); font-size:12px; }
</style>
