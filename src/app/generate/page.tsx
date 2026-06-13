"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Download,
  LogIn,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ExportStatus =
  | "idle"
  | "saving"
  | "saved"
  | "exporting"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

function GenerateContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const videoUrl = searchParams.get("videoUrl") || "";
  const startTime = parseFloat(searchParams.get("start") || "0");
  const endTime = parseFloat(searchParams.get("end") || "0");
  const title = searchParams.get("title") || "Untitled";
  const category = searchParams.get("category") || "hook";
  const confidenceScore = parseInt(searchParams.get("confidence") || "80");
  const viralityScore = parseInt(searchParams.get("virality") || "80");
  const reasoning = searchParams.get("reasoning") || "";

  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState("");
  const [exportId, setExportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [queueInfo, setQueueInfo] = useState<{
    ahead: number;
    estimatedSeconds: number;
  } | null>(null);
  const [progress, setProgress] = useState(0);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState("default");
  const [captionEnabled, setCaptionEnabled] = useState(true);
  const [sumberVideo, setSumberVideo] = useState("");
  // Auto-save highlight on mount when logged in
  useEffect(() => {
    if (!session || !videoUrl || !startTime || !endTime) return;
    if (status !== "idle") return;

    setStatus("saving");

    fetch("/api/genclip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        youtubeUrl: videoUrl,
        startTime,
        endTime,
        title,
        category,
        confidenceScore,
        viralityScore,
        reasoning,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setHighlightId(data.highlightId);
        setStatus("saved");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("failed");
      });
  }, [
    session,
    videoUrl,
    startTime,
    endTime,
    title,
    category,
    confidenceScore,
    viralityScore,
    reasoning,
    status,
  ]);

  const startExport = useCallback(async () => {
    if (!highlightId) return;
    setStatus("exporting");

    try {
      const res = await fetch("/api/genclip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          highlightId,
          title,
          includeCaptions: captionEnabled,
          template: selectedTemplate,
          sumberVideo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create clip");
      }

      setExportId(data.exportId);
      setStatus("queued");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setError(msg);
      setStatus("failed");
    }
  }, [highlightId, title, captionEnabled, selectedTemplate, sumberVideo]);

  // Poll export status
  useEffect(() => {
    if (!exportId || status === "completed" || status === "failed") return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/export-status/${exportId}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to check status");
        if (cancelled) return;

        setStatus(data.status);
        if (data.progress != null) setProgress(data.progress);
        if (data.queue) setQueueInfo(data.queue);

        if (data.status === "completed") {
          setDownloadUrl(data.downloadUrl);
        } else if (data.status === "failed") {
          setError(data.error || "Clip generation failed");
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Polling failed";
          setError(msg);
          setStatus("failed");
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [exportId, status]);

  useEffect(() => {
    if (status !== "processing") {
      setDisplayedProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setDisplayedProgress((prev) => {
        if (prev < progress) {
          const diff = progress - prev;
          return Math.min(prev + Math.max(1, Math.ceil(diff * 0.1)), progress);
        }
        return Math.min(prev + 1, 95);
      });
    }, 700);
    return () => clearInterval(interval);
  }, [status, progress]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!videoUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 pb-16">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-zinc-500" />
          <h2 className="mt-4 text-xl font-semibold text-white">
            Tidak Ada Clip Dipilih
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Kembali dan pilih highlight untuk dibuat.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 pb-16">
        <div className="w-full max-w-md text-center">
          <LogIn className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-4 text-xl font-semibold text-white">
            Masuk untuk Membuat Clip
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Kamu perlu masuk untuk membuat dan mengunduh clip. Daftar dapat 100
            kredit gratis.
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={() =>
                signIn("google", { callbackUrl: window.location.href })
              }
              className="w-full cursor-pointer rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Masuk dengan Google
            </button>
            <Link
              href={`/?url=${encodeURIComponent(videoUrl)}`}
              className="block text-sm text-zinc-500 hover:text-white"
            >
              <ArrowLeft className="mr-1 inline h-4 w-4" />
              Coba video lain
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && status === "failed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 pb-16">
        <div className="w-full max-w-md text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-xl font-semibold text-white">Gagal</h2>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
          <button
            onClick={startExport}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-16">
      <div className="mx-auto max-w-lg px-4 py-12">
        <Link
          href="/workspace"
          className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke workspace
        </Link>

        <div className="mb-6">
          <h1 className="truncate text-lg font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatTime(startTime)} — {formatTime(endTime)} (
            {Math.round(endTime - startTime)}s)
          </p>
        </div>

        {status === "saving" && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-16 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        )}

        {status === "saved" && (
          <div className="text-center">
            <p className="mb-2 text-sm text-zinc-400">
              Highlight tersimpan! Buat clip seharga{" "}
              <strong className="text-white">20 kredit</strong>.
            </p>

            <div className="mb-6 space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📎</span>
                  <span className="text-sm text-zinc-400">Nama Sumber</span>
                  <span className="text-[10px] text-zinc-600">(opsional)</span>
                </div>
                <input
                  type="text"
                  value={sumberVideo}
                  onChange={(e) => setSumberVideo(e.target.value)}
                  placeholder="Contoh: Mas Aji / CNBC Indonesia"
                  className="mt-1.5 w-full bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <span className="text-sm text-zinc-400">
                  Caption TikTok Style
                </span>
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
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <label className="text-sm text-zinc-400">Template</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    {
                      id: "default",
                      label: "Default",
                      desc: "Boxblur + caption bawah",
                      icon: "🎬",
                    },
                    {
                      id: "podcast",
                      label: "Podcast",
                      desc: "Blur ringan + caption tengah",
                      icon: "🎙️",
                    },
                    {
                      id: "minimal",
                      label: "Minimal",
                      desc: "BG gelap + caption tipis",
                      icon: "✨",
                    },
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
                      <p className="mt-1 text-xs font-medium text-white">
                        {t.label}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        {t.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={startExport}
              className="block mx-auto cursor-pointer rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Buat Clip
            </button>
          </div>
        )}

        {(status === "exporting" ||
          status === "queued" ||
          status === "processing") && (
          <div className="space-y-4 scale-90">
            <Skeleton className="aspect-9/16 w-full max-w-xs mx-auto rounded-2xl" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-white">
                {status === "exporting"
                  ? "Membuat clip..."
                  : status === "queued"
                    ? "Clip dalam antrian..."
                    : "Memproses clip..."}
              </h2>
              {status === "queued" && queueInfo ? (
                <p className="text-sm text-zinc-500">
                  {queueInfo.ahead > 0
                    ? `${queueInfo.ahead} antrian di depan. Estimasi ${Math.ceil(queueInfo.estimatedSeconds / 60)} menit.`
                    : "Kamu berikutnya! Sebentar lagi..."}
                </p>
              ) : (
                <div className="mx-auto max-w-sm space-y-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(0, displayedProgress))}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm text-zinc-500">
                    {Math.round(Math.min(100, Math.max(0, displayedProgress)))}%
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {status === "completed" && downloadUrl && (
          <div className="space-y-5 scale-90">
            <div className="mx-auto max-w-xs overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              <video
                src={downloadUrl}
                controls
                autoPlay
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
            <div className="flex items-center justify-center gap-3">
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
              >
                <Download className="h-4 w-4" />
                Unduh Clip
              </a>
            </div>
            <p className="text-center text-xs text-zinc-600">
              Clip tersimpan ke workspace kamu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black pb-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <GenerateContent />
    </Suspense>
  );
}
