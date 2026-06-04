require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const cloudinary = require("cloudinary").v2;

// ─── Config ────────────────────────────────────────────────
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const WORKER_SECRET = process.env.WORKER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL || "5000", 10);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Binary resolution ────────────────────────────────────
function getFfmpegPath() {
  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    return null;
  }
}

function getYtDlpPath() {
  const binName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const pkgDir = path.join(__dirname, "..", "node_modules", "@distube", "yt-dlp", "bin");
  if (!fs.existsSync(pkgDir)) return null;
  const candidate = path.join(pkgDir, binName);
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

const FFMPEG = getFfmpegPath();
const YT_DLP = getYtDlpPath() || "yt-dlp";

// ─── Convex REST helper ────────────────────────────────────
async function convexCall(mutationPath, args) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: mutationPath, args }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.value;
}

// ─── Helpers ───────────────────────────────────────────────
function execYtDlp(args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    execFile(YT_DLP, args, { timeout }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function srtTimeToSeconds(t) {
  const parts = t.replace(",", ".").split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
}

function parseSRT(raw) {
  const segments = [];
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

async function tryDownloadSubs(url, tempDir) {
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
      // try next language
    }
  }
  return { raw: "", segments: [] };
}

async function getVideoContext(url, tempDir) {
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

function generateSegmentFallback(duration) {
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

function filterSegmentsForClips(segments, clips) {
  const result = [];
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

async function analyzeVideo(context) {
  const provider = context.provider || "groq";
  const model = context.model || "llama-3.1-8b-instant";

  if (provider === "gemini" && !GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set");
  }
  if (provider !== "gemini" && !GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not set");
  }

  const durationMinutes = Math.floor(context.duration / 60);
  const durationSeconds = context.duration % 60;
  const hasTranscript = context.transcript.length > 50;
  const hasChapters = context.chapters.length > 0;

  let contentSection = `Judul: "${context.title}"\nDurasi: ${durationMinutes}m${durationSeconds}s (${Math.floor(context.duration)} detik)`;
  if (context.description) contentSection += `\n\nDeskripsi:\n${context.description}`;
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
    const fb = generateSegmentFallback(context.duration);
    return {
      clips: fb.clips.map((c) => ({ ...c, end: Math.min(c.end, context.duration) })),
      captions: [{ start: 0, end: 10, text: `${context.title}`, style: "fade-in" }],
      voiceOver: `Sorotan dari ${context.title}`,
    };
  }

  const systemPrompt = "Anda adalah editor video AI. Analisis konten video dan pilih 2 segmen pendek (15-45 detik) yang PALING BERBEDA dan menarik. Prioritaskan potongan UTUH jangan sampai klimaks terpotong. Kembalikan JSON valid saja.";

  const userPrompt = `Analisis video YouTube ini dan pilih 2 momen PALING penting/berharga untuk dijadikan short clip viral.

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
${hasTranscript ? "- Timeline caption harus cocok dgn ucapan di transkrip" : "- Caption generik relevan dgn judul"}`;

  let result = {};
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise((r) => setTimeout(r, delay));
    }

    if (provider === "gemini") {
      const geminiModel = model || "gemini-2.0-flash";
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
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
      const groqPayload = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      };

      const jsonModels = ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "llama-3.3-70b-versatile"];
      if (jsonModels.includes(model)) {
        groqPayload.response_format = { type: "json_object" };
      }

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

    console.error(`[Worker] AI attempt ${attempt + 1} failed:`, lastError);
  }

  if (lastError) throw new Error(lastError);

  let clips = (result.clips || []).slice(0, 2).map((c) => {
    const start = Math.max(0, Number(c.start) || 0);
    const end = Math.min(context.duration, Number(c.end) || Math.min(start + 25, context.duration));
    return {
      start,
      end: end > start ? end : Math.min(start + 25, context.duration),
      description: String(c.description || ""),
    };
  });

  if (clips.length === 0) {
    clips = generateSegmentFallback(context.duration).clips;
  }

  let finalCaptions;

  if (context.subtitleSegments.length > 0) {
    finalCaptions = filterSegmentsForClips(context.subtitleSegments, clips);
  } else {
    const rawSegments = Array.isArray(result.captionSegments) ? result.captionSegments : [];
    finalCaptions = rawSegments
      .filter((s) => s && typeof s === "object")
      .slice(0, 30)
      .map((s) => ({
        start: Math.max(0, Number(s.start) || 0),
        end: Math.max(0, Number(s.end) || Number(s.start) + 3 || 0),
        text: String(s.text || ""),
        style: ["fade-in", "slide-up", "bounce"].includes(String(s.style)) ? String(s.style) : "fade-in",
      }))
      .filter((s) => s.text.trim().length > 0);
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

async function downloadYouTube(outputDir, filename, url, onProgress) {
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

function srtTimeStr(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3).replace(".", ",");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(7, "0")}`;
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

function cutClip(ffmpegPath, workDir, videoName, outputName, start, duration, captions) {
  let vf = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920";

  if (captions && captions.length > 0) {
    const clipEnd = start + duration;
    const srtContent = generateSrtForClip(captions, start, clipEnd);
    if (srtContent.trim()) {
      fs.writeFileSync(path.join(workDir, "captions.srt"), srtContent, "utf-8");
      const style = "FontName=Arial\\,FontSize=13\\,PrimaryColour=&H00FFFFFF\\,OutlineColour=&H0000FF00\\,Outline=2\\,BorderStyle=1";
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

// ─── Main loop ─────────────────────────────────────────────
async function processJob(job) {
  console.log(`\n[Worker] Claimed job: ${job.jobId} — "${job.title}"`);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "saas-worker-"));

  try {
    // 1. Video info
    console.log(`[Worker] Getting video info for: ${job.youtubeUrl}`);
    const context = await getVideoContext(job.youtubeUrl, tempDir);
    console.log(`[Worker] Video: "${context.title}" (${Math.floor(context.duration)}s)`);

    // 2. AI analysis
    console.log(`[Worker] Analyzing with ${job.provider || "groq"}/${job.model || "llama-3.1-8b-instant"}...`);
    const analysis = await analyzeVideo({
      ...context,
      title: job.title,
      model: job.model || "llama-3.1-8b-instant",
      provider: job.provider || "groq",
    });
    console.log(`[Worker] AI found ${analysis.clips.length} clips`);

    // 3. Download
    console.log(`[Worker] Downloading video...`);
    await convexCall("workerMutations:workerUpdateProgress", {
      workerSecret: WORKER_SECRET,
      jobId: job.jobId,
      progress: 30,
    });
    await downloadYouTube(tempDir, "video.mp4", job.youtubeUrl, (dlPct) => {
      const scaled = 30 + Math.round(dlPct * 0.10);
      convexCall("workerMutations:workerUpdateProgress", {
        workerSecret: WORKER_SECRET,
        jobId: job.jobId,
        progress: scaled,
      }).catch(() => {});
    });

    // 4. FFmpeg cut + upload
    const videoUrls = [];
    for (let i = 0; i < analysis.clips.length; i++) {
      const c = analysis.clips[i];
      const dur = Math.max(5, c.end - c.start);
      const clipName = `clip-${i}.mp4`;

      const progressBase = 40;
      const stepSize = 25;
      const clipProgress = progressBase + Math.round((stepSize / analysis.clips.length) * (i + 1));

      console.log(`[Worker] Cutting clip ${i + 1}/${analysis.clips.length} (${c.start}s → ${c.start + dur}s)...`);
      const clipCaptions = analysis.captions.filter(
        (cap) => cap.start < c.end && cap.end > c.start
      );
      await cutClip(FFMPEG, tempDir, "video.mp4", clipName, c.start, dur, clipCaptions);

      console.log(`[Worker] Uploading clip ${i + 1} to Cloudinary...`);
      const result = await cloudinary.uploader.upload(path.join(tempDir, clipName), {
        resource_type: "video",
        folder: `shortsai/${job.projectId}`,
        public_id: `clip-${i}`,
      });
      videoUrls.push(result.secure_url);

      await convexCall("workerMutations:workerUpdateProgress", {
        workerSecret: WORKER_SECRET,
        jobId: job.jobId,
        progress: clipProgress + 5,
      }).catch(() => {});
    }

    // 5. Complete
    console.log(`[Worker] Completing job...`);
    await convexCall("workerMutations:workerCompleteJob", {
      workerSecret: WORKER_SECRET,
      jobId: job.jobId,
      clips: analysis.clips,
      captions: analysis.captions,
      voiceOver: analysis.voiceOver,
      videoUrls,
    });
    console.log(`[Worker] ✅ Job ${job.jobId} completed!`);

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Worker error";
    console.error(`[Worker] ❌ Job ${job.jobId} failed:`, msg);
    try {
      await convexCall("workerMutations:workerFailJob", {
        workerSecret: WORKER_SECRET,
        jobId: job.jobId,
        error: msg,
      });
    } catch (e) {
      console.error("[Worker] Failed to update Convex:", e.message);
    }
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function pollLoop() {
  console.log(`[Worker] Starting poll loop (interval: ${POLL_INTERVAL}ms)`);
  console.log(`[Worker] FFmpeg: ${FFMPEG || "NOT FOUND"}`);
  console.log(`[Worker] yt-dlp: ${YT_DLP}`);

  if (!FFMPEG) {
    console.error("[Worker] ❌ FFmpeg binary not found!");
    process.exit(1);
  }
  if (!WORKER_SECRET) {
    console.error("[Worker] ❌ WORKER_API_KEY not set in .env.local!");
    process.exit(1);
  }

  while (true) {
    try {
      const job = await convexCall("workerMutations:claimNextJob", {
        workerSecret: WORKER_SECRET,
      });

      if (job) {
        await processJob(job);
      } else {
        // no jobs — wait
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }
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
