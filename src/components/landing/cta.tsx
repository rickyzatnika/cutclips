import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,rgba(255,255,255,0.15),transparent)]" />
          <Sparkles className="mx-auto mb-4 h-8 w-8 text-white/80" />
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Siap Membuat Short Viral?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            Dapatkan 150 credits gratis ketika mendaftar. Tidak perlu kartu
            kredit.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                variant="secondary"
                size="xl"
                className="bg-white text-primary-700 hover:bg-surface-100"
              >
                Mulai Gratis
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                variant="outline"
                size="xl"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Lihat Harga
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
