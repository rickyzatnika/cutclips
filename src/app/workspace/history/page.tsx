"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Search,
  Film,
  Youtube,
  Zap,
  Clock,
  TrendingUp,
  Sparkles,
  MessageCircle,
  Trash2,
  CheckSquare,
  Square,
  X,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

const BATCH_SIZE = 3;

function getYoutubeThumbnail(url: string): string {
  const m = url.match(
    /(?:youtu\.be\/|v=|vi\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return "";
}

const CATEGORY_LABELS: Record<string, string> = {
  funny: "Lucu",
  emotional: "Emosional",
  inspirational: "Inspiratif",
  shocking: "Mengejutkan",
  educational: "Edukatif",
  hook: "Hook",
};

type UnclippedItem = {
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
  video: {
    _id: Id<"videos">;
    title: string;
    youtubeUrl: string;
    thumbnailUrl?: string;
  };
};

type ConfirmAction =
  | { type: "single"; highlightId: Id<"highlights"> }
  | { type: "batch" };

export default function HistoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const email = session?.user?.email;
  const deleteHighlight = useMutation(api.highlights.remove);
  const deleteBatch = useMutation(api.highlights.removeBatch);

  const rawData = useQuery(
    api.highlights.listUnclipped,
    email ? { email } : "skip",
  ) as UnclippedItem[] | undefined;

  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState<Id<"highlights"> | null>(null);
  const [selected, setSelected] = useState<Set<Id<"highlights">>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    if (!rawData) return undefined;
    let list = [...rawData];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.highlight.title.toLowerCase().includes(q) ||
          item.video.title.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => b.highlight.createdAt - a.highlight.createdAt);
    return list;
  }, [rawData, search]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      Id<"videos">,
      {
        video: UnclippedItem["video"];
        highlights: UnclippedItem["highlight"][];
      }
    >();
    for (const item of data) {
      const key = item.video._id;
      if (!map.has(key)) {
        map.set(key, { video: item.video, highlights: [] });
      }
      map.get(key)!.highlights.push(item.highlight);
    }
    return Array.from(map.values());
  }, [data]);

  const visibleGroups = useMemo(
    () => grouped.slice(0, visibleCount),
    [grouped, visibleCount],
  );
  const hasMore = visibleCount < grouped.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, grouped.length));
  }, [grouped.length]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [search]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  const toggleSelect = (id: Id<"highlights">) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selected.size === data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((item) => item.highlight._id)));
    }
  };

  const executeDelete = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === "single") {
        await deleteHighlight({ highlightId: confirm.highlightId });
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(confirm.highlightId);
          return next;
        });
        toast({ title: "Highlight dihapus", variant: "success" });
      } else {
        await deleteBatch({ highlightIds: Array.from(selected) });
        setSelected(new Set());
        toast({
          title: `${selected.size} highlight dihapus`,
          variant: "success",
        });
      }
    } catch {
      toast({ title: "Gagal menghapus", variant: "error" });
    } finally {
      setConfirm(null);
    }
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
      router.push("/workspace");
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Gagal",
        variant: "error",
      });
      setGenerating(null);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Highlight Belum Di-Clip
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Highlight yang belum kamu buat jadi clip. Klik &quot;Buat Clip&quot;
          untuk mulai generate.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari highlight atau video..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {data && data.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 cursor-pointer"
            >
              {selected.size === data.length ? (
                <CheckSquare className="h-4 w-4 text-emerald-400" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Pilih Semua
            </button>
          )}
          {selected.size > 0 && (
            <button
              onClick={() => setConfirm({ type: "batch" })}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Hapus {selected.size}
            </button>
          )}
        </div>
      </div>

      {!data ? (
        <div className="space-y-8">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
                <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-3">
                <Skeleton className="h-10 w-16 rounded-lg" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-16 rounded-full" />
                        </div>
                        <div className="flex gap-3">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 p-12 text-center">
          <Film className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {search
              ? "Tidak ditemukan"
              : "Semua highlight sudah di-clip! Analisis video baru untuk mendapatkan lebih banyak highlight."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleGroups.map(({ video, highlights }) => {
            const thumb =
              video.thumbnailUrl || getYoutubeThumbnail(video.youtubeUrl);
            return (
              <div key={video._id}>
                <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-3">
                  <img
                    src={thumb}
                    alt={video.title}
                    className="h-10 w-16 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/analyze?url=${encodeURIComponent(video.youtubeUrl)}`}
                      className="text-sm font-medium text-white hover:text-emerald-400 transition-colors"
                    >
                      {video.title}
                    </Link>
                  </div>
                  <a
                    href={video.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-zinc-500 hover:text-white transition-colors"
                  >
                    <Youtube className="h-4 w-4" />
                  </a>
                </div>
                <div className="space-y-2">
                  {highlights.map((h) => {
                    const checked = selected.has(h._id);
                    return (
                      <div
                        key={h._id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleSelect(h._id)}
                            className="mt-0.5 shrink-0 cursor-pointer text-zinc-600 hover:text-white transition-colors"
                          >
                            {checked ? (
                              <CheckSquare className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-sm font-medium text-white">
                                {h.title}
                              </h3>
                              <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                                {CATEGORY_LABELS[h.category] || h.category}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(h.startTime)} &mdash;{" "}
                                {formatTime(h.endTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                Virality {h.viralityScore}
                              </span>
                              <span className="flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Confidence {h.confidenceScore}
                              </span>
                            </div>
                            {h.reasoning && (
                              <p className="mt-1 text-xs text-zinc-600 line-clamp-1">
                                <MessageCircle className="mr-1 inline h-3 w-3" />
                                {h.reasoning}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleGenerate(h._id)}
                              disabled={generating === h._id}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
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
                            <button
                              onClick={() => setConfirm({ type: "single", highlightId: h._id })}
                              className="cursor-pointer rounded-lg p-2 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="text-xs text-zinc-600">{h.endTime - h.startTime}s</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
            </div>
          )}
        </div>
      )}

      {confirm && (
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
                  {confirm.type === "batch"
                    ? `${selected.size} highlight akan dihapus permanen.`
                    : "Highlight ini akan dihapus permanen."}
                </p>
              </div>
            </div>
            <p className="mb-6 text-sm text-zinc-500">
              Yakin ingin menghapus? Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
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
