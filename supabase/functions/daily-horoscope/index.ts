/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

enum EnvKeys {
  SUPABASE_URL = "SUPABASE_URL",
  SUPABASE_KEY = "SUPABASE_SERVICE_ROLE_KEY",
  OPENAI_KEY = "OPENAI_API_KEY",
}

const supabase = createClient(
  Deno.env.get(EnvKeys.SUPABASE_URL)!,
  Deno.env.get(EnvKeys.SUPABASE_KEY)!,
);

const signs = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
];

async function fetchFromHoroscopeApp(sign: string) {
  const res = await fetch(
    `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=today`
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.horoscope_data ?? null;
}

async function fetchFromAztro(sign: string) {
  const res = await fetch(
    `https://aztro.sameerkumar.website/?sign=${sign}&day=today`,
    { method: "POST" }
  );
  if (!res.ok) return null;
  return (await res.json()).description;
}

async function fetchFromBurcYorum(sign: string) {
  const res = await fetch(`https://burc-yorumlari.vercel.app/get/${sign}`);
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr[0]?.GunlukYorum || null;
}

async function translateWithGPT(text: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get(EnvKeys.OPENAI_KEY)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a professional translator. Translate to natural Turkish while preserving the meaning and tone." },
        { role: "user", content: text },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function deleteOldRecords(today: string) {
  const { error } = await supabase
    .from("horoscopes")
    .delete()
    .neq("date", today);

  if (error) {
    console.error("❌ Error deleting old records:", error);
    return false;
  }
  console.log("🗑️ Old records deleted successfully");
  return true;
}

serve(async () => {
  try {
    console.log("🔥 [daily-horoscope] invocation started at", new Date().toISOString());
    const today = new Date().toISOString().slice(0, 10);

    // First delete old records
    await deleteOldRecords(today);

    for (const sign of signs) {
      try {
        console.log("➡️ fetching for sign:", sign);

        // Try each source in order
        const text =
          (await fetchFromHoroscopeApp(sign)) ||
          (await fetchFromAztro(sign)) ||
          (await fetchFromBurcYorum(sign));

        if (!text) {
          console.log("⚠️ no text returned for", sign);
          continue;
        }

        // Store original text and get translation if needed
        let text_tr = text;
        if (!/[ĞÜŞİÖÇığüşiöç]/.test(text)) {
          console.log("🔄 translating via GPT for", sign);
          const translation = await translateWithGPT(text);
          if (translation) {
            text_tr = translation;
          } else {
            console.log("⚠️ translation failed for", sign, "using original text");
          }
        }

        console.log("💾 upserting into horoscopes:", {
          sign,
          date: today,
          preview: text.slice(0, 20) + (text.length > 20 ? "…" : ""),
        });

        const { error } = await supabase
          .from("horoscopes")
          .upsert(
            {
              sign,
              date: today,
              text,
              text_tr
            },
            { onConflict: ["sign", "date"] }
          );

        if (error) {
          console.error("❌ upsert error for", sign, error);
        } else {
          console.log("✅ upsert success for", sign);
        }
      } catch (error) {
        console.error("❌ Error processing sign:", sign, error);
      }
    }

    console.log("✅ [daily-horoscope] all signs processed");
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Daily horoscopes updated",
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("💥 Fatal error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Internal server error", 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
});
