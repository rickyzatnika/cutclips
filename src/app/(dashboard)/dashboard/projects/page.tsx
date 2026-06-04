"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Eye, ExternalLink, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useToast } from "@/components/ui/toast";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.listByUser);
  const deleteProject = useMutation(api.projects.remove);
  const { addToast } = useToast();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenu]);

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
          <h1 className="text-2xl font-bold text-surface-900">
            Proyek Saya
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            Kelola semua proyek short video Anda.
          </p>
        </div>
        <Link href="/dashboard/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Proyek Baru
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="px-6 py-4 font-medium text-surface-500">
                    Judul
                  </th>
                  <th className="px-6 py-4 font-medium text-surface-500">
                    Status
                  </th>
                  <th className="px-6 py-4 font-medium text-surface-500">
                    Short
                  </th>
                  <th className="px-6 py-4 font-medium text-surface-500">
                    Views
                  </th>
                  <th className="px-6 py-4 font-medium text-surface-500">
                    Tanggal
                  </th>
                  <th className="px-6 py-4 font-medium text-surface-500">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {!projects ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-surface-400">
                      Memuat...
                    </td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-surface-400">
                      Belum ada proyek.{" "}
                      <Link
                        href="/dashboard/new"
                        className="text-primary-600 hover:underline"
                      >
                        Buat proyek baru
                      </Link>
                    </td>
                  </tr>
                ) : (
                  projects.map((project) => {
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

                    const date = new Date(project.createdAt).toLocaleDateString(
                      "id-ID",
                      { dateStyle: "medium" },
                    );

                    return (
                      <tr
                        key={project._id}
                        className="hover:bg-surface-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="min-w-0 max-w-[250px]">
                            <p className="truncate font-medium text-surface-900">
                              {project.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-surface-400">
                              {project.youtubeUrl}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant}>
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-surface-600">
                          {project.shortCount}
                        </td>
                        <td className="px-6 py-4 text-surface-600">
                          {project.totalViews > 0
                            ? `${(project.totalViews / 1000).toFixed(1)}K`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-surface-600">
                          {date}
                        </td>
                        <td className="px-6 py-4 relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenuPos({ x: rect.right - 160, y: rect.bottom + 4 });
                              setOpenMenu(openMenu === project._id ? null : project._id);
                            }}
                            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {openMenu && (() => {
            const project = projects?.find(p => p._id === openMenu);
            if (!project) return null;
            return (
              <div
                ref={menuRef}
                className="fixed z-50 w-40 rounded-lg border border-surface-200 bg-white py-1 shadow-lg"
                style={{ left: menuPos.x, top: menuPos.y }}
              >
                <Link
                  href={`/dashboard/projects/${project._id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50"
                  onClick={() => setOpenMenu(null)}
                >
                  <Eye className="h-4 w-4" />
                  Detail
                </Link>
                <a
                  href={project.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50"
                  onClick={() => setOpenMenu(null)}
                >
                  <ExternalLink className="h-4 w-4" />
                  YouTube
                </a>
                <button
                  onClick={() => handleDelete(project._id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </button>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
