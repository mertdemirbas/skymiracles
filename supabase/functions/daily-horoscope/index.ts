/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// .env’deki anahtar isimleri
enum EnvKeys {
  SUPABASE_URL       = "SUPABASE_URL",
  SUPABASE_KEY       = "SUPABASE_SERVICE_ROLE_KEY",
  OPENAI_KEY         = "OPENAI_API_KEY",
}

const SUPABASE_URL = Deno.env.get(EnvKeys.SUPABASE_URL)!;
const SUPABASE_KEY = Deno.env.get(EnvKeys.SUPABASE_KEY)!;
const OPENAI_KEY   = Deno.env.get(EnvKeys.OPENAI_KEY)!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Desteklenen 12 burç listesi
const signs = [
  "aries","taurus","gemini","cancer","leo","virgo",
  "libra","scorpio","sagittarius","capricorn","aquarius","pisces"
];

// Üç farklı kaynak API’sinden yorum çekme fonksiyonları
async function fetchFromHoroscopeApp(sign: string): Promise<string|null> {
  const res = await fetch(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=today`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.horoscope_data ?? null;
}

async function fetchFromAztro(sign: string): Promise<string|null> {
  const res = await fetch(`https://aztro.sameerkumar.website/?sign=${sign}&day=today`, { method: "POST" });
  if (!res.ok) return null;
  const { description } = await res.json();
  return description;
}

async function fetchFromBurcYorum(sign: string): Promise<string|null> {
  const res = await fetch(`https://burc-yorumlari.vercel.app/get/${sign}`);
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr[0]?.GunlukYorum || null;
}

// OpenAI ile çeviri fonksiyonu
async function translateWithGPT(text: string): Promise<string> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type":  "application/json"
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
    if (!res.ok) return text;
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch (_err) {
    console.error("❌ translation error", _err);
    return text;
  }
}

// Edge Function'u ayağa kaldır
serve(async () => {
  console.log("🔥 [daily-horoscope] invocation started at", new Date().toISOString());

  const today = new Date().toISOString().slice(0, 10);

  for (const sign of signs) {
    console.log("➡️ fetching for sign:", sign);

    // 1) Orijinal yorumu çek
    let txt = await fetchFromHoroscopeApp(sign)
           || await fetchFromAztro(sign)
           || await fetchFromBurcYorum(sign)
           || "";
    if (!txt) {
      console.warn("⚠️ no text returned for", sign);
      continue;
    }

    // 2) Önceden çevrilmiş var mı diye DB’den oku
    const { data: existing, error: selErr } = await supabase
      .from("horoscopes")
      .select("translated_text")
      .eq("sign", sign)
      .eq("date", today)
      .single();

    let finalText: string;

    if (selErr) {
      console.error("❌ select error for", sign, selErr);
      finalText = txt;  // fallback
    }
    else if (existing?.translated_text) {
      console.log("🟢 reuse existing translation for", sign);
      finalText = existing.translated_text;
    }
    else {
      // 3) İhtiyaç varsa çeviri yap
      if (!/[ĞÜŞİÖÇığüşiöç]/.test(txt)) {
        console.log("🔄 translating via GPT for", sign);
        txt = await translateWithGPT(txt);
      }
      finalText = txt;
    }

    // 4) Upsert: original text + translated_text
    console.log("💾 upserting into horoscopes:", { sign, date: today });
    const { error: upErr } = await supabase
      .from("horoscopes")
      .upsert({
        sign,
        date: today,
        text: txt,              // orijinal
        translated_text: finalText  // yeni sütun
      }, {
        onConflict: ["sign","date"]
      });

    if (upErr) console.error("❌ upsert error for", sign, upErr);
    else       console.log("✔ upsert success for", sign);
  }

  console.log("✅ [daily-horoscope] all signs processed");
  return new Response("Daily horoscopes updated");
});
