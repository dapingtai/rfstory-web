// https://nuxt.com/docs/api/configuration/nuxt-config
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  app: {
    baseURL,
    head: {
      title: 'RFStory｜照片故事工作室',
      meta: [
        { name: 'theme-color', content: '#0B0B0D' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${baseURL}icons/favicon-32.png` },
        { rel: 'apple-touch-icon', href: `${baseURL}icons/apple-touch-icon.png` }
      ]
    }
  },
  modules: ['@nuxt/image', '@nuxtjs/i18n', '@nuxtjs/google-fonts', '@nuxt/ui', '@vite-pwa/nuxt'],
  pwa: {
    registerType: 'prompt',
    scope: baseURL,
    manifest: {
      id: baseURL,
      name: 'RFStory 照片故事工作室',
      short_name: 'RFStory',
      description: '在裝置上編排照片、設計相框並匯出你的照片故事。',
      lang: 'zh-TW',
      start_url: baseURL,
      scope: baseURL,
      display: 'standalone',
      theme_color: '#0B0B0D',
      background_color: '#0B0B0D',
      icons: [
        { src: `${baseURL}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${baseURL}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${baseURL}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      // Include the bundled CJK fonts (up to 4.9 MB each) for offline exports.
      globPatterns: ['**/*.{js,css,html,json,woff2,png,ico,webmanifest}'],
      globIgnores: ['**/200.html', '**/404.html', '**/rfstory-film-master.*'],
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      navigateFallback: baseURL,
      cleanupOutdatedCaches: true
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 60 * 60
    },
    devOptions: { enabled: false }
  },
  compatibilityDate: '2025-07-15',
  css: ['~/assets/rfstory.css', '~/assets/studio-fonts.css'],
  devtools: { enabled: true }
})
