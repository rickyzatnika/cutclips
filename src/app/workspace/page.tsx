"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Film,
  MoreVertical,
  Download,
  Trash2,
  Loader2,
  Video,
  Clock,
  TrendingUp,
  List,
  AlertTriangle,
  Sparkles,
  Coins,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

const BATCH_SIZE = 15;

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

const PROGRESS_LABELS: Record<string, string> = {
  queued: "Menunggu antrian",
  processing: "Memproses",
};

interface Clip {
  exportId: string;
  status: string;
  progress?: number;
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
    /(?:youtu\.be\/|v=|vi\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return "";
}

function getClipThumbnail(downloadUrl: string): string {
  return downloadUrl
    .replace(/\.mp4$/, ".jpg")
    .replace("/upload/", "/upload/so_0/");
}

function MenuButton({
  clip,
  email,
  onDeleted,
  onRequestDelete,
}: {
  clip: Clip;
  email?: string | null;
  onDeleted: () => void;
  onRequestDelete: (exportId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
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
            onClick={() => {
              setOpen(false);
              onRequestDelete(clip.exportId);
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

const ClipCard = React.memo(function ClipCard({
  clip,
  email,
  onRequestDelete,
}: {
  clip: Clip;
  email?: string | null;
  onRequestDelete: (id: string) => void;
}) {
  const poster = clip.downloadUrl ? getClipThumbnail(clip.downloadUrl) : "";
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700">
      <div className="relative aspect-9/16 bg-zinc-950">
        <video
          src={clip.downloadUrl}
          poster={poster}
          controls
          preload="metadata"
          className="h-full w-full object-contain"
        />
        <div className="absolute right-2 top-2">
          <MenuButton
            clip={clip}
            email={email}
            onDeleted={() => {}}
            onRequestDelete={onRequestDelete}
          />
        </div>
        <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white">
          {Math.floor(clip.startTime / 60)}:
          {Math.floor(clip.startTime % 60)
            .toString()
            .padStart(2, "0")}
          {" — "}
          {Math.floor(clip.endTime / 60)}:
          {Math.floor(clip.endTime % 60)
            .toString()
            .padStart(2, "0")}
        </div>
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-white">
          {clip.highlightTitle}
        </h3>
        <p className="mt-1 truncate text-xs text-zinc-600">
          {clip.video.title}
        </p>
        <p className="mt-1 text-[11px] text-zinc-700">
          {new Date(clip.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>
    </div>
  );
});

export default function WorkspacePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const userEmail = session?.user?.email;
  const userData = useQuery(
    api.users.getByEmail,
    userEmail ? { email: userEmail } : "skip",
  );
  const latestPayment = useQuery(
    api.payments.getLatestByUser,
    userEmail ? { email: userEmail } : "skip",
  );
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!latestPayment) return;
    const current = latestPayment.status;
    if (prevStatus.current === "pending" && current !== "pending") {
      if (current === "approved") {
        toast({
          title: "Pembayaran disetujui! 🎉",
          description: `${latestPayment.credits} kredit sudah ditambahkan.`,
          variant: "success",
        });
      } else if (current === "rejected") {
        toast({
          title: "Pembayaran ditolak",
          description: latestPayment.adminNote || "Silakan hubungi admin.",
          variant: "error",
        });
      }
    }
    prevStatus.current = current;
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
        if (data.value) {
          setClips((prev) => {
            const next = data.value as typeof prev;
            if (prev.length === next.length && prev.every((c, i) =>
              c.exportId === next[i].exportId && c.status === next[i].status && c.downloadUrl === next[i].downloadUrl
            )) {
              return prev;
            }
            return next;
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    setLoading(true);
    fetchClips();
  }, [fetchClips]);

  // Smart poll: every 3s while processing, stop when all done
  const hasProcessing = clips.some(
    (c) => c.status === "queued" || c.status === "processing",
  );
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(fetchClips, 3000);
    return () => clearInterval(interval);
  }, [hasProcessing, fetchClips]);

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const exportId = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      const res = await fetch("/api/delete-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportId, email: session?.user?.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setClips((prev) => prev.filter((c) => c.exportId !== exportId));
      toast({ title: "Clip dihapus", variant: "success" });
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  };

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [sortBy]);

  const completed = useMemo(
    () => clips.filter((c) => c.status === "completed"),
    [clips],
  );

  const aiInsightEl = useMemo(() => {
    const c = completed.length;
    const processing = clips.filter(
      (x) => x.status === "queued" || x.status === "processing",
    ).length;
    const credits = userData ? (userData as any).credits ?? 0 : 0;
    const cats = completed.map((x) => x.category);
    const topCat = c > 0 && cats.length
      ? cats
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort((a, b) => cats.filter((v) => v === b).length - cats.filter((v) => v === a).length)[0]
      : null;
    const topCatCount = topCat ? cats.filter((v) => v === topCat).length : 0;
    const totalDur = completed.reduce((s, x) => s + (x.endTime - x.startTime), 0);
    const avgDur = c > 0 ? Math.round(totalDur / c / 60) : 0;
    const latest =
      c > 0
        ? completed.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
        : null;
    const latestVideo = latest?.video?.title || "";
    const latestDaysAgo = latest
      ? Math.floor((Date.now() - latest.createdAt) / 86400000)
      : 0;

    const isNewbie = c <= 2;

    const seeds: string[] = [];

    if (processing > 0) {
      seeds.push(
        processing === 1
          ? `${processing} clip sedang diproses — akan muncul otomatis setelah selesai.`
          : `${processing} clip sedang diproses — bersabar sebentar ya.`,
      );
    }

    if (credits < 50 && !isNewbie) {
      seeds.push(`Sisa ${credits} kredit. Isi ulang agar proses clip tidak terhenti.`);
    }

    if (c === 0) {
      seeds.push("Tempel URL YouTube pertama untuk mulai membuat highlight.");
    } else if (c <= 2) {
      seeds.push(
        `${c} clip berhasil dibuat. Coba analisis video viral favorit untuk inspirasi.`,
      );
    } else if (c <= 5) {
      seeds.push(
        `${c} clip — lumayan! Fokus pada kualitas hook untuk hasil maksimal.`,
      );
    } else if (c <= 10) {
      seeds.push(`${c} clip — konsisten banget! 🔥 Pertahankan ritmenya.`);
    } else if (c <= 25) {
      seeds.push(
        `Total ${c} clip — Anda sudah pro! Saatnya eksplorasi konten baru. 🚀`,
      );
    } else {
      seeds.push(
        `${c} clip — kreator sejati! Konten Anda makin bervariasi. 🏆`,
      );
    }

    if (topCat && topCatCount >= 3) {
      const label: Record<string, string> = {
        funny: "Konten lucu 🎭",
        emotional: "Momen emosional 🎬",
        inspirational: "Konten inspiratif ✨",
        shocking: "Momen shocking ⚡",
        educational: "Konten edukasi 📚",
        hook: "Strong hooks 🎯",
      };
      seeds.push(
        `${label[topCat] || topCat} paling banyak menghasilkan clip — pertanda niche Anda.`,
      );
    }

    if (c >= 3 && totalDur >= 300) {
      seeds.push(
        `Total ${Math.round(totalDur / 60)} menit clip diproduksi — portofolio konten yang solid.`,
      );
    }

    if (c >= 3 && avgDur >= 1 && avgDur <= 3) {
      seeds.push(
        `Durasi rata-rata ${avgDur} menit — ideal untuk Shorts/Reels. 👍`,
      );
    } else if (c >= 3 && avgDur > 3) {
      seeds.push(
        `Durasi rata-rata ${avgDur} menit — coba versi lebih pendek untuk engagement lebih tinggi.`,
      );
    }

    if (latest && latestDaysAgo >= 7 && c >= 3) {
      seeds.push(
        `${latestDaysAgo} hari sejak clip terakhir. Saatnya upload video baru!`,
      );
    }

    if (latestVideo && latestVideo.length < 30 && latestVideo.length > 0 && c >= 2) {
      seeds.push(`Clip terbaru dari: "${latestVideo}".`);
    }

    if (seeds.length === 0 && c > 0) {
      seeds.push(`${c} clip berhasil dibuat. Tempel URL YouTube baru untuk menambah koleksi.`);
    }

    const insight = seeds.slice(0, 2).join(" ");
    if (!insight) return null;

    return (
      <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" />
          AI Insight
        </div>
        <p className="mt-1 text-sm text-zinc-400">{insight}</p>
      </div>
    );
  }, [completed, clips, userData]);

  const filtered = useMemo(() => {
    let list =
      filterStatus === "processing"
        ? clips.filter(
            (c) => c.status === "queued" || c.status === "processing",
          )
        : completed;
    if (sortBy === "newest")
      list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === "oldest")
      list = [...list].sort((a, b) => a.createdAt - b.createdAt);
    else if (sortBy === "title")
      list = [...list].sort((a, b) =>
        a.highlightTitle.localeCompare(b.highlightTitle),
      );
    return list;
  }, [clips, filterStatus, sortBy]);

  const visibleClips = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const hasMore = visibleCount < filtered.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filtered.length));
  }, [filtered.length]);

  useEffect(() => {
    if (!hasMore || filterStatus === "processing") return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, filterStatus, loadMore]);

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

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Kredit</p>
          <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-white">
            <Coins className="h-4 w-4 text-emerald-400" />
            {userData ? (userData as any).credits?.toLocaleString() : "..."}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Total Clip</p>
          <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-white">
            <Video className="h-4 w-4 text-emerald-400" />
            {clips.length || "..."}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Siap Download</p>
          <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-white">
            <Download className="h-4 w-4 text-emerald-400" />
            {completed.length || "..."}
          </p>
        </div>
      </div>

      {aiInsightEl}

      {/* Filter & Sort */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterStatus("processing")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === "processing"
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Loader2 className="mr-1 inline h-3 w-3" />
            Proses (
            {
              clips.filter(
                (c) => c.status === "queued" || c.status === "processing",
              ).length
            }
            )
          </button>
          <Link
            href="/workspace/history"
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <List className="h-3 w-3" />
            Riwayat
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
      {filterStatus !== "all" &&
        filterStatus === "processing" &&
        filtered.length > 0 && (
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Membuat Clip ({filtered.length})
              </h2>
            </div>
            <div className="space-y-3">
              {filtered.map((clip) => {
                const pct = typeof clip.progress === "number" ? Math.min(100, Math.max(0, Math.round(clip.progress))) : 0;
                const label =
                  clip.status === "queued"
                    ? PROGRESS_LABELS.queued
                    : `${pct}%`;
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
                      <span className="shrink-0 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                        {label}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                          style={{ width: `${clip.status === "queued" ? 0 : pct}%` }}
                        />
                      </div>
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
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
                >
                  <Skeleton className="aspect-9/16 w-full rounded-none" />
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : completed.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 px-6 py-14 text-center">
              <Film className="mx-auto mb-4 h-10 w-10 text-zinc-700" />
              <h3 className="text-base font-semibold text-white">
                Belum Ada Clip
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Tempel link YouTube pertama kamu, biarkan AI menemukan highlight
                terbaik dan buat clip viral dalam hitungan menit.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {visibleClips.map((clip) => (
                <ClipCard
                  key={clip.exportId}
                  clip={clip}
                  email={session?.user?.email}
                  onRequestDelete={(id) => setConfirmDeleteId(id)}
                />
              ))}
            </div>
          )}
          {filterStatus !== "processing" && hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
            </div>
          )}
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Konfirmasi Hapus
                </h3>
                <p className="text-xs text-zinc-400">
                  Clip ini akan dihapus permanen.
                </p>
              </div>
            </div>
            <p className="mb-6 text-sm text-zinc-500">
              Yakin ingin menghapus? Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="cursor-pointer rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Batal
              </button>
              <button
                onClick={executeDelete}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
