<template>
  <div class="p-8">
    <h2 class="text-2xl font-semibold mb-4">Burçlar</h2>
    <div class="grid grid-cols-3 gap-4">
      <HoroscopeCard
        v-for="sign in signs"
        :key="sign"
        :sign="sign"
        :label="labels[sign]"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const signs = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const labels: Record<string,string> = {
  aries: 'Koç', taurus: 'Boğa', gemini: 'İkizler', cancer: 'Yengeç',
  leo: 'Aslan', virgo: 'Başak', libra: 'Terazi', scorpio: 'Akrep',
  sagittarius: 'Yay', capricorn: 'Oğlak', aquarius: 'Kova', pisces: 'Balık'
};
</script>
