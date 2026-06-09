import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { createProvider, type Highlight } from "@convex/ai";

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

async function tryYoutubeTranscript(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
} | null> {
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    if (items && items.length > 0) {
      const segments = items.map((s) => ({
        start: s.offset,
        end: s.offset + s.duration,
        text: s.text,
      }));
      const rawText = segments.map((s) => s.text).join(" ");
      return { segments, rawText };
    }
  } catch {
    // fall through
  }

  // Try with lang param
  for (const lang of ["en", "id", "ja", "ko", "zh-Hans", "es", "fr"]) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      if (items && items.length > 0) {
        const segments = items.map((s) => ({
          start: s.offset,
          end: s.offset + s.duration,
          text: s.text,
        }));
        const rawText = segments.map((s) => s.text).join(" ");
        return { segments, rawText };
      }
    } catch {
      // continue
    }
  }

  return null;
}

async function tryYoutubetranscriptCom(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
} | null> {
  try {
    const res = await fetch(
      `https://youtubetranscript.com/api?vid=${videoId}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.transcript)) {
        const segments = data.transcript.map((s: any) => ({
          start: Number(s.start) || 0,
          end: (Number(s.start) || 0) + (Number(s.duration) || 5),
          text: s.text || "",
        }));
        const rawText = segments.map((s: any) => s.text).join(" ");
        return { segments, rawText };
      }
    }
  } catch {
    // fall through
  }
  return null;
}

async function tryYoutubeScrape(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
} | null> {
  try {
    const res = await fetch(
      `https://youtube.com/watch?v=${videoId}`,
      { signal: AbortSignal.timeout(10000) },
    );
    const html = await res.text();

    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (captionMatch) {
      const tracks = JSON.parse(captionMatch[1]);
      const track = tracks.find((t: any) => t.languageCode === "en")
        || tracks.find((t: any) => t.languageCode === "id")
        || tracks[0];
      if (track?.baseUrl) {
        const captionRes = await fetch(track.baseUrl);
        const xml = await captionRes.text();

        const segments: TranscriptSegment[] = [];
        const regex = /<text start="([\d.]+)" dur="([\d.]*)">(.*?)<\/text>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
          const start = parseFloat(match[1]);
          const dur = parseFloat(match[2]) || 3;
          const text = match[3].replace(/<[^>]+>/g, "").trim();
          if (text) {
            segments.push({ start, end: start + dur, text });
          }
        }
        if (segments.length > 0) {
          const rawText = segments.map((s) => s.text).join(" ");
          return { segments, rawText };
        }
      }
    }
  } catch {
    // fall through
  }
  return null;
}

async function fetchTranscript(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
}> {
  // Try multiple approaches in order
  const methods = [
    tryYoutubeTranscript,
    tryYoutubetranscriptCom,
    tryYoutubeScrape,
  ];

  for (const method of methods) {
    const result = await method(videoId);
    if (result) return result;
  }

  throw new Error(
    "Could not fetch transcript. Make sure the video has captions available.",
  );
}

export async function POST(request: NextRequest) {
  try {
    const { url, provider, model } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const match = url.match(YOUTUBE_REGEX);
    if (!match) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const videoId = match[1];

    // Get video info
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // Try to get video title (fallback if oembed fails)
    let title = "YouTube Video";
    try {
      const infoRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) },
      );
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        title = infoData.title || title;
      }
    } catch {
      // fallback title
    }

    // Fetch transcript
    const { segments, rawText } = await fetchTranscript(videoId);
    const duration = segments.length > 0
      ? Math.max(...segments.map((s) => s.end))
      : 600;

    // Run AI analysis (with fallback)
    let highlights: Highlight[];
    try {
      const aiProvider = createProvider(provider, model);
      highlights = await aiProvider.analyzeTranscript({
        title, duration, segments, rawText,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("429") || msg.includes("rate limit")) {
        console.warn("Groq rate limited, falling back to Gemini 2.0 Flash");
        const fallback = createProvider("gemini", "gemini-2.0-flash");
        highlights = await fallback.analyzeTranscript({
          title, duration, segments, rawText,
        });
      } else {
        throw err;
      }
    }

    return NextResponse.json({
      videoId,
      title,
      duration,
      thumbnailUrl,
      youtubeUrl: url,
      transcript: { segments, rawText },
      highlights,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
