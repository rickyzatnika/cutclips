import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { v2 as cloudinary } from "cloudinary";

function srtTimeStr(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3).replace(".", ",");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(7, "0")}`;
}

function generateSrtForClip(
  captions: { start: number; end: number; text: string }[],
  clipStart: number,
  clipEnd: number,
): string {
  let srt = "";
  let idx = 1;
  for (const cap of captions) {
    const relStart = Math.max(0, cap.start - clipStart);
    const relEnd = Math.min(clipEnd, cap.end) - clipStart;
    if (relEnd <= relStart || relEnd < 0) continue;
    srt += `${idx}\n`;
    srt += `${srtTimeStr(relStart)} --> ${srtTimeStr(relEnd)}\n`;
    const cleanText = cap.text.replace(/\r?\n/g, " ").replace(/[<>&]/g, "");
    srt += `${cleanText}\n\n`;
    idx++;
  }
  return srt;
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

import { getFfmpegPath, getYtDlpPath } from "@/lib/video-processing";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const YT_DLP = getYtDlpPath() || "yt-dlp";

function convexFetch(path: string, args: Record<string, unknown>, accessToken?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, args }),
  });
}

function execYtDlp(args: string[], timeout = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(YT_DLP, args, { timeout }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function srtTimeToSeconds(t: string): number {
  const parts = t.replace(",", ".").split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
}

function parseSRT(raw: string): { start: number; end: number; text: string }[] {
  const segments: { start: number; end: number; text: string }[] = [];
  const blocks = raw.trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/,
    );
    if (!timeMatch) continue;
    const text = lines.slice(2).join(" ").replace(/<\/?[^>]+(>|$)/g, "").trim();
    if (!text) continue;
    segments.push({
      start: srtTimeToSeconds(timeMatch[1]),
      end: srtTimeToSeconds(timeMatch[2]),
      text,
    });
  }
  return segments;
}

async function tryDownloadSubs(url: string, tempDir: string): Promise<{
  raw: string;
  segments: { start: number; end: number; text: string }[];
}> {
  const langAttempts = ["id", "en", "a*"];
  for (const lang of langAttempts) {
    try {
      await execYtDlp([
        "--skip-download",
        "--write-auto-subs",
        "--sub-lang", lang,
        "--sub-format", "srt/vtt/ttml",
        "--convert-subs", "srt",
        "-o", path.join(tempDir, "sub_%(lang)s"),
        "--no-playlist",
        "--no-warnings",
        "--quiet",
        url,
      ]);
      const subFile = fs.readdirSync(tempDir).find((f) => f.endsWith(".srt") || f.endsWith(".vtt"));
      if (subFile) {
        const raw = fs.readFileSync(path.join(tempDir, subFile), "utf-8");
        const clean = raw
          .replace(/\d+\n\d{2}:\d{2}:\d{2}[.,]\d{3} --> .+\n?/g, "")
          .replace(/<\/?[^>]+(>|$)/g, "")
          .replace(/\n{2,}/g, "\n")
          .trim();
        const segments = parseSRT(raw);
        if (segments.length > 3) return { raw: clean.slice(0, 15000), segments };
        if (clean.length > 50) return { raw: clean.slice(0, 15000), segments: [] };
      }
    } catch {
      continue;
    }
  }
  return { raw: "", segments: [] };
}

async function getVideoContext(url: string, tempDir: string) {
  const stdout = await execYtDlp(["--dump-json", "--no-playlist", "--no-warnings", "--quiet", url]);
  const info = JSON.parse(stdout);
  const subs = await tryDownloadSubs(url, tempDir);
  return {
    title: info.title || "Unknown",
    duration: info.duration || 600,
    description: (info.description || "").slice(0, 3000),
    chapters: info.chapters || [],
    transcript: subs.raw,
    subtitleSegments: subs.segments,
  };
}

function generateSegmentFallback(duration: number): {
  clips: { start: number; end: number; description: string }[];
} {
  if (duration <= 60) {
    return { clips: [{ start: 0, end: duration, description: "Bagian awal video" }] };
  }
  const quarter = Math.floor(duration / 4);
  const mid = Math.floor(duration / 2);
  return {
    clips: [
      { start: Math.max(0, quarter - 10), end: Math.min(quarter + 20, duration), description: "Bagian seperempat pertama video" },
      { start: Math.max(0, mid + quarter - 10), end: Math.min(mid + quarter + 20, duration), description: "Bagian akhir video" },
    ],
  };
}

function filterSegmentsForClips(
  segments: { start: number; end: number; text: string }[],
  clips: { start: number; end: number }[],
): { start: number; end: number; text: string; style: string }[] {
  const result: { start: number; end: number; text: string; style: string }[] = [];
  for (const clip of clips) {
    for (const seg of segments) {
      if (seg.start >= clip.start && seg.end <= clip.end) {
        result.push({ ...seg, style: "fade-in" });
      } else if (seg.start < clip.end && seg.end > clip.start) {
        result.push({
          start: Math.max(seg.start, clip.start),
          end: Math.min(seg.end, clip.end),
          text: seg.text,
          style: "fade-in",
        });
      }
    }
  }
  return result.slice(0, 30);
}

async function analyzeVideo(context: {
  title: string;
  duration: number;
  description: string;
  chapters: { title: string; start_time: number; end_time: number }[];
  transcript: string;
  subtitleSegments: { start: number; end: number; text: string }[];
  model?: string;
  provider?: string;
}) {
  if (context.provider === "gemini") {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not set. Daftar di https://aistudio.google.com/apikey");
    }
  } else if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not set. Daftar di https://console.groq.com");
  }

  const durationMinutes = Math.floor(context.duration / 60);
  const durationSeconds = context.duration % 60;
  const hasTranscript = context.transcript.length > 50;
  const hasChapters = context.chapters.length > 0;

  let contentSection = `Judul: "${context.title}"\nDurasi: ${durationMinutes}m${durationSeconds}s (${Math.floor(context.duration)} detik)`;

  if (context.description) {
    contentSection += `\n\nDeskripsi:\n${context.description}`;
  }
  if (hasChapters) {
    contentSection += `\n\nBab:\n${context.chapters.map((ch, i) =>
      `  ${i + 1}. ${ch.start_time}s - ${ch.end_time}s: ${ch.title}`
    ).join("\n")}`;
  }
  if (hasTranscript) {
    contentSection += `\n\nTranskrip (auto-generated):\n${context.transcript}`;
  } else {
    contentSection += `\n\n(Catatan: Transkrip tidak tersedia. Bagi video berdasarkan durasi saja.)`;
  }

  if (!hasTranscript && !hasChapters) {
    const fallback = generateSegmentFallback(context.duration);
    return {
      clips: fallback.clips.map((c) => ({ ...c, end: Math.min(c.end, context.duration) })),
      captions: [{ start: 0, end: 10, text: `${context.title}`, style: "fade-in" as const }],
      voiceOver: `Sorotan dari ${context.title}`,
    };
  }

  const groqPayload = {
    model: context.model || "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content:
          "Anda adalah editor video AI. Analisis konten video dan pilih 2 segmen pendek (15-45 detik) yang PALING BERBEDA dan menarik. Prioritaskan potongan UTUH jangan sampai klimaks terpotong. Kembalikan JSON valid saja.",
      },
      {
        role: "user",
        content: `Analisis video YouTube ini dan pilih 2 momen PALING penting/berharga untuk dijadikan short clip viral.

