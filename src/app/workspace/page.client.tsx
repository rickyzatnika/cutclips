"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
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
  Play,
  Zap,
  MessageCircle,
  ChevronRight,
  Search,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

function getInitialBatchSize() {
  if (typeof window !== "undefined" && window.innerWidth < 640) return 2;
  return 15;
}

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
  viralityScore?: number;
  startTime: number;
  endTime: number;
  createdAt: number;
  video: {
    _id: string;
    youtubeUrl: string;
    title: string;
    thumbnailUrl?: string;
    duration?: number;
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
        className="rounded-lg bg-black/60 p-1.5 cursor-pointer text-white opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700"
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

const CATEGORY_STYLES: Record<string, string> = {
  funny: "bg-yellow-500/20 text-yellow-400",
  emotional: "bg-pink-500/20 text-pink-400",
  inspirational: "bg-purple-500/20 text-purple-400",
  shocking: "bg-red-500/20 text-red-400",
  educational: "bg-blue-500/20 text-blue-400",
  hook: "bg-emerald-500/20 text-emerald-400",
};

const CATEGORY_LABEL: Record<string, string> = {
  funny: "Lucu",
  emotional: "Emosional",
  inspirational: "Inspiratif",
  shocking: "Mengejutkan",
  educational: "Edukatif",
  hook: "Hook",
};

type HistoryItem = {
  highlight: {
    _id: Id<"highlights">;
    title: string;
    startTime: number;
    endTime: number;
    category: string;
    confidenceScore: number;
    viralityScore: number;
    reasoning: string;
    createdAt: number;
  };
  clipped: boolean;
  video: {
    _id: Id<"videos">;
    title: string;
    youtubeUrl: string;
    thumbnailUrl?: string;
  };
};

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
  const catStyle =
    CATEGORY_STYLES[clip.category] || "bg-zinc-800 text-zinc-400";
  const catLabel = CATEGORY_LABEL[clip.category] || clip.category;
  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-emerald-500/5">
      <div className="relative aspect-9/16 bg-zinc-950">
        <video
          src={clip.downloadUrl}
          poster={poster}
          controls
          preload="metadata"
          className="h-full w-full object-contain"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
          <div className="rounded-full bg-black/60 p-3">
            <Play className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="absolute right-2 top-2">
          <MenuButton
            clip={clip}
            email={email}
            onDeleted={() => {}}
            onRequestDelete={onRequestDelete}
          />
        </div>
      </div>
      <div className="p-3 relative">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {clip.highlightTitle}
          </h3>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${catStyle}`}
            >
              {catLabel}
            </span>
            {clip.viralityScore != null && (
              <span className="flex items-center gap-0.5 text-[10px] text-orange-400/70">
                <TrendingUp className="h-3 w-3" />
                {clip.viralityScore}
              </span>
            )}
          </div>
        </div>
        <p className="mt-1.5 truncate text-xs text-zinc-500">
          {clip.video.title}
        </p>
        <p className="mt-1 text-[10px] text-zinc-600">
          {new Date(clip.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
        <div className="absolute bottom-2 right-2"></div>
      </div>
    </div>
  );
});

export default function WorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>(
    searchParams.get("tab") || "all",
  );
  const [sortBy, setSortBy] = useState<string>("newest");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [batchSize] = useState(getInitialBatchSize);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Id<"highlights"> | null>(null);
  const userEmail = session?.user?.email;
  const userData = useQuery(
    api.users.getByEmail,
    userEmail ? { email: userEmail } : "skip",
  );
  const {
    results: clips,
    status: paginationStatus,
    loadMore: loadMoreClips,
  } = usePaginatedQuery(
    api.videos.listByUserWithClipsPaginated as any,
    userEmail ? { email: userEmail } : "skip",
    { initialNumItems: batchSize },
  ) as unknown as {
    results: Clip[] | undefined;
    status: "Loading" | "LoadingMore" | "CanLoadMore" | "Exhausted";
    loadMore: (n: number) => void;
  };
  const latestPayment = useQuery(
    api.payments.getLatestByUser,
    userEmail ? { email: userEmail } : "skip",
  );
  const prevStatus = useRef<string | null>(null);

  const highlightsData = useQuery(
    api.highlights.listAll,
    userEmail ? { email: userEmail } : "skip",
  ) as HistoryItem[] | undefined;

  const recentHighlights = useMemo(() => {
    if (!highlightsData) return undefined;
    return [...highlightsData]
      .sort((a, b) => b.highlight.createdAt - a.highlight.createdAt)
      .slice(0, 5);
  }, [highlightsData]);

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
      toast({ title: "Clip dihapus", variant: "success" });
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  };

  const handleGenerate = async (highlightId: Id<"highlights">) => {
    setGenerating(highlightId);
    try {
      const res = await fetch("/api/genclip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal");
      toast({ title: "Clip sedang dibuat!", variant: "success" });
      router.push("/workspace?tab=processing");
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Gagal",
        variant: "error",
      });
      setGenerating(null);
    }
  };

  const clipsSafe = clips || [];
  const completed = useMemo(
    () => clipsSafe.filter((c) => c.status === "completed"),
    [clipsSafe],
  );

  const aiInsightEl = useMemo(() => {
    const c = completed.length;
    const processing = clipsSafe.filter(
      (x) => x.status === "queued" || x.status === "processing",
    ).length;
    const credits = userData ? ((userData as any).credits ?? 0) : 0;
    const cats = completed.map((x) => x.category);
    const topCat =
      c > 0 && cats.length
        ? cats
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort(
              (a, b) =>
                cats.filter((v) => v === b).length -
                cats.filter((v) => v === a).length,
            )[0]
        : null;
    const topCatCount = topCat ? cats.filter((v) => v === topCat).length : 0;
    const totalDur = completed.reduce(
      (s, x) => s + (x.endTime - x.startTime),
      0,
    );
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
      seeds.push(
        `Sisa ${credits} kredit. Isi ulang agar proses clip tidak terhenti.`,
      );
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

    if (
      latestVideo &&
      latestVideo.length < 30 &&
      latestVideo.length > 0 &&
      c >= 2
    ) {
      seeds.push(`Clip terbaru dari: "${latestVideo}".`);
    }

    if (seeds.length === 0 && c > 0) {
      seeds.push(
        `${c} clip berhasil dibuat. Tempel URL YouTube baru untuk menambah koleksi.`,
      );
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
  }, [completed, clipsSafe, userData]);

  const filtered = useMemo(() => {
    let list =
      filterStatus === "processing"
        ? clipsSafe.filter(
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
  }, [clipsSafe, filterStatus, sortBy]);

  useEffect(() => {
    if (paginationStatus !== "CanLoadMore" || filterStatus === "processing")
      return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreClips?.(batchSize);
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [paginationStatus, filterStatus, loadMoreClips]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
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
            className="cursor-pointer rounded-xl bg-emerald-500 px-6 py-2 sm:py-4 text-base font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Analisis
          </button>
        </div>
      </form>

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
            {clips?.length ?? "..."}
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
              clipsSafe.filter(
                (c) => c.status === "queued" || c.status === "processing",
              ).length
            }
            )
          </button>
          <button
            onClick={() => setFilterStatus("history")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === "history"
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <List className="mr-1 inline h-3 w-3" />
            Riwayat
          </button>
        </div>
        {filterStatus !== "history" && (
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
        )}
      </div>

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
                const pct =
                  typeof clip.progress === "number"
                    ? Math.min(100, Math.max(0, Math.round(clip.progress)))
                    : 0;
                const label =
                  clip.status === "queued" ? PROGRESS_LABELS.queued : `${pct}%`;
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
                          style={{
                            width: `${clip.status === "queued" ? 0 : pct}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {filterStatus === "history" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Riwayat Terbaru
            </h2>
            <Link
              href="/workspace/history"
              className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Lihat selengkapnya
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {highlightsData === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Skeleton className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentHighlights!.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 px-6 py-14 text-center">
              <Search className="mx-auto mb-4 h-8 w-8 text-zinc-700" />
              <h3 className="text-base font-semibold text-white">
                Belum Ada Riwayat
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Analisis video YouTube untuk mulai melihat highlight.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentHighlights!.map((item) => {
                const h = item.highlight;
                const catLabel = CATEGORY_LABEL[h.category] || h.category;
                const catStyle =
                  CATEGORY_STYLES[h.category] || "bg-zinc-800 text-zinc-400";
                const fmtTime = (s: number) => {
                  const m = Math.floor(s / 60);
                  const sec = Math.floor(s % 60);
                  return `${m}:${sec.toString().padStart(2, "0")}`;
                };
                return (
                  <div
                    key={h._id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-white">
                            {h.title}
                          </h3>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${catStyle}`}
                          >
                            {catLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {item.video.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {fmtTime(h.startTime)} &mdash; {fmtTime(h.endTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {h.viralityScore}
                          </span>
                        </div>
                        {h.reasoning && (
                          <p className="mt-1 text-xs text-zinc-600 line-clamp-1">
                            <MessageCircle className="mr-1 inline h-3 w-3" />
                            {h.reasoning}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {item.clipped ? (
                          <span className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400">
                            <Zap className="h-3.5 w-3.5" />
                            Sudah
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGenerate(h._id)}
                            disabled={generating === h._id}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                          >
                            {generating === h._id ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                                Memproses
                              </>
                            ) : (
                              <>
                                <Zap className="h-4 w-4" />
                                Buat Clip
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filterStatus === "all" && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Clip Terbaru
            {completed.length > 0 && (
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({completed.length})
              </span>
            )}
          </h2>

          {clips === undefined ? (
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
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
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((clip) => (
                <ClipCard
                  key={clip.exportId}
                  clip={clip}
                  email={session?.user?.email}
                  onRequestDelete={(id) => setConfirmDeleteId(id)}
                />
              ))}
            </div>
          )}
          {(paginationStatus === "CanLoadMore" ||
            paginationStatus === "LoadingMore") && (
            <div
              ref={paginationStatus === "CanLoadMore" ? sentinelRef : undefined}
              className="flex justify-center py-6"
            >
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
            </div>
          )}
          {paginationStatus === "Exhausted" && filtered.length > 0 && (
            <div className="flex justify-center py-3 text-xs text-zinc-600"></div>
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
