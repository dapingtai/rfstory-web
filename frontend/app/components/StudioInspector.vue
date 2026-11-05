<script setup lang="ts">
import type { StudioPhoto, StudioSettings } from '~/composables/useStudio'

const props = defineProps<{ readonly modelValue: StudioSettings; readonly selectedPhoto: StudioPhoto | null }>()
const emit = defineEmits<{ update: [settings: StudioSettings]; photoUpdate: [photo: StudioPhoto]; save: []; undo: []; redo: []; close: [] }>()

function update<K extends keyof StudioSettings>(key: K, value: StudioSettings[K]): void {
  emit('update', { ...props.modelValue, [key]: value })
}

function updatePhoto<K extends keyof StudioPhoto>(key: K, value: StudioPhoto[K]): void {
  if (props.selectedPhoto === null) return
  emit('photoUpdate', { ...props.selectedPhoto, [key]: value })
}
</script>

<template>
  <aside class="inspector" aria-label="照片設定">
    <div class="inspector-heading"><span>Inspector</span><span class="mono">LOCAL</span><button class="sheet-close" type="button" @click="emit('close')">關閉</button></div>
    <section class="control-group">
      <label>作品標題<input :value="modelValue.title" @input="update('title', ($event.target as HTMLInputElement).value)"></label>
      <label>敘述<textarea :value="modelValue.note" rows="2" @input="update('note', ($event.target as HTMLTextAreaElement).value)"></textarea></label>
    </section>
    <section class="control-group">
      <div class="control-title">畫面</div>
      <label>比例<select :value="modelValue.ratio" @change="update('ratio', ($event.target as HTMLSelectElement).value as StudioSettings['ratio'])"><option>3:2</option><option>4:3</option><option>1:1</option><option>16:9</option></select></label>
      <label>框線 <output class="mono">{{ modelValue.border }} px</output><input :value="modelValue.border" max="96" min="24" type="range" @input="update('border', Number(($event.target as HTMLInputElement).value))"></label>
    </section>
    <section class="control-group">
      <div class="control-title">手動資訊</div>
      <div class="field-grid"><label>相機<input :value="modelValue.camera" @input="update('camera', ($event.target as HTMLInputElement).value)"></label><label class="wide-field">鏡頭<input :value="modelValue.lens" @input="update('lens', ($event.target as HTMLInputElement).value)"></label><label>光圈<input :value="modelValue.aperture" @input="update('aperture', ($event.target as HTMLInputElement).value)"></label><label>快門<input :value="modelValue.shutter" @input="update('shutter', ($event.target as HTMLInputElement).value)"></label><label>感光度<input :value="modelValue.iso" @input="update('iso', ($event.target as HTMLInputElement).value)"></label><label>日期<input :value="modelValue.date" @input="update('date', ($event.target as HTMLInputElement).value)"></label></div>
    </section>
    <section v-if="selectedPhoto !== null" class="control-group">
      <div class="control-title">選取照片的資訊 <span class="mono">可在畫布拖曳</span></div>
      <label>照片標題<input :value="selectedPhoto.title" @input="updatePhoto('title', ($event.target as HTMLInputElement).value)"></label>
      <label>照片敘述<textarea :value="selectedPhoto.note" rows="2" @input="updatePhoto('note', ($event.target as HTMLTextAreaElement).value)"></textarea></label>
      <div class="field-grid"><label>相機<input :value="selectedPhoto.camera" @input="updatePhoto('camera', ($event.target as HTMLInputElement).value)"></label><label class="wide-field">鏡頭<input :value="selectedPhoto.lens" @input="updatePhoto('lens', ($event.target as HTMLInputElement).value)"></label><label>光圈<input :value="selectedPhoto.aperture" @input="updatePhoto('aperture', ($event.target as HTMLInputElement).value)"></label><label>快門<input :value="selectedPhoto.shutter" @input="updatePhoto('shutter', ($event.target as HTMLInputElement).value)"></label><label>感光度<input :value="selectedPhoto.iso" @input="updatePhoto('iso', ($event.target as HTMLInputElement).value)"></label><label>日期<input :value="selectedPhoto.date" @input="updatePhoto('date', ($event.target as HTMLInputElement).value)"></label></div>
    </section>
    <section v-else class="control-group"><div class="control-title">選取一張照片後，可填寫它專屬的手動資訊。</div></section>
    <section class="control-group history-controls">
      <button type="button" @click="emit('undo')">復原</button><button type="button" @click="emit('redo')">重做</button><button type="button" @click="emit('save')">設為預設</button>
    </section>
  </aside>
</template>
