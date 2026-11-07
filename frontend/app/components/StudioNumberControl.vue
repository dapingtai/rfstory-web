<script setup lang="ts">
import { ref, useId, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  label: string
  min: number
  max: number
  step?: number
  unit?: string
}>(), { step: 1, unit: '' })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const id = useId()
const draft = ref(String(props.modelValue))
watch(() => props.modelValue, (value) => { draft.value = String(value) })

function update(value: number): void {
  if (!Number.isFinite(value)) { draft.value = String(props.modelValue); return }
  const snapped = props.min + Math.round((value - props.min) / props.step) * props.step
  const next = Number(Math.min(props.max, Math.max(props.min, snapped)).toFixed(8))
  draft.value = String(next)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function commit(): void {
  update(draft.value.trim() === '' ? props.modelValue : Number(draft.value))
}
</script>

<template>
  <div class="number-control">
    <label :for="`${id}-number`">{{ label }}</label>
    <div class="number-control-fields">
      <button type="button" :aria-label="`減少${label}`" :disabled="modelValue <= min" @click="update(modelValue - step)">−</button>
      <input :id="`${id}-number`" v-model="draft" class="mono" type="number" :min="min" :max="max" :step="step" @change="commit" @blur="commit" @keydown.enter.prevent="commit">
      <span v-if="unit" class="number-control-unit mono">{{ unit }}</span>
      <button type="button" :aria-label="`增加${label}`" :disabled="modelValue >= max" @click="update(modelValue + step)">＋</button>
    </div>
    <input type="range" :aria-label="label" :value="modelValue" :min="min" :max="max" :step="step" @input="update(Number(($event.target as HTMLInputElement).value))">
  </div>
</template>

<style scoped>
.number-control { display:grid; gap:6px; min-width:0; color:var(--muted); font-size:12px; }
.number-control-fields { display:flex; align-items:center; gap:6px; min-width:0; }
.number-control-fields input { flex:1; min-width:0; height:36px; padding:9px 10px; font-size:12px; text-align:center; }
.number-control-fields button { flex:0 0 36px; height:36px; padding:0; border:1px solid var(--border); border-radius:6px; color:var(--fg); background:color-mix(in srgb,var(--bg) 70%,transparent); font-size:12px; }
.number-control-fields button:hover:not(:disabled) { background:color-mix(in srgb,var(--accent) 8%,transparent); }
.number-control-fields button:disabled { opacity:.35; cursor:not-allowed; }
.number-control-unit { color:var(--muted); font-size:12px; }
@media (max-width:680px) { .number-control-fields button { flex-basis:44px; height:44px; }.number-control-fields input { height:44px; } }
</style>
