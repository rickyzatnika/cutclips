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

async function fetchTranscript(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
}> {
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);

    if (!items || items.length === 0) {
      throw new Error("No captions available");
    }

    const segments = items.map((s) => ({
      start: s.offset,
      end: s.offset + s.duration,
      text: s.text,
    }));

    const rawText = segments.map((s) => s.text).join(" ");
    return { segments, rawText };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    throw new Error(
      message || "Could not fetch transcript. Make sure the video has captions available.",
    );
  }
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
