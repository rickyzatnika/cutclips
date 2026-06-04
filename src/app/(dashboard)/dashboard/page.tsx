"use client";

import Link from "next/link";
import { Film, TrendingUp, CreditCard, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/providers/auth";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useUser();

  const userData = useQuery(api.users.getMe);
  const projects = useQuery(api.projects.listByUser);
  const credits = useQuery(api.credits.getBalance);

  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  const totalViews = projects?.reduce((sum, p) => sum + (p.totalViews || 0), 0) || 0;
  const activeProjects = projects?.filter((p) => p.status === "processing").length || 0;
  const recentProjects = projects?.slice(0, 4) || [];

  const statCards = [
    {
      label: "Total Proyek",
      value: projects?.length ?? "-",
      icon: Film,
      change: activeProjects > 0 ? `${activeProjects} sedang diproses` : "Belum ada proyek",
    },
    {
      label: "Credits Tersisa",
      value: credits?.credits ?? "-",
      icon: CreditCard,
      change: credits ? `Plan: ${credits.plan}` : "Memuat...",
    },
    {
      label: "Total Views",
      value: totalViews > 0 ? `${(totalViews / 1000).toFixed(1)}K` : "0",
      icon: TrendingUp,
      change: totalViews > 0 ? "Dari semua proyek" : "Belum ada data",
    },
    {
      label: "Status Akun",
      value: credits?.plan ? credits.plan.charAt(0).toUpperCase() + credits.plan.slice(1) : "Free",
      icon: Film,
      change: user?.email || "Memuat...",
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
          <p className="mt-1 text-sm text-surface-500">
            Selamat datang{user?.name ? `, ${user.name}` : ""}!
          </p>
        </div>
        <Link href="/dashboard/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Proyek Baru
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-surface-900">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-surface-400">
                    {stat.change}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proyek Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-surface-100">
              {!projects ? (
                <p className="px-6 py-8 text-center text-sm text-surface-400">
                  Memuat...
                </p>
              ) : recentProjects.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-surface-400">
                  Belum ada proyek.{" "}
                  <Link
                    href="/dashboard/new"
                    className="text-primary-600 hover:underline"
                  >
                    Buat proyek pertama
                  </Link>
                </p>
              ) : (
                recentProjects.map((project) => {
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
                    <div
                      key={project._id}
                      className="flex items-center justify-between px-6 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-surface-900">
                          {project.title}
                        </p>
                        <p className="text-xs text-surface-400">{date}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-sm text-surface-500">
                          {project.totalViews > 0
                            ? `${(project.totalViews / 1000).toFixed(1)}K`
                            : "-"}
                        </span>
                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credit History</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[
                {
                  action: "Credits tersisa",
                  detail: `${credits?.credits ?? "-"} credits`,
                  time: credits ? `${credits.plan} plan` : "Memuat...",
                },
                {
                  action: "Total credits terpakai",
                  detail: `${credits?.totalUsed ?? "-"} credits`,
                  time: "Sepanjang waktu",
                },
                {
                  action: "Reset berikutnya",
                  detail: credits
                    ? `${30 - Math.floor((Date.now() - credits.lastReset) / (1000 * 60 * 60 * 24))} hari lagi`
                    : "Memuat...",
                  time: "Periodik 30 hari",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-surface-900">
                      {item.action}
                    </p>
                    <p className="text-xs text-surface-500">
                      {item.detail} &middot; {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
