"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Sparkles } from "lucide-react";

const STORAGE_KEY = "cutclips_notified_exports";

function getNotifiedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addNotified(id: string) {
  try {
    const set = getNotifiedSet();
    set.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {}
}

export function ClipCompleteNotification() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [since] = useState(() => Date.now() - 300000);

  const userData = useQuery(
    api.users.getByEmail,
    userEmail ? { email: userEmail } : "skip",
  );
  const userId = userData?._id;

  const recentCompleted = useQuery(
    api.exports.getRecentCompletedByUser,
    userId ? { userId, since } : "skip",
  );

  const unshown = (recentCompleted || []).filter(
    (e) => !getNotifiedSet().has(e._id) && !dismissedIds.has(e._id),
  );

  const latest = unshown.length > 0 ? unshown[0] : null;

  useEffect(() => {
    if (!latest) return;
    addNotified(latest._id);
  }, [latest?._id]);

  const handleDismiss = useCallback(() => {
    if (latest) {
      setDismissedIds((prev) => new Set(prev).add(latest._id));
    }
  }, [latest]);

  if (
    !latest ||
    !pathname ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/generate")
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 w-full max-w-sm animate-in slide-in-from-right">
      <div className="rounded-2xl border border-emerald-500 bg-zinc-900/50 backdrop-blur-lg p-6 shadow-xl shadow-emerald-500/20">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <Sparkles className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white">
              Clip Selesai!
            </h3>
            <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
              &ldquo;{latest.highlightTitle}&rdquo; sudah selesai diproses dan siap dilihat.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 cursor-pointer rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Nanti
          </button>
          <Link
            href="/workspace"
            onClick={handleDismiss}
            className="flex-1 cursor-pointer rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black text-center transition-colors hover:bg-emerald-400"
          >
            Lihat
          </Link>
        </div>
      </div>
    </div>
  );
}
