"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Scissors,
  LogOut,
  LayoutDashboard,
  User,
  History,
  Sparkles,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const setOffline = useMutation(api.users.setOffline);
  const user = useQuery(
    api.users.getByEmail,
    session?.user?.email ? { email: session.user.email } : "skip",
  );

  const credits = user?.credits;
  const isAdmin = user?.role === "admin";
  const isLoading = user === undefined;

  const handleSignOut = () => {
    if (session?.user?.email) {
      setOffline({ email: session.user.email }).catch(() => {});
    }
    signOut({ callbackUrl: "/" });
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

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-4">
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
            <Link
              href="/analyze"
              className={`flex items-center gap-1 text-sm ${
                pathname === "/analyze"
                  ? "text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Analyze
            </Link>
            <Link
              href="/chat-ai"
              className={`flex items-center gap-1 text-sm ${
                pathname === "/chat-ai" || pathname.startsWith("/chat-ai/")
                  ? "text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Tanya AI
            </Link>
            <Link
              href="/workspace/billing"
              className={`flex items-center gap-1 text-sm ${
                pathname === "/workspace/billing"
                  ? "text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Billing
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
            <div className="ml-2 flex items-center gap-4 border-l border-zinc-800 pl-4">
              <Link
                href="/workspace/billing"
                className="text-sm text-zinc-400 hover:text-white"
              >
                Credits = {isLoading ? <Skeleton className="inline-block h-4 w-10 align-middle" /> : credits ?? 0}
              </Link>
              <button
                onClick={handleSignOut}
                className="cursor-pointer text-sm text-zinc-500 hover:text-white"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </nav>

          {/* Mobile credits */}
          <Link
            href="/workspace/user-info"
            className="flex sm:hidden items-center gap-1 text-xs text-zinc-400"
          >
            <User className="h-3.5 w-3.5" />
            <span className="font-medium text-white">
              {isLoading ? <Skeleton className="inline-block h-4 w-8 align-middle" /> : credits ?? 0}
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-16 sm:pb-0">{children}</main>
    </div>
  );
}
