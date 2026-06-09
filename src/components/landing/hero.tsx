"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

const trustItems = [
  "No Perlu Skill Editing",
  "Didukung AI",
  "Ramah Kreator",
  "Analisis Cepat",
];

export function Hero() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  };

  return (
    <section className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="mx-auto w-full max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Ubah Video Panjang Jadi{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
            Shorts Viral
          </span>
        </h1>

        <p className="mt-4 text-lg text-zinc-400">
          AI menemukan momen paling menarik dari video YouTube kamu secara otomatis.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 mx-auto max-w-xl">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Tempel URL YouTube..."
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-base text-white placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-emerald-500 px-6 py-4 text-base font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Cari Highlight
            </button>
          </div>
        </form>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {trustItems.map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm text-zinc-500">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
