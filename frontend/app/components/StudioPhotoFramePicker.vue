<script setup lang="ts">
import { photoFrameOptions, type PhotoFrameId } from '~/composables/usePhotoFrame'

defineProps<{ modelValue: PhotoFrameId }>()
const emit = defineEmits<{ 'update:modelValue': [value: PhotoFrameId] }>()
</script>

<template>
  <div class="photo-frame-picker" role="group" aria-label="照片邊框模板">
    <button v-for="frame in photoFrameOptions" :key="frame.id" type="button" :aria-pressed="modelValue === frame.id" @click="emit('update:modelValue', frame.id)">
      <span class="frame-swatch" :data-frame="frame.id" aria-hidden="true"><span></span></span>
      <span>{{ frame.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.photo-frame-picker { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
.photo-frame-picker button { display:grid; justify-items:center; gap:6px; min-width:0; padding:8px 4px; border:1px solid var(--border); border-radius:6px; background:transparent; color:var(--muted); font-size:12px; }
.photo-frame-picker button:hover,.photo-frame-picker button[aria-pressed="true"] { border-color:var(--accent); color:var(--fg); background:color-mix(in srgb,var(--accent) 8%,transparent); }
.frame-swatch { display:block; width:40px; height:32px; padding:3px; background:var(--paper); }
.frame-swatch > span { display:block; width:100%; height:100%; background:linear-gradient(145deg,var(--swatch-mid) 48%,var(--accent) 49%); }
.frame-swatch[data-frame="auto"] { background:repeating-linear-gradient(45deg,var(--paper) 0 3px,var(--muted) 3px 6px); }
.frame-swatch[data-frame="none"] { padding:0; background:transparent; }
.frame-swatch[data-frame="black"],.frame-swatch[data-frame="film"] { background:var(--ink); }
.frame-swatch[data-frame="instant"],.frame-swatch[data-frame="instant-shadow"] { padding-bottom:9px; }
.frame-swatch[data-frame="instant-shadow"] { box-shadow:2px 3px 5px rgba(0,0,0,.32); }
.frame-swatch[data-frame="double"] { outline:1px solid var(--muted); outline-offset:-2px; padding:5px; }
.frame-swatch[data-frame="film"] { border-block:3px dashed var(--muted); padding-block:1px; }
</style>
