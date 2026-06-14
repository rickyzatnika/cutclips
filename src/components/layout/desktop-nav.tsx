"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  CirclePlay,
  LayoutDashboard,
  History,
  Film,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AiAnalyzeLink } from "@/components/chat-ai/ai-analyze-link";
import Image from "next/image";

export function DesktopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = useQuery(
    api.users.getByEmail,
    session?.user?.email ? { email: session.user.email } : "skip",
  );

  const credits = user?.credits;
  const isAdmin = user?.role === "admin";
  const isLoading = user === undefined;

  if (!session) return null;

  return (
    <header className="py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/workspace" className="flex items-center gap-2">
          <CirclePlay className="h-7 w-7 text-emerald-400" />
          <span className="text-lg font-bold text-white">CutClips</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4">
          <Link
            href="/workspace"
            className={`flex items-center gap-1 text-sm ${
              pathname === "/workspace"
                ? "text-emerald-400"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            Clip
          </Link>
          <Link
            href="/workspace/history"
            className={`flex items-center gap-1 text-sm ${
              pathname === "/workspace/history"
                ? "text-emerald-400"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Riwayat
          </Link>
          <Link
            href="/workspace/billing"
            className={`flex items-center gap-1 text-sm ${
              pathname === "/workspace/billing"
                ? "text-emerald-400"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Isi Credit
          </Link>
          <AiAnalyzeLink
            className={`flex items-center gap-1 text-sm ${
              pathname === "/chat-ai" || pathname.startsWith("/chat-ai/")
                ? "text-emerald-400"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            AI Analyze
          </AiAnalyzeLink>
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
              Credits ={" "}
              {isLoading ? (
                <Skeleton className="inline-block h-4 w-10 align-middle" />
              ) : (
                (credits ?? 0)
              )}
            </Link>
            <Link
              href="/workspace/user-info"
              className="cursor-pointer text-sm text-zinc-500 hover:text-white"
            >
              <Image
                src={session?.user?.image || "/avatar.png"}
                alt=""
                width={32}
                height={32}
                className="object-cover rounded-full"
                unoptimized
              />
            </Link>
          </div>
        </nav>

        {/* Mobile */}
        <Link
          href="/workspace/user-info"
          className="flex sm:hidden items-center gap-1 text-xs font-medium text-zinc-200"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ) : user?.name ? (
            <>
              <Image
                src={user.image || "/avatar.png"}
                alt=""
                width={28}
                height={28}
                className="object-cover rounded-full"
                unoptimized
              />
              <p>
                {user.name.length > 6
                  ? user.name.slice(0, 5) + "..."
                  : user.name}
              </p>
            </>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