Info video:
${contentSection}

ATURAN:
${hasTranscript
  ? `- Gunakan transkrip untuk menemukan momen-momen TERPENTING dalam video
- Cari: klimaks, fakta mengejutkan, poin kunci, kesimpulan penting, momen lucu/komedi, momen emosional, atau bagian paling informatif
- JANGAN ambil bagian pembukaan/intro/ basa-basi — langsung ke inti`
  : `- Video ${Math.floor(context.duration / 60)} menit, bagi secara temporal
- Clip 1 dari 25%-40% durasi video
- Clip 2 dari 65%-85% durasi video`
}
- 2 clip harus dari BAGIAN VIDEO YANG BERBEDA
- Clip 1 dari bagian PERTAMA, Clip 2 dari bagian KEDUA/TERAKHIR
- Durasi 15-45 detik, SESUAIKAN dengan momen biar klimaks UTUH (jangan dipotong tengah kalimat)
- JANGAN tumpang tindih antar clip
- JANGAN default ke 0-30 atau 30-60
- Deskripsi clip dalam Bahasa Indonesia
${hasTranscript ? "- Buat caption segment yg sesuai dgn apa yg DIUCAPKAN" : ""}

Kembalikan JSON:
{
  "clips": [
    { "start": <detik>, "end": <detik>, "description": "Penjelasan momen ini (BI)" },
    { "start": <detik>, "end": <detik>, "description": "Penjelasan momen ini (BI)" }
  ],
  "captionSegments": [
    { "start": <detik>, "end": <detik>, "text": "Caption BI", "style": "fade-in" },
    { "start": <detik>, "end": <detik>, "text": "Caption BI", "style": "slide-up" }
  ],
  "voiceOver": "Narasi BI singkat menjelaskan video"
}

