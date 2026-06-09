"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

const creditPacks = [
  { id: "starter", credits: 100, price: 25000, label: "Rp25.000" },
  { id: "creator", credits: 500, price: 100000, label: "Rp100.000" },
];

export default function BillingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user?.email || !CONVEX_URL) return;

    fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "users:getByEmail",
        args: { email: session.user.email },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.value?.credits != null) setCredits(data.value.credits);
      })
      .catch(() => {});
  }, [session]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-white">Buy Credits</h1>
      <p className="mb-8 text-sm text-zinc-500">
        Purchase credits to generate clips. Credits never expire.
      </p>

      <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-sm text-zinc-400">Current Balance</p>
        <p className="mt-1 text-3xl font-bold text-white">
          {credits != null ? credits : "..."} Credits
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-400">BUY CREDITS</h2>
        {creditPacks.map((pack) => (
          <div
            key={pack.id}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700"
          >
            <div>
              <p className="font-semibold text-white">{pack.credits} Kredit</p>
              <p className="text-sm text-zinc-500">{pack.label}</p>
            </div>
            <button
              onClick={() =>
                router.push(
                  `/invoice?packId=${pack.id}&credits=${pack.credits}&amount=${pack.price}`,
                )
              }
              className="cursor-pointer rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Beli
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
