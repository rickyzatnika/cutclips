"use client";

import { use, useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Captions,
  Mic2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

type CaptionSegment = {
  start: number;
  end: number;
  text: string;
  style: "fade-in" | "slide-up" | "bounce";
};

const captionStyles: Record<string, string> = {
  "fade-in": "animate-caption-fade",
  "slide-up": "animate-caption-slide",
  "bounce": "animate-caption-bounce",
};

function CaptionOverlay({
  getVideoRef,
  clipStart,
  clipEnd,
  segments,
}: {
  getVideoRef: () => HTMLVideoElement | null;
  clipStart: number;
  clipEnd: number;
  segments: CaptionSegment[];
}) {
  const [active, setActive] = useState<CaptionSegment | null>(null);

  useEffect(() => {
    const video = getVideoRef();
    if (!video) return;

    const onTimeUpdate = () => {
      const currentTime = clipStart + video.currentTime;
      const found = segments
        .filter((s) => currentTime >= s.start && currentTime < s.end)
        .sort((a, b) => b.start - a.start)?.[0];
      setActive(found ?? null);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [getVideoRef, clipStart, segments]);

  if (!active) return null;

  return (
    <div className="absolute bottom-6 left-0 right-0 flex justify-center px-4 pointer-events-none">
      <span
        className={`inline-block rounded-lg bg-black/60 px-3 py-1.5 text-center text-sm font-medium text-white backdrop-blur-sm ${captionStyles[active.style] || captionStyles["fade-in"]}`}
      >
        {active.text}
      </span>
    </div>
  );
}

function calcVirality(clip: { start: number; end: number; description: string }, captions: CaptionSegment[], hasVoiceOver: boolean): number {
  let score = 0;
  const dur = clip.end - clip.start;
  if (dur >= 25 && dur <= 35) score += 30;
  else if (dur >= 20 && dur <= 40) score += 20;
  else score += 10;
  if (clip.description.trim()) score += 15;
  const captionCount = captions.filter(c => c.start >= clip.start && c.end <= clip.end).length;
  if (captionCount >= 5 && captionCount <= 10) score += 30;
  else if (captionCount >= 3) score += 15;
  const styles = new Set(captions.filter(c => c.start >= clip.start && c.end <= clip.end).map(c => c.style));
  if (styles.size >= 2) score += 15;
  else score += 5;
  if (hasVoiceOver) score += 10;
  return Math.min(score, 100);
}

function generateSrtDownload(captions: CaptionSegment[], filename: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toSrtTime = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
  };
  const lines = captions.map((c, i) =>
    `${i + 1}\n${toSrtTime(c.start)} --> ${toSrtTime(c.end)}\n${c.text}`
  ).join("\n\n");
  const blob = new Blob([lines], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function VoiceOverCard({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggle = () => {
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "id-ID";
    u.rate = 1;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic2 className="h-5 w-5 text-primary-600" />
            <CardTitle>AI Voice-Over</CardTitle>
          </div>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
          >
            {playing ? "Stop" : "Putar"}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-surface-600 leading-relaxed">
          {text}
        </p>
      </CardContent>
    </Card>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const project = useQuery(api.projects.getById, { projectId: id as any });
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const updateProgress = useMutation(api.projects.updateProgress);
  const sseStarted = useRef(false);

  useEffect(() => {
    if (!project) return;
    if (project.status !== "queued" && project.status !== "processing") return;
    if (sseStarted.current) return;
    if (project.progress && project.progress > 0) return;
    sseStarted.current = true;

    let cancelled = false;

    const run = async () => {
      let accessToken: string | null = null;
      try {
        const tokenRes = await fetch("/api/auth/token");
        const tokenData = await tokenRes.json();
        accessToken = tokenData.accessToken;
      } catch {}

      if (!accessToken) return;
      if (cancelled) return;

      try {
        const res = await fetch("/api/process-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: id,
            accessToken,
          }),
        });

        if (!res.ok) return;
        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.progress >= 0 && data.progress < 100) {
                updateProgress({ projectId: id as any, progress: data.progress }).catch(() => {});
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error("SSE read error:", err);
      }
    };

    run();

    return () => { cancelled = true; };
  }, [project?.status, project?._id]);

  const statusIcon: Record<string, React.ReactNode> = {
    queued: <Loader2 className="h-4 w-4 animate-spin" />,
    processing: <Loader2 className="h-4 w-4 animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4" />,
    failed: <XCircle className="h-4 w-4" />,
  };

  const statusLabel: Record<string, string> = {
    queued: "Antre",
    processing: "Memproses",
    completed: "Selesai",
    failed: "Gagal",
  };

  const statusVariant: Record<string, "warning" | "success" | "danger"> = {
    queued: "warning",
    processing: "warning",
    completed: "success",
    failed: "danger",
  };

  if (!project) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <Link
          href="/dashboard/projects"
          className="mb-4 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">
              {project.title}
            </h1>
            <a
              href={project.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              {project.youtubeUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Badge variant={statusVariant[project.status]} className="gap-1.5">
            {statusIcon[project.status]}
            {statusLabel[project.status]}
          </Badge>
        </div>
      </div>

      {(project.status === "queued" || project.status === "processing") && (
        <Card className="border-primary-200 bg-primary-50">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              <div>
                <p className="font-medium text-primary-900">
                  {project.status === "queued"
                    ? "Video dalam antrian..."
                    : "AI sedang memproses video..."}
                </p>
                <p className="text-sm text-primary-700">
                  {project.status === "queued"
                    ? "Menunggu giliran diproses..."
                    : project.progress != null && project.progress > 0
                      ? `Processing ${project.progress}%`
                      : "Menganalisis konten, memotong short, dan menambahkan caption..."}
                </p>
              </div>
            </div>
            {project.progress != null && project.progress > 0 && (
              <div className="w-full">
                <div className="h-2 w-full overflow-hidden rounded-full bg-primary-200">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(project.progress, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-primary-600">
                  {project.progress}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {project.status === "completed" && project.clips && project.clips.length > 0 && (
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {project.clips.map((clip, i) => {
              const virality = calcVirality(
                clip,
                Array.isArray(project.captions) ? project.captions as CaptionSegment[] : [],
                !!project.voiceOver,
              );
              return (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Short {i + 1}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={virality >= 70 ? "success" : virality >= 40 ? "warning" : "neutral"} className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        {virality}
                      </Badge>
                      <Badge variant="success" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {clip.end - clip.start}s
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              <CardContent className="space-y-3">
                  {project.videoUrls && project.videoUrls[i] ? (
                    <div className="relative">
                      <video
                        ref={(el) => { videoRefs.current[i] = el; }}
                        src={project.videoUrls[i]}
                        controls
                        className="max-h-[75vh] w-full aspect-[9/16] rounded-lg bg-black object-contain"
                      />
                      {Array.isArray(project.captions) && (
                        <CaptionOverlay
                          getVideoRef={() => videoRefs.current[i]}
                          clipStart={clip.start}
                          clipEnd={clip.end}
                          segments={project.captions as CaptionSegment[]}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video rounded-lg bg-surface-100 flex items-center justify-center text-surface-400 text-sm">
                      Video Preview
                    </div>
                  )}
                  <p className="text-sm text-surface-600">
                    {clip.description}
                  </p>
                  <div className="flex gap-2">
                    {project.videoUrls && project.videoUrls[i] && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          try {
                            const videoUrl = project.videoUrls![i]!;
                            const res = await fetch(videoUrl);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `short-${i + 1}.mp4`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          } catch {}
                        }}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>

          {(project.captions || project.voiceOver) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {project.captions && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Captions className="h-5 w-5 text-primary-600" />
                        <CardTitle>AI Captions</CardTitle>
                      </div>
                      {Array.isArray(project.captions) && (
                        <button
                          onClick={() => generateSrtDownload(project.captions as CaptionSegment[], `${project.title.replace(/[^a-z0-9]/gi, "_")}_captions.srt`)}
                          className="rounded-lg border border-surface-300 bg-white px-3 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                        >
                          Download SRT
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {Array.isArray(project.captions) ? (
                      <div className="space-y-2">
                        {(project.captions as CaptionSegment[]).map((seg, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-surface-50 px-3 py-2 text-sm"
                          >
                            <span className="text-xs text-surface-400">
                              {seg.start}s - {seg.end}s
                            </span>
                            <p className="text-surface-700">{seg.text}</p>
                            <span className="text-xs text-surface-400 capitalize">
                              {seg.style}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-surface-600 leading-relaxed">
                        {project.captions}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {project.voiceOver && (
                <VoiceOverCard text={project.voiceOver} />
              )}
            </div>
          )}
        </div>
      )}

      {project.status === "completed" && (!project.clips || project.clips.length === 0) && (
        <Card>
          <CardContent className="p-6 text-center text-surface-400">
            Hasil akan muncul setelah selesai diproses.
          </CardContent>
        </Card>
      )}

      {project.status === "failed" && (
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
            <p className="font-medium text-surface-900">
              Proses gagal
            </p>
            <p className="mt-1 text-sm text-surface-500">
              Silakan coba lagi dengan video lain.
            </p>
            <Link href="/dashboard/new">
              <Button className="mt-4">Buat Proyek Baru</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
