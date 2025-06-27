<template>
  <div class="p-6 max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold mb-4">{{ turkishName }}</h1>

    <p v-if="loading" class="italic">Yükleniyor…</p>
    <p v-else-if="horoscope">{{ horoscope }}</p>
    <p v-else class="text-red-500">Bugün için bir yorum bulunamadı.</p>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

// 1. Route’dan gelen sign parametresi
const route = useRoute()
const sign = route.params.sign as string

// 2. Türkçe isim haritası
const TURKISH_NAMES: Record<string,string> = {
  aries: 'Koç', taurus: 'Boğa', gemini: 'İkizler', cancer: 'Yengeç',
  leo: 'Aslan', virgo: 'Başak', libra: 'Terazi', scorpio: 'Akrep',
  sagittarius: 'Yay', capricorn: 'Oğlak', aquarius: 'Kova', pisces: 'Balık'
}
const turkishName = TURKISH_NAMES[sign] || sign

// 3. Supabase istemcisi
const config = useRuntimeConfig()
const supabase = createClient(
  config.public.supabaseUrl,
  config.public.supabaseAnonKey
)

// 4. State’ler
const loading = ref(true)
const horoscope = ref<string>('')

// 5. Veriyi çek
const today = new Date().toISOString().slice(0,10)
async function fetchHoroscope() {
  const { data, error } = await supabase
    .from('horoscopes')
    .select('text')
    .eq('sign', sign)
    .eq('date', today)
    .single()

  if (error) {
    console.error('Supabase error:', error)
    horoscope.value = ''
  } else {
    horoscope.value = data?.text || ''
  }
  loading.value = false
}

// sayfa yüklendiğinde hemen çağır
fetchHoroscope()
</script>
