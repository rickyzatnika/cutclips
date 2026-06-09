"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Film, MoreVertical, Download, Trash2, Loader2, CheckCircle2, Cloud, Film as FilmIcon, Video, Timer } from "lucide-react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

const PROGRESS_STEPS: Record<string, { label: string; icon: any }> = {
  queued: { label: "Menunggu antrian", icon: Timer },
  downloading: { label: "Mengunduh video", icon: Video },
  cutting: { label: "Memotong clip", icon: FilmIcon },
  uploading: { label: "Mengunggah ke Cloudinary", icon: Cloud },
  completing: { label: "Finalisasi", icon: CheckCircle2 },
};

interface Clip {
  exportId: string;
  status: string;
  progress?: string;
  downloadUrl?: string;
  highlightId: string;
  highlightTitle: string;
  category: string;
  startTime: number;
  endTime: number;
  createdAt: number;
  video: {
    _id: string;
    youtubeUrl: string;
    title: string;
    thumbnailUrl?: string;
  };
}

function getYoutubeThumbnail(url: string): string {
  const m = url.match(
    /(?:youtu\.be\/|v=|vi\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/
  );
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return "";
}

function MenuButton({ clip, email, onDeleted }: { clip: Clip; email?: string | null; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="rounded-lg bg-black/60 p-1.5 cursor-pointer text-white opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          <a
            href={clip.downloadUrl}
            download
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <Download className="h-4 w-4" />
            Unduh
          </a>
          <button
            onClick={async () => {
              setOpen(false);
              try {
                const res = await fetch(`${CONVEX_URL}/api/mutation`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    path: "exports:remove",
                    args: { exportId: clip.exportId, email },
                  }),
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                onDeleted();
              } catch {}
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-zinc-800 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            Hapus
          </button>
        </div>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [url, setUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClips = useCallback(() => {
    if (!session?.user?.email || !CONVEX_URL) return;
    fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "videos:listByUserWithClips",
        args: { email: session.user.email },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.value) setClips(data.value);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    setLoading(true);
    fetchClips();
  }, [fetchClips]);

  // Smart poll: every 3s while processing, stop when all done
  const hasProcessing = clips.some((c) => c.status === "queued" || c.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(fetchClips, 3000);
    return () => clearInterval(interval);
  }, [hasProcessing, fetchClips]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-medium text-black shadow-lg transition-all">
          {toast}
        </div>
      )}

      {/* Paste URL section */}
      <form onSubmit={handleSubmit} className="mb-10 ">
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Tempel URL YouTube untuk cari highlight..."
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-base text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-xl bg-emerald-500 px-6 py-4 text-base font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Analisis
          </button>
        </div>
      </form>

      {/* Processing clips */}
      {(() => {
        const processing = clips.filter((c) => c.status === "queued" || c.status === "processing");
        if (!processing.length) return null;
        return (
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Membuat Clip ({processing.length})
              </h2>
            </div>
            <div className="space-y-3">
              {processing.map((clip) => {
                const step = PROGRESS_STEPS[clip.progress || "queued"] || PROGRESS_STEPS.queued;
                const StepIcon = step.icon;
                return (
                  <div
                    key={clip.exportId}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 transition-all duration-500"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium text-white">
                          {clip.highlightTitle}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {clip.video.title}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-800 px-3 py-1 text-xs capitalize text-zinc-400">
                        {clip.progress || "queued"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
                      <StepIcon className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                      <span className="text-emerald-400/80">{step.label}...</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Completed clips */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Clip Terbaru
          {clips.filter((c) => c.status === "completed").length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              ({clips.filter((c) => c.status === "completed").length})
            </span>
          )}
        </h2>

        {loading ? (
          <div className="rounded-2xl border border-zinc-800 p-12 text-center">
            <p className="text-sm text-zinc-500">Memuat...</p>
          </div>
        ) : clips.filter((c) => c.status === "completed").length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 p-12 text-center">
            <Film className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-500">
              Belum ada clip. Tempel URL YouTube di atas untuk memulai.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {clips.filter((c) => c.status === "completed").map((clip) => {
              const thumb =
                clip.video.thumbnailUrl || getYoutubeThumbnail(clip.video.youtubeUrl);
              return (
                <div
                  key={clip.exportId}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700"
                >
                  <div className="relative aspect-video bg-zinc-950">
                    <video
                      src={clip.downloadUrl}
                      poster={thumb}
                      controls
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                    <div className="absolute right-2 top-2">
                      <MenuButton
                        clip={clip}
                        email={session?.user?.email}
                        onDeleted={() => {
                          setClips((prev) => prev.filter((c) => c.exportId !== clip.exportId));
                          setToast("Clip dihapus");
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="truncate text-sm font-medium text-white">
                      {clip.highlightTitle}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {Math.floor(clip.startTime / 60)}:
                      {Math.floor(clip.startTime % 60)
                        .toString()
                        .padStart(2, "0")}
                      {" — "}
                      {Math.floor(clip.endTime / 60)}:
                      {Math.floor(clip.endTime % 60)
                        .toString()
                        .padStart(2, "0")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
