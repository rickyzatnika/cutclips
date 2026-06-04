import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Ahmad Fauzi",
    role: "Content Creator",
    content:
      "CutClips benar-benar mengubah workflow saya. Dari 1 video YouTube saya bisa dapat 10+ short dalam hitungan menit.",
    rating: 5,
  },
  {
    name: "Sari Dewi",
    role: "Social Media Manager",
    content:
      "Fitur auto posting ke semua platform menghemat waktu saya berjam-jam setiap minggu. Virality Score-nya juga akurat!",
    rating: 5,
  },
  {
    name: "Budi Santoso",
    role: "YouTuber",
    content:
      "Caption animasi dan voice-over AI-nya sangat natural. Views short saya naik 300% sejak pakai CutClips.",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl dark:text-white">
            Apa Kata Pengguna
          </h2>
          <p className="mt-4 text-lg text-surface-500 dark:text-surface-300">
            Ribuan content creator sudah merasakan manfaat CutClips.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900"
            >
              <div className="mb-3 flex gap-1">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
                &ldquo;{t.content}&rdquo;
              </p>
              <div>
                <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                  {t.name}
                </div>
                <div className="text-xs text-surface-500 dark:text-surface-400">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
