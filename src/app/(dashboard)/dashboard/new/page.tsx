"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wand2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useToast } from "@/components/ui/toast";

export default function NewProjectPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("llama-3.1-8b-instant");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const groqModels = [
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Cepat)" },
    { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B (Akurat)" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Alternatif)" },
  ];

  const geminiModels = [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Cepat)" },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite (Ringan)" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Alternatif)" },
  ];

  const models = provider === "gemini" ? geminiModels : groqModels;

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setModel(newProvider === "gemini" ? "gemini-2.0-flash" : "llama-3.1-8b-instant");
  };

  const createProject = useMutation(api.projects.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Masukkan URL YouTube");
      return;
    }

    if (!url.includes("youtube.com/watch") && !url.includes("youtu.be/")) {
      setError("URL YouTube tidak valid");
      return;
    }

    setLoading(true);
    try {
      const projectId = await createProject({
        title: title.trim() || "Video tanpa judul",
        youtubeUrl: url.trim(),
        provider,
        model,
      });

      addToast("Menambahkan ke antrian processing...", "success");

      router.push(`/dashboard/projects/${projectId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membuat proyek";
      setError(msg);
      addToast(msg, "error");
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <h1 className="text-2xl font-bold text-surface-900">
          Proyek Baru
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          Masukkan link YouTube untuk diubah menjadi short video.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Buat Short Video</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="url"
                label="URL YouTube"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                error={error}
              />
              <Input
                id="title"
                label="Judul (opsional)"
                type="text"
                placeholder="Review Produk Terbaru"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-surface-700">
                  Provider AI
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleProviderChange("groq")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      provider === "groq"
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-surface-300 bg-white text-surface-600 hover:border-surface-400"
                    }`}
                  >
                    Groq
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProviderChange("gemini")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      provider === "gemini"
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-surface-300 bg-white text-surface-600 hover:border-surface-400"
                    }`}
                  >
                    Gemini
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-surface-700">
                  Model AI
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg bg-surface-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-surface-700">
                  <Wand2 className="h-4 w-4 text-primary-600" />
                  Yang akan dilakukan AI:
                </div>
                <ul className="mt-2 space-y-1 text-sm text-surface-500">
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary-500" />
                    Menganalisis video dan memotong 2 short 30 detik
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary-500" />
                    Menambahkan animated caption AI
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary-500" />
                    Voice-over AI otomatis
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary-500" />
                    Biaya: 5 credits (dipotong saat processing dimulai)
                  </li>
                </ul>
              </div>
              <Button
                type="submit"
                loading={loading}
                size="lg"
                className="w-full gap-2"
              >
                {loading ? "Menyiapkan..." : "Buat Short Video"}
                <Wand2 className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
