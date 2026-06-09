"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Scissors, CreditCard, LogOut } from "lucide-react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href={session ? "/app" : "/"} className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-bold text-white">CutClips</span>
        </Link>

        {session ? (
          <nav className="flex items-center gap-4">
            <Link
              href="/app"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Workspace
            </Link>
            <Link
              href="/app/billing"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              <span className="flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                Billing
              </span>
            </Link>
            <Link
              href="/api/auth/signout"
              className="text-sm text-zinc-500 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Sign In
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
