import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const ANICHIN_BASE = "https://api.anichin.bio";
const AUTH_HEADERS = { "X-API-Key": "TRIAL-ANICHIN-2026" };

async function fetchAnichin(path: string) {
  const res = await fetch(`${ANICHIN_BASE}${path}`, {
    headers: AUTH_HEADERS,
  });
  if (!res.ok) throw new Error(`Anichin API ${res.status}`);
  return res.json();
}

async function uploadBuffer(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { resource_type: "video", public_id: publicId, folder: "dramas" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result!.secure_url);
      },
    );
    upload.end(buffer);
  });
}

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source");
  const id = req.nextUrl.searchParams.get("id");
  const ep = Number(req.nextUrl.searchParams.get("ep"));
  if (!source || !id || !ep) {
    return NextResponse.json({ error: "Missing source, id, or ep" }, { status: 400 });
  }

  try {
    // 1. Get video URL from Anichin
    const epData = await fetchAnichin(`/${source}/episode?id=${id}&ep=${ep}`);
    const videoUrl = epData.videoUrl || epData.data?.videoUrl || "";
    if (!videoUrl) throw new Error("No video URL from API");

    const publicId = `${source}_${id}_ep${String(ep).padStart(3, "0")}`;

    // 2. Check if it's HLS or direct video
    if (videoUrl.includes(".m3u8")) {
      // HLS: fetch playlist, download all .ts segments, concatenate
      const playlistRes = await fetch(videoUrl, { headers: AUTH_HEADERS });
      if (!playlistRes.ok) throw new Error(`Playlist ${playlistRes.status}`);
      const playlist = await playlistRes.text();

      const tsUrls = playlist
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("#"))
        .map((l) => {
          if (l.startsWith("http")) return l;
          const base = videoUrl.substring(0, videoUrl.lastIndexOf("/") + 1);
          return base + l;
        });

      if (tsUrls.length === 0) throw new Error("No .ts segments in playlist");

      // Download all .ts segments in parallel (limit 5)
      const chunks: Buffer[] = [];
      for (let i = 0; i < tsUrls.length; i += 5) {
        const batch = tsUrls.slice(i, i + 5);
        const results = await Promise.all(
          batch.map(async (url) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`TS ${url.slice(-20)} ${res.status}`);
            return Buffer.from(await res.arrayBuffer());
          }),
        );
        chunks.push(...results);
      }

      const combined = Buffer.concat(chunks);
      const cloudinaryUrl = await uploadBuffer(combined, publicId);
      return NextResponse.json({ episode: ep, cloudinaryUrl, segments: tsUrls.length });
    } else {
      // Direct video (mp4 etc): download and upload
      const videoRes = await fetch(videoUrl, { headers: AUTH_HEADERS });
      if (!videoRes.ok) throw new Error(`Video ${videoRes.status}`);
      const buffer = Buffer.from(await videoRes.arrayBuffer());
      const cloudinaryUrl = await uploadBuffer(buffer, publicId);
      return NextResponse.json({ episode: ep, cloudinaryUrl });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
