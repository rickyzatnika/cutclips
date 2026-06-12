"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import dynamic from "next/dynamic";
import UpgradeModal from "@/components/ui/upgrade-modal";
import { Loader2, Sparkles } from "lucide-react";

const ChatDesktopHeader = dynamic(
  () => import("@/components/layout/chat-desktop-header"),
  { ssr: false },
);

export default function ChatAiLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const user = useQuery(
    api.users.getByEmail,
    session?.user?.email ? { email: session.user.email } : "skip",
  );

  const isPaid = user != null && (user.credits + (user.totalCreditsUsed ?? 0)) > 100;

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050505] px-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <Sparkles className="h-7 w-7 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Fitur AI Analyze</h2>
        <p className="max-w-xs text-sm text-zinc-400 leading-relaxed">
          Fitur ini hanya tersedia untuk pengguna Starter &amp; Kreator. Upgrade paket untuk mengakses AI analisis konten.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <a
            href="/workspace/billing"
            className="cursor-pointer rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Upgrade Sekarang
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050505]">
      <ChatDesktopHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
