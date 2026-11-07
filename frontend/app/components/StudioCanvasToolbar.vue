<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ modelValue: number; panMode: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number]; reset: []; togglePan: [] }>()
const draft = ref(String(props.modelValue))
watch(() => props.modelValue, (value) => { draft.value = String(value) })

function update(value: number): void {
  const next = Number.isFinite(value) ? Math.min(300, Math.max(25, Math.round(value))) : props.modelValue
  draft.value = String(next)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function commit(): void { update(draft.value.trim() === '' ? props.modelValue : Number(draft.value)) }
</script>

<template>
  <div class="canvas-view-tools ml-auto flex flex-wrap items-center gap-1.5" role="group" aria-label="畫布視野縮放">
    <button type="button" aria-label="縮小畫布" :disabled="modelValue <= 25" @click="update(modelValue - 25)">−</button>
    <label class="canvas-zoom-value" title="25%–300%；100% 為適合視窗大小">
      <input v-model="draft" class="mono" aria-label="畫布縮放百分比" type="number" min="25" max="300" step="1" @change="commit" @blur="commit" @keydown.enter.prevent="commit">
      <span class="mono">%</span>
    </label>
    <button type="button" aria-label="放大畫布" :disabled="modelValue >= 300" @click="update(modelValue + 25)">＋</button>
    <div class="flex gap-1 border-l border-studio-border pl-1.5" role="group" aria-label="畫布操作模式">
      <button class="canvas-mode-icon" type="button" aria-label="Pointer：選取與編輯照片" :aria-pressed="!panMode" title="Pointer：選取與編輯照片" @click="panMode && emit('togglePan')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3l7 18 3-7 7-3L4 3Z" /></svg>
      </button>
      <button class="canvas-mode-icon" type="button" aria-label="Hand：拖動畫布" :aria-pressed="panMode" title="Hand：拖動畫布；也可按住空白鍵或滑鼠中鍵拖動" @click="!panMode && emit('togglePan')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V6a1.5 1.5 0 0 1 3 0v6m0-6V4a1.5 1.5 0 0 1 3 0v8m0-6a1.5 1.5 0 0 1 3 0v7m0-4a1.5 1.5 0 0 1 3 0v7c0 4-2.5 6-6 6h-1c-2 0-3.5-1-5-3l-4-6a1.5 1.5 0 0 1 2.4-1.8L8 13Z" /></svg>
      </button>
    </div>
    <button class="ml-1" type="button" title="置中並還原為適合視窗的 100% 大小" @click="emit('reset')">置中復歸</button>
  </div>
</template>

<style scoped>
@reference "../assets/rfstory.css";
.canvas-view-tools button, .canvas-zoom-value { @apply min-h-9 rounded-md border border-studio-border bg-studio-surface text-xs text-studio-fg max-[680px]:min-h-11; }
.canvas-view-tools button { @apply min-w-9 px-2 py-0 max-[680px]:min-w-11; }
.canvas-view-tools button:hover:not(:disabled) { @apply border-studio-accent; }
.canvas-view-tools button:disabled { @apply cursor-not-allowed opacity-35; }
.canvas-zoom-value { @apply flex items-center gap-0.5 px-2 py-0; }
.canvas-zoom-value input { @apply w-11 min-w-0 [appearance:textfield] border-0 bg-transparent p-0 text-center text-studio-fg; }
.canvas-view-tools button[aria-pressed="true"] { @apply border-studio-accent bg-studio-accent text-studio-bg; }
.canvas-zoom-value input::-webkit-inner-spin-button, .canvas-zoom-value input::-webkit-outer-spin-button { @apply m-0 appearance-none; }
.canvas-mode-icon { @apply grid place-items-center; }
</style>
