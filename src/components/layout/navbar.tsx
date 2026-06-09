"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Scissors, CreditCard, LogOut, Menu, X } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50  bg-black/10 backdrop-blur-lg py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href={session ? "/workspace" : "/"} className="flex items-center gap-2">
          <Scissors className="h-7 w-7 text-emerald-400" />
          <span className="text-lg font-bold text-white">CutClips</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex">
          {session ? (
            <nav className="flex items-center gap-4">
              <Link
                href="/workspace"
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Workspace
              </Link>
              <Link
                href="/workspace/billing"
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  Billing
                </span>
              </Link>
              <button onClick={() => signOut()} className="py-2 px-4 rounded-xl cursor-pointer bg-emerald-400  text-sm text-zinc-900 transition-colors hover:text-white">
                Logout
              </button>
            </nav>
          ) : (
            <button className="py-2 px-4 rounded-xl cursor-pointer bg-emerald-400  text-sm text-zinc-900 transition-colors hover:text-white">
              <Link
                href="/login"
                className="text-sm font-medium "
              >
                Masuk
              </Link>
            </button>
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
                  href="/workspace"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  Workspace
                </Link>
                <Link
                  href="/workspace/billing"
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
