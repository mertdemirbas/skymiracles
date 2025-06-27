/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Çevre değişkenleri (trimliyoruz ki baş/son boşluk, newline falan kalmasın)
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
const SUPABASE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
const OPENAI_KEY   = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const signs = [
  "aries","taurus","gemini","cancer",
  "leo","virgo","libra","scorpio",
  "sagittarius","capricorn","aquarius","pisces"
];

async function fetchFromHoroscopeApp(sign: string): Promise<string|null> {
  const res = await fetch(
    `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=today`
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.horoscope_data ?? null;
}

async function fetchFromAztro(sign: string): Promise<string|null> {
  const res = await fetch(
    `https://aztro.sameerkumar.website/?sign=${sign}&day=today`,
    { method: "POST" }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.description;
}

async function fetchFromBurcYorum(sign: string): Promise<string|null> {
  const res = await fetch(`https://burc-yorumlari.vercel.app/get/${sign}`);
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr[0]?.GunlukYorum || null;
}

async function translateWithGPT(text: string): Promise<string> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a professional translator. Translate to natural Turkish." },
          { role: "user",   content: text }
        ],
        temperature: 0.7
      })
    });
    if (!res.ok) {
      console.error("❌ GPT API hata kodu:", res.status, await res.text());
      return text;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? text;
  } catch (err) {
    console.error("❌ translateWithGPT error:", err);
    return text;
  }
}

serve(async () => {
  console.log("🔥 [daily-horoscope] invocation started at", new Date().toISOString());
  const today = new Date().toISOString().slice(0, 10);

  for (const sign of signs) {
    console.log("➡️ fetching for sign:", sign);

    let txt = 
      await fetchFromHoroscopeApp(sign) ||
      await fetchFromAztro(sign) ||
      await fetchFromBurcYorum(sign) ||
      "";

    if (!txt) {
      console.log("⚠️ no text returned for", sign);
      continue;
    }

    // İçerikte Türkçe karakter yoksa GPT ile çevir
    if (!/[ĞÜŞİÖÇığüşiöç]/.test(txt)) {
      console.log("🔄 translating via GPT for", sign);
      txt = await translateWithGPT(txt);
    }

    console.log("💾 upserting into horoscopes:", { sign, date: today, preview: txt.slice(0,20)+"…" });
    const { data, error } = await supabase
      .from("horoscopes")
      .upsert({ sign, date: today, text: txt }, { onConflict: ["sign","date"] });

    if (error) {
      console.error("❌ upsert error for", sign, error);
    } else {
      console.log("✔ upsert success for", sign);
    }
  }

  console.log("✅ [daily-horoscope] all signs processed");
  return new Response("Daily horoscopes updated");
});
