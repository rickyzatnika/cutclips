"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Scissors, CreditCard } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();
  const setOffline = useMutation(api.users.setOffline);

  const handleSignOut = async () => {
    if (session?.user?.email) {
      await setOffline({ email: session.user.email });
    }
    signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="sticky top-0 z-50 bg-black/10 backdrop-blur-lg py-4">
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
              <button onClick={handleSignOut} className="py-2 px-4 rounded-xl cursor-pointer bg-emerald-400 text-sm text-zinc-900 transition-colors hover:text-white">
                Logout
              </button>
            </nav>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-emerald-300"
            >
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
