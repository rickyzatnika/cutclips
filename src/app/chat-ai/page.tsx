"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTypewriter } from "@/hooks/use-typewriter";
import { CirclePlay } from "lucide-react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  Youtube,
  Lightbulb,
  TrendingUp,
  Target,
  PenLine,
  Eye,
  MessageCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

const capabilities = [
  {
    icon: Youtube,
    title: "Analisis Video",
    desc: "Evaluasi performa video YouTube, engagement rate, dan potensi viral",
    prompt: "Analisis video YouTube ini buat aku",
  },
  {
    icon: Lightbulb,
    title: "Ide Konten Viral",
    desc: "Dapatkan ide konten berdasarkan tren terkini di TikTok, Instagram, YouTube",
    prompt: "Kasih ide konten viral yang lagi tren",
  },
  {
    icon: PenLine,
    title: "Optimasi Judul",
    desc: "Bantu bikin judul yang bikin penasaran dan thumbnail yang menarik",
    prompt: "Bantu bikin judul yang menarik buat video",
  },
  {
    icon: TrendingUp,
    title: "Strategi Posting",
    desc: "Saran jadwal posting, platform terbaik, dan format konten yang tepat",
    prompt: "Kapan waktu terbaik buat posting konten?",
  },
  {
    icon: Target,
    title: "Riset Audiens",
    desc: "Analisis demografi, preferensi, dan kebiasaan audiens target kamu",
    prompt: "Bantu aku memahami audiens target ku",
  },
  {
    icon: Eye,
    title: "Insight Kompetitor",
    desc: "Analisis strategi konten kompetitor di niche yang sama",
    prompt: "Analisis strategi konten kompetitor aku",
  },
];

export default function ChatAIListPage() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const router = useRouter();
  const { toast } = useToast();

  const user = useQuery(api.users.getByEmail, email ? { email } : "skip");
  const conversations = useQuery(
    api.conversations.list,
    email ? { email } : "skip",
  );

  const deleteConversation = useMutation(api.conversations.remove);
  const createConversation = useMutation(api.conversations.create);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const handleNewChat = async (prompt?: string) => {
    if (!email || starting) return;
    setStarting(true);
    try {
      const id = await createConversation({
        userEmail: email,
        title: prompt || "Percakapan Baru",
      });

      if (prompt) {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: id,
            message: prompt,
            email,
          }),
        });
      }

      router.push(`/chat-ai/${id}`);
    } catch {
      setStarting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await deleteConversation({
        conversationId: id as unknown as Id<"conversations">,
      });
      toast({ title: "Percakapan dihapus", variant: "success" });
    } catch (err) {
      toast({
        title: "Gagal menghapus",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div
      className={`flex flex-col bg-[#050505] min-h-screen ${starting ? "pointer-events-none opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4 sm:hidden">
        <Link
          href={session ? "/workspace" : "/"}
          className="flex items-center gap-2"
        >
          <CirclePlay className="h-7 w-7 text-emerald-400" />
          <span className="text-lg font-bold text-white">CutClips</span>
        </Link>
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24">
        <div className="flex mb-8 sm:mb-10 item-start justify-between">
          <div>
            <GreetingText user={user} />
          </div>
          <button
            onClick={() => handleNewChat()}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Baru
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-8 sm:mb-10">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <button
                key={cap.title}
                onClick={() => handleNewChat(cap.prompt)}
                className="group text-left rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-emerald-500/40 hover:bg-zinc-900 hover:-translate-y-0.5"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                  <Icon className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-white text-sm">
                  {cap.title}
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  {cap.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Quick prompt suggestions */}
        <div className="mb-8 sm:mb-10">
          <p className="text-xs text-zinc-600 mb-3 font-medium uppercase tracking-wider">
            Coba tanyakan:
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Analisis video YouTube ini...",
              "Kasih ide konten viral...",
              "Apa yang lagi tren di TikTok?",
              "Bantu bikin judul yang menarik...",
              "Kapan waktu terbaik posting?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => handleNewChat(q)}
                className="rounded-full border border-zinc-800 bg-zinc-900/30 px-3.5 py-1.5 text-xs text-zinc-400 transition-all hover:border-zinc-700 hover:text-zinc-300 hover:bg-zinc-900/60"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {!conversations ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
          </div>
        ) : conversations.length > 0 ? (
          <div className="border-t border-zinc-800/50 pt-6">
            <h3 className="text-xs font-medium text-zinc-600 mb-3 uppercase tracking-wider">
              Riwayat Percakapan
            </h3>
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv._id}
                  className="group flex items-center justify-between rounded-xl px-4 py-3 transition-colors cursor-pointer hover:bg-zinc-900"
                  onClick={() => router.push(`/chat-ai/${conv._id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {conv.title || "Percakapan baru"}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      {new Date(
                        conv.updatedAt || conv.createdAt,
                      ).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(conv._id);
                    }}
                    disabled={deleting === conv._id}
                    className="ml-2 flex cursor-pointer items-center gap-1 rounded-lg bg-zinc-800/50 px-2.5 py-2 text-xs text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center border-t border-zinc-800/30 pt-10">
            <MessageCircle className="mb-3 h-7 w-7 text-zinc-700" />
            <p className="text-sm text-zinc-600">
              Pilih salah satu di atas atau klik{" "}
              <span className="text-zinc-500">+Baru</span> untuk memulai
            </p>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">
              Hapus Percakapan?
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Semua pesan dalam percakapan ini akan dihapus permanen.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete}
                className="cursor-pointer rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
              >
                {deleting === confirmDelete ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GreetingText({ user }: { user: { name?: string } | null | undefined }) {
  const isLoading = user === undefined;

  const greeting = `Hai, ${user?.name || "Kreator"}..`;
  const subtitle = "Saya AI Assistant Analis, apa yang bisa saya bantu ?";

  const [showSub, setShowSub] = useState(false);
  const typedGreeting = useTypewriter(isLoading ? "" : greeting, 80);
  const typedSubtitle = useTypewriter(showSub ? subtitle : "", 40);

  const greetingDone = typedGreeting.length === greeting.length;

  useEffect(() => {
    if (greetingDone) {
      const t = setTimeout(() => setShowSub(true), 400);
      return () => clearTimeout(t);
    }
  }, [greetingDone]);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-7 sm:h-8 w-52 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-white">
        {typedGreeting}
        {!showSub && (
          <span className="inline-block w-0.5 h-5 bg-emerald-400 ml-0.5 animate-pulse" />
        )}
      </h2>
      <p className="text-sm text-zinc-400 mt-1.5 min-h-[1.25rem]">
        {typedSubtitle}
        {showSub && (
          <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
        )}
      </p>
    </div>
  );
}
