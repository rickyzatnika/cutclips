"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

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
    id: "starter",
    creditsLabel: "100 Kredit + (Bonus 100)",
    credits: 200,
    price: 25000,
    priceLabel: "Rp25.000",
    name: "Starter",
    features: [
      "100 kredit + ( Bonus 100)",
      "Bebas Watermark",
      "Generate Hook AI",
      "Analisis gratis & tak terbatas",
      "Semua kategori highlight",
      "Kredit tidak pernah kedaluwarsa",
      "Chat dengan AI Analisis",
    ],
    popular: true,
  },
  {
    id: "creator",
    creditsLabel: "500 Kredit (Bonus 200)",
    credits: 700,
    price: 75000,
    priceLabel: "Rp75.000",
    name: "Kreator",
    features: [
      "200 kredit tambahan",
      "Bebas Watermark",
      "Generate Hook AI",
      "Analisis gratis & tak terbatas",
      "Semua kategori highlight",
      "Prioritas pemrosesan",
      "Kredit tidak pernah kedaluwarsa",
      "Chat dengan AI Analisis",
    ],
  },
];

export default function BillingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = useQuery(
    api.users.getByEmail,
    session?.user?.email ? { email: session.user.email } : "skip",
  );
  const credits = user?.credits;
  const isLoading = user === undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="mx-auto max-w-xs rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center sm:max-w-sm">
          <p className="text-sm text-zinc-400">Sisa Kredit</p>
          <div className="mt-1 text-4xl font-bold text-white">
            {isLoading ? (
              <Skeleton className="inline-block h-9 w-20 align-middle" />
            ) : (
              (credits ?? 0)
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isGratis = plan.name === "Gratis";

          if (isGratis) {
            return (
              <div
                key={plan.name}
                className="relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
              >
                <h3 className="text-lg font-semibold text-white">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">{plan.credits}</p>
                <p className="mt-4 text-3xl font-bold text-white">
                  {plan.price}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feat: string) => (
                    <li
                      key={feat}
                      className="flex items-start gap-3 text-sm text-zinc-400"
                    >
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            );
          }

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
              <p className="mt-1 text-sm text-zinc-500">{plan.creditsLabel}</p>
              <p className="mt-4 text-3xl font-bold text-white">
                {plan.priceLabel}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feat: string) => (
                  <li
                    key={feat}
                    className="flex items-start gap-3 text-sm text-zinc-400"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() =>
                  router.push(
                    `/invoice?packId=${plan.id}&credits=${plan.credits}&amount=${plan.price}`,
                  )
                }
                className={`mt-6 cursor-pointer rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
                  plan.popular
                    ? "bg-emerald-500 text-black hover:bg-emerald-400"
                    : "border border-zinc-700 text-white hover:bg-zinc-800"
                }`}
              >
                Beli {plan.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
