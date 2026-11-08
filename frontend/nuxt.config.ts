// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },
  modules: ['@nuxt/image', '@nuxtjs/i18n', '@nuxtjs/google-fonts', '@nuxt/ui'],
  compatibilityDate: '2025-07-15',
  css: ['~/assets/rfstory.css', '~/assets/studio-fonts.css'],
  devtools: { enabled: true }
})
