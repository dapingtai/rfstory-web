<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { globalInfoFields, photoLabel, type GlobalInfoField, type StudioPhoto, type StudioSettings } from '~/composables/useStudio'

const props = defineProps<{ readonly modelValue: StudioSettings; readonly selectedPhoto: StudioPhoto | null; readonly canRaise: boolean; readonly canLower: boolean }>()
const emit = defineEmits<{ update: [settings: StudioSettings]; photoUpdate: [photo: StudioPhoto]; selectPhoto: [id: string | null]; save: []; undo: []; redo: []; close: []; crop: []; raise: []; lower: []; delete: [] }>()
const scopeId = useId()
const tabList = ref<HTMLElement | null>(null)
watch(() => props.selectedPhoto?.id, async () => {
  await nextTick()
  tabList.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

function navigateTabs(event: KeyboardEvent): void {
  const tabs = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const current = tabs.indexOf(event.target as HTMLButtonElement)
  if (current < 0) return
  let next = current
  if (event.key === 'ArrowRight') next = (current + 1) % tabs.length
  else if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = tabs.length - 1
  else return
  event.preventDefault()
  tabs[next]?.click()
  tabs[next]?.focus()
}

function update<K extends keyof StudioSettings>(key: K, value: StudioSettings[K]): void {
  emit('update', { ...props.modelValue, [key]: value })
}

function updatePhoto<K extends keyof StudioPhoto>(key: K, value: StudioPhoto[K]): void {
  if (props.selectedPhoto === null) return
  emit('photoUpdate', { ...props.selectedPhoto, [key]: value })
}

function updateVisibility(key: GlobalInfoField, visible: boolean): void {
  update('globalInfoVisibility', { ...props.modelValue.globalInfoVisibility, [key]: visible })
}
</script>

<template>
  <aside class="inspector" aria-label="照片設定">
    <div class="inspector-heading"><span>Inspector</span><span class="mono">LOCAL</span><button class="sheet-close" type="button" @click="emit('close')">關閉</button></div>
    <div class="scope-navigation">
      <div ref="tabList" class="scope-tabs" role="tablist" aria-label="編輯範圍與照片" @keydown="navigateTabs">
        <button :id="`${scopeId}-global`" role="tab" type="button" :aria-selected="selectedPhoto === null" :tabindex="selectedPhoto === null ? 0 : -1" :aria-controls="`${scopeId}-panel`" @click="emit('selectPhoto', null)">全域</button>
        <button v-for="photo in modelValue.photos" :id="`${scopeId}-${photo.id}`" :key="photo.id" role="tab" type="button" :title="photo.title ? `${photoLabel(modelValue.photos, photo.id)} · ${photo.title}` : photo.id" :aria-selected="selectedPhoto?.id === photo.id" :tabindex="selectedPhoto?.id === photo.id ? 0 : -1" :aria-controls="`${scopeId}-panel`" @click="emit('selectPhoto', photo.id)"><span class="mono">{{ photoLabel(modelValue.photos, photo.id) }}</span></button>
      </div>
      <div class="scope-summary" :data-scope="selectedPhoto === null ? 'global' : 'photo'">
        <span class="scope-badge mono">{{ selectedPhoto === null ? 'GLOBAL' : 'PHOTO' }}</span>
        <strong :title="selectedPhoto?.id">{{ selectedPhoto === null ? '全域畫布設定' : photoLabel(modelValue.photos, selectedPhoto.id) }}</strong>
        <p>{{ selectedPhoto === null ? '影響整體版面與作品資訊，不修改單張照片設定。' : '僅編輯此張照片的邊框、變形與資訊，不影響其他照片。' }}</p>
      </div>
    </div>
    <div :id="`${scopeId}-panel`" :key="selectedPhoto?.id ?? 'global'" role="tabpanel" :aria-labelledby="selectedPhoto === null ? `${scopeId}-global` : `${scopeId}-${selectedPhoto.id}`" tabindex="0">
    <template v-if="selectedPhoto === null">
    <section class="control-group">
      <div v-for="field in globalInfoFields.slice(0, 3)" :key="field.key" class="global-info-field">
        <div class="global-field-heading"><label :for="`${scopeId}-${field.key}`">{{ field.label }}</label><label class="visibility-toggle"><input type="checkbox" :checked="modelValue.globalInfoVisibility[field.key] !== false" :aria-label="`顯示${field.label}`" @change="updateVisibility(field.key, ($event.target as HTMLInputElement).checked)">顯示</label></div>
        <textarea v-if="field.multiline" :id="`${scopeId}-${field.key}`" :value="modelValue[field.key]" rows="2" @input="update(field.key, ($event.target as HTMLTextAreaElement).value)"></textarea>
        <input v-else :id="`${scopeId}-${field.key}`" :value="modelValue[field.key]" @input="update(field.key, ($event.target as HTMLInputElement).value)">
      </div>
      <span class="control-title">依目前模板顯示對應欄位；畫布標記用於「底片紀錄」。取消勾選會保留內容。</span>
    </section>
    <section class="control-group">
      <div class="control-title">畫面</div>
      <label>比例<select :value="modelValue.ratio" @change="update('ratio', ($event.target as HTMLSelectElement).value as StudioSettings['ratio'])"><option>3:2</option><option>4:3</option><option>1:1</option><option>16:9</option><option value="9:16">9:16</option></select></label>
      <span v-if="modelValue.ratio === '9:16'" class="control-title">1080 × 1920 px · 直式社群版面</span>
      <StudioNumberControl label="框線" :model-value="modelValue.border" :min="24" :max="96" unit="px" @update:model-value="update('border', $event)" />
    </section>
    <section class="control-group">
      <div class="control-title">全域作品資訊</div>
      <StudioNumberControl label="資訊水平位移" :model-value="modelValue.globalInfoOffsetX" :min="-100" :max="100" :step="0.1" unit="%" @update:model-value="update('globalInfoOffsetX', $event)" />
      <StudioNumberControl label="資訊垂直位移" :model-value="modelValue.globalInfoOffsetY" :min="-100" :max="100" :step="0.1" unit="%" @update:model-value="update('globalInfoOffsetY', $event)" />
      <button type="button" @click="emit('update', { ...modelValue, globalInfoOffsetX: 0, globalInfoOffsetY: 0 })">重設資訊位置</button>
      <div class="field-grid">
        <div v-for="field in globalInfoFields.slice(3)" :key="field.key" class="global-info-field" :class="{ 'wide-field': field.key === 'camera' || field.key === 'lens' }">
          <div class="global-field-heading"><label :for="`${scopeId}-${field.key}`">{{ field.label }}</label><label class="visibility-toggle"><input type="checkbox" :checked="modelValue.globalInfoVisibility[field.key] !== false" :aria-label="`顯示${field.label}`" @change="updateVisibility(field.key, ($event.target as HTMLInputElement).checked)">顯示</label></div>
          <input :id="`${scopeId}-${field.key}`" :value="modelValue[field.key]" @input="update(field.key, ($event.target as HTMLInputElement).value)">
        </div>
      </div>
    </section>
    </template>
    <section v-else class="control-group">
      <div class="photo-actions" role="group" aria-label="選取照片操作">
        <button type="button" @click="emit('crop')">裁切照片</button>
        <button type="button" :disabled="!canRaise" @click="emit('raise')">上移一層</button>
        <button type="button" :disabled="!canLower" @click="emit('lower')">下移一層</button>
        <button type="button" @click="emit('delete')">刪除照片</button>
      </div>
      <div class="control-title">選取照片的邊框模板</div>
      <StudioPhotoFramePicker :model-value="selectedPhoto.frame" @update:model-value="updatePhoto('frame', $event)" />
      <StudioNumberControl v-if="selectedPhoto.frame !== 'none'" label="照片框寬" :model-value="selectedPhoto.frameBorder" :min="1" :max="12" unit="%" @update:model-value="updatePhoto('frameBorder', $event)" />
      <span class="control-title">僅套用至這張照片；跟隨版面會隨整體模板切換風格。</span>
      <div class="control-title">選取照片的變形 <span class="mono">可在畫布拖曳</span></div>
      <StudioNumberControl :key="`${selectedPhoto.id}-scale`" label="縮放" :model-value="Math.round(selectedPhoto.scale * 100)" :min="10" :max="300" unit="%" @update:model-value="updatePhoto('scale', $event / 100)" />
      <StudioNumberControl :key="`${selectedPhoto.id}-rotation`" label="旋轉" :model-value="selectedPhoto.rotation" :min="-180" :max="180" unit="°" @update:model-value="updatePhoto('rotation', $event)" />
      <button type="button" @click="emit('photoUpdate', { ...selectedPhoto, scale: 1, rotation: 0 })">重設縮放與旋轉</button>
      <div class="control-title">選取照片的資訊</div>
      <label>照片標題<input :value="selectedPhoto.title" @input="updatePhoto('title', ($event.target as HTMLInputElement).value)"></label>
      <label>照片敘述<textarea :value="selectedPhoto.note" rows="2" @input="updatePhoto('note', ($event.target as HTMLTextAreaElement).value)"></textarea></label>
      <div class="field-grid"><label class="wide-field">相機<input :value="selectedPhoto.camera" @input="updatePhoto('camera', ($event.target as HTMLInputElement).value)"></label><label class="wide-field">鏡頭<input :value="selectedPhoto.lens" @input="updatePhoto('lens', ($event.target as HTMLInputElement).value)"></label><label>光圈<input :value="selectedPhoto.aperture" @input="updatePhoto('aperture', ($event.target as HTMLInputElement).value)"></label><label>快門<input :value="selectedPhoto.shutter" @input="updatePhoto('shutter', ($event.target as HTMLInputElement).value)"></label><label>感光度<input :value="selectedPhoto.iso" @input="updatePhoto('iso', ($event.target as HTMLInputElement).value)"></label><label>日期<input :value="selectedPhoto.date" @input="updatePhoto('date', ($event.target as HTMLInputElement).value)"></label></div>
    </section>
    <section v-if="selectedPhoto === null && modelValue.photos.length === 0" class="control-group"><div class="control-title">上傳照片後，可從畫布或上方分頁選取，開啟單張照片工具。</div></section>
    </div>
    <section class="control-group history-controls grid-cols-3">
      <button type="button" @click="emit('undo')">復原</button><button type="button" @click="emit('redo')">重做</button><button type="button" title="儲存全域設定，不含單張照片" @click="emit('save')">全域預設</button>
    </section>
  </aside>
</template>

<style scoped>
@reference "../assets/rfstory.css";
.global-info-field { @apply grid min-w-0 gap-1.5; }
.global-field-heading { @apply flex flex-wrap items-center justify-between gap-2; }
.control-group .visibility-toggle { @apply inline-flex min-h-6 cursor-pointer items-center gap-1.5; }
.control-group .visibility-toggle input { @apply size-4 min-h-0 w-4 cursor-pointer p-0 accent-studio-accent; }
.scope-navigation { @apply sticky -top-6 z-1 border-b border-studio-border bg-studio-surface pt-4 pb-3 max-[680px]:-top-5; }
.scope-tabs { @apply flex gap-1.5 overflow-x-auto px-0.5 pt-0.5 pb-2 [scrollbar-width:thin]; }
.scope-tabs button { @apply min-h-9 shrink-0 rounded-md border border-studio-border bg-transparent px-2.5 py-2 text-xs text-studio-muted max-[680px]:min-h-11; }
.scope-tabs button[aria-selected="true"] { @apply border-studio-accent bg-studio-accent text-studio-bg; }
.scope-summary { @apply grid grid-cols-[auto_1fr] items-center gap-2 rounded-md border border-dashed border-studio-border p-3; }
.scope-summary[data-scope="photo"] { @apply border-solid border-studio-accent bg-studio-accent/6; }
.scope-summary strong { @apply text-[13px]; }
.scope-badge { @apply rounded-[3px] bg-studio-bg px-[5px] py-[3px] text-[10px] tracking-[.06em] text-studio-muted; }
.scope-summary[data-scope="photo"] .scope-badge { @apply bg-studio-accent text-studio-bg; }
.scope-summary p { @apply col-span-full m-0 text-xs leading-[1.6] text-studio-muted; }
@media (max-width: 767px), (max-width: 980px) and (max-height: 500px) {
  .scope-navigation { position: static; }
  .scope-tabs button { min-height: 44px; }
}
</style>
