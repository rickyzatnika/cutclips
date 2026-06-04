import {
  Scissors,
  Captions,
  Mic2,
  Sparkles,
  Palette,
  FileText,
} from "lucide-react";

const features = [
  {
    icon: Scissors,
    title: "Smart AI Clipping",
    desc: "AI menganalisis video YouTube dan otomatis memotong momen terbaik menjadi short video 30 detik (9:16).",
  },
  {
    icon: Captions,
    title: "Animated Captions",
    desc: "Caption animasi typewriter (slide-up + fade) dalam format ASS, siap pakai tanpa editing manual.",
  },
  {
    icon: Mic2,
    title: "AI Voice-Over Natural",
    desc: "Voice-over dengan Microsoft Edge Neural TTS - suara natural, bukan robot, support Bahasa Indonesia.",
  },
  {
    icon: Sparkles,
    title: "Virality Score",
    desc: "AI menilai potensi viral setiap clip dan memberi rekomendasi untuk meningkatkan engagement.",
  },
  {
    icon: Palette,
    title: "Brand Templates",
    desc: "Simpan template brand (font, warna outline, ukuran) dan terapkan ke semua video secara konsisten.",
  },
  {
    icon: FileText,
    title: "AI Script Generator",
    desc: "Dari topik saja, AI generate naskah + visual keyword + narasi, lalu buat video pakai stock footage (Pexels).",
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
