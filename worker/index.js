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

async function downloadYouTube(outputDir, filename, url) {
  const outputPath = path.join(outputDir, filename);
  await execYtDlpAsync(
    ["-f", "best[height<=720]", "-o", outputPath, "--merge-output-format", "mp4", url],
    600000,
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
  let vf = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920";

  if (captions && captions.length > 0) {
    const clipEnd = start + duration;
    const srtContent = generateSrtForClip(captions, start, clipEnd);
    if (srtContent.trim()) {
      fs.writeFileSync(path.join(workDir, "captions.srt"), srtContent, "utf-8");
      const fontFamily = (opts && opts.fontFamily) || "Arial";
      const fontSize = (opts && opts.fontSize) || 13;
      const outlineColor = (opts && opts.outlineColor) || "&H0000FF00";
      const style = `FontName=${fontFamily}\\,FontSize=${fontSize}\\,PrimaryColour=&H00FFFFFF\\,OutlineColour=${outlineColor}\\,Outline=2\\,BorderStyle=1`;
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

  console.log(`[Worker] Downloading video...`);
  await reportProgress(job.exportId, "downloading");
  await downloadYouTube(tempDir, "video.mp4", job.youtubeUrl);

  console.log(`[Worker] Cutting clip (${duration}s)...`);
  await reportProgress(job.exportId, "cutting");
  const clipName = "clip.mp4";
  await cutClip(FFMPEG, tempDir, "video.mp4", clipName, job.startTime, duration, []);

  console.log(`[Worker] Uploading to Cloudinary...`);
  await reportProgress(job.exportId, "uploading");
  const result = await cloudinary.uploader.upload(path.join(tempDir, clipName), {
    resource_type: "video",
    folder: "cutclips",
    public_id: `export-${job.exportId}`,
  });

  console.log(`[Worker] Completing export...`);
  await reportProgress(job.exportId, "completing");
  await convexCall("exports:complete", {
    exportId: job.exportId,
    downloadUrl: result.secure_url,
  });

  console.log(`[Worker] ✅ Export ${job.exportId} completed!`);
}

// ─── Main job processing ───────────────────────────────────

async function processJob(job) {
  console.log(`\n[Worker] Claimed export: ${job.exportId}`);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cutclips-worker-"));

  try {
    await processExportJob(job, tempDir);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Worker error";
    console.error(`[Worker] ❌ Export ${job.exportId} failed:`, msg);
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
      const job = await convexCall("exports:claimQueued", {
        workerSecret: WORKER_SECRET,
      });

      if (job) {
        await processJob(job);
      } else {
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
