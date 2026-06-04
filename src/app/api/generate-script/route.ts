import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const groqModels = ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "llama-3.3-70b-versatile"];

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
          content: "Anda adalah penulis script video AI. Buat script video pendek 60-90 detik berdasarkan topik. Kembalikan JSON valid saja.",
        },
        { role: "user", content: prompt },
      ],
      response_format: groqModels.includes(model) ? { type: "json_object" } : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 200)}`);
  }
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
          parts: [{ text: "Anda adalah penulis script video AI. Buat script video pendek 60-90 detik berdasarkan topik. Kembalikan JSON valid saja." }],
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
}

export async function POST(req: NextRequest) {
  try {
    const { topic, provider = "groq", model: modelArg } = await req.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Prompt harus diisi" }, { status: 400 });
    }

    const providerName = provider === "gemini" ? "gemini" : "groq";
    const model = modelArg || (providerName === "gemini" ? "gemini-2.0-flash" : "llama-3.1-8b-instant");

    const systemPrompt = `Kamu adalah kreator konten video pendek viral. Buat script video 60-90 detik dalam Bahasa Indonesia berdasarkan permintaan berikut:

"${topic.trim()}"

ATURAN:
- Total durasi video: 60-90 detik
- Bagi menjadi 3-5 scene
- Tiap scene: 12-25 detik
- Tiap scene punya: narasi (BI), deskripsi visual (BI), visual keyword Bahasa Inggris (1-2 kata), durasi
- **visualKeyword HARUS kata konkret yang pasti ADA di stock footage (Pexels)** — pilih dari daftar berikut:
  nature, city, people, technology, business, office, food, cooking, science, laboratory, computer, laptop, robot, healthcare, doctor, hospital, education, classroom, student, industry, factory, machine, agriculture, farming, travel, transportation, car, driving, sports, fitness, music, art, design, construction, engineering, space, ocean, beach, mountain, forest, animal, family, meeting, presentation, communication, smartphone, internet, data, abstract, background
- **JANGAN** pakai keyword abstrak seperti "future innovation", "ai revolution" — ganti dengan keyword konkret
- Pahami konteks Bahasa Indonesia: dari topik user, petakan ke keyword visual yang paling relevan
- Narasi nyambung antar scene

Contoh pemetaan topik → visualKeyword:
- "AI masa depan" → robot, technology, data, science, computer
- "manfaat AI" → business, office, meeting, healthcare, technology
- "dampak teknologi" → people, city, communication, smartphone, lifestyle
- "kesehatan mental" → healthcare, doctor, hospital, people, nature
- "bisnis online" → business, office, laptop, internet, meeting

Kembalikan JSON:
{
  "title": "Judul video clickbait",
  "scenes": [
    {
      "sceneDescription": "Visual scene ini",
      "visualKeyword": "robot",
      "narration": "Teks narasi",
      "duration": 18
    }
  ]
}`;

    let result: any = {};
    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      try {
        result = providerName === "gemini" ? await callGemini(systemPrompt, model) : await callGroq(systemPrompt, model);
        lastError = "";
        if (result?.scenes?.length) break;
      } catch (e: any) {
        lastError = e.message || "Generate failed";
      }
    }

    if (lastError) return NextResponse.json({ error: lastError }, { status: 500 });
    if (!result?.scenes?.length) {
      return NextResponse.json({ error: "Gagal generate script — coba topik lain" }, { status: 500 });
    }

    const scenes = result.scenes.slice(0, 5).map((s: any) => ({
      sceneDescription: String(s.sceneDescription || ""),
      visualKeyword: String(s.visualKeyword || topic).split(" ").slice(0, 3).join(" "),
      narration: String(s.narration || ""),
      duration: Math.max(10, Math.min(30, Number(s.duration) || 15)),
    }));

    const totalDuration = scenes.reduce((sum: number, s: any) => sum + s.duration, 0);
    if (totalDuration < 40 || totalDuration > 120) {
      const factor = Math.min(90 / totalDuration, 1.5);
      for (const s of scenes) {
        s.duration = Math.max(10, Math.min(30, Math.round(s.duration * factor)));
      }
    }

    return NextResponse.json({
      title: String(result.title || `Video tentang ${topic}`),
      topic: topic.trim(),
      scenes,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
