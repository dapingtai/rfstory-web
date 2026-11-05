// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/image', '@nuxtjs/i18n', '@nuxtjs/google-fonts', '@nuxt/ui'],
  compatibilityDate: '2025-07-15',
  css: ['~/assets/rfstory.css'],
  devtools: { enabled: true }
})
