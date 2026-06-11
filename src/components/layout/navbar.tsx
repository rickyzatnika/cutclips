"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Scissors } from "lucide-react";

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
        <Link
          href={session ? "/workspace" : "/"}
          className="flex items-center gap-2"
        >
          <Scissors className="h-7 w-7 text-emerald-400" />
          <span className="text-lg font-bold text-white">CutClips</span>
        </Link>

        {/* Desktop nav */}
        <div className="flex">
          {session ? (
            <nav className="flex items-center gap-4">
              <button
                onClick={handleSignOut}
                className="py-2 px-4 rounded-xl cursor-pointer border border-emerald-400 text-sm text-emerald-400 transition-colors hover:bg-emerald-300 hover:text-zinc-900"
              >
                Logout
              </button>
            </nav>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border border-emerald-400 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-300 hover:text-zinc-900"
            >
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
