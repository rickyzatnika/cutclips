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

type ExportStatus = "idle" | "saving" | "saved" | "exporting" | "queued" | "processing" | "completed" | "failed";

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
  }, [session, videoUrl, startTime, endTime, title, category, confidenceScore, viralityScore, reasoning, status]);

  const startExport = useCallback(async () => {
    if (!highlightId) return;
    setStatus("exporting");

    try {
      const res = await fetch("/api/genclip", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId, title }),
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
  }, [highlightId, title]);

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
    return () => { cancelled = true; clearInterval(interval); };
  }, [exportId, status]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!videoUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-zinc-500" />
          <h2 className="mt-4 text-xl font-semibold text-white">No Clip Selected</h2>
          <p className="mt-2 text-sm text-zinc-400">Go back and select a highlight to generate.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
            <ArrowLeft className="h-4 w-4" />
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md text-center">
          <LogIn className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-4 text-xl font-semibold text-white">Sign in to Generate Clips</h2>
          <p className="mt-2 text-sm text-zinc-400">
            You need to sign in to generate and download clips. Signing up gives you 100 free credits.
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={() => signIn("google", { callbackUrl: window.location.href })}
              className="w-full cursor-pointer rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Sign in with Google
            </button>
            <Link href={`/?url=${encodeURIComponent(videoUrl)}`} className="block text-sm text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-1 inline h-4 w-4" />
              Try another video
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && status === "failed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-xl font-semibold text-white">Failed</h2>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
          <button
            onClick={startExport}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-lg px-4 py-12">
        <Link
          href="/app"
          className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </Link>

        <div className="mb-6">
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatTime(startTime)} — {formatTime(endTime)} ({Math.round(endTime - startTime)}s)
          </p>
        </div>

        {status === "saving" && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving highlight...
          </div>
        )}

        {status === "saved" && (
          <div className="text-center">
            <p className="mb-2 text-sm text-zinc-400">
              Highlight saved! Generate the clip for <strong className="text-white">20 credits</strong>.
            </p>
            <p className="mb-4 text-xs text-zinc-600">
              You have enough credits to do this.
            </p>
            <button
              onClick={startExport}
              className="cursor-pointer rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Generate Clip
            </button>
          </div>
        )}

        {(status === "exporting" || status === "queued" || status === "processing") && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {status === "exporting" ? "Creating clip..."
                : status === "queued" ? "Clip queued..."
                : "Processing clip..."}
            </h2>
            <p className="text-sm text-zinc-500">This usually takes 30-60 seconds.</p>
          </div>
        )}

        {status === "completed" && downloadUrl && (
          <div className="space-y-5">
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
                Download Clip
              </a>
            </div>
            <p className="text-center text-xs text-zinc-600">
              Clip saved to your workspace.
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
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <GenerateContent />
    </Suspense>
  );
}
