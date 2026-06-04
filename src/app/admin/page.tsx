"use client";

import { Users, Film, TrendingUp, CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

const statusIcon: Record<string, React.ReactNode> = {
  queued: <Loader2 className="h-3 w-3 animate-spin" />,
  processing: <Loader2 className="h-3 w-3 animate-spin" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
};

const statusColor: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function AdminPage() {
  const allUsers = useQuery(api.users.list);
  const allProjects = useQuery(api.projects.listAll);

  const totalUsers = allUsers?.length ?? 0;
  const totalProjects = allProjects?.length ?? 0;
  const activeUsers = allUsers?.filter((u) => u.plan !== "free").length ?? 0;
  const totalCreditsUsed = allUsers?.reduce((sum, u) => sum + (u.totalCreditsUsed || 0), 0) ?? 0;

  const stats = [
    { label: "Total Users", value: totalUsers, icon: Users, change: `${activeUsers} active paying` },
    { label: "Total Proyek", value: totalProjects, icon: Film, change: `${allProjects?.filter(p => p.status === "completed").length ?? 0} selesai` },
    { label: "Credits Used", value: totalCreditsUsed.toLocaleString("id-ID"), icon: CreditCard, change: "All time" },
    { label: "Platform", value: "Online", icon: TrendingUp, change: "All systems good" },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900">Admin Overview</h1>
        <p className="mt-1 text-sm text-surface-500">Pantau pertumbuhan platform CutClips.</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-surface-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-surface-400">{stat.change}</p>
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
            <CardTitle>Users Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-surface-100">
              {!allUsers ? (
                <p className="px-6 py-8 text-center text-sm text-surface-400">Memuat...</p>
              ) : allUsers.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-surface-400">Belum ada user</p>
              ) : (
                allUsers.slice(0, 5).map((user) => (
                  <div key={user._id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-surface-900">{user.name}</p>
                      <p className="text-xs text-surface-400">{user.email} {user.role === "admin" && "👑"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-surface-400">{user.plan}</span>
                      <span className="text-xs font-medium text-surface-600">{user.credits} cr</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paket Aktif</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-surface-100">
              {!allUsers ? (
                <p className="px-6 py-8 text-center text-sm text-surface-400">Memuat...</p>
              ) : (
                [
                  { plan: "Free", count: allUsers.filter((u) => u.plan === "free").length },
                  { plan: "Starter", count: allUsers.filter((u) => u.plan === "starter").length },
                  { plan: "Pro", count: allUsers.filter((u) => u.plan === "pro").length },
                  { plan: "Business", count: allUsers.filter((u) => u.plan === "business").length },
                ].map((item) => (
                  <div key={item.plan} className="flex items-center justify-between px-6 py-4">
                    <p className="text-sm font-medium text-surface-900">{item.plan}</p>
                    <p className="text-sm text-surface-600">{item.count}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Proyek Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-surface-100">
              {!allProjects ? (
                <p className="px-6 py-8 text-center text-sm text-surface-400">Memuat...</p>
              ) : allProjects.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-surface-400">Belum ada proyek</p>
              ) : (
                allProjects.slice(0, 10).map((project) => (
                  <Link
                    key={project._id}
                    href={`/dashboard/projects/${project._id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-surface-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-surface-900 truncate">{project.title}</p>
                      <p className="text-xs text-surface-400 truncate">{project.youtubeUrl}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[project.status] || "bg-gray-100 text-gray-700"}`}>
                        {statusIcon[project.status]}
                        {project.status}
                      </span>
                      {project.progress != null && project.progress > 0 && project.progress < 100 && (
                        <span className="text-xs text-surface-400">{project.progress}%</span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
