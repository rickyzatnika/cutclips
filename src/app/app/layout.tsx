"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Scissors, CreditCard, LogOut } from "lucide-react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
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
    <div className="flex min-h-screen flex-col bg-black">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/app" className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-bold text-white">CutClips</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/app"
                className={`text-sm ${
                  pathname === "/app"
                    ? "text-white"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Workspace
              </Link>
              <Link
                href="/app/billing"
                className={`text-sm ${
                  pathname === "/app/billing"
                    ? "text-white"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  Billing
                </span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">
              ✨ Credits:{" "}
              <strong className="text-white">
                {credits != null ? credits : "..."}
              </strong>
            </span>
            <Link
              href="/api/auth/signout"
              className="text-sm text-zinc-500 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
