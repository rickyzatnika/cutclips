import Link from "next/link";
import { Check, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Harga",
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "Rp25.000",
    period: "sekali",
    desc: "Untuk creative individu yang ingin memulai.",
    credits: 100,
    features: [
      "100 credits (20x proses video)",
      "AI clipping YouTube + Script Generator",
      "AI animated captions (slide-up + fade)",
      "AI voice-over natural (Microsoft Edge Neural TTS)",
      "Stock footage otomatis (Pexels)",
      "1 brand template",
      "Virality Score",
    ],
    cta: "Beli Starter",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "Rp75.000",
    period: "sekali",
    desc: "Untuk professional creator & tim.",
    credits: 200,
    features: [
      "200 credits (40x proses video)",
      "Semua fitur Starter",
      "2 brand templates",
      "Custom fonts & outline color",
      "Export MP4 9:16",
      "Prioritas proses worker",
    ],
    cta: "Beli Pro",
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    price: "Rp150.000",
    period: "sekali",
    desc: "Untuk organisasi dengan kebutuhan khusus.",
    credits: 500,
    features: [
      "500 credits (100x proses video)",
      "Semua fitur Pro",
      "Unlimited brand templates",
      "Custom credits & seats",
      "Dedicated support",
      "API access (coming soon)",
    ],
    cta: "Beli Business",
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-surface-900">
            Pilih Paket yang Tepat
          </h1>
          <p className="mt-4 text-lg text-surface-500">
            Pembelian satu kali, credit tidak pernah expired. Top-up kapan saja.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 shadow-sm ${
                plan.popular
                  ? "border-primary-500 bg-white ring-2 ring-primary-500"
                  : "border-surface-200 bg-white"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
                    Paling Populer
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-surface-900">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-surface-500">{plan.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-surface-900">
                    {plan.price}
                  </span>
                  <span className="text-sm text-surface-500">/{plan.period}</span>
                </div>
                <p className="mt-1 text-sm text-surface-500">
                  {plan.credits.toLocaleString("id-ID")} credits
                </p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                    <span className="text-sm text-surface-600">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link href={`/checkout?package=${plan.id}`}>
                <Button
                  variant={plan.popular ? "primary" : "outline"}
                  size="lg"
                  className="w-full"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
