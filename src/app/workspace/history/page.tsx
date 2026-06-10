"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ExternalLink, Search, Film, Calendar, Clock, Hash, Youtube } from "lucide-react";

function getYoutubeThumbnail(url: string): string {
  const m = url.match(/(?:youtu\.be\/|v=|vi\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return "";
}

function getYoutubeId(url: string): string {
  const m = url.match(/(?:youtu\.be\/|v=|vi\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : "";
}

export default function HistoryPage() {
  const videos = useQuery(api.videos.listByUserWithStats);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");

  const filtered = useMemo(() => {
    if (!videos) return [];
    let list = [...videos];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) => v.title.toLowerCase().includes(q) || v.youtubeUrl.toLowerCase().includes(q),
      );
    }
    if (sortBy === "newest") list.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === "oldest") list.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortBy === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "clips") list.sort((a, b) => b.clipCount - a.clipCount);
    return list;
  }, [videos, search, sortBy]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Riwayat Video</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Semua video YouTube yang pernah kamu analisis
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari video..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-400 outline-none transition-colors focus:border-emerald-500"
        >
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
          <option value="title">A-Z</option>
          <option value="clips">Terbanyak Clip</option>
        </select>
      </div>

      {!videos ? (
        <div className="rounded-2xl border border-zinc-800 p-12 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
          <p className="text-sm text-zinc-500">Memuat...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 p-12 text-center">
          <Film className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {search ? "Video tidak ditemukan" : "Belum ada video yang dianalisis"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((video) => {
            const thumb = video.thumbnailUrl || getYoutubeThumbnail(video.youtubeUrl);
            return (
              <div
                key={video._id}
                className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
              >
                <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                  <img
                    src={thumb}
                    alt={video.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white">
                    {Math.floor(video.duration / 60)}m
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-white">
                    {video.title}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {video.highlightCount} highlight
                    </span>
                    <span className="flex items-center gap-1">
                      <Film className="h-3 w-3" />
                      {video.clipCount} clip
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(video.createdAt).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Link
                      href={`/analyze?url=${encodeURIComponent(video.youtubeUrl)}`}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                    >
                      Analisis Ulang
                    </Link>
                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-400 transition-colors hover:text-white"
                    >
                      <Youtube className="h-3 w-3" />
                      YouTube
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
