<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Burçlar</h1>
    <div class="grid grid-cols-3 gap-4">
      <HoroscopeCard
        v-for="s in signs"
        :key="s"
        :sign="s"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import HoroscopeCard from '~/components/HoroscopeCard.vue'

const signs = [
  'aries','taurus','gemini','cancer','leo','virgo',
  'libra','scorpio','sagittarius','capricorn','aquarius','pisces'
]
</script>
