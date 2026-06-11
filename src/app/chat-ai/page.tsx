"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

export default function ChatAIListPage() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const router = useRouter();
  const { toast } = useToast();

  const conversations = useQuery(
    api.conversations.list,
    email ? { email } : "skip",
  );

  const deleteConversation = useMutation(api.conversations.remove);
  const createConversation = useMutation(api.conversations.create);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleNewChat = async () => {
    if (!email) return;
    try {
      const id = await createConversation({
        userEmail: email,
        title: "Percakapan Baru",
      });
      router.push(`/chat-ai/${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await deleteConversation({ conversationId: id as any });
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
    <div className="flex flex-col bg-[#050505] min-h-screen">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
        <h1 className="text-lg font-bold text-white">Tanya AI</h1>
        <button
          onClick={handleNewChat}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          Baru
        </button>
      </div>

      {!conversations ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <Sparkles className="mb-4 h-12 w-12 text-emerald-400/60" />
          <h2 className="text-lg font-semibold text-white">
            Belum ada percakapan
          </h2>
          <p className="mt-1 max-w-xs text-sm text-zinc-500">
            Mulai chat dengan AI untuk mencari ide konten atau diskusi
          </p>
          <button
            onClick={handleNewChat}
            className="mt-6 cursor-pointer rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Mulai Percakapan
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-1 p-3 pb-24">
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
                  {new Date(conv.updatedAt || conv.createdAt).toLocaleDateString(
                    "id-ID",
                    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
                  )}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(conv._id);
                }}
                disabled={deleting === conv._id}
                className="ml-2 flex cursor-pointer items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-2 text-xs text-zinc-400 transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Hapus Percakapan?</h3>
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
