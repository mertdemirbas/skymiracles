/// <reference lib="deno.ns" />
/// <reference lib="dom" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SIGNS = [
  "aries", "taurus", "gemini", "cancer",
  "leo", "virgo", "libra", "scorpio",
  "sagittarius", "capricorn", "aquarius", "pisces",
] as const;
type Sign = typeof SIGNS[number];

enum EnvKeys {
  SUPABASE_URL              = "SUPABASE_URL",
  SUPABASE_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY",
  OPENAI_API_KEY            = "OPENAI_API_KEY",
}

const SUPABASE_URL   = Deno.env.get(EnvKeys.SUPABASE_URL)!;
const SUPABASE_KEY   = Deno.env.get(EnvKeys.SUPABASE_SERVICE_ROLE_KEY)!;
const OPENAI_API_KEY = Deno.env.get(EnvKeys.OPENAI_API_KEY)!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1) Üçüncü parti API’lerden günlük yorumu çekme
async function fetchFromHoroscopeApp(sign: Sign): Promise<string | null> {
  const res = await fetch(
    `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=today`
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.horoscope_data ?? null;
}

async function fetchFromAztro(sign: Sign): Promise<string | null> {
  const res = await fetch(`https://aztro.sameerkumar.website/?sign=${sign}&day=today`, {
    method: "POST",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.description ?? null;
}

async function fetchFromBurcYorum(sign: Sign): Promise<string | null> {
  const res = await fetch(`https://burc-yorumlari.vercel.app/get/${sign}`);
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr[0]?.GunlukYorum
    ? arr[0].GunlukYorum
    : null;
}

// 2) GPT ile doğal Türkçe çeviri
async function translateToTurkish(text: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Translate the following horoscope into natural Turkish, preserving tone:"
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    console.error("GPT çeviri hatası:", await res.text());
    return text;
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// 3) Edge Function
serve(async () => {
  console.log("🔥 [daily-horoscope] invocation at", new Date().toISOString());

  const today = new Date().toISOString().slice(0, 10);
  for (const sign of SIGNS) {
    console.log("➡️ fetching for:", sign);
    let txt =
      await fetchFromHoroscopeApp(sign) ||
      await fetchFromAztro(sign) ||
      await fetchFromBurcYorum(sign) ||
      "";

    if (!txt) {
      console.warn("⚠️ no data for", sign);
      continue;
    }

    // Eğer metin zaten Türkçe karakter içermiyorsa, GPT ile çevir
    if (!/[İŞĞÇÜÖışğçüö]/.test(txt)) {
      console.log("🔄 translating via GPT for", sign);
      try {
        txt = await translateToTurkish(txt);
      } catch (err) {
        console.error("❌ translation failed:", err);
      }
    }

    console.log("💾 upserting:", { sign, date: today, preview: txt.slice(0, 30) + "…" });
    const { data, error } = await supabase
      .from("horoscopes")
      .upsert({ sign, date: today, text: txt }, { onConflict: ["sign", "date"] });

    if (error) {
      console.error("❌ upsert error for", sign, error);
    } else {
      console.log("✔ upsert success for", sign);
    }
  }

  console.log("✅ all signs done");
  return new Response("Daily horoscopes updated");
});
