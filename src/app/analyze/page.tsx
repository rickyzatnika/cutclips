"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import UpgradeModal from "@/components/ui/upgrade-modal";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Flame,
  Sparkles,
  Lightbulb,
  Copy,
  Check,
  Coins,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { convexQuery } from "@/lib/convex-rest";
import type { Id } from "@convex/_generated/dataModel";

const CATEGORY_EMOJIS: Record<string, string> = {
  funny: "😂",
  emotional: "😢",
  inspirational: "💪",
  shocking: "😱",
  educational: "📚",
  hook: "🎣",
};

const CATEGORY_LABELS: Record<string, string> = {
  funny: "Lucu",
  emotional: "Emosional",
  inspirational: "Inspiratif",
  shocking: "Mengejutkan",
  educational: "Edukatif",
  hook: "Hook Kuat",
};

interface Highlight {
  _id?: string;
  startTime: number;
  endTime: number;
  title: string;
  category: string;
  confidenceScore: number;
  viralityScore: number;
  reasoning: string;
}

type PollStatus = "loading" | "processing" | "done" | "error";

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const url = searchParams.get("url");

  const [pollStatus, setPollStatus] = useState<PollStatus>("loading");
  const [statusMessage, setStatusMessage] = useState("Menyiapkan analisis...");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [videoInfo, setVideoInfo] = useState<{
    title: string;
    duration: number;
    thumbnailUrl?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("default");
  const [captionEnabled, setCaptionEnabled] = useState(true);
  const [hooksMap, setHooksMap] = useState<Record<string, string[]>>({});
  const [loadingHooks, setLoadingHooks] = useState<Record<string, boolean>>({});
  const [copiedHook, setCopiedHook] = useState<string | null>(null);
  const [creditsBlocked, setCreditsBlocked] = useState(false);
  const [creditsChecking, setCreditsChecking] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated" || !session?.user?.email) {
      setCreditsChecking(false);
      return;
    }

    convexQuery("users:getByEmail", { email: session.user.email })
      .then((user) => {
        const userData = user as { credits?: number } | null;
        if (userData && typeof userData.credits === "number" && userData.credits <= 0) {
          setCreditsBlocked(true);
        }
      })
      .catch(() => {})
      .finally(() => setCreditsChecking(false));
  }, [session, status]);

  // Start analysis job
  useEffect(() => {
    if (status === "loading") return;
    if (!url) {
      setError("No URL provided");
      setPollStatus("error");
      return;
    }
    if (creditsChecking) return;
    if (creditsBlocked) return;
    if (jobId) return;
    if (pollStatus === "done" || pollStatus === "error") return;

    let cancelled = false;

    setStatusMessage("Mengirim video untuk dianalisis...");

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Gagal memulai analisis");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setJobId(data.jobId);
          setStatusMessage("Menunggu antrian analisis...");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setPollStatus("error");
        }
      });

    return () => { cancelled = true; };
  }, [url, creditsChecking, creditsBlocked, session, status, jobId, pollStatus]);

  // Reactive job status via Convex
  const jobDoc = useQuery(
    api.analyzeJobs.getById,
    jobId ? { jobId: jobId as Id<"analyzeJobs"> } : "skip",
  );

  useEffect(() => {
    if (!jobDoc) return;

    if (jobDoc.status === "processing") {
      setPollStatus("processing");
      setStatusMessage("Menganalisis video...");
    } else if (jobDoc.status === "completed") {
      setVideoInfo({
        title: jobDoc.title || "YouTube Video",
        duration: jobDoc.duration || 600,
      });

      const detectedHighlights: Highlight[] = (jobDoc.highlights || []).map(
        (h: Record<string, unknown>) => ({
          _id: `h-${Math.random().toString(36).slice(2)}`,
          startTime: h.startTime as number,
          endTime: h.endTime as number,
          title: String(h.title || ""),
          category: String(h.category || "hook"),
          confidenceScore: Number(h.confidenceScore) || 0,
          viralityScore: Number(h.viralityScore) || 0,
          reasoning: String(h.reasoning || ""),
        }),
      );

      setHighlights(detectedHighlights);
      setPollStatus("done");
    } else if (jobDoc.status === "failed") {
      setError(jobDoc.error || "Analisis gagal");
      setPollStatus("error");
    }
  }, [jobDoc]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const generateAll = async () => {
    if (!highlights.length || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/genclip/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: url,
          videoTitle: videoInfo?.title,
          includeCaptions: captionEnabled,
          template: selectedTemplate,
          highlights: highlights.map((h) => ({
            startTime: h.startTime,
            endTime: h.endTime,
            title: h.title,
            category: h.category,
            confidenceScore: h.confidenceScore,
            viralityScore: h.viralityScore,
            reasoning: h.reasoning,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch generation failed");
      router.push("/workspace");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      setGenerating(false);
    }
  };

  const generateHooks = async (highlight: Highlight) => {
    const key = `${highlight.startTime}-${highlight.endTime}`;
    if (hooksMap[key] || loadingHooks[key]) return;
    setLoadingHooks((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: highlight.title,
          reasoning: highlight.reasoning,
          category: highlight.category,
          email: session?.user?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) { setUpgradeModalOpen(true); return; }
        throw new Error(data.error);
      }
      setHooksMap((prev) => ({ ...prev, [key]: data.hooks }));
    } catch {
      // silent
    } finally {
      setLoadingHooks((prev) => ({ ...prev, [key]: false }));
    }
  };

  const copyHook = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHook(text);
      setTimeout(() => setCopiedHook(null), 2000);
    } catch {}
  };

  const generateClipUrl = (highlight: Highlight) => {
    const params = new URLSearchParams({
      videoUrl: url || "",
      start: String(highlight.startTime),
      end: String(highlight.endTime),
      title: highlight.title,
      category: highlight.category,
      confidence: String(highlight.confidenceScore),
      virality: String(highlight.viralityScore),
      reasoning: highlight.reasoning,
    });
    return `/generate?${params.toString()}`;
  };

  if (creditsBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <Coins className="h-7 w-7 text-amber-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Kredit Tidak Mencukupi</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Saldo kredit kamu habis. Isi ulang untuk melanjutkan analisis dan generate clip.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/workspace/billing"
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Isi Credit
            </Link>
            <button
              onClick={() => router.push("/")}
              className="w-full cursor-pointer rounded-xl border border-zinc-700 py-3 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error && pollStatus === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 pb-16">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-xl font-semibold text-white">Analisis Gagal</h2>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Coba URL Lain
          </Link>
        </div>
      </div>
    );
  }

  if (pollStatus === "loading" || pollStatus === "processing") {
    return (
      <div className="min-h-screen bg-black pb-16">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Skeleton className="mb-6 h-4 w-20" />
          <div className="mb-8 space-y-2">
            <Skeleton className="h-6 w-72" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <div className="flex gap-3">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-10 w-24 shrink-0 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-600">
            {statusMessage} — Biasanya 30-60 detik
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-16">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>

        {videoInfo && (
          <div className="mb-8">
            <h1 className="truncate text-xl font-bold text-white">{videoInfo.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {Math.floor(videoInfo.duration / 60)}m {Math.floor(videoInfo.duration % 60)}s
            </p>
          </div>
        )}

        {highlights.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {highlights.length} Highlight Ditemukan
              </h2>
              <span className="text-xs text-zinc-500">
                Diurutkan berdasarkan Skor Viral
              </span>
            </div>

            {session && (
              <>
                <div className="mb-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Caption TikTok Style</span>
                    <button
                      onClick={() => setCaptionEnabled(!captionEnabled)}
                      className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${
                        captionEnabled ? "bg-emerald-500" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          captionEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Template Clip</label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[
                        { id: "default", label: "Default", desc: "Boxblur + caption bawah", icon: "🎬" },
                        { id: "podcast", label: "Podcast", desc: "Blur ringan + caption tengah", icon: "🎙️" },
                        { id: "minimal", label: "Minimal", desc: "BG gelap + caption tipis", icon: "✨" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                            selectedTemplate === t.id
                              ? "border-emerald-500 bg-emerald-500/10"
                              : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                          }`}
                        >
                          <span className="text-lg">{t.icon}</span>
                          <p className="mt-1 text-xs font-medium text-white">{t.label}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={generateAll}
                  disabled={generating}
                  className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-4 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating
                    ? `Membuat ${highlights.length} clip...`
                    : `Generate Semua ${highlights.length} Clip (${highlights.length * 20} kredit)`}
                </button>
              </>
            )}

            <div className="space-y-4">
              {highlights.map((h) => (
                <div
                  key={h._id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-emerald-400">
                        {h.viralityScore}
                      </span>
                      <span className="text-sm text-zinc-500">/ 100</span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                      {CATEGORY_EMOJIS[h.category] || "🏷️"}
                      {CATEGORY_LABELS[h.category] || h.category}
                    </span>
                  </div>

                  <h3 className="mb-1 text-base font-semibold text-white">
                    {h.title}
                  </h3>

                  <p className="mb-2 text-sm text-zinc-500">
                    {formatTime(h.startTime)} — {formatTime(h.endTime)}
                    <span className="ml-2 text-zinc-600">
                      ({Math.round(h.endTime - h.startTime)}s)
                    </span>
                  </p>

                  <p className="mb-4 text-sm text-zinc-400">
                    {h.reasoning}
                  </p>

                  <div className="mb-4">
                    {hooksMap[`${h.startTime}-${h.endTime}`] ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-emerald-400">Hook Viral</p>
                        {hooksMap[`${h.startTime}-${h.endTime}`].map((hook, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
                          >
                            <span className="mt-0.5 shrink-0 text-xs text-zinc-600">
                              {i + 1}
                            </span>
                            <p className="flex-1 text-sm text-zinc-300">{hook}</p>
                            <button
                              onClick={() => copyHook(hook)}
                              className="mt-0.5 shrink-0 cursor-pointer text-zinc-600 hover:text-white"
                            >
                              {copiedHook === hook ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : loadingHooks[`${h.startTime}-${h.endTime}`] ? (
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generate hook...
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={generateClipUrl(h)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
                    >
                      <Flame className="h-4 w-4" />
                      Buat Clip
                    </Link>
                    <button
                      onClick={() => generateHooks(h)}
                      disabled={loadingHooks[`${h.startTime}-${h.endTime}`]}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white disabled:opacity-50"
                    >
                      <Lightbulb className="h-4 w-4" />
                      Hook
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!session && (
              <p className="text-center text-xs text-zinc-600">
                Masuk untuk generate semua {highlights.length} clip sekaligus (hanya{" "}
                <span className="text-emerald-400">{highlights.length * 20} kredit</span>).{" "}
                <Link href="/login" className="text-emerald-400 hover:underline">
                  Masuk
                </Link>
              </p>
            )}
          </div>
        )}

        {highlights.length === 0 && pollStatus === "done" && (
          <div className="text-center text-zinc-500">
            Tidak ada highlight ditemukan. Coba video lain.
          </div>
        )}
      </div>
      <UpgradeModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black pb-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
