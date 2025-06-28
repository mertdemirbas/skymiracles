<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-4">{{ displayName }}</h1>
    <p v-if="body">{{ body }}</p>
    <p v-else>Bugün için yorum bulunamadı.</p>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { useFetch }   from "#app";
import { createClient } from "@supabase/supabase-js";

const route = useRoute();
const sign  = route.params.sign as string;

const supabase = createClient(
  useRuntimeConfig().public.supabaseUrl,
  useRuntimeConfig().public.supabaseAnonKey
);

const today = new Date().toISOString().slice(0, 10);

const { data, error } = await supabase
  .from("horoscopes")
  .select("translated_text, text, sign")
  .eq("sign", sign)
  .eq("date", today)
  .single();

if (error) {
  console.error(error);
}

const body = data?.translated_text || data?.text || "";

const TURKISH_NAMES: Record<string,string> = {
  aries: "Koç",      taurus: "Boğa",     gemini: "İkizler",
  cancer: "Yengeç",  leo: "Aslan",       virgo: "Başak",
  libra: "Terazi",   scorpio: "Akrep",   sagittarius: "Yay",
  capricorn: "Oğlak", aquarius: "Kova",   pisces: "Balık"
};

const displayName = TURKISH_NAMES[sign] || sign;
</script>
