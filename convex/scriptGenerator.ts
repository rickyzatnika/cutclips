import { v } from "convex/values";
import { mutation } from "./_generated/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function callGroq(prompt: string, model: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Anda adalah penulis script video AI. Buat script video pendek 60-90 detik berdasarkan topik yang diberikan. Kembalikan JSON valid saja.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}

async function callGemini(prompt: string, model: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "Anda adalah penulis script video AI. Buat script video pendek 60-90 detik berdasarkan topik yang diberikan. Kembalikan JSON valid saja." }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    },
  );
  const data = await res.json();
  return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
}

export const generateScript = mutation({
  args: {
    topic: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const provider = args.provider || "groq";
    const model =
      args.model || (provider === "gemini" ? "gemini-2.0-flash" : "llama-3.1-8b-instant");

    const systemPrompt = `Kamu adalah kreator konten video pendek viral. Buat script video 60-90 detik dalam Bahasa Indonesia tentang topik: "${args.topic}".

ATURAN:
- Total durasi video: 60-90 detik
- Bagi menjadi 3-5 scene
- Tiap scene: 12-25 detik
- Tiap scene punya: narasi (BI), deskripsi visual (BI), visual keyword Bahasa Inggris (1-2 kata), durasi
- Narasi nyambung antar scene (cerita mengalir)
- **visualKeyword HARUS kata konkret yang ADA di stock footage** — pilih dari daftar ini:
  nature, city, people, technology, business, office, food, cooking, science, laboratory, computer, laptop, robot, healthcare, doctor, hospital, education, classroom, student, industry, factory, machine, agriculture, farming, travel, transportation, car, driving, sports, fitness, music, art, design, construction, engineering, space, ocean, beach, mountain, forest, animal, family, meeting, presentation, communication, smartphone, internet, data, abstract, background
- **JANGAN** pakai keyword abstrak seperti "future innovation", "digital transformation", "ai revolution", "technology advancement". Ganti dengan keyword konkret seperti "technology", "computer", "robot", "data", "science", "laboratory".
- Contoh: topik "AI masa depan" → visualKeyword: "robot", "technology", "computer", "data", "science"
- Contoh: topik "manfaat AI" → visualKeyword: "office", "business", "meeting", "healthcare"
- Contoh: topik "dampak teknologi" → visualKeyword: "people", "city", "communication", "smartphone"
- Judul video menarik dan clickbait

Kembalikan JSON:
{
  "title": "Judul video",
  "scenes": [
    {
      "sceneDescription": "Deskripsi visual scene ini (BI)",
      "visualKeyword": "robot",
      "narration": "Teks narasi untuk voice-over scene ini",
      "duration": 18
    }
  ]
}

Pastikan total durasi semua scene = 60-90 detik. Jangan kurangi kualitas narasi.`;

    let result: { title?: string; scenes?: { sceneDescription: string; visualKeyword: string; narration: string; duration: number }[] } = {};
    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }

      try {
        result =
          provider === "gemini"
            ? await callGemini(systemPrompt, model)
            : await callGroq(systemPrompt, model);
        lastError = "";
        if (result?.scenes?.length) break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Generate failed";
      }
    }

    if (lastError) throw new Error(lastError);
    if (!result?.scenes?.length) throw new Error("Gagal generate script");

    const scenes = result.scenes.slice(0, 5);
    const totalDur = scenes.reduce((sum, s) => sum + (s.duration || 15), 0);

    return {
      title: result.title || `Video tentang ${args.topic}`,
      topic: args.topic,
      scenes: scenes.map((s) => ({
        sceneDescription: s.sceneDescription || "",
        visualKeyword: s.visualKeyword || args.topic,
        narration: s.narration || "",
        duration: Math.max(10, Math.min(30, s.duration || 15)),
      })),
      totalDuration: totalDur,
    };
  },
});
