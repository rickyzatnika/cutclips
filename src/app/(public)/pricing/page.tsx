"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

const plans = [
  {
    name: "Gratis",
    credits: "100 Kredit",
    price: "Rp0",
    features: [
      "100 kredit gratis saat daftar",
      "Bebas Watermark",
      "5 clip",
      "Deteksi highlight AI",
      "Unduh clip MP4",
    ],
  },
  {
    name: "Starter",
    credits: "+100 Kredit",
    price: "Rp25.000",
    features: [
      "100 kredit tambahan",
      "Bebas Watermark",
      "Analisis gratis & tak terbatas",
      "Semua kategori highlight",
      "Kredit tidak pernah kedaluwarsa",
    ],
    popular: true,
  },
  {
    name: "Kreator",
    credits: "+500 Kredit",
    price: "Rp75.000",
    features: [
      "500 kredit tambahan",
      "Bebas Watermark",
      "Analisis gratis & tak terbatas",
      "Semua kategori highlight",
      "Prioritas pemrosesan",
      "Kredit tidak pernah kedaluwarsa",
    ],
  },
];

export default function PricingPage() {
  const { data: session } = useSession();

  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold text-white">
            Harga Kredit Sederhana
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            Analisis video gratis. Bayar hanya untuk generate clip. Tanpa langganan.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const isGratis = plan.name === "Gratis";
            const href = isGratis
              ? "/"
              : session
                ? "/workspace/billing"
                : "/login";

            return (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  plan.popular
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-900/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black">
                      Terpopuler
                    </span>
                  </div>
                )}

                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{plan.credits}</p>
                <p className="mt-4 text-3xl font-bold text-white">{plan.price}</p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-zinc-400">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link
                  href={href}
                  className={`mt-6 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
                    plan.popular
                      ? "bg-emerald-500 text-black hover:bg-emerald-400"
                      : "border border-zinc-700 text-white hover:bg-zinc-800"
                  }`}
                >
                  {isGratis ? "Coba Gratis" : session ? "Beli" : "Masuk untuk Beli"}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
