require("dotenv").config();

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const cloudinary = require("cloudinary").v2;

// ─── Config ────────────────────────────────────────────────
const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const WORKER_SECRET = process.env.WORKER_API_KEY;
const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL || "5000", 10);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Binary resolution ────────────────────────────────────
function getFfmpegPath() {
  const pkgDir = path.join(__dirname, "node_modules", "@ffmpeg-installer", "ffmpeg");
  const mainPkgDir = path.join(__dirname, "..", "node_modules", "@ffmpeg-installer", "ffmpeg");
  for (const dir of [pkgDir, mainPkgDir]) {
    try {
      return require(path.join(dir, "index.js")).path;
    } catch {}
  }
  return null;
}

function getYtDlpPath() {
  const binName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const dirs = [
    path.join(__dirname, "node_modules", "@distube", "yt-dlp", "bin"),
    path.join(__dirname, "..", "node_modules", "@distube", "yt-dlp", "bin"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const candidate = path.join(dir, binName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const FFMPEG = getFfmpegPath();
const YT_DLP = getYtDlpPath() || "yt-dlp";

// ─── Convex REST helper ────────────────────────────────────
async function convexCall(mutationPath, args, retries = 3) {
  if (!CONVEX_URL) throw new Error("CONVEX_URL not set");
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: mutationPath, args }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Convex ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return data.value;
    } catch (err) {
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(`[Worker] ⚠️ Convex call failed (attempt ${attempt}/${retries}), retrying in ${delay}ms:`, err.message);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────
function srtTimeStr(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3).replace(".", ",");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(7, "0")}`;
}

function execYtDlp(args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    execFile(YT_DLP, args, { timeout }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function execYtDlpAsync(args, timeout, onProgress) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("yt-dlp timeout")), timeout);
    const proc = execFile(YT_DLP, [...args, "--no-playlist", "--no-warnings"], (err) => {
      clearTimeout(t);
      if (err) return reject(err);
      resolve();
    });
    if (proc.stdout) {
      const onData = (chunk) => {
        const text = chunk.toString();
        const m = text.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (m && onProgress) onProgress(parseFloat(m[1]));
      };
      proc.stdout.on("data", onData);
      proc.on("close", () => proc.stdout?.removeListener("data", onData));
    }
  });
}

async function downloadYouTube(outputDir, filename, url, startTime, endTime) {
  const outputPath = path.join(outputDir, filename);
  const duration = Math.max(5, endTime - startTime);

  // Download only the needed segment using --download-sections with ffmpeg location
  await execYtDlpAsync(
    [
      "-f", "best[height<=1080]",
      "--download-sections", `*${startTime}-${endTime}`,
      "--force-keyframes-at-cuts",
      "--ffmpeg-location", path.dirname(FFMPEG),
      "-o", outputPath,
      "--merge-output-format", "mp4",
      url,
    ],
    300000,
  );

  const actual = fs.existsSync(outputPath)
    ? outputPath
    : fs.readdirSync(outputDir)
        .map((f) => path.join(outputDir, f))
        .find((f) => f.endsWith(".mp4"));

  if (!actual) throw new Error(`Downloaded file not found in ${outputDir}`);
  if (actual !== outputPath) fs.renameSync(actual, outputPath);

  const stats = fs.statSync(outputPath);
  if (stats.size < 10000) {
    throw new Error(`Downloaded file too small (${stats.size} bytes) — possible failed download`);
  }
  console.log(`[Worker]   Downloaded ${(stats.size / 1024 / 1024).toFixed(1)}MB (${duration}s segment)`);
  return outputPath;
}

function generateSrtForClip(captions, clipStart, clipEnd) {
  let srt = "";
  let idx = 1;
  for (const cap of captions) {
    const relStart = Math.max(0, cap.start - clipStart);
    const relEnd = Math.min(clipEnd, cap.end) - clipStart;
    if (relEnd <= relStart || relEnd < 0) continue;

    const cleanText = cap.text.replace(/\r?\n/g, " ").replace(/[<>&]/g, "");
    const totalDur = relEnd - relStart;
    const charsPerSec = 12;
    const totalChars = Math.min(cleanText.length, Math.floor(totalDur * charsPerSec));
    const timePerChar = totalDur / Math.max(totalChars, 1);

    for (let i = 0; i < totalChars; i++) {
      const tStart = relStart + i * timePerChar;
      const tEnd = relStart + (i + 1.5) * timePerChar;
      const end = Math.min(tEnd, relEnd);
      if (end - tStart < 0.05) break;
      srt += `${idx}\n`;
      srt += `${srtTimeStr(tStart)} --> ${srtTimeStr(end)}\n`;
      srt += `${cleanText.substring(0, i + 1)}\n\n`;
      idx++;
    }
  }
  return srt;
}

function cutClip(ffmpegPath, workDir, videoName, outputName, start, duration, captions, opts) {
  // Hybrid: fg fills full width (decrease) then zoom 1.35x, crop center 1080 to preserve most content
  // bg: blur at original res (fast), then scale to fill + crop to 1080:1920
  let vf = "[0:v]split[fg][blur_src];" +
    "[blur_src]boxblur=10:3,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];" +
    "[fg]scale=1080:1920:force_original_aspect_ratio=decrease," +
    "scale=trunc(iw*1.35/2)*2:trunc(ih*1.35/2)*2," +
    "crop='gt(iw\\,1080)*1080+lte(iw\\,1080)*trunc(iw/2)*2':'gt(ih\\,1920)*1920+lte(ih\\,1920)*trunc(ih/2)*2',setsar=1[fg];" +
    "[bg][fg]overlay=(W-w)/2:(H-h)/2[out]";

  if (captions && captions.length > 0) {
    const clipEnd = start + duration;
    const srtContent = generateSrtForClip(captions, start, clipEnd);
    if (srtContent.trim()) {
      fs.writeFileSync(path.join(workDir, "captions.srt"), srtContent, "utf-8");
      const fontFamily = (opts && opts.fontFamily) || "Arial";
      const fontSize = (opts && opts.fontSize) || 13;
      const outlineColor = (opts && opts.outlineColor) || "&H0000FF00";
      const style = `FontName=${fontFamily}\\,FontSize=${fontSize}\\,PrimaryColour=&H00FFFFFF\\,OutlineColour=${outlineColor}\\,Outline=2\\,BorderStyle=1`;
      vf = vf.replace("[out]", "[tmp]") + `;[tmp]subtitles=captions.srt:force_style=${style}[out]`;
    }
  }

  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`FFmpeg timeout at ${start}s`)), 300000);
    execFile(ffmpegPath, [
      "-ss", String(start),
      "-i", videoName,
      "-t", String(duration),
      "-filter_complex", vf,
      "-map", "[out]", "-map", "0:a",
      "-c:v", "libx264", "-c:a", "aac",
      "-preset", "ultrafast",
      "-b:v", "3M", "-maxrate", "3M", "-bufsize", "6M",
      "-y",
      outputName,
    ], { cwd: workDir }, (err, stdout, stderr) => {
      clearTimeout(t);
      if (err) {
        const stderrStr = (stderr || "").slice(0, 3000);
        err.message = `FFmpeg: ${err.message}\nStderr: ${stderrStr}`;
        return reject(err);
      }
      resolve();
    });
  });
}

// ─── Clip generation job ───────────────────────────────────

async function reportProgress(exportId, step) {
  try {
    await convexCall("exports:updateProgress", { exportId, workerSecret: WORKER_SECRET, progress: step });
  } catch {}
}

async function processExportJob(job, tempDir) {
  console.log(`[Worker] Processing export: ${job.exportId}`);
  console.log(`[Worker] Video: "${job.videoTitle}" (${job.youtubeUrl})`);
  console.log(`[Worker] Clip: ${job.startTime}s → ${job.endTime}s`);

  const duration = Math.max(5, job.endTime - job.startTime);

  console.log(`[Worker] Downloading video segment (${job.startTime}s → ${job.endTime}s)...`);
  await reportProgress(job.exportId, "downloading");
  await downloadYouTube(tempDir, "video.mp4", job.youtubeUrl, job.startTime, job.endTime);

  console.log(`[Worker] Cutting clip (${duration}s)...`);
  await reportProgress(job.exportId, "cutting");
  const clipName = "clip.mp4";
  await cutClip(FFMPEG, tempDir, "video.mp4", clipName, 0, duration, []);

  console.log(`[Worker] Uploading to Cloudinary...`);
  await reportProgress(job.exportId, "uploading");
  const clipPath = path.join(tempDir, clipName);
  console.log(`[Worker]   Clip path: ${clipPath}`);
  console.log(`[Worker]   File exists: ${fs.existsSync(clipPath)}`);
  if (fs.existsSync(clipPath)) {
    console.log(`[Worker]   File size: ${fs.statSync(clipPath).size} bytes`);
  }
  const result = await cloudinary.uploader.upload(clipPath, {
    resource_type: "video",
    folder: "cutclips",
    public_id: `export-${job.exportId}`,
    timeout: 120000,
  });

  console.log(`[Worker] Completing export...`);
  await reportProgress(job.exportId, "completing");
  await convexCall("exports:complete", {
    exportId: job.exportId,
    downloadUrl: result.secure_url,
  });

  console.log(`[Worker] ✅ Export ${job.exportId} completed!`);
}

// ─── Transcript fetching (for analyze jobs) ──────────────

const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractVideoId(url) {
  const m = String(url).match(YOUTUBE_REGEX);
  return m ? m[1] : null;
}

async function fetchTranscript(videoId) {
  const methods = [
    { name: "innertube-web", fn: tryInnerTubeWeb },
    { name: "library", fn: tryLibrary },
    { name: "timedtext", fn: tryTimedtext },
    { name: "scrape", fn: tryYoutubeScrape },
  ];

  for (const { name, fn } of methods) {
    console.log(`[Worker/analyze] trying transcript method: ${name}`);
    try {
      const result = await fn(videoId);
      if (result) {
        console.log(`[Worker/analyze] transcript method ${name} succeeded (${result.segments.length} segments)`);
        return result;
      }
    } catch (e) {
      console.log(`[Worker/analyze] transcript method ${name} threw: ${e.message}`);
    }
  }

  throw new Error("Could not fetch transcript. Make sure the video has captions available.");
}

async function tryLibrary(videoId) {
  // youtube-transcript lib — try InnerTube ANDROID + HTML scrape fallback
  let YoutubeTranscript;
  try {
    YoutubeTranscript = require("youtube-transcript").YoutubeTranscript;
  } catch {
    // fallback: try from root node_modules
    YoutubeTranscript = require("../node_modules/youtube-transcript").YoutubeTranscript;
  }
  if (!YoutubeTranscript) return null;

  const langs = ["id", "en", "ja", "ko", "zh-Hans", "es", "fr"];
  for (const lang of langs) {
    try {
      const config = lang ? { lang } : {};
      const items = await YoutubeTranscript.fetchTranscript(videoId, config);
      if (items && items.length > 0) {
        const segments = items.map((s) => ({
          start: s.offset / 1000,
          end: (s.offset + s.duration) / 1000,
          text: s.text,
        }));
        const rawText = segments.map((s) => s.text).join(" ");
        return { segments, rawText };
      }
    } catch { /* fall through */ }
  }
  return null;
}

async function tryInnerTubeWeb(videoId) {
  try {
    const body = {
      context: {
        client: { clientName: "WEB", clientVersion: "2.20240101", hl: "en", gl: "US" },
      },
      videoId,
    };
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": WEB_UA,
      Origin: "https://www.youtube.com",
      "X-YouTube-Client-Name": "1",
      "X-YouTube-Client-Version": "2.20240101",
    };
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) headers["X-Goog-Api-Key"] = apiKey;

    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST", headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;
    return downloadFromTracks(tracks);
  } catch { return null; }
}

async function downloadFromTracks(tracks) {
  const track = tracks.find((t) => t.languageCode === "id") ||
    tracks.find((t) => t.languageCode === "en") || tracks[0];
  if (!track?.baseUrl) return null;

  try {
    const captionRes = await fetch(track.baseUrl, {
      headers: { "User-Agent": WEB_UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!captionRes.ok) return null;
    const xml = await captionRes.text();
    const segments = parseTranscriptXml(xml);
    if (segments.length === 0) return null;
    const rawText = segments.map((s) => s.text).join(" ");
    return { segments, rawText };
  } catch { return null; }
}

function parseTranscriptXml(xml) {
  const segments = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]*)">(.*?)<\/text>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]) || 3;
    const text = match[3].replace(/<[^>]+>/g, "").trim();
    if (text) segments.push({ start, end: start + dur, text });
  }
  return segments;
}

async function tryTimedtext(videoId) {
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=id&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": WEB_UA },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.length < 50) continue;
      const data = JSON.parse(text);
      const events = data?.events;
      if (Array.isArray(events) && events.length > 0) {
        const segments = [];
        for (const e of events) {
          const start = (e.tStartMs || 0) / 1000;
          const dur = (e.dDurationMs || 5000) / 1000;
          const texts = e.segs?.map((s) => s.utf8 || "").join(" ") || "";
          if (texts.trim()) segments.push({ start, end: start + dur, text: texts.trim() });
        }
        if (segments.length > 0) {
          return { segments, rawText: segments.map((s) => s.text).join(" ") };
        }
      }
    } catch { /* fall through */ }
  }
  return null;
}

async function tryYoutubeScrape(videoId) {
  try {
    const res = await fetch(`https://youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": WEB_UA },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (jsonMatch) {
      try {
        const playerResponse = JSON.parse(jsonMatch[1]);
        const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) {
          return downloadFromTracks(tracks);
        }
      } catch { /* fall through */ }
    }
  } catch { /* fall through */ }
  return null;
}

