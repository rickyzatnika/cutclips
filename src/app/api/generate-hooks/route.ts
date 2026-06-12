import { NextRequest } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY || "";
const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";

async function convexQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error);
  return data.value;
}

export async function POST(req: NextRequest) {
  try {
    const { title, reasoning, category, email } = await req.json();

    if (!title) {
      return Response.json({ error: "Missing title" }, { status: 400 });
    }

    if (!email) {
      return Response.json({ error: "Email required" }, { status: 400 });
    }

    const user = await convexQuery("users:getByEmail", { email });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });
    const totalReceived = (user.credits ?? 0) + (user.totalCreditsUsed ?? 0);
    if (totalReceived <= 100) {
      return Response.json({
        error: "Fitur Generate Hook AI hanya untuk pengguna Starter & Kreator. Silakan isi credit terlebih dahulu.",
      }, { status: 403 });
    }

    const prompt = `Buatkan 3 hook kalimat pembuka viral untuk video Shorts/Reels/TikTok berdasarkan highlight berikut.

Judul: "${title}"
Kategori: ${category || "general"}
Alasan: ${reasoning || ""}

Aturan:
- Bahasa Indonesia
- Masing-masing hook 1 kalimat, maksimal 15 kata
- Bersifat hook yang bikin penasaran (curiosity gap)
- Hook harus natural, bukan clickbait berlebihan
- Jangan pake tanda tanya di akhir kalimat

Kembalikan dalam format JSON array of strings, contoh:
["Hook pertama...", "Hook kedua...", "Hook ketiga..."]`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Kamu adalah ahli copywriting viral untuk Shorts. Output ONLY JSON array." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Groq error: ${text.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return Response.json({ error: "Empty response from AI" }, { status: 502 });
    }

    let parsed: { hooks?: string[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return Response.json({ error: "Invalid JSON from AI" }, { status: 502 });
    }

    const hooks = parsed.hooks || parsed;
    const hooksArray = Array.isArray(hooks) ? hooks.slice(0, 3) : [];

    return Response.json({ hooks: hooksArray });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Failed to generate hooks",
    }, { status: 500 });
  }
}
