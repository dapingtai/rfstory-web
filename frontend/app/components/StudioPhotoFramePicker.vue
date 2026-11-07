<script setup lang="ts">
import { photoFrameOptions, type PhotoFrameId } from '~/composables/usePhotoFrame'

defineProps<{ modelValue: PhotoFrameId }>()
const emit = defineEmits<{ 'update:modelValue': [value: PhotoFrameId] }>()
</script>

<template>
  <div class="photo-frame-picker grid grid-cols-3 gap-1.5" role="group" aria-label="照片邊框模板">
    <button v-for="frame in photoFrameOptions" :key="frame.id" type="button" :aria-pressed="modelValue === frame.id" @click="emit('update:modelValue', frame.id)">
      <span class="frame-swatch" :data-frame="frame.id" aria-hidden="true"><span></span></span>
      <span>{{ frame.name }}</span>
    </button>
  </div>
</template>

<style scoped>
@reference "../assets/rfstory.css";
.photo-frame-picker button { @apply grid min-w-0 justify-items-center gap-1.5 rounded-md border border-studio-border bg-transparent px-1 py-2 text-xs text-studio-muted; }
.photo-frame-picker button:hover, .photo-frame-picker button[aria-pressed="true"] { @apply border-studio-accent bg-studio-accent/8 text-studio-fg; }
.frame-swatch { @apply block h-8 w-10 bg-studio-paper p-[3px]; }
.frame-swatch > span { @apply block size-full bg-[linear-gradient(145deg,var(--swatch-mid)_48%,var(--accent)_49%)]; }
.frame-swatch[data-frame="auto"] { @apply bg-[repeating-linear-gradient(45deg,var(--paper)_0_3px,var(--muted)_3px_6px)]; }
.frame-swatch[data-frame="none"] { @apply bg-transparent p-0; }
.frame-swatch[data-frame="black"], .frame-swatch[data-frame="film"] { @apply bg-studio-ink; }
.frame-swatch[data-frame="black-shadow"] { @apply bg-[#18181B] shadow-[2px_3px_6px_#00000073] outline outline-[#52525B] -outline-offset-1; }
.frame-swatch[data-frame="instant-shadow"] { @apply pb-[9px]; }
.frame-swatch[data-frame="instant-shadow"] { @apply shadow-[2px_3px_5px_#00000052]; }
.frame-swatch[data-frame="double"] { @apply p-[5px] outline outline-studio-muted -outline-offset-2; }
.frame-swatch[data-frame="film"] { @apply border-y-[3px] border-dashed border-studio-muted py-px; }
</style>
