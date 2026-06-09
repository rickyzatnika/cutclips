"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Scissors, CreditCard, LogOut, Menu, X } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href={session ? "/app" : "/"} className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-bold text-white">CutClips</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex">
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
                href="/login"
                className="text-sm font-medium text-white transition-colors hover:text-zinc-300"
              >
                Masuk
              </Link>
            </nav>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="flex sm:hidden cursor-pointer text-zinc-400 hover:text-white"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 bg-black sm:hidden">
          <div className="space-y-1 px-4 py-3">
            {session ? (
              <>
                <Link
                  href="/app"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  Workspace
                </Link>
                <Link
                  href="/app/billing"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  Billing
                </Link>
                <Link
                  href="/api/auth/signout"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  Keluar
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-white hover:bg-zinc-900"
                >
                  Masuk
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
