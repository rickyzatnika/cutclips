import { Link2, Wand2, Share2 } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "Copy Link YouTube",
    desc: "Salin URL video YouTube panjang yang ingin Anda ubah menjadi short.",
    number: "01",
  },
  {
    icon: Wand2,
    title: "AI Proses Otomatis",
    desc: "AI menganalisis, memotong, dan menambahkan caption + voice-over secara otomatis.",
    number: "02",
  },
  {
    icon: Share2,
    title: "Download & Share",
    desc: "Download hasilnya atau langsung post ke YouTube Shorts, TikTok, dan IG Reels.",
    number: "03",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface-900 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Cara Kerjanya
          </h2>
          <p className="mt-4 text-lg text-surface-400">
            Hanya 3 langkah mudah untuk membuat short video viral.
          </p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="relative text-center">
              {i < steps.length - 1 && (
                <div className="hidden sm:absolute top-12 left-[60%] h-px w-[80%] bg-surface-700" />
              )}
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary-600/10 text-primary-400">
                <step.icon className="h-10 w-10" />
              </div>
              <div className="mb-2 text-sm font-semibold text-primary-400">
                Langkah {step.number}
              </div>
              <h3 className="mb-3 text-lg font-semibold text-white">
                {step.title}
              </h3>
              <p className="text-sm text-surface-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
