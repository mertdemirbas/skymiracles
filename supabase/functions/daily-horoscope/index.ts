/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

enum EnvKeys {
  SUPABASE_URL       = "SUPABASE_URL",
  SUPABASE_KEY       = "SUPABASE_SERVICE_ROLE_KEY",
  OPENAI_KEY         = "OPENAI_API_KEY",
}

const SUPABASE_URL = Deno.env.get(EnvKeys.SUPABASE_URL)!;
const SUPABASE_KEY = Deno.env.get(EnvKeys.SUPABASE_KEY)!;
const OPENAI_KEY   = Deno.env.get(EnvKeys.OPENAI_KEY)!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const signs = [
  "aries","taurus","gemini","cancer","leo","virgo",
  "libra","scorpio","sagittarius","capricorn","aquarius","pisces"
];

async function fetchFromHoroscopeApp(sign: string): Promise<string|null> {
  const res = await fetch(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=today`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.horoscope_data ?? null;
}

async function fetchFromAztro(sign: string): Promise<string|null> {
  const res = await fetch(`https://aztro.sameerkumar.website/?sign=${sign}&day=today`, { method: "POST" });
  if (!res.ok) return null;
  const j = await res.json();
  return j.description;
}

async function fetchFromBurcYorum(sign: string): Promise<string|null> {
  const res = await fetch(`https://burc-yorumlari.vercel.app/get/${sign}`);
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr[0]?.GunlukYorum || null;
}

async function translateWithGPT(text: string): Promise<string> {
  // Header değerlerini kesin stringe çevirdik, byte-string hatası kalkacak
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${OPENAI_KEY}`);
  headers.set("Content-Type", "application/json");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a professional translator. Translate to natural Turkish." },
          { role: "user",   content: text }
        ],
        temperature: 0.7
      }),
    });
    if (!res.ok) throw new Error(`GPT ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content.trim() ?? text;
  } catch (err) {
    console.error("❌ translation failed:", err);
    return text;
  }
}

serve(async () => {
  console.log("🔥 [daily-horoscope] invocation started at", new Date().toISOString());
  const today = new Date().toISOString().slice(0,10);

  for (const sign of signs) {
    console.log("➡️ fetching for sign:", sign);
    let txt = await fetchFromHoroscopeApp(sign)
           || await fetchFromAztro(sign)
           || await fetchFromBurcYorum(sign)
           || "";
    if (!txt) {
      console.warn("⚠️ no text returned for", sign);
      continue;
    }

    // Sadece Türkçe karakter yoksa çevir
    if (!/[ĞÜŞİÖÇığüşiöç]/.test(txt)) {
      console.log("🔄 translating via GPT for", sign);
      txt = await translateWithGPT(txt);
    }

    console.log("💾 upserting into horoscopes:", { sign, date: today, preview: txt.slice(0,20)+"…" });

    const { data, error } = await supabase
      .from("horoscopes")
      .upsert({ sign, date: today, text: txt, text_tr: txt }, { onConflict: ["sign","date"] });

    if (error) {
      console.error("❌ upsert error for", sign, error);
    } else {
      console.log("✔ upsert success for", sign);
    }
  }

  console.log("✅ [daily-horoscope] all signs processed");
  return new Response("Daily horoscopes updated");
});
