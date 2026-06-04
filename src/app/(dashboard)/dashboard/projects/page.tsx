"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder, MoreHorizontal, Eye, ExternalLink, Trash2, Film, FileText, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useToast } from "@/components/ui/toast";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.listByUser);
  const deleteProject = useMutation(api.projects.remove);
  const { addToast } = useToast();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleDelete = async (projectId: string) => {
    try {
      await fetch("/api/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      await deleteProject({ projectId: projectId as any });
      addToast("Proyek berhasil dihapus", "success");
    } catch {
      addToast("Gagal menghapus proyek", "error");
    }
    setOpenMenu(null);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Proyek Saya</h1>
          <p className="mt-1 text-sm text-surface-500">Kelola semua proyek short video Anda.</p>
        </div>
      </div>

      {!projects ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="mb-3 h-16 w-16 rounded-xl" />
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="mb-3 h-3 w-20" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Folder className="h-12 w-12 text-surface-300" />
            <p className="text-sm text-surface-400">Belum ada proyek.</p>
            <div className="flex gap-3">
              <Link href="/dashboard/new">
                <Button variant="outline" className="gap-2"><Globe className="h-4 w-4" />YouTube URL</Button>
              </Link>
              <Link href="/dashboard/script-generator">
                <Button className="gap-2"><FileText className="h-4 w-4" />Text to Video</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => {
            const statusLabel =
              project.status === "processing"
                ? "Diproses"
                : project.status === "completed"
                  ? "Selesai"
                  : "Gagal";
            const statusVariant =
              project.status === "completed"
                ? ("success" as const)
                : project.status === "processing"
                  ? ("warning" as const)
                  : ("danger" as const);

            const date = new Date(project.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" });
            const projectType = project.type || "youtube";

            return (
              <div key={project._id} className="group relative">
                <Link href={`/dashboard/projects/${project._id}`}>
                  <Card className="cursor-pointer transition-all hover:border-primary-300 hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-100 text-surface-400 dark:bg-surface-800">
                          {projectType === "script" ? (
                            <FileText className="h-7 w-7" />
                          ) : (
                            <Film className="h-7 w-7" />
                          )}
                        </div>
                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                      </div>
                      <p className="mb-1 truncate font-medium text-surface-900 dark:text-surface-100">
                        {project.title}
                      </p>
                      <p className="mb-3 text-xs text-surface-400">{date}</p>
                      <div className="flex items-center gap-3 text-xs text-surface-500">
                        <span>{project.shortCount || 0} short</span>
                        <span className="text-surface-300">|</span>
                        <span>{project.totalViews > 0 ? `${(project.totalViews / 1000).toFixed(1)}K` : "0"} views</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setOpenMenu(openMenu === project._id ? null : project._id);
                  }}
                  className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-surface-400 opacity-0 transition-opacity hover:bg-surface-100 hover:text-surface-600 group-hover:opacity-100 dark:hover:bg-surface-800 dark:hover:text-surface-300"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {openMenu === project._id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-0 top-12 z-50 w-40 rounded-lg border border-surface-200 bg-white py-1 shadow-lg dark:border-surface-700 dark:bg-surface-900">
                      <Link
                        href={`/dashboard/projects/${project._id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800"
                        onClick={() => setOpenMenu(null)}
                      >
                        <Eye className="h-4 w-4" />
                        Detail
                      </Link>
                      {project.youtubeUrl && (
                        <a
                          href={project.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800"
                          onClick={() => setOpenMenu(null)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          YouTube
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(project._id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4" />
                        Hapus
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
