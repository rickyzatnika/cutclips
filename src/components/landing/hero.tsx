import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, BarChart3, Languages } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,rgba(59,130,246,0.08),transparent)]" />
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Video Creation
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-surface-900 sm:text-5xl lg:text-6xl dark:text-white">
            Ubah Video YouTube Jadi{" "}
            <span className="bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent">
              Short Viral
            </span>{" "}
            dengan AI
          </h1>
          <p className="mt-6 text-lg leading-8 text-surface-500 dark:text-surface-300">
            CutClips secara otomatis meng-clip video YouTube atau mengubah naskah menjadi short video vertikal dengan caption animasi dan voice-over AI.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="xl" className="gap-2">
                <Play className="h-5 w-5" />
                Mulai Gratis
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="outline" size="xl">
                Lihat Cara Kerja
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: BarChart3,
              title: "AI Clipping",
              desc: "AI mendeteksi momen terbaik dan memotong otomatis jadi short 30 detik.",
            },
            {
              icon: Languages,
              title: "AI Captioning",
              desc: "Caption animasi otomatis dalam 20+ bahasa dengan Virality Score.",
            },
            {
              icon: Sparkles,
              title: "AI Voice-Over",
              desc: "Sulih suara natural dengan berbagai pilihan suara AI.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-surface-800 dark:bg-surface-900"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold text-surface-900 dark:text-surface-100">
                {item.title}
              </h3>
              <p className="text-sm text-surface-500 dark:text-surface-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
