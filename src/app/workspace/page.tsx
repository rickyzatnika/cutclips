"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Film, MoreVertical, Download, Trash2, Loader2, CheckCircle2, Cloud, Film as FilmIcon, Video, Timer, Clock, TrendingUp, List } from "lucide-react";
import { useToast } from "@/components/ui/toast";

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
                const res = await fetch("/api/delete-clip", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ exportId: clip.exportId, email }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Delete failed");
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
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const userEmail = session?.user?.email;
  const latestPayment = useQuery(api.payments.getLatestByUser, userEmail ? { email: userEmail } : "skip");
  const shownPaymentId = useRef<string | null>(null);

  useEffect(() => {
    if (!latestPayment) return;
    if (latestPayment.status === "pending") return;
    if (shownPaymentId.current === latestPayment._id) return;
    shownPaymentId.current = latestPayment._id;
    if (latestPayment.status === "approved") {
      toast({ title: "Pembayaran disetujui! 🎉", description: `${latestPayment.credits} kredit sudah ditambahkan.`, variant: "success" });
    } else if (latestPayment.status === "rejected") {
      toast({ title: "Pembayaran ditolak", description: latestPayment.adminNote || "Silakan hubungi admin.", variant: "error" });
    }
  }, [latestPayment]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  };

  const completed = useMemo(() => clips.filter((c) => c.status === "completed"), [clips]);

  const filtered = useMemo(() => {
    let list = filterStatus === "processing"
      ? clips.filter((c) => c.status === "queued" || c.status === "processing")
      : completed;
    if (sortBy === "newest") list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === "oldest") list = [...list].sort((a, b) => a.createdAt - b.createdAt);
    else if (sortBy === "title") list = [...list].sort((a, b) => a.highlightTitle.localeCompare(b.highlightTitle));
    return list;
  }, [clips, filterStatus, sortBy]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
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

      {/* Filter & Sort */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === "all" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterStatus("processing")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === "processing" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Loader2 className="mr-1 inline h-3 w-3" />
            Proses ({clips.filter((c) => c.status === "queued" || c.status === "processing").length})
          </button>
          <Link
            href="/workspace/history"
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <List className="h-3 w-3" />
            Riwayat Video
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-zinc-600" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 outline-none transition-colors focus:border-emerald-500"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
            <option value="title">A-Z</option>
          </select>
        </div>
      </div>

      {/* Processing clips */}
      {filterStatus !== "all" && filterStatus === "processing" && filtered.length > 0 && (
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Membuat Clip ({filtered.length})
            </h2>
          </div>
          <div className="space-y-3">
            {filtered.map((clip) => {
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
      )}

      {/* Completed clips */}
      {filterStatus !== "processing" && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Clip Terbaru
            {completed.length > 0 && (
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({completed.length})
              </span>
            )}
          </h2>

          {loading ? (
            <div className="rounded-2xl border border-zinc-800 p-12 text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-zinc-600" />
              <p className="text-sm text-zinc-500">Memuat...</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 p-12 text-center">
              <Film className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">
                Belum ada clip. Tempel URL YouTube di atas untuk memulai.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {filtered.map((clip) => {
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
                            toast({ title: "Clip dihapus", variant: "success" });
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
      )}
    </div>
  );
}
