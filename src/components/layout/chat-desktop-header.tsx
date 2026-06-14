"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { AiAnalyzeLink } from "@/components/chat-ai/ai-analyze-link";
import {
  Plus,
  Film,
  History,
  CreditCard,
  MessageCircle,
  LayoutDashboard,
} from "lucide-react";

export default function ChatDesktopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const createConversation = useMutation(api.conversations.create);
  const user = useQuery(
    api.users.getByEmail,
    session?.user?.email ? { email: session.user.email } : "skip",
  );
  const isAdmin = user?.role === "admin";

  const handleNewChat = async () => {
    if (!session?.user?.email) return;
    try {
      const id = await createConversation({
        userEmail: session.user.email,
        title: "Percakapan Baru",
      });
      router.push(`/chat-ai/${id}`);
    } catch {}
  };

  return (
    <div className="hidden sm:flex items-center justify-between border-b border-zinc-800 px-6 py-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-emerald-400" />
        <span className="font-bold text-white">AI Analyze</span>
      </div>

      <nav className="flex items-center gap-4">
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
      </nav>
    </div>
  );
}
