<script setup lang="ts">
import { templateOptions, type TemplateId } from '~/composables/useStudio'

defineProps<{ readonly activeTemplate: TemplateId; readonly theme: 'dark' | 'light' }>()

const emit = defineEmits<{
  select: [template: TemplateId]
  upload: [event: Event]
  toggleTheme: []
}>()
</script>

<template>
  <aside class="studio-sidebar" aria-label="素材與模板">
    <div class="brand-lockup"><span class="grid size-[30px] place-items-center border border-studio-accent font-mono text-xs">RF</span><span>RFStory</span><button class="theme-toggle" type="button" @click="emit('toggleTheme')">{{ theme === 'dark' ? '淺色' : '深色' }}</button></div>
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
