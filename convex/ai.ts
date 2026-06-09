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
  return `You are an AI highlight moment detector.
Your job is to analyze video transcripts and find the most engaging moments.
Each moment must feel complete — don't cut mid-sentence or mid-laugh.

For each moment, provide:
- startTime and endTime in seconds (align with transcript timestamps)
- A short, clickable title
- Category: funny, emotional, inspirational, shocking, educational, or hook
- confidenceScore (0-100): how sure you are this is a genuine highlight
- viralityScore (0-100): how likely this moment is to perform well as a Short/Reel/TikTok
- reasoning: 1 sentence explaining WHY this moment works

Rules:
- Return 5-12 moments
- Each moment should be 20-60 seconds long
- Align start/end with natural breaks in the transcript (end of sentence, pause, topic shift)
- Do NOT overlap moments
- Avoid the first 15 seconds (intro/warm-up)
- Sort by viralityScore descending
- Return ONLY a JSON array of objects, no markdown. Example: [{"startTime":15,"endTime":45,"title":"Funny reaction","category":"funny","confidenceScore":85,"viralityScore":90,"reasoning":"..."}]`;
}

function buildUserPrompt(context: TranscriptContext): string {
  return `Analyze this video transcript and find the best highlight moments.

Title: "${context.title}"
Duration: ${Math.floor(context.duration / 60)}m ${Math.floor(context.duration % 60)}s

Transcript:
${context.rawText.slice(0, 10000)}

Return a JSON array of highlights:
[
  {
    "startTime": <number>,
    "endTime": <number>,
    "title": "<short catchy title>",
    "category": "<category>",
    "confidenceScore": <0-100>,
    "viralityScore": <0-100>,
    "reasoning": "<why this works>"
  }
]`;
}

class GroqProvider implements AIProvider {
  private model: string;

  constructor(model = "llama-3.1-8b-instant") {
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
            max_tokens: 4096,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (res.status === 429) {
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

        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error(`Groq returned invalid JSON in content: "${content.slice(0, 200)}"`);
        }

        const raw = parsed.highlights || parsed;
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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
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
  return new GroqProvider(model || "llama-3.1-8b-instant");
}
