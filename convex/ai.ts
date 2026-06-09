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

const GROQ_API_KEY = process.env.GROQ_API_KEY;

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

class GroqProvider implements AIProvider {
  private model: string;

  constructor(model = "llama-3.3-70b-versatile") {
    this.model = model;
  }

  async analyzeTranscript(context: TranscriptContext): Promise<Highlight[]> {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: this.model,
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
          const wait = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((r) => setTimeout(r, wait));
          continue;
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

        console.log("Groq raw response:", content.slice(0, 500));

        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error(`Groq returned invalid JSON in content: "${content.slice(0, 200)}"`);
        }

        const raw = parsed.highlights || parsed;
        const highlights = Array.isArray(raw) ? raw : [raw];

        console.log(`Groq parsed ${highlights.length} highlights`);

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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`Groq attempt ${attempt}/3 failed:`, lastError.message);
        // Don't retry on client errors (except 429/413 which are handled above)
        if (lastError.message.includes("Groq API error 4") && !lastError.message.includes("429") && !lastError.message.includes("413")) {
          throw lastError;
        }
        if (attempt < 3) {
          const wait = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
    throw lastError || new Error("Groq analysis failed after 3 retries");
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
  return new GroqProvider(model || "llama-3.3-70b-versatile");
}
