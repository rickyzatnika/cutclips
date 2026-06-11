"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Scissors, LogOut, LayoutDashboard, User } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
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
      {/* header — desktop nav, mobile just logo */}
      <header className="py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/workspace" className="flex items-center gap-2">
            <Scissors className="h-7 w-7 text-emerald-400" />
            <span className="text-lg font-bold text-white">CutClips</span>
          </Link>

          {/* Desktop nav — credits + admin + logout only */}
          <nav className="hidden sm:flex items-center gap-4">
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
            <Link
              href="/pricing"
              className="text-sm text-zinc-400 hover:text-white"
            >
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {credits != null ? credits : "..."} credit
              </span>
            </Link>
            <button
              onClick={handleSignOut}
              className="cursor-pointer text-sm text-zinc-500 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </nav>

          {/* Mobile credits */}
          <Link
            href="/pricing"
            className="flex sm:hidden items-center gap-1 text-xs text-zinc-400"
          >
            <User className="h-3.5 w-3.5" />
            <span className="font-medium text-white">{credits != null ? credits : "..."}</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-16">{children}</main>
    </div>
  );
}