// ─── Groq AI (for analyze jobs) ──────────────────────────

function getGroqApiKeys() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  if (keys.length === 0 && process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  return keys;
}

function buildAnalyzePrompt(title, duration, rawText) {
  const system = `Kamu adalah pendeteksi momen highlight AI.
Tugasmu menganalisis transkrip video dan menemukan momen paling menarik.
Setiap momen harus terasa lengkap — jangan memotong di tengah kalimat atau tawa.

Untuk setiap momen, berikan:
- startTime dan endTime dalam detik (sesuaikan dengan timestamp transkrip)
- Judul pendek yang menarik dalam Bahasa Indonesia
- Kategori: funny, emotional, inspirational, shocking, educational, atau hook
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

  const user = `Analisis transkrip video ini dan temukan momen highlight terbaik.

Judul: "${title}"
Durasi: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s

Transkrip:
${rawText.slice(0, 5000)}

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

  return { system, user };
}

async function callGroq(apiKey, model, system, user) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 429 || res.status === 413) {
    throw new Error(`Rate limited on ${model}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Groq returned invalid JSON: "${content.slice(0, 200)}"`);
  }

  const raw = parsed.highlights || parsed.highlight || parsed;
  const highlights = Array.isArray(raw) ? raw : [raw];

  return highlights
    .filter((h) => h.startTime != null && h.endTime != null)
    .slice(0, 12);
}

