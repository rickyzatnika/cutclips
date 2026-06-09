export type HighlightCategory =
  | "funny"
  | "emotional"
  | "inspirational"
  | "shocking"
  | "educational"
  | "hook";

export interface Highlight {
  startTime: number;
  endTime: number;
  title: string;
  category: HighlightCategory;
  confidenceScore: number;
  viralityScore: number;
  reasoning: string;
}

export interface TranscriptContext {
  title: string;
  duration: number;
  segments: { start: number; end: number; text: string }[];
  rawText: string;
}

export interface AIProvider {
  analyzeTranscript(context: TranscriptContext): Promise<Highlight[]>;
}

const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

function getApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`] as string | undefined;
    if (key) keys.push(key);
  }
  if (keys.length === 0) {
    const fallback = process.env.GROQ_API_KEY as string | undefined;
    if (fallback) keys.push(fallback);
  }
  if (keys.length === 0) throw new Error("No GROQ_API_KEY set");
  return keys;
}

function buildSystemPrompt(): string {
  return `Kamu adalah pendeteksi momen highlight AI.
Tugasmu menganalisis transkrip video dan menemukan momen paling menarik.
Setiap momen harus terasa lengkap — jangan memotong di tengah kalimat atau tawa.

Untuk setiap momen, berikan:
- startTime dan endTime dalam detik (sesuaikan dengan timestamp transkrip)
- Judul pendek yang menarik dalam Bahasa Indonesia
- Kategori: funny, emotional, horror, seram, inspirational, shocking, educational, atau hook
- confidenceScore (0-100): seberapa yakin kamu ini adalah highlight asli
- viralityScore (0-100): seberapa besar kemungkinan momen ini viral sebagai Short/Reel/TikTok
- reasoning: 1 kalimat dalam Bahasa Indonesia menjelaskan KENAPA momen ini bagus

Aturan:
- Kembalikan 5-12 momen
- Setiap momen harus 20-60 detik
- Sesuaikan start/end dengan jeda alami di transkrip (akhir kalimat, jeda, perpindahan topik)
- JANGAN tumpang tindih momen
- Hindari 15 detik pertama (intro/pemanasan)
- Urutkan berdasarkan viralityScore descending
- SEMUA teks output harus dalam Bahasa Indonesia
- Kembalikan ONLY JSON array of objects, tanpa markdown. Contoh: [{"startTime":15,"endTime":45,"title":"Reaksi lucu","category":"funny","confidenceScore":85,"viralityScore":90,"reasoning":"Penjelasan dalam bahasa Indonesia..."}]`;
}

function buildUserPrompt(context: TranscriptContext): string {
  return `Analisis transkrip video ini dan temukan momen highlight terbaik.

Judul: "${context.title}"
Durasi: ${Math.floor(context.duration / 60)}m ${Math.floor(context.duration % 60)}s

Transkrip:
${context.rawText.slice(0, 5000)}

Kembalikan JSON array of highlights. SEMUA teks harus Bahasa Indonesia:
[
  {
    "startTime": <number>,
    "endTime": <number>,
    "title": "<judul catchy bahasa Indonesia>",
    "category": "<category>",
    "confidenceScore": <0-100>,
    "viralityScore": <0-100>,
    "reasoning": "<penjelasan bahasa Indonesia>"
  }
]`;
}

async function callGroq(apiKey: string, model: string, context: TranscriptContext): Promise<Highlight[]> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(context) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 429 || res.status === 413) {
    throw new RateLimitError(`Rate limited on ${model}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 200)}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    const raw = await res.text();
    throw new Error(`Groq returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");

  console.log(`Groq ${model} response:`, content.slice(0, 300));

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Groq returned invalid JSON: "${content.slice(0, 200)}"`);
  }

  const raw = parsed.highlights || parsed.highlight || parsed;
  const highlights = Array.isArray(raw) ? raw : [raw];

  return highlights
    .filter((h: any) => h.startTime != null && h.endTime != null)
    .slice(0, 12)
    .map((h: any) => {
      const { start, end } = clampDuration(
        Math.max(0, h.startTime),
        Math.min(context.duration, h.endTime),
      );
      return {
        startTime: start,
        endTime: end,
        title: String(h.title || "Untitled"),
        category: validateCategory(h.category),
        confidenceScore: clampScore(h.confidenceScore),
        viralityScore: clampScore(h.viralityScore),
        reasoning: String(h.reasoning || ""),
      };
    });
}

class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RateLimitError";
  }
}

class GroqProvider implements AIProvider {
  async analyzeTranscript(context: TranscriptContext): Promise<Highlight[]> {
    const keys = getApiKeys();

    for (const key of keys) {
      for (const model of MODELS) {
        try {
          console.log(`Groq trying key=${key.slice(0, 8)}... model=${model}`);
          return await callGroq(key, model, context);
        } catch (err) {
          const isRateLimit = err instanceof RateLimitError;
          console.error(`Groq key=${key.slice(0, 8)}... model=${model} ${isRateLimit ? "RATE_LIMITED" : "FAILED"}:`, (err as Error).message);
          if (!isRateLimit) {
            throw err;
          }
        }
      }
    }

    throw new Error("All Groq API keys and models exhausted due to rate limiting");
  }
}

function validateCategory(cat: string): HighlightCategory {
  const valid: HighlightCategory[] = [
    "funny", "emotional", "inspirational",
    "shocking", "educational", "hook",
  ];
  return valid.includes(cat as HighlightCategory) ? (cat as HighlightCategory) : "hook";
}

const MAX_DURATION = 120;
const MIN_DURATION = 8;

function clampDuration(start: number, end: number): { start: number; end: number } {
  let duration = end - start;
  if (duration < MIN_DURATION) {
    const mid = (start + end) / 2;
    start = Math.max(0, mid - MIN_DURATION / 2);
    end = start + MIN_DURATION;
    duration = end - start;
  }
  if (duration > MAX_DURATION) {
    start = Math.max(0, end - MAX_DURATION);
  }
  return { start, end };
}

function clampScore(n: unknown): number {
  const num = Number(n);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function createProvider(provider?: string, model?: string): AIProvider {
  return new GroqProvider();
}
