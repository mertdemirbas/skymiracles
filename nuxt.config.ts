// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt'

export default defineNuxtConfig({
  // 1) TailwindCSS modülü
  modules: ['@nuxtjs/tailwindcss'],

  // 2) Global CSS (Tailwind giriş dosyanız)
  css: ['~/assets/css/tailwind.css'],

  // 3) SSR açık (default Nuxt 3’te açık)
  ssr: true,

  // 4) Çevre değişkenleri
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    }
  },

  // 5) Diğer Nuxt ayarları (alias, plugins vs.)
})
