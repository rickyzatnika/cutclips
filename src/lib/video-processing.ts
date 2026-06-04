import fs from "fs";
import path from "path";

const isVercel = !!process.env.VERCEL;

function findPlatformBinary(basePkg: string, exeName: string): string | null {
  const platform = process.platform === "win32" ? "win32-x64" : process.platform === "darwin" ? "darwin-x64" : "linux-x64";

  const npm3 = path.join(process.cwd(), "node_modules", basePkg, platform, exeName);
  if (fs.existsSync(npm3)) return npm3;

  const npm2 = path.join(process.cwd(), "node_modules", `@ffmpeg-installer`, platform, exeName);
  if (fs.existsSync(npm2)) return npm2;

  return null;
}

export function getFfmpegPath(): string | null {
  if (isVercel) return null;
  const exeName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return findPlatformBinary("@ffmpeg-installer/ffmpeg", exeName);
}

export function getYtDlpPath(): string | null {
  if (isVercel) return null;

  const binName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const pkgDir = path.join(process.cwd(), "node_modules", "@distube", "yt-dlp", "bin");
  const candidate = path.join(pkgDir, binName);
  if (fs.existsSync(candidate)) return candidate;

  return null;
}

export function hasBinaries(): boolean {
  return !!getFfmpegPath() && !!getYtDlpPath();
}
