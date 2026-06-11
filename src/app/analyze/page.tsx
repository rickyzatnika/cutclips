"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Flame,
  Sparkles,
} from "lucide-react";

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
  const { data: session } = useSession();
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!url) {
      setError("No URL provided");
      setPollStatus("error");
      return;
    }

    let cancelled = false;

    const startAnalysis = async () => {
      try {
        setStatusMessage("Mengirim video untuk dianalisis...");

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Gagal memulai analisis");
        }

        const { jobId } = await res.json();
        if (cancelled) return;

        setStatusMessage("Menunggu antrian analisis...");

        intervalRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/analyze-status/${jobId}`);
            if (!pollRes.ok) {
              const data = await pollRes.json();
              throw new Error(data.error || "Gagal mendapat status");
            }

            const job = await pollRes.json();
            if (cancelled) return;

            if (job.status === "processing") {
              setPollStatus("processing");
              setStatusMessage("Menganalisis video...");
            } else if (job.status === "completed") {
              if (intervalRef.current) clearInterval(intervalRef.current);

              setVideoInfo({
                title: job.title || "YouTube Video",
                duration: job.duration || 600,
              });

              const detectedHighlights: Highlight[] = (job.highlights || []).map(
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
            } else if (job.status === "failed") {
              if (intervalRef.current) clearInterval(intervalRef.current);
              throw new Error(job.error || "Analisis gagal");
            }
          } catch (pollErr) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (!cancelled) {
              const msg = pollErr instanceof Error ? pollErr.message : "Gagal memeriksa status";
              setError(msg);
              setPollStatus("error");
            }
          }
        }, 2000);

      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Analysis failed";
          setError(msg);
          setPollStatus("error");
        }
      }
    };

    startAnalysis();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [url]);

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
      router.push("/workspace");
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
      <div className="flex min-h-screen items-center justify-center bg-black px-4 pb-16">
        <div className="w-full max-w-md text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-400" />
          <p className="mt-4 text-sm text-zinc-400">{statusMessage}</p>
          <p className="mt-2 text-xs text-zinc-600">Proses ini biasanya memakan waktu 30-60 detik</p>
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

        {highlights.length === 0 && pollStatus === "done" && (
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
        <div className="flex min-h-screen items-center justify-center bg-black pb-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
