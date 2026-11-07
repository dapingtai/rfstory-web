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
  <div ref="menu" class="photo-context-menu" role="menu" :aria-label="`${label} 編輯工具`" :style="{ left: `${left}px`, top: `${top}px` }" @keydown="keyboard" @contextmenu.prevent>
    <div class="context-label mono">{{ label }}</div>
    <button type="button" role="menuitem" @click="emit('crop')">裁切照片</button>
    <button type="button" role="menuitem" :disabled="!canRaise" @click="emit('raise')">上移一層</button>
    <button type="button" role="menuitem" :disabled="!canLower" @click="emit('lower')">下移一層</button>
  </div>
</template>

<style scoped>
.photo-context-menu { position:fixed; z-index:20; display:grid; min-width:180px; padding:6px; border:1px solid var(--border); border-radius:8px; background:var(--surface); box-shadow:0 8px 32px rgba(0,0,0,.3); }
.context-label { padding:8px 10px; color:var(--muted); font-size:11px; border-bottom:1px solid var(--border); }
button { text-align:left; min-height:36px; padding:8px 10px; border:0; border-radius:4px; background:transparent; color:var(--fg); font-size:12px; }
button:hover:not(:disabled),button:focus-visible { background:color-mix(in srgb,var(--accent) 12%,transparent); }
button:disabled { opacity:.35; cursor:not-allowed; }
</style>
