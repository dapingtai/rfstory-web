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
  <div class="grid min-w-0 gap-1.5 text-xs text-studio-muted">
    <label :for="`${id}-number`">{{ label }}</label>
    <div class="number-control-fields flex min-w-0 items-center gap-1.5">
      <button type="button" :aria-label="`減少${label}`" :disabled="modelValue <= min" @click="update(modelValue - step)">−</button>
      <input :id="`${id}-number`" v-model="draft" class="mono" type="number" :min="min" :max="max" :step="step" @change="commit" @blur="commit" @keydown.enter.prevent="commit">
      <span v-if="unit" class="mono text-xs text-studio-muted">{{ unit }}</span>
      <button type="button" :aria-label="`增加${label}`" :disabled="modelValue >= max" @click="update(modelValue + step)">＋</button>
    </div>
    <input type="range" :aria-label="label" :value="modelValue" :min="min" :max="max" :step="step" @input="update(Number(($event.target as HTMLInputElement).value))">
  </div>
</template>

<style scoped>
@reference "../assets/rfstory.css";
.number-control-fields input { @apply h-9 min-w-0 flex-1 px-2.5 py-[9px] text-center text-xs max-[680px]:h-11; }
.number-control-fields button { @apply h-9 flex-[0_0_36px] rounded-md border border-studio-border bg-studio-bg/70 p-0 text-xs text-studio-fg max-[680px]:h-11 max-[680px]:basis-11; }
.number-control-fields button:hover:not(:disabled) { @apply bg-studio-accent/8; }
.number-control-fields button:disabled { @apply cursor-not-allowed opacity-35; }
</style>
