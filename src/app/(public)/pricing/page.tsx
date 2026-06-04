import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Harga",
};

const plans = [
  {
    name: "Starter",
    price: "Rp130.000",
    period: "/bulan",
    desc: "Untuk creative individu yang ingin memulai.",
    credits: 150,
    features: [
      "150 credits per bulan",
      "AI clipping dengan Virality Score",
      "AI animated captions 20+ bahasa",
      "Auto post ke YouTube Shorts, TikTok, IG Reels",
      "Powerful editor",
      "1 brand template",
      "Filler & silence removal",
      "Remove watermark",
    ],
    cta: "Mulai Trial Gratis",
    popular: false,
  },
  {
    name: "Pro",
    price: "Rp250.000",
    period: "/bulan",
    desc: "Untuk professional creator & tim.",
    credits: 500,
    features: [
      "500 credits per bulan",
      "Semua fitur Starter",
      "2 brand templates",
      "6 social account connections",
      "Input dari 10+ sumber",
      "Export ke Premiere Pro & DaVinci Resolve",
      "Multiple aspect ratios",
      "Social media scheduler",
      "Intercom chat support",
      "Custom fonts",
      "Speech enhancement",
      "Limited API Access",
    ],
    cta: "Mulai Trial Gratis",
    popular: true,
  },
  {
    name: "Business",
    price: "Custom",
    period: "",
    desc: "Untuk organisasi dengan kebutuhan khusus.",
    credits: -1,
    features: [
      "Custom credits & seats",
      "Semua fitur Pro",
      "Priority project processing",
      "Tailored business assets",
      "Dedicated storage",
      "API & custom integrations",
      "Master Service Agreement (MSA)",
      "Priority support + Slack channel",
      "Enterprise-level security",
    ],
    cta: "Hubungi Kami",
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
            Mulai dengan trial gratis, tidak perlu kartu kredit.
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
                  {plan.period && (
                    <span className="text-sm text-surface-500">
                      {plan.period}
                    </span>
                  )}
                </div>
                {plan.credits > 0 && (
                  <p className="mt-1 text-sm text-surface-500">
                    {plan.credits.toLocaleString("id-ID")} credits per bulan
                  </p>
                )}
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                    <span className="text-sm text-surface-600">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.name === "Business" ? "#" : "/signup"}
              >
                <Button
                  variant={plan.popular ? "primary" : "outline"}
                  size="lg"
                  className="w-full"
                >
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
