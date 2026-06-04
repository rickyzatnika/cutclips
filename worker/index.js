require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const cloudinary = require("cloudinary").v2;
const { EdgeTTS } = require("node-edge-tts");


// ─── Config ────────────────────────────────────────────────
const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const WORKER_SECRET = process.env.WORKER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
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
  if (!CONVEX_URL) throw new Error("CONVEX_URL not set in .env.local");
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

// ─── Script-type job helpers ───────────────────────────────

async function tryPexelsSearch(query) {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait`,
    { headers: { Authorization: PEXELS_API_KEY } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.videos?.length) return null;
  for (const v of data.videos) {
    if (v.duration < 8) continue;
    const hdFile = v.video_files?.find((f) => f.quality === "hd" && f.width >= 720);
    if (hdFile?.link) return { url: hdFile.link, duration: v.duration };
    const sdFile = v.video_files?.find((f) => f.link);
    if (sdFile?.link) return { url: sdFile.link, duration: v.duration };
  }
  return null;
}

const idEnKeywords = {
  teknologi: "technology", kota: "city", alam: "nature", orang: "people",
  manusia: "people", pekerja: "worker", karyawan: "office", staf: "office",
  bisnis: "business", kantor: "office", rapat: "meeting", presentasi: "presentation",
  makanan: "food", masak: "cooking", dapur: "kitchen", restoran: "restaurant",
  sains: "science", laboratorium: "laboratory", penelitian: "research",
  komputer: "computer", laptop: "laptop", robot: "robot", mesin: "machine",
  kecerdasan: "robot", buatan: "technology", digital: "technology",
  kesehatan: "healthcare", dokter: "doctor", rumahsakit: "hospital", pasien: "hospital",
  pendidikan: "education", sekolah: "classroom", kelas: "classroom", siswa: "student",
  mahasiswa: "student", guru: "teacher", belajar: "student", mengajar: "teacher",
  industri: "industry", pabrik: "factory", manufaktur: "factory",
  pertanian: "agriculture", sawah: "farming", petani: "farming",
  perjalanan: "travel", transportasi: "transportation", mobil: "car",
  motor: "motorcycle", pesawat: "airplane", kereta: "train",
  olahraga: "sports", gym: "fitness", kebugaran: "fitness", lari: "running",
  musik: "music", alatmusik: "music", seni: "art", lukisan: "art",
  desain: "design", arsitektur: "architecture",
  konstruksi: "construction", bangunan: "building",
  luarangkasa: "space", planet: "space", bintang: "space",
  laut: "ocean", pantai: "beach", gunung: "mountain", hutan: "forest",
  sungai: "river", danau: "lake", pohon: "nature", bunga: "nature",
  hewan: "animal", kucing: "cat", anjing: "dog", burung: "bird",
  keluarga: "family", anak: "children", rumah: "home",
  meeting: "meeting", komunikasi: "communication", internet: "internet",
  data: "data", jaringan: "network", server: "technology",
  masa: "future", depan: "future", inovasi: "innovation",
  keuangan: "business", ekonomi: "business", pasar: "market",
  medsos: "social media", sosial: "people", media: "technology",
  ponsel: "smartphone", smartphone: "smartphone", aplikasi: "smartphone",
  kendaraan: "vehicle", jalan: "city", tol: "highway",
  listrik: "energy", energi: "energy", tenaga: "power",
  udara: "sky", awan: "cloud", cuaca: "weather",
  olahrag: "sports", sepakbola: "sports", basket: "sports",
  menulis: "writing", membaca: "reading", buku: "book",
  krisis: "abstract", masalah: "abstract", solusi: "business",
  dampak: "abstract", manfaat: "people", perubahan: "abstract",
  
};

function extractKeywords(visualKeyword, sceneDescription) {
  const keywords = [visualKeyword];
  const desc = (sceneDescription || "").toLowerCase();
  for (const [id, en] of Object.entries(idEnKeywords)) {
    if (desc.includes(id) && !keywords.includes(en)) {
      keywords.push(en);
    }
  }
  return keywords;
}

async function searchStockVideo(keyword, sceneDescription) {
  if (!PEXELS_API_KEY) return null;

  // Extract keywords from visual keyword + scene description
  const extracted = extractKeywords(keyword, sceneDescription);
  const keywordsToTry = [
    ...extracted,
    ...keyword.split(/\s+/).filter((k) => k.length > 3),
    "nature", "technology", "city", "people",
    "business", "office", "food", "background",
    "abstract", "landscape", "lifestyle", "science",
  ];

  const tried = new Set();
  for (const kw of keywordsToTry) {
    const lower = kw.toLowerCase().trim();
    if (!lower || tried.has(lower)) continue;
    tried.add(lower);
    try {
      const result = await tryPexelsSearch(lower);
      if (result) {
        console.log(`[Worker]   Found stock video via keyword "${lower}" (${result.duration}s)`);
        return result;
      }
    } catch {}
  }
  return null;
}

async function downloadStockVideo(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download stock video: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(outputPath, buffer);
}

async function generateTTS(text, outputPath) {
  const tts = new EdgeTTS({
    voice: "id-ID-GadisNeural",
    lang: "id-ID",
    rate: "default",
    pitch: "default",
    timeout: 30000,
  });
  await tts.ttsPromise(text, outputPath);
}

function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, ["-i", filePath, "-f", "null", "-"], (err, stdout, stderr) => {
      if (err) return reject(err);
      const m = stderr.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/);
      if (m) {
        resolve(parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100);
      } else {
        reject(new Error("Could not parse duration"));
      }
    });
  });
}

async function renderSceneWithNarration(ffmpegPath, workDir, sceneIndex, scene, opts, actualDuration) {
  const sceneInput = path.join(workDir, `scene_${sceneIndex}_input.mp4`);
  const ttsAudio = path.join(workDir, `scene_${sceneIndex}_tts.mp3`);
  const outputRaw = path.join(workDir, `scene_${sceneIndex}_raw.mp4`);
  const outputFinal = `scene_${sceneIndex}.mp4`;

  const duration = actualDuration || scene.duration;
  let inputFile = sceneInput;

  // Check if stock video was downloaded
  if (!fs.existsSync(sceneInput)) {
    // Generate a colorful background with text instead
    const bgColor = ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560"][sceneIndex % 5];
    const textDesc = scene.sceneDescription.replace(/'/g, "'\\''").substring(0, 50);
    const label = `Scene ${sceneIndex + 1}`;
    const ffCmd = [
      "-f", "lavfi",
      "-i", `color=c=${bgColor}:s=1080x1920:d=${duration}:r=30`,
      "-vf", `drawtext=text='${label}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2-40:fontfile=${escapeFontPath("Arial")},drawtext=text='${textDesc}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2+20:fontfile=${escapeFontPath("Arial")}`,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-y",
      outputRaw,
    ];
    await new Promise((resolve, reject) => {
      execFile(ffmpegPath, ffCmd, { cwd: workDir }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    inputFile = outputRaw;
  } else {
    // We have stock footage - center-crop to 9:16 and scale
    const vf = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920";
    await new Promise((resolve, reject) => {
      execFile(ffmpegPath, [
        "-i", sceneInput,
        "-t", String(duration),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-y",
        outputRaw,
      ], { cwd: workDir }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    inputFile = outputRaw;
  }

  // Generate TTS for narration (skip if pre-generated)
  if (scene.narration && scene.narration.trim()) {
    try {
      if (!fs.existsSync(ttsAudio)) {
        await generateTTS(scene.narration, ttsAudio);
      }
      await new Promise((resolve, reject) => {
        execFile(ffmpegPath, [
          "-i", inputFile,
          "-i", ttsAudio,
          "-c:v", "copy",
          "-c:a", "aac",
          "-map", "0:v:0",
          "-map", "1:a:0",
          "-shortest",
          "-y",
          outputFinal,
        ], { cwd: workDir }, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      return outputFinal;
    } catch {
      // TTS failed, add silent audio so all scenes have consistent streams
      await new Promise((resolve, reject) => {
        execFile(ffmpegPath, [
          "-i", inputFile,
          "-f", "lavfi",
          "-i", "anullsrc=r=44100:cl=mono",
          "-shortest",
          "-c:v", "copy",
          "-c:a", "aac",
          "-y",
          outputFinal,
        ], { cwd: workDir }, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      return outputFinal;
    }
  }

  // No TTS, add silent audio
  const silentOutput = `scene_${sceneIndex}_silent.mp4`;
  await new Promise((resolve, reject) => {
    execFile(ffmpegPath, [
      "-i", inputFile,
      "-f", "lavfi",
      "-i", "anullsrc=r=44100:cl=mono",
      "-shortest",
      "-c:v", "copy",
      "-c:a", "aac",
      "-y",
      silentOutput,
    ], { cwd: workDir }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
  return silentOutput;
}

function escapeFontPath(fontName) {
  // Simple font name for drawtext filter
  return fontName.replace(/'/g, "'\\''");
}

function generateCaptionsForScript(scenes) {
  const captions = [];
  let currentTime = 0;
  for (const scene of scenes) {
    const dur = scene.duration;
    const words = scene.narration.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    if (wordCount === 0) {
      currentTime += dur;
      continue;
    }
    const timePerWord = dur / wordCount;
    // Group words into chunks of 3-4 for display
    const chunkSize = 3;
    for (let i = 0; i < wordCount; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      const start = currentTime + i * timePerWord;
      const end = Math.min(start + timePerWord * chunkSize, currentTime + dur);
      captions.push({
        start,
        end,
        text: chunk,
        style: "fade-in",
      });
    }
    currentTime += dur;
  }
  return captions;
}

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(sec)).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function generateAssCaptions(scenes, opts, actualDurations) {
  const fontName = opts.fontFamily || "Arial";
  const fontSize = Math.max(28, opts.fontSize || 36);
  const rawColor = opts.outlineColor || "&H0000FF00";
  const primaryColor = "&H00FFFFFF";

  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H0000FFFF,${rawColor},&H00000000,0,0,0,0,100,100,0,0,1,3,1,2,10,10,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let currentTime = 0;
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const dur = (actualDurations && actualDurations[si]) || scene.duration;
    const words = scene.narration.split(/\s+/).filter(Boolean);
    if (words.length === 0) { currentTime += dur; continue; }

    const timePerWord = dur / words.length;
    const chunkSize = 4;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      const start = currentTime + i * timePerWord;
      const end = Math.min(start + timePerWord * chunkSize, currentTime + dur);

      ass += `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,{\\move(540,1970,540,1720,0,250)}{\\fad(80,150)}${chunk}\n`;
    }
    currentTime += dur;
  }

  return ass;
}

function concatVideos(ffmpegPath, workDir, sceneFiles, outputName) {
  // Create concat file
  const listContent = sceneFiles.map((f) => `file '${f}'`).join("\n");
  fs.writeFileSync(path.join(workDir, "concat.txt"), listContent, "utf-8");

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, [
      "-f", "concat",
      "-safe", "0",
      "-i", "concat.txt",
      "-c:v", "libx264",
      "-c:a", "aac",
      "-preset", "ultrafast",
      "-y",
      outputName,
    ], { cwd: workDir }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// ─── YouTube job processing ────────────────────────────────

async function processYoutubeJob(job, tempDir) {
  console.log(`[Worker] Getting video info for: ${job.youtubeUrl}`);
  const context = await getVideoContext(job.youtubeUrl, tempDir);
  console.log(`[Worker] Video: "${context.title}" (${Math.floor(context.duration)}s)`);

  console.log(`[Worker] Analyzing with ${job.provider || "groq"}/${job.model || "llama-3.1-8b-instant"}...`);
  const analysis = await analyzeVideo({
    ...context,
    title: job.title,
    model: job.model || "llama-3.1-8b-instant",
    provider: job.provider || "groq",
  });
  console.log(`[Worker] AI found ${analysis.clips.length} clips`);

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
    const clipOpts = {};
    if (job.fontFamily) clipOpts.fontFamily = job.fontFamily;
    if (job.fontSize) clipOpts.fontSize = job.fontSize;
    if (job.outlineColor) clipOpts.outlineColor = "&H00" + job.outlineColor.replace("#", "").toUpperCase();
    await cutClip(FFMPEG, tempDir, "video.mp4", clipName, c.start, dur, clipCaptions, clipOpts);

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

  return { clips: analysis.clips, captions: analysis.captions, voiceOver: analysis.voiceOver, videoUrls };
}

// ─── Script job processing ─────────────────────────────────

async function processScriptJob(job, tempDir) {
  const script = job.script;
  console.log(`[Worker] Processing script job: "${script.topic}" (${script.scenes.length} scenes)`);

  await convexCall("workerMutations:workerUpdateProgress", {
    workerSecret: WORKER_SECRET,
    jobId: job.jobId,
    progress: 10,
  });

  // 1. Search and download stock footage for each scene
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    console.log(`[Worker] Scene ${i + 1}/${script.scenes.length}: "${scene.visualKeyword}"`);

    const stockVideo = await searchStockVideo(scene.visualKeyword, scene.sceneDescription);
    if (stockVideo) {
      try {
        const outputPath = path.join(tempDir, `scene_${i}_input.mp4`);
        console.log(`[Worker]   Downloading stock video: ${stockVideo.url}`);
        await downloadStockVideo(stockVideo.url, outputPath);
        console.log(`[Worker]   Stock video downloaded (${stockVideo.duration}s)`);
      } catch (e) {
        console.log(`[Worker]   Stock download failed: ${e.message}`);
      }
    } else {
      console.log(`[Worker]   No stock video found for "${scene.visualKeyword}"`);
    }

    const sceneProgress = 10 + Math.round((40 / script.scenes.length) * (i + 1));
    await convexCall("workerMutations:workerUpdateProgress", {
      workerSecret: WORKER_SECRET,
      jobId: job.jobId,
      progress: sceneProgress,
    }).catch(() => {});
  }

  // 2. Pre-generate TTS for each scene to get actual audio duration
  const actualDurations = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const ttsPath = path.join(tempDir, `scene_${i}_tts.mp3`);
    if (scene.narration && scene.narration.trim()) {
      try {
        console.log(`[Worker]   Generating TTS for scene ${i + 1}...`);
        await generateTTS(scene.narration, ttsPath);
        const audioDur = await getAudioDuration(ttsPath);
        actualDurations.push(audioDur);
        console.log(`[Worker]   TTS duration: ${audioDur.toFixed(1)}s (scene duration: ${scene.duration}s)`);
      } catch (e) {
        console.log(`[Worker]   TTS failed for scene ${i + 1}: ${e.message}`);
        actualDurations.push(scene.duration);
      }
    } else {
      actualDurations.push(scene.duration);
    }
  }

  // 3. Render each scene with TTS and correct duration
  const opts = {};
  if (job.fontFamily) opts.fontFamily = job.fontFamily;
  if (job.fontSize) opts.fontSize = job.fontSize;
  if (job.outlineColor) opts.outlineColor = "&H00" + job.outlineColor.replace("#", "").toUpperCase();

  const renderedScenes = [];
  for (let i = 0; i < script.scenes.length; i++) {
    console.log(`[Worker] Rendering scene ${i + 1}/${script.scenes.length}...`);
    const sceneFile = await renderSceneWithNarration(FFMPEG, tempDir, i, script.scenes[i], opts, actualDurations[i]);
    renderedScenes.push(sceneFile);

    const renderProgress = 50 + Math.round((30 / script.scenes.length) * (i + 1));
    await convexCall("workerMutations:workerUpdateProgress", {
      workerSecret: WORKER_SECRET,
      jobId: job.jobId,
      progress: renderProgress,
    }).catch(() => {});
  }

  // 4. Concatenate scenes
  console.log(`[Worker] Concatenating ${renderedScenes.length} scenes...`);
  const concatOutput = "final.mp4";
  await concatVideos(FFMPEG, tempDir, renderedScenes, concatOutput);

  // 5. Add animated captions to final video
  const captions = generateCaptionsForScript(script.scenes);
  const assContent = generateAssCaptions(script.scenes, opts, actualDurations);
  let finalVideo = concatOutput;
  if (assContent.trim()) {
    fs.writeFileSync(path.join(tempDir, "final_captions.ass"), assContent, "utf-8");
    const captionedVideo = "final_captioned.mp4";
    await new Promise((resolve, reject) => {
      execFile(FFMPEG, [
        "-i", concatOutput,
        "-vf", "ass=final_captions.ass",
        "-c:a", "copy",
        "-preset", "ultrafast",
        "-y",
        captionedVideo,
      ], { cwd: tempDir }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    finalVideo = captionedVideo;
  }

  await convexCall("workerMutations:workerUpdateProgress", {
    workerSecret: WORKER_SECRET,
    jobId: job.jobId,
    progress: 85,
  }).catch(() => {});

  // 5. Upload to Cloudinary
  console.log(`[Worker] Uploading final video to Cloudinary...`);
  const result = await cloudinary.uploader.upload(path.join(tempDir, finalVideo), {
    resource_type: "video",
    folder: `shortsai/${job.projectId}`,
    public_id: "script-video",
  });

  const totalDuration = script.scenes.reduce((s, sc) => s + sc.duration, 0);

  await convexCall("workerMutations:workerUpdateProgress", {
    workerSecret: WORKER_SECRET,
    jobId: job.jobId,
    progress: 95,
  }).catch(() => {});

  return {
    clips: [{
      start: 0,
      end: totalDuration,
      description: `Video tentang ${script.topic}`,
    }],
    captions,
    voiceOver: script.scenes.map((s) => s.narration).join(" "),
    videoUrls: [result.secure_url],
  };
}

// ─── Main job processing ───────────────────────────────────

async function processJob(job) {
  console.log(`\n[Worker] Claimed job: ${job.jobId} — "${job.title}" (type: ${job.type || "youtube"})`);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "saas-worker-"));

  try {
    let result;
    if (job.type === "script" && job.script) {
      result = await processScriptJob(job, tempDir);
    } else {
      result = await processYoutubeJob(job, tempDir);
    }

    console.log(`[Worker] Completing job...`);
    await convexCall("workerMutations:workerCompleteJob", {
      workerSecret: WORKER_SECRET,
      jobId: job.jobId,
      clips: result.clips,
      captions: result.captions,
      voiceOver: result.voiceOver,
      videoUrls: result.videoUrls,
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

// ─── Poll loop ─────────────────────────────────────────────

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
