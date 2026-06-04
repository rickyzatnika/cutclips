"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wand2, Sparkles, ChevronDown, ChevronUp, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useToast } from "@/components/ui/toast";

interface Scene {
  sceneDescription: string;
  visualKeyword: string;
  narration: string;
  duration: number;
}

export default function ScriptGeneratorPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const createProject = useMutation(api.projects.create);

  const [topic, setTopic] = useState("");
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("llama-3.1-8b-instant");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<{
    title: string;
    topic: string;
    scenes: Scene[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");

  const groqModels = [
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Cepat)" },
    { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B (Akurat)" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Alternatif)" },
  ];

  const geminiModels = [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Cepat)" },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  ];

  const models = provider === "gemini" ? geminiModels : groqModels;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Masukkan prompt/deskripsi video");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), provider, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate script");
      setGenerated(data);
    } catch (e: any) {
      setError(e.message || "Gagal generate script");
      addToast(e.message || "Gagal generate script", "error");
    }
    setLoading(false);
  };

  const handleSubmitProject = async () => {
    if (!generated) return;
    setSubmitting(true);
    try {
      const projectId = await createProject({
        title: generated.title,
        type: "script",
        provider,
        model,
        script: {
          topic: generated.topic,
          scenes: generated.scenes,
        },
      });
      addToast("Script dikirim ke antrian processing! Jalankan worker untuk memproses: node worker/index.js", "success");
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e: any) {
      addToast(e.message || "Gagal membuat proyek", "error");
    }
    setSubmitting(false);
  };

  const totalDuration = generated?.scenes.reduce((s, sc) => s + sc.duration, 0) || 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <h1 className="text-2xl font-bold text-surface-900 ">AI Script Generator</h1>
        <p className="mt-1 text-sm text-surface-500 ">
          Generate script video otomatis dari topik, lengkap dengan stock footage + voice-over.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        {!generated ? (
          <Card>
            <CardHeader>
              <CardTitle>Buat Script Baru</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGenerate();
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label htmlFor="topic" className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Prompt / Deskripsi Video
                  </label>
                  <textarea
                    id="topic"
                    rows={4}
                    placeholder="Buat video tentang cara bikin nasi goreng ala chef, atau review smartphone terbaru — jelaskan detailnya biar hasil maksimal..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-vertical dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:placeholder:text-surface-500"
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Provider AI</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                    onClick={() => setProvider("groq")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      provider === "groq"
                        ? "border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-950 dark:text-primary-300"
                        : "border-surface-300 bg-white text-surface-600 hover:border-surface-400 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-400 dark:hover:border-surface-600"
                    }`}
                  >
                    Groq
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider("gemini")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      provider === "gemini"
                        ? "border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-950 dark:text-primary-300"
                        : "border-surface-300 bg-white text-surface-600 hover:border-surface-400 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-400 dark:hover:border-surface-600"
                    }`}
                    >
                      Gemini
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Model AI</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" loading={loading} size="lg" className="w-full gap-2">
                  {loading ? "Mengenerate..." : "Generate Script"}
                  <Sparkles className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{generated.title}</CardTitle>
                    <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                      {generated.scenes.length} scene &middot; {totalDuration} detik &middot; Topik: {generated.topic}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setGenerated(null)} size="sm">
                    Generate Ulang
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {generated.scenes.map((scene, i) => {
              const isOpen = expandedScenes[i] ?? (i === 0);
              return (
                <Card key={i}>
                  <CardHeader className="cursor-pointer" onClick={() => setExpandedScenes({ ...expandedScenes, [i]: !isOpen })}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                          {i + 1}
                        </div>
                        <div>
                          <CardTitle className="text-base">Scene {i + 1}</CardTitle>
                          <p className="text-xs text-surface-400 dark:text-surface-500">
                            {scene.duration} detik &middot; Keyword: {scene.visualKeyword}
                          </p>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-surface-400 dark:text-surface-500" /> : <ChevronDown className="h-4 w-4 text-surface-400 dark:text-surface-500" />}
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-surface-500 dark:text-surface-400">Visual</label>
                        <p className="text-sm text-surface-900 dark:text-surface-100">{scene.sceneDescription}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-surface-500 dark:text-surface-400">Keyword Stock Footage</label>
                        <p className="text-sm font-mono text-primary-600">{scene.visualKeyword}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-surface-500 dark:text-surface-400">Narasi (Voice-Over)</label>
                        <p className="text-sm text-surface-700 italic dark:text-surface-300">&ldquo;{scene.narration}&rdquo;</p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            <Card>
              <CardContent className="p-6">
                <div className="rounded-lg bg-surface-50 p-4 mb-4 dark:bg-surface-800/50">
                  <div className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300">
                    <Wand2 className="h-4 w-4 text-primary-600" />
                    Yang akan dilakukan AI:
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-surface-500 dark:text-surface-400">
                    <li className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary-500" />
                      Mencari stock video dari Pexels sesuai keyword tiap scene
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary-500" />
                      Generate voice-over natural dari narasi (Google TTS)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary-500" />
                      Menggabungkan scene + transisi + animated caption
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary-500" />
                      Output video 9:16 (1080×1920) siap upload
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary-500" />
                      Biaya: 5 credits
                    </li>
                  </ul>
                </div>
                <Button
                  onClick={handleSubmitProject}
                  loading={submitting}
                  size="lg"
                  className="w-full gap-2"
                >
                  {submitting ? "Menyiapkan..." : "Buat Video Sekarang"}
                  <Play className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
