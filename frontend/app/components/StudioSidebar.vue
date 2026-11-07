<script setup lang="ts">
import { templateOptions, type TemplateId } from '~/composables/useStudio'

defineProps<{ readonly activeTemplate: TemplateId; readonly theme: 'dark' | 'light' }>()

const emit = defineEmits<{
  select: [template: TemplateId]
  upload: [event: Event]
  toggleTheme: []
  close: []
}>()
</script>

<template>
  <aside class="studio-sidebar" aria-label="素材與模板">
    <div class="brand-lockup">
      <span class="grid size-[30px] place-items-center border border-studio-accent font-mono text-xs">RF</span>
      <span>RFStory</span>
      <button
        class="theme-toggle"
        type="button"
        :aria-label="theme === 'dark' ? '切換至日間模式' : '切換至夜間模式'"
        :title="theme === 'dark' ? '切換至日間模式' : '切換至夜間模式'"
        @click="emit('toggleTheme')"
      >
        <svg :key="theme" class="theme-toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <template v-if="theme === 'dark'">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </template>
          <path v-else d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z" />
        </svg>
      </button>
    </div>
    <button class="materials-close" type="button" aria-label="關閉素材與模板" @click="emit('close')">關閉 ×</button>
    <section>
      <div class="section-heading"><span>素材</span><span class="mono">01</span></div>
      <label class="upload-zone">
        <input accept="image/jpeg,image/png,image/webp,.raw,.dng" multiple type="file" @change="emit('upload', $event)">
        <strong>加入照片</strong>
        <span>JPEG · PNG · WebP</span>
      </label>
    </section>
    <section class="template-section">
      <div class="section-heading"><span>模板</span><span class="mono">06</span></div>
      <div class="template-list" role="list">
        <button
          v-for="template in templateOptions"
          :key="template.id"
          :aria-pressed="activeTemplate === template.id"
          class="template-card"
          type="button"
          @click="emit('select', template.id)"
        >
          <span class="template-swatch" :data-template="template.id" aria-hidden="true"></span>
          <span><strong>{{ template.name }}</strong><small>{{ template.description }}</small></span>
        </button>
      </div>
    </section>
  </aside>
</template>
