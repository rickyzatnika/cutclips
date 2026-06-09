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

const WEB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function parseTranscriptXml(xml: string, lang: string): Promise<TranscriptSegment[]> {
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
  return segments;
}

async function fetchTranscriptFromTracks(
  tracks: { languageCode: string; baseUrl: string }[],
  videoId: string,
): Promise<{ segments: TranscriptSegment[]; rawText: string } | null> {
  const track =
    tracks.find((t) => t.languageCode === "en") ||
    tracks.find((t) => t.languageCode === "id") ||
    tracks[0];
  if (!track?.baseUrl) return null;

  try {
    const captionRes = await fetch(track.baseUrl, {
      headers: { "User-Agent": WEB_USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    if (!captionRes.ok) return null;
    const xml = await captionRes.text();
    const segments = await parseTranscriptXml(xml, track.languageCode);
    if (segments.length === 0) return null;
    const rawText = segments.map((s) => s.text).join(" ");
    return { segments, rawText };
  } catch {
    return null;
  }
}

// --- Method 1: youtube-transcript library (ANDROID InnerTube + web scrape) ---
async function tryLibrary(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
} | null> {
  const langs = [undefined, "en", "id", "ja", "ko", "zh-Hans", "es", "fr"];
  for (const lang of langs) {
    try {
      const config = lang ? { lang } : undefined;
      const items = await YoutubeTranscript.fetchTranscript(videoId, config as any);
      if (items && items.length > 0) {
        const segments = items.map((s) => ({
          start: s.offset / 1000,
          end: (s.offset + s.duration) / 1000,
          text: s.text,
        }));
        const rawText = segments.map((s) => s.text).join(" ");
        return { segments, rawText };
      }
    } catch {
      // fall through
    }
  }
  return null;
}

// --- Method 2: InnerTube API direct with WEB client context + API key ---
async function tryInnerTubeWeb(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
} | null> {
  try {
    const body = {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20240101",
          hl: "en",
          gl: "US",
        },
      },
      videoId,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": WEB_USER_AGENT,
      Origin: "https://www.youtube.com",
      "X-YouTube-Client-Name": "1",
      "X-YouTube-Client-Version": "2.20240101",
    };

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      headers["X-Goog-Api-Key"] = apiKey;
    }

    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!res.ok) return null;
    const data = await res.json();
    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    return fetchTranscriptFromTracks(tracks, videoId);
  } catch {
    return null;
  }
}

// --- Method 3: youtubetranscript.com API ---
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

// --- Method 4: YouTube HTML scrape (fallback) ---
async function tryYoutubeScrape(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
} | null> {
  try {
    const res = await fetch(`https://youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": WEB_USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();

    // Try ytInitialPlayerResponse
    const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (jsonMatch) {
      try {
        const playerResponse = JSON.parse(jsonMatch[1]);
        const tracks =
          playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) {
          return fetchTranscriptFromTracks(tracks, videoId);
        }
      } catch {
        // fall through
      }
    }

    // Try captionTracks regex
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (captionMatch) {
      try {
        const tracks = JSON.parse(captionMatch[1]);
        if (Array.isArray(tracks) && tracks.length > 0) {
          return fetchTranscriptFromTracks(tracks, videoId);
        }
      } catch {
        // fall through
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
  const methods = [
    { name: "library", fn: tryLibrary },
    { name: "innertube-web", fn: tryInnerTubeWeb },
    { name: "youtubetranscript.com", fn: tryYoutubetranscriptCom },
    { name: "scrape", fn: tryYoutubeScrape },
  ];

  for (const { name, fn } of methods) {
    const result = await fn(videoId);
    if (result) {
      console.log(`fetchTranscript: ${name} succeeded for ${videoId}`);
      return result;
    }
  }

  throw new Error(
    "Could not fetch transcript. Make sure the video has captions available.",
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const step = (label: string) => console.log(`[analyze] ${label} (${Date.now() - startTime}ms)`);

  try {
    const { url, provider, model } = await request.json();
    step("body parsed");

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const match = url.match(YOUTUBE_REGEX);
    if (!match) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const videoId = match[1];

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

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
    } catch { /* fallback */ }
    step("title fetched");

    const { segments, rawText } = await fetchTranscript(videoId);
    step(`transcript fetched (${segments.length} segments)`);
    const duration = segments.length > 0
      ? Math.max(...segments.map((s) => s.end))
      : 600;

    let highlights: Highlight[];
    try {
      step("AI analysis starting...");
      const aiProvider = createProvider(provider, model);
      highlights = await aiProvider.analyzeTranscript({
        title, duration, segments, rawText,
      });
      step(`AI analysis done (${highlights.length} highlights)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const full = err instanceof Error ? err.stack || err.message : String(err);
      console.error("[analyze] AI analysis failed:", full);
      throw new Error(`AI analysis failed: ${msg}`);
    }

    step(`response sent`);
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
    console.error(`[analyze] FAILED at ${Date.now() - startTime}ms:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
