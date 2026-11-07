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
  <div class="canvas-view-tools" role="group" aria-label="畫布視野縮放">
    <button type="button" aria-label="縮小畫布" :disabled="modelValue <= 25" @click="update(modelValue - 25)">−</button>
    <label class="canvas-zoom-value" title="25%–300%；100% 為適合視窗大小">
      <input v-model="draft" class="mono" aria-label="畫布縮放百分比" type="number" min="25" max="300" step="1" @change="commit" @blur="commit" @keydown.enter.prevent="commit">
      <span class="mono">%</span>
    </label>
    <button type="button" aria-label="放大畫布" :disabled="modelValue >= 300" @click="update(modelValue + 25)">＋</button>
    <div class="canvas-mode-tools" role="group" aria-label="畫布操作模式">
      <button class="canvas-mode-icon" type="button" aria-label="Pointer：選取與編輯照片" :aria-pressed="!panMode" title="Pointer：選取與編輯照片" @click="panMode && emit('togglePan')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3l7 18 3-7 7-3L4 3Z" /></svg>
      </button>
      <button class="canvas-mode-icon" type="button" aria-label="Hand：拖動畫布" :aria-pressed="panMode" title="Hand：拖動畫布；也可按住空白鍵或滑鼠中鍵拖動" @click="!panMode && emit('togglePan')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V6a1.5 1.5 0 0 1 3 0v6m0-6V4a1.5 1.5 0 0 1 3 0v8m0-6a1.5 1.5 0 0 1 3 0v7m0-4a1.5 1.5 0 0 1 3 0v7c0 4-2.5 6-6 6h-1c-2 0-3.5-1-5-3l-4-6a1.5 1.5 0 0 1 2.4-1.8L8 13Z" /></svg>
      </button>
    </div>
    <button class="canvas-reset-view" type="button" title="置中並還原為適合視窗的 100% 大小" @click="emit('reset')">置中復歸</button>
  </div>
</template>

<style scoped>
.canvas-view-tools { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-left:auto; }
.canvas-view-tools button,.canvas-zoom-value { min-height:36px; border:1px solid var(--border); border-radius:6px; color:var(--fg); background:var(--surface); font-size:12px; }
.canvas-view-tools button { min-width:36px; padding:0 8px; }
.canvas-view-tools button:hover:not(:disabled) { border-color:var(--accent); }
.canvas-view-tools button:disabled { cursor:not-allowed; opacity:.35; }
.canvas-zoom-value { display:flex; align-items:center; gap:2px; padding:0 8px; }
.canvas-zoom-value input { width:44px; min-width:0; padding:0; border:0; background:transparent; color:var(--fg); text-align:center; appearance:textfield; }
.canvas-view-tools button[aria-pressed="true"] { background:var(--accent); color:var(--bg); border-color:var(--accent); }
.canvas-zoom-value input::-webkit-inner-spin-button,.canvas-zoom-value input::-webkit-outer-spin-button { appearance:none; margin:0; }
.canvas-reset-view { margin-left:4px; }
.canvas-mode-tools { display:flex; gap:4px; padding-left:6px; border-left:1px solid var(--border); }
.canvas-mode-icon { display:grid; place-items:center; }
@media (max-width:680px) { .canvas-view-tools button,.canvas-zoom-value { min-height:44px; }.canvas-view-tools button { min-width:44px; } }
</style>
