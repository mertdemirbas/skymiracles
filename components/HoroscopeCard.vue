<template>
  <nuxt-link
    :to="`/horoscope/${sign}`"
    class="block p-4 border rounded hover:bg-gray-50 transition cursor-pointer"
  >
    <div class="text-center">
      <div class="mb-2">
        🔮
      </div>
      <div class="font-medium">{{ turkishName }}</div>
    </div>
  </nuxt-link>
</template>

<script setup lang="ts">
// İngilizce anahtar → Türkçe isim
const TURKISH_NAMES: Record<string,string> = {
  aries: 'Koç', taurus: 'Boğa', gemini: 'İkizler', cancer: 'Yengeç',
  leo: 'Aslan', virgo: 'Başak', libra: 'Terazi', scorpio: 'Akrep',
  sagittarius: 'Yay', capricorn: 'Oğlak', aquarius: 'Kova', pisces: 'Balık'
}

const props = defineProps<{ sign: string }>()
const turkishName = TURKISH_NAMES[props.sign] || props.sign
</script>
