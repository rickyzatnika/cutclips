"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Flame,
  Sparkles,
} from "lucide-react";

type ProgressStep = {
  id: string;
  label: string;
  status: "waiting" | "processing" | "done" | "error";
};

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

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const url = searchParams.get("url");

  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: "transcript", label: "Mengambil Transkrip", status: "waiting" },
    { id: "funny", label: "Mencari Momen Lucu", status: "waiting" },
    { id: "emotional", label: "Mencari Momen Emosional", status: "waiting" },
    { id: "shocking", label: "Mencari Momen Mengejutkan", status: "waiting" },
    { id: "educational", label: "Mencari Insight Edukatif", status: "waiting" },
    { id: "ranking", label: "Meranking Highlight", status: "waiting" },
  ]);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [videoInfo, setVideoInfo] = useState<{
    title: string;
    duration: number;
    thumbnailUrl?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!url) {
      setError("No URL provided");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const analyze = async () => {
      try {
        updateStep("transcript", "processing");
        await delay(800);

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Analysis failed");
        }

        const data = await res.json();
        if (cancelled) return;

        updateStep("transcript", "done");
        setVideoInfo({
          title: data.title,
          duration: data.duration,
          thumbnailUrl: data.thumbnailUrl,
        });

        const detectSteps = ["funny", "emotional", "shocking", "educational"];
        for (const stepId of detectSteps) {
          if (cancelled) return;
          updateStep(stepId, "processing");
          await delay(600);
          updateStep(stepId, "done");
        }

        updateStep("ranking", "processing");
        await delay(500);

        const detectedHighlights: Highlight[] = (data.highlights || []).map(
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
        updateStep("ranking", "done");
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Analysis failed";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    analyze();
    return () => { cancelled = true; };
  }, [url]);

  const updateStep = (id: string, status: ProgressStep["status"]) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      router.push("/app");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      setGenerating(false);
    }
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

  if (error && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
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

  return (
    <div className="min-h-screen bg-black">
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
            <h1 className="text-xl font-bold text-white">{videoInfo.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {Math.floor(videoInfo.duration / 60)}m {Math.floor(videoInfo.duration % 60)}s
            </p>
          </div>
        )}

        {loading && (
          <div className="mb-8 space-y-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                {step.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                ) : step.status === "processing" ? (
                  <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-emerald-400" />
                ) : (
                  <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-zinc-700" />
                )}
                <span
                  className={`text-sm ${
                    step.status === "done"
                      ? "text-zinc-300"
                      : step.status === "processing"
                        ? "text-white"
                        : "text-zinc-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {!loading && highlights.length > 0 && (
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

                  <Link
                    href={generateClipUrl(h)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
                  >
                    <Flame className="h-4 w-4" />
                    Buat Clip
                  </Link>
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

        {!loading && highlights.length === 0 && !error && (
          <div className="text-center text-zinc-500">
            Tidak ada highlight ditemukan. Coba video lain.
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
