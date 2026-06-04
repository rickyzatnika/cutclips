import {
  Scissors,
  Captions,
  Mic2,
  Sparkles,
  Share2,
  Download,
} from "lucide-react";

const features = [
  {
    icon: Scissors,
    title: "Smart AI Clipping",
    desc: "AI menganalisis setiap frame video untuk menemukan momen terbaik dan secara otomatis memotongnya menjadi short 30 detik.",
  },
  {
    icon: Captions,
    title: "Animated Captions",
    desc: "Caption animasi yang menarik dalam 20+ bahasa, dengan skor virality untuk memastikan engagement maksimal.",
  },
  {
    icon: Mic2,
    title: "AI Voice-Over",
    desc: "Pilih berbagai suara AI natural untuk narasi, dengan dukungan multi-bahasa dan penyesuaian kecepatan.",
  },
  {
    icon: Sparkles,
    title: "Virality Score",
    desc: "AI menilai potensi viral setiap clip dan memberi rekomendasi untuk meningkatkan engagement.",
  },
  {
    icon: Share2,
    title: "Auto Posting",
    desc: "Post otomatis ke YouTube Shorts, TikTok, dan Instagram Reels langsung dari dashboard.",
  },
  {
    icon: Download,
    title: "Export Multi-Format",
    desc: "Download dalam berbagai format dan aspek rasio, atau ekspor ke Premiere Pro & DaVinci Resolve.",
  },
];

export function Features() {
  return (
    <section id="features" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl dark:text-white">
            Fitur Lengkap untuk Content Creator
          </h2>
          <p className="mt-4 text-lg text-surface-500 dark:text-surface-300">
            Semua alat yang Anda butuhkan untuk membuat short video viral dengan
            bantuan AI.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-surface-200 bg-white p-6 transition-all hover:border-primary-200 hover:shadow-md dark:border-surface-800 dark:bg-surface-900"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors dark:bg-primary-900/50 dark:text-primary-300 dark:group-hover:bg-primary-600">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold text-surface-900 dark:text-surface-100">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-surface-500 dark:text-surface-400">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
