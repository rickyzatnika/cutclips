"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Scissors, CreditCard, LogOut, Menu, X, LayoutDashboard, History } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const setOffline = useMutation(api.users.setOffline);
  const user = useQuery(api.users.getByEmail, session?.user?.email ? { email: session.user.email } : "skip");

  const credits = user?.credits ?? null;
  const isAdmin = user?.role === "admin";

  const handleSignOut = async () => {
    if (session?.user?.email) {
      await setOffline({ email: session.user.email });
    }
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#050505]">
      <header className="py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/workspace" className="flex items-center gap-2">
              <Scissors className="h-7 w-7 text-emerald-400" />
              <span className="text-lg font-bold text-white">CutClips</span>
            </Link>
            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-4">
              <Link
                href="/workspace"
                className={`text-sm ${
                  pathname === "/workspace"
                    ? "text-white"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Workspace
              </Link>
              <Link
                href="/workspace/billing"
                className={`text-sm ${
                  pathname === "/workspace/billing"
                    ? "text-white"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  Billing
                </span>
              </Link>
              <Link
                href="/workspace/history"
                className={`flex items-center gap-1 text-sm ${
                  pathname === "/workspace/history"
                    ? "text-white"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Riwayat
              </Link>
              {isAdmin && (
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-1 text-sm ${
                    pathname.startsWith("/dashboard")
                      ? "text-emerald-400"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
              )}
            </nav>
          </div>

          {/* Desktop credits + logout */}
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm text-zinc-400 hover:text-white"
            >
              ✨ Credits:{" "}
              <strong className="text-white">
                {credits != null ? credits : "..."}
              </strong>
              
            </Link>
            <button
              onClick={handleSignOut}
              className="cursor-pointer text-sm text-zinc-500 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex sm:hidden cursor-pointer text-zinc-400 hover:text-white"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-zinc-800 bg-[#050505] sm:hidden">
            <div className="space-y-1 px-4 py-3">
              <Link
                href="/workspace"
                onClick={() => setMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  pathname === "/workspace"
                    ? "text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                Workspace
              </Link>
              <Link
                href="/workspace/billing"
                onClick={() => setMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  pathname === "/workspace/billing"
                    ? "text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                Billing
              </Link>
              <Link
                href="/workspace/history"
                onClick={() => setMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  pathname === "/workspace/history"
                    ? "text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                Riwayat
              </Link>
              {isAdmin && (
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    pathname.startsWith("/dashboard")
                      ? "text-emerald-400"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  Dashboard
                </Link>
              )}
              <div className="border-t border-zinc-800 pt-2 mt-2">
                <Link
                  href="/pricing"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  ✨ Credits: <strong className="text-white">{credits != null ? credits : "..."}</strong>
                </Link>
                <button
                  onClick={() => { setMenuOpen(false); handleSignOut(); }}
                  className="block w-full text-left rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