async function analyzeWithGroq(title, duration, rawText) {
  const keys = getGroqApiKeys();
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  const { system, user } = buildAnalyzePrompt(title, duration, rawText);

  for (const key of keys) {
    for (const model of models) {
      try {
        console.log(`[Worker/analyze] Groq trying key=${key.slice(0, 8)}... model=${model}`);
        return await callGroq(key, model, system, user);
      } catch (err) {
        const isRateLimit = err.message.includes("Rate limited");
        console.error(`[Worker/analyze] Groq key=${key.slice(0, 8)}... model=${model} ${isRateLimit ? "RATE_LIMITED" : "FAILED"}: ${err.message}`);
        if (!isRateLimit) throw err;
      }
    }
  }
  throw new Error("All Groq API keys and models exhausted due to rate limiting");
}

// ─── Analyze job processing ──────────────────────────────

async function processAnalyzeJob(job) {
  console.log(`\n[Worker/analyze] Processing analyze job: ${job.jobId}`);
  console.log(`[Worker/analyze] Video: ${job.youtubeUrl}`);

  const videoId = extractVideoId(job.youtubeUrl) || job.videoId;
  if (!videoId) {
    throw new Error("Could not extract video ID from URL");
  }

  // Step 1: Fetch transcript
  console.log(`[Worker/analyze] Fetching transcript...`);
  const { segments, rawText } = await fetchTranscript(videoId);
  console.log(`[Worker/analyze] Transcript fetched: ${segments.length} segments`);

  const duration = segments.length > 0
    ? Math.max(...segments.map((s) => s.end))
    : 600;

  // Step 2: Get title (from job or fetch)
  let title = job.title || "YouTube Video";
  if (!job.title) {
    try {
      const infoRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(job.youtubeUrl)}&format=json`,
        { headers: { "User-Agent": WEB_UA }, signal: AbortSignal.timeout(5000) },
      );
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        title = infoData.title || title;
      }
    } catch { /* fallback */ }
  }

  // Step 3: AI analysis
  console.log(`[Worker/analyze] AI analysis with Groq...`);
  const highlights = await analyzeWithGroq(title, duration, rawText);
  console.log(`[Worker/analyze] AI analysis done: ${highlights.length} highlights`);

  // Step 4: Save results to Convex
  console.log(`[Worker/analyze] Saving results...`);
  await convexCall("analyzeJobs:complete", {
    jobId: job.jobId,
    title,
    duration,
    transcriptSegments: segments,
    rawText,
    highlights,
  });

  console.log(`[Worker/analyze] ✅ Analyze job ${job.jobId} completed!`);
}

// ─── Main job processing ───────────────────────────────────

async function processJob(job) {
  console.log(`\n[Worker] Claimed export: ${job.exportId}`);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cutclips-worker-"));

  try {
    await processExportJob(job, tempDir);
  } catch (error) {
    let msg = "Worker error";
    if (error instanceof Error) {
      msg = error.message;
      const fullStack = error.stack || "";
      const stderr = (error).stderr || "";
      console.error(`[Worker] ❌ Export ${job.exportId} failed`);
      console.error(`[Worker]    Error: ${msg}`);
      console.error(`[Worker]    Stack: ${fullStack.slice(0, 3000)}`);
      if (stderr) console.error(`[Worker]    Stderr: ${stderr.slice(0, 3000)}`);
      // save only the actual error, not the full command
      const errLines = stderr.split("\n").filter(l => /[Ee]rror|width not|Conversion failed/.test(l));
      if (errLines.length > 0) msg = errLines.slice(0, 2).join(" | ").slice(0, 300);
      else msg = msg.split("\n")[0].slice(0, 150);
    } else {
      console.error(`[Worker] ❌ Export ${job.exportId} failed:`, String(error));
    }
    try {
      await convexCall("exports:fail", {
        exportId: job.exportId,
        error: msg,
      });
    } catch (e) {
      console.error("[Worker] Failed to update Convex:", e.message);
    }
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Poll loop ─────────────────────────────────────────────

async function pollLoop() {
  console.log(`[Worker] Starting poll loop (interval: ${POLL_INTERVAL}ms)`);
  console.log(`[Worker] FFmpeg: ${FFMPEG || "NOT FOUND"}`);
  console.log(`[Worker] yt-dlp: ${YT_DLP}`);

  if (!FFMPEG) {
    console.error("[Worker] ❌ FFmpeg binary not found!");
    console.error("[Worker] Install: npm install @ffmpeg-installer/ffmpeg");
    process.exit(1);
  }
  if (!WORKER_SECRET) {
    console.error("[Worker] ❌ WORKER_API_KEY not set in worker/.env!");
    process.exit(1);
  }

  while (true) {
    try {
      // Try export (clip) jobs first
      const exportJob = await convexCall("exports:claimQueued", {
        workerSecret: WORKER_SECRET,
      });

      if (exportJob) {
        await processJob(exportJob);
        continue;
      }

      // Then try analyze jobs
      const analyzeJob = await convexCall("analyzeJobs:claimQueued", {
        workerSecret: WORKER_SECRET,
      });

      if (analyzeJob) {
        processAnalyzeJob(analyzeJob).catch((err) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[Worker/analyze] ❌ Analyze job ${analyzeJob.jobId} failed: ${msg}`);
          convexCall("analyzeJobs:fail", {
            jobId: analyzeJob.jobId,
            error: msg,
          }).catch(() => {});
        });
        continue;
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("Invalid worker secret")) {
        console.error("[Worker] ❌ Invalid WORKER_API_KEY!");
        process.exit(1);
      }
      console.error(`[Worker] Poll error: ${msg}`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
  }
}

pollLoop();