CAPTION SEGMENTS:
- start/end di timeline video asli
- 5-10 segmen per clip
${hasTranscript ? "- Timeline caption harus cocok dgn ucapan di transkrip" : "- Caption generik relevan dgn judul"}`,
      },
    ],
  };

  const jsonModels = ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "llama-3.3-70b-versatile"];
  const supportsJson = jsonModels.includes(context.model || "");
  if (supportsJson) {
    (groqPayload as any).response_format = { type: "json_object" };
  }

  let result: Record<string, unknown> = {};
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise((r) => setTimeout(r, delay));
    }

    if (context.provider === "gemini") {
      const geminiModel = context.model || "gemini-2.0-flash";
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: groqPayload.messages[0].content }] },
            contents: [{ role: "user", parts: [{ text: groqPayload.messages[1].content }] }],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.7,
              maxOutputTokens: 8192,
            },
          }),
        },
      );

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          result = JSON.parse(text);
          lastError = "";
          break;
        }
        lastError = "Gemini: no content in response";
      } else {
        const body = await geminiRes.text();
        lastError = `Gemini API error ${geminiRes.status}: ${body.slice(0, 150)}`;
      }
    } else {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(groqPayload),
      });

      if (res.ok) {
        const data = await res.json();
        result = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        lastError = "";
        break;
      }

      const body = await res.text();
      lastError = `Groq API error ${res.status}: ${body.slice(0, 150)}`;
    }

    console.error(`Attempt ${attempt + 1} failed:`, lastError);
  }

  if (lastError) {
    throw new Error(lastError);
  }

  let clips = ((result.clips as unknown as Record<string, unknown>[]) || []).slice(0, 2).map(
    (c: Record<string, unknown>) => {
      const start = Math.max(0, Number(c.start) || 0);
      const end = Math.min(context.duration, Number(c.end) || Math.min(start + 25, context.duration));
      return {
        start,
        end: end > start ? end : Math.min(start + 25, context.duration),
        description: String(c.description || ""),
      };
    },
  );

  if (clips.length === 0) {
    const fb = generateSegmentFallback(context.duration);
    clips = fb.clips;
  }

  let finalCaptions: { start: number; end: number; text: string; style: string }[];

  if (context.subtitleSegments.length > 0) {
    finalCaptions = filterSegmentsForClips(context.subtitleSegments, clips);
  } else {
    const rawSegments = Array.isArray(result.captionSegments) ? result.captionSegments as Record<string, unknown>[] : [];
    finalCaptions = rawSegments
      .filter((s: unknown) => s && typeof s === "object")
      .slice(0, 30)
      .map((s: Record<string, unknown>) => ({
        start: Math.max(0, Number(s.start) || 0),
        end: Math.max(0, Number(s.end) || Number(s.start) + 3 || 0),
        text: String(s.text || ""),
        style: ["fade-in", "slide-up", "bounce"].includes(String(s.style)) ? String(s.style) : "fade-in",
      }))
      .filter((s: { text: string }) => s.text.trim().length > 0);
  }

  if (finalCaptions.length === 0) {
    finalCaptions = [{ start: 0, end: 10, text: `${context.title}`, style: "fade-in" }];
  }

  return {
    clips,
    captions: finalCaptions,
    voiceOver: String(result.voiceOver || `Sorotan dari ${context.title}`),
  };
}

function execYtDlpAsync(
  args: string[], timeout: number, onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("yt-dlp timeout")), timeout);
    const proc = execFile(YT_DLP, [...args, "--no-playlist", "--no-warnings"], (err) => {
      clearTimeout(t);
      if (err) return reject(err);
      resolve();
    });
    if (proc.stdout) {
      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        const m = text.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (m && onProgress) {
          onProgress(parseFloat(m[1]));
        }
      };
      proc.stdout.on("data", onData);
      proc.on("close", () => proc.stdout?.removeListener("data", onData));
    }
  });
}

async function downloadYouTube(
  outputDir: string, filename: string, url: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  const outputPath = path.join(outputDir, filename);
  await execYtDlpAsync(
    ["-f", "best[height<=720]", "-o", outputPath, "--merge-output-format", "mp4", url],
    600000,
    onProgress,
  );

  const actual = fs.existsSync(outputPath)
    ? outputPath
    : fs.readdirSync(outputDir)
        .map((f) => path.join(outputDir, f))
        .find((f) => f.endsWith(".mp4"));

  if (!actual) throw new Error(`Downloaded file not found in ${outputDir}`);
  if (actual !== outputPath) fs.renameSync(actual, outputPath);
  return outputPath;
}

async function cutClip(
  ffmpegPath: string, workDir: string, videoName: string, outputName: string,
  start: number, duration: number,
  captions?: { start: number; end: number; text: string }[],
): Promise<void> {
  let vf = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920";

  if (captions && captions.length > 0) {
    const clipEnd = start + duration;
    const srtContent = generateSrtForClip(captions, start, clipEnd);
    if (srtContent.trim()) {
      fs.writeFileSync(path.join(workDir, "captions.srt"), srtContent, "utf-8");
      const style = "FontName=Arial\\,FontSize=18\\,PrimaryColour=&H00FFFFFF\\,OutlineColour=&H0000FF00\\,Outline=2\\,BorderStyle=1";
      vf += `,subtitles=captions.srt:force_style=${style}`;
    }
  }

  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`FFmpeg timeout at ${start}s`)), 120000);
    execFile(ffmpegPath, [
      "-ss", String(start),
      "-i", videoName,
      "-t", String(duration),
      "-map", "0:v", "-map", "0:a?",
      "-c:v", "libx264", "-c:a", "aac",
      "-preset", "ultrafast",
      "-vf", vf,
      "-avoid_negative_ts", "make_zero",
      "-y",
      outputName,
    ], { cwd: workDir }, (err) => {
      clearTimeout(t);
      if (err) return reject(err);
      resolve();
    });
  });
}

const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "llama-3.3-70b-versatile"];
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

function sseEvent(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    return NextResponse.json({
      error: process.env.VERCEL
        ? "Video processing not available on Vercel. Run a dedicated worker."
        : "FFmpeg binary not found. Run: npx convex deploy"
    }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { projectId, accessToken, model, provider } = body;

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Missing accessToken" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try { controller.enqueue(sseEvent(data)); } catch { /* controller closed */ }
      };

      try {
        const claimRes = await convexFetch("processingJobs:claimJob", { projectId }, accessToken);
        const claimData = await claimRes.json();

        // Convex REST API returns { "value": <return_value> } on success
        const claimValue = claimData?.value;
        const jobId = claimValue?.jobId ?? null;

        if (!jobId) {
          send({ progress: -1, step: "Gagal", error: "Job tidak ditemukan atau sudah diproses" });
          controller.close();
          return;
        }

        const jobInfo = claimValue as {
          jobId: string;
          projectId: string;
          youtubeUrl: string;
          title: string;
          provider?: string;
          model?: string;
        };

        const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "yt-dl-"));

        try {
          send({ progress: 5, step: "Mendapatkan info video..." });
          const context = await getVideoContext(jobInfo.youtubeUrl, tempDir);
          send({ progress: 15, step: "Menganalisis konten dengan AI..." });

          const selectedProvider = provider || jobInfo.provider || "groq";
          const selectedModel = model || jobInfo.model || "llama-3.1-8b-instant";
          const analysis = await analyzeVideo({ ...context, title: jobInfo.title, model: selectedModel, provider: selectedProvider });

          send({ progress: 30, step: "Mengunduh video dari YouTube..." });

          await downloadYouTube(
            tempDir, "video.mp4", jobInfo.youtubeUrl,
            (dlPct) => {
              const scaled = 30 + Math.round(dlPct * 0.10);
              send({ progress: scaled, step: `Mengunduh video ${Math.round(dlPct)}%...` });
              convexFetch("processingJobs:updateJobProgress", { jobId, progress: scaled }, accessToken);
            },
          );

          const videoUrls: string[] = [];
          for (let i = 0; i < analysis.clips.length; i++) {
            const c = analysis.clips[i];
            const dur = Math.max(5, c.end - c.start);
            const clipName = `clip-${i}.mp4`;

            const progressBase = 40;
            const stepSize = 25;
            const clipProgress = progressBase + Math.round((stepSize / analysis.clips.length) * (i + 1));
            send({ progress: clipProgress, step: `Memotong clip ${i + 1} dari ${analysis.clips.length}...` });

            const clipCaptions = analysis.captions.filter(
              (cap: { start: number; end: number }) => cap.start < c.end && cap.end > c.start
            );
            await cutClip(ffmpegPath, tempDir, "video.mp4", clipName, c.start, dur, clipCaptions);

            send({ progress: clipProgress + 5, step: `Mengupload clip ${i + 1} ke cloud...` });
            const result = await cloudinary.uploader.upload(path.join(tempDir, clipName), {
              resource_type: "video",
              folder: `shortsai/${projectId}`,
              public_id: `clip-${i}`,
            });
            videoUrls.push(result.secure_url);
          }

          const finalResult = {
            success: true,
            clips: analysis.clips,
            captions: analysis.captions,
            voiceOver: analysis.voiceOver,
            videoUrls,
          };

          await convexFetch("processingJobs:completeJob", {
            jobId,
            clips: analysis.clips,
            captions: analysis.captions,
            voiceOver: analysis.voiceOver,
            videoUrls,
          }, accessToken);

          send({ progress: 100, step: "Selesai!", result: finalResult });
          controller.close();
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Internal server error";
          console.error("Queue worker processing error:", error);
          await convexFetch("processingJobs:failJob", { jobId, error: msg }, accessToken);
          send({ progress: -1, step: `Gagal: ${msg}`, error: msg });
          controller.close();
        } finally {
          await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Queue worker error";
        console.error("Queue worker error:", error);
        send({ progress: -1, step: `Gagal: ${msg}`, error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
