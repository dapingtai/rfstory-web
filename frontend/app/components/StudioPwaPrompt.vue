<script setup lang="ts">
const { $pwa } = useNuxtApp()

function update(): void {
  if (window.confirm('更新會重新載入工作室，尚未匯出的照片編輯將會遺失。已匯出並準備好更新嗎？')) {
    $pwa?.updateServiceWorker(true)
  }
}
</script>

<template>
  <aside v-if="$pwa?.needRefresh || $pwa?.offlineReady || $pwa?.showInstallPrompt" class="pwa-prompt" aria-label="應用程式狀態">
    <template v-if="$pwa.needRefresh">
      <p role="status">有新版本可用，請先匯出作品再更新。</p>
      <button type="button" @click="update">更新並重新載入</button>
      <button type="button" @click="$pwa.cancelPrompt()">稍後</button>
    </template>
    <template v-else-if="$pwa.offlineReady">
      <p role="status">離線使用已就緒。照片編輯仍需在關閉前匯出。</p>
      <button type="button" @click="$pwa.cancelPrompt()">知道了</button>
    </template>
    <template v-else-if="$pwa.showInstallPrompt">
      <p>安裝 RFStory，從主畫面開啟照片工作室。</p>
      <button type="button" @click="$pwa.install()">安裝</button>
      <button type="button" @click="$pwa.cancelInstall()">暫不安裝</button>
    </template>
  </aside>
</template>

<style scoped>
.pwa-prompt {
  position: fixed;
  z-index: 100;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(76px + env(safe-area-inset-bottom));
  width: min(360px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--fg);
  box-shadow: 0 8px 32px #0006;
  font-size: 14px;
}
.pwa-prompt p { margin: 0 0 12px; }
.pwa-prompt button {
  min-height: 44px;
  padding: 8px 12px;
  margin: 4px 8px 0 0;
  border: 1px solid var(--muted);
  border-radius: 6px;
  cursor: pointer;
}
.pwa-prompt button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>
