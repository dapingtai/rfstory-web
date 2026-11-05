<script setup lang="ts">
import type { StudioSettings } from '~/composables/useStudio'

defineProps<{
  readonly hasImage: boolean
  readonly settings: StudioSettings
}>()

const canvas = defineModel<HTMLCanvasElement | null>('canvas', { default: null })

const emit = defineEmits<{
  pointerdown: [event: PointerEvent]
  pointermove: [event: PointerEvent]
  pointerup: [event: PointerEvent]
  pointercancel: []
}>()
</script>

<template>
  <main class="canvas-panel">
    <div class="canvas-toolbar">
      <span class="status-dot"></span><span>本機工作階段</span>
      <span class="canvas-ratio mono">{{ settings.ratio }}</span>
    </div>
    <div class="canvas-stage">
      <canvas ref="canvas" aria-label="多照片即時預覽，可拖曳照片與資訊" @pointercancel="emit('pointercancel')" @pointerdown="emit('pointerdown', $event)" @pointermove="emit('pointermove', $event)" @pointerup="emit('pointerup', $event)"></canvas>
      <div v-if="!hasImage" class="canvas-empty">
        <span class="empty-glyph" aria-hidden="true">+</span>
        <strong>從一張照片開始</strong>
        <p>影像只會留在你的瀏覽器中。</p>
      </div>
    </div>
    <div class="canvas-caption"><span class="mono">NO CROP</span><span>保留原始比例 · 拖曳照片或資訊</span></div>
  </main>
</template>
