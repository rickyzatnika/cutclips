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

async function parseTranscriptXml(xml: string, _lang: string): Promise<TranscriptSegment[]> {
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
  _videoId: string,
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

// --- Method 3: Google-hosted InnerTube API (uses API key, works from Vercel) ---
async function tryGoogleInnerTube(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
} | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const clients = [
      { clientName: "ANDROID", clientVersion: "19.09.37" },
      { clientName: "WEB", clientVersion: "2.20240101" },
      { clientName: "ANDROID_MUSIC", clientVersion: "5.22.1" },
    ];

    for (const client of clients) {
      try {
        const res = await fetch(
          `https://youtubei.googleapis.com/youtubei/v1/player?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": WEB_USER_AGENT,
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: client.clientName,
                  clientVersion: client.clientVersion,
                  hl: "en",
                  gl: "US",
                },
              },
              videoId,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!res.ok) continue;
        const data = await res.json();
        const tracks =
          data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) {
          const result = await fetchTranscriptFromTracks(tracks, videoId);
          if (result) return result;
        }
      } catch { /* fall through */ }
    }
  } catch { /* fall through */ }
  return null;
}

// --- Method 4: YouTube public timedtext API (no auth needed) ---
async function tryTimedtext(videoId: string): Promise<{
  segments: TranscriptSegment[];
  rawText: string;
} | null> {
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=id&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": WEB_USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.length < 50) continue;

      try {
        const data = JSON.parse(text);
        const events = data?.events;
        if (Array.isArray(events) && events.length > 0) {
          const segments: TranscriptSegment[] = [];
          for (const e of events) {
            const start = (e.tStartMs || 0) / 1000;
            const dur = (e.dDurationMs || 5000) / 1000;
            const texts = e.segs?.map((s: any) => s.utf8 || "").join(" ") || "";
            if (texts.trim()) segments.push({ start, end: start + dur, text: texts.trim() });
          }
          if (segments.length > 0) {
            return { segments, rawText: segments.map((s) => s.text).join(" ") };
          }
        }
      } catch { /* not json */ }
    } catch {
      // fall through
    }
  }
  return null;
}

// --- Method 5: YouTube HTML scrape (fallback) ---
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
    { name: "google-innertube", fn: tryGoogleInnerTube },
    { name: "library", fn: tryLibrary },
    { name: "innertube-web", fn: tryInnerTubeWeb },
    { name: "timedtext", fn: tryTimedtext },
    { name: "scrape", fn: tryYoutubeScrape },
  ];

  for (const { name, fn } of methods) {
    console.log(`[analyze] trying method: ${name}`);
    try {
      const result = await fn(videoId);
      if (result) {
        console.log(`[analyze] method ${name} succeeded`);
        return result;
      }
      console.log(`[analyze] method ${name} returned null`);
    } catch (e) {
      console.log(`[analyze] method ${name} threw:`, e instanceof Error ? e.message : String(e));
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
