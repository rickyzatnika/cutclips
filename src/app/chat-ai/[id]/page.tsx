"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useRouter, useParams } from "next/navigation";
import LightGallery from "lightgallery/react";
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import lgZoom from "lightgallery/plugins/zoom";
import lgThumbnail from "lightgallery/plugins/thumbnail";

import {
  Send,
  Trash2,
  Plus,
  ChevronLeft,
  User,
  Bot,
  Loader2,
  MessageCircle,
  Mic,
  Menu,
  X,
  Square,
} from "lucide-react";

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    let i = 0;
    const speed = text.length > 200 ? 5 : text.length > 100 ? 8 : 12;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        doneRef.current = true;
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text]);

  return <>{displayed}</>;
}

type Message = {
  _id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
  videos?: {
    title: string;
    url: string;
    thumbnail: string;
    channelName?: string;
  }[];
  images?: {
    url: string;
    alt?: string;
  }[];
};

export default function ChatDetailPage() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const router = useRouter();
  const params = useParams();
  const conversationId = params.id as string;
  const convId = conversationId ? (conversationId as unknown as Id<"conversations">) : undefined;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const conversations = useQuery(
    api.conversations.list,
    email ? { email } : "skip",
  );
  const messages = useQuery(
    api.messages.list,
    convId ? { conversationId: convId } : "skip",
  ) as Message[] | undefined;

  const currentConv = conversations?.find((c) => c._id === conversationId);

  const deleteConversation = useMutation(api.conversations.remove);
  const createConversation = useMutation(api.conversations.create);
  const updateTitle = useMutation(api.conversations.updateTitle);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
    setRecordingDuration(0);
  };

  const getAudioMimeType = () => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
      "",
    ];
    for (const t of types) {
      if (t && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  };

  const getAudioExtension = (mimeType: string) => {
    if (mimeType.includes("mp4") || mimeType.includes("aac")) return "m4a";
    return "webm";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getAudioMimeType();
      const ext = getAudioExtension(mimeType);
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size < 1000) return;

        setSending(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, `voice.${ext}`);
          formData.append("conversationId", conversationId || "");
          formData.append("email", email || "");

          const res = await fetch("/api/chat", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          if ((!messages || messages.length === 0) && conversationId) {
            if (convId) updateTitle({ conversationId: convId, title: (data.transcript || "").slice(0, 60) });
          }
          if (data.content && "speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(data.content);
            utterance.lang = "id-ID";
            utterance.rate = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setSending(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      console.error("Microphone access denied");
    }
  };

  const handleMicTap = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !email) return;
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if ((!messages || messages.length === 0) && convId) {
        updateTitle({ conversationId: convId, title: text.slice(0, 60) });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (id: string) => {
    await deleteConversation({ conversationId: id as unknown as Id<"conversations"> });
    if (id === conversationId) {
      router.push("/chat-ai");
    }
  };

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

  return (
    <div className="flex h-screen flex-col bg-[#050505]">
      {/* Fixed top header */}
      <div className="fixed inset-x-0 top-0 z-40 border-b border-zinc-800 bg-[#050505] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-sm font-medium text-white truncate max-w-45">
              {currentConv?.title || "Percakapan Baru"}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition-colors hover:text-white"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 flex">
          <div
            className="flex-1 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="w-80 max-w-[85vw] border-l border-zinc-800 bg-[#050505]">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
              <h2 className="text-sm font-semibold text-white">Riwayat Chat</h2>
              <button
                onClick={handleNewChat}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
              >
                <Plus className="h-4 w-4" />
                Baru
              </button>
            </div>
            {!conversations ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <MessageCircle className="mb-3 h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">Belum ada percakapan</p>
              </div>
            ) : (
              <div
                className="space-y-1 overflow-y-auto p-3"
                style={{ height: "calc(100vh - 64px)" }}
              >
                {conversations.map((conv) => (
                  <div
                    key={conv._id}
                    className={`group flex items-center justify-between rounded-xl px-4 py-3 transition-colors cursor-pointer ${
                      conv._id === conversationId
                        ? "bg-emerald-500/10"
                        : "hover:bg-zinc-900"
                    }`}
                    onClick={() => {
                      router.push(`/chat-ai/${conv._id}`);
                      setSidebarOpen(false);
                    }}
                  >
                    <p className="min-w-0 flex-1 truncate text-sm text-white">
                      {conv.title || "Percakapan baru"}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(conv._id);
                      }}
                      className="ml-2 cursor-pointer rounded-lg p-1.5 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto pt-14 pb-20">
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {!messages && (
            <div className="flex items-center justify-center pt-20">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            </div>
          )}

          {messages?.length === 0 && !sending && (
            <div className="flex h-full flex-col items-center justify-center pt-20 text-center">
              <Bot className="mb-3 h-10 w-10 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">
                {currentConv?.title || "Percakapan Baru"}
              </h2>
              <p className="mt-1 max-w-xs text-sm text-zinc-500">
                Mulai diskusi dengan AI
              </p>
            </div>
          )}

          {messages?.map((msg, i) => (
            <div
              key={msg._id || i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Bot className="h-4 w-4 text-emerald-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-emerald-500 text-black"
                    : "border border-zinc-800 bg-zinc-900/50 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.role === "assistant" &&
                  i === (messages?.length ?? 0) - 1 ? (
                    <TypewriterText text={msg.content} />
                  ) : (
                    msg.content
                  )}
                </p>
                {msg.images && msg.images.length > 0 && (
                  <LightGallery
                    elementClassNames="mt-3 grid grid-cols-2 gap-2"
                    plugins={[lgZoom, lgThumbnail]}
                    download={true}
                    mobileSettings={{
                      controls: true,
                      showCloseIcon: true,
                      download: true,
                    }}
                    speed={300}
                  >
                    {msg.images.map((img, ii) => (
                      <a
                        key={ii}
                        data-src={img.url}
                        className="overflow-hidden rounded-xl border border-zinc-700"
                      >
                        <Image
                          src={img.url}
                          alt={img.alt || ""}
                          width={200}
                          height={96}
                          className="h-24 w-full object-cover"
                          unoptimized
                        />
                      </a>
                    ))}
                  </LightGallery>
                )}
                {msg.videos && msg.videos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.videos.map((v, vi) => (
                      <a
                        key={vi}
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-2 transition-colors hover:bg-zinc-800"
                      >
                        <Image
                          src={v.thumbnail}
                          alt={v.title}
                          width={96}
                          height={64}
                          className="h-16 w-24 rounded-lg object-cover"
                          unoptimized
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-medium text-white">
                            {v.title}
                          </p>
                          {v.channelName && (
                            <p className="mt-0.5 text-[10px] text-zinc-500">
                              {v.channelName}
                            </p>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                  <User className="h-4 w-4 text-black" />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                <Bot className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <p className="text-sm text-zinc-500">Wait, nuju mikir..</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed bottom input */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-[#050505] p-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
        }}
      >
        <div className="mx-auto max-w-3xl relative flex items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanya sesuatu..."
            rows={1}
            className="max-h-32 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 pr-24 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500"
            style={{ scrollbarWidth: "none" }}
          />
          <div className="absolute bottom-1 right-1 flex items-center gap-1">
            {recording ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  {recordingDuration}s
                </span>
                <button
                  onClick={handleMicTap}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-400"
                >
                  <Square className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleMicTap}
                  disabled={sending}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-white disabled:opacity-40"
                >
                  <Mic className="h-5 w-5" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-emerald-500 text-black transition-colors hover:bg-emerald-400 disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
