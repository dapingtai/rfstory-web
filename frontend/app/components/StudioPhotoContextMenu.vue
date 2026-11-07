<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ x: number; y: number; label: string; canRaise: boolean; canLower: boolean }>()
const emit = defineEmits<{ crop: []; raise: []; lower: []; close: [] }>()
const menu = ref<HTMLDivElement | null>(null)
const left = ref(props.x)
const top = ref(props.y)
function outside(event: PointerEvent): void { if (!menu.value?.contains(event.target as Node)) emit('close') }
function keyboard(event: KeyboardEvent): void {
  if (event.key === 'Escape' || event.key === 'Tab') { emit('close'); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const items = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus()
}
onMounted(async () => {
  await nextTick()
  const bounds = menu.value?.getBoundingClientRect()
  if (bounds !== undefined) { left.value = Math.max(8, Math.min(props.x, window.innerWidth - bounds.width - 8)); top.value = Math.max(8, Math.min(props.y, window.innerHeight - bounds.height - 8)) }
  menu.value?.querySelector('button')?.focus()
  window.addEventListener('pointerdown', outside)
})
onBeforeUnmount(() => window.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="menu" class="fixed z-20 grid min-w-[180px] rounded-lg border border-studio-border bg-studio-surface p-1.5 shadow-[0_8px_32px_#0000004d]" role="menu" :aria-label="`${label} 編輯工具`" :style="{ left: `${left}px`, top: `${top}px` }" @keydown="keyboard" @contextmenu.prevent>
    <div class="mono border-b border-studio-border px-2.5 py-2 text-[11px] text-studio-muted">{{ label }}</div>
    <button type="button" role="menuitem" @click="emit('crop')">裁切照片</button>
    <button type="button" role="menuitem" :disabled="!canRaise" @click="emit('raise')">上移一層</button>
    <button type="button" role="menuitem" :disabled="!canLower" @click="emit('lower')">下移一層</button>
  </div>
</template>

<style scoped>
@reference "../assets/rfstory.css";
button { @apply min-h-9 rounded border-0 bg-transparent px-2.5 py-2 text-left text-xs text-studio-fg; }
button:hover:not(:disabled), button:focus-visible { @apply bg-studio-accent/12; }
button:disabled { @apply cursor-not-allowed opacity-35; }
</style>
