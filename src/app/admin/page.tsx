"use client";

import { useMemo, useEffect, useState } from "react";
import { Users, Film, TrendingUp, CreditCard, Loader2, CheckCircle2, XCircle, BarChart3, Wifi } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const ONLINE_WINDOW = 2 * 60 * 1000; // 2 menit

function isOnline(user: { lastActive?: number }) {
  return user.lastActive && Date.now() - user.lastActive < ONLINE_WINDOW;
}

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

const planColors: Record<string, string> = {
  free: "bg-surface-300",
  starter: "bg-blue-500",
  pro: "bg-purple-500",
  business: "bg-amber-500",
};

function groupByMonth(items: { timestamp: number }[], months: number) {
  const now = Date.now();
  const result: { month: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    const count = items.filter((item) => {
      const itemDate = new Date(item.timestamp);
      const itemKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, "0")}`;
      return itemKey === key;
    }).length;
    result.push({ month: label, count });
  }
  return result;
}

function Chart({ data, color, gradientId }: { data: { month: string; count: number }[]; color: string; gradientId: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-700" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: 13,
          }}
          cursor={{ fill: 'currentColor', className: 'text-surface-100 dark:text-surface-800' }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={`url(#${gradientId})`} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const planGradients: Record<string, string> = {
  free: "linear-gradient(90deg, #9ca3af, #d1d5db)",
  starter: "linear-gradient(90deg, #3b82f6, #60a5fa)",
  pro: "linear-gradient(90deg, #8b5cf6, #a78bfa)",
  business: "linear-gradient(90deg, #f59e0b, #fbbf24)",
};

function PlanBar({ label, count, total, color, gradient }: { label: string; count: number; total: number; color: string; gradient: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="group flex items-center gap-4">
      <span className="w-24 text-sm font-medium text-surface-700 dark:text-surface-300">{label}</span>
      <div className="flex-1 h-7 bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden relative">
        <div
          className="h-full rounded-lg transition-all duration-700 ease-out relative"
          style={{ width: `${pct}%`, background: gradient, minWidth: pct > 0 ? 12 : 0 }}
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <span className="w-14 text-right text-sm font-semibold text-surface-800 dark:text-surface-200">{count}</span>
      <span className="w-12 text-right text-xs text-surface-400">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function AdminPage() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const allUsers = useQuery(api.users.list);
  const allProjects = useQuery(api.projects.listAll);

  const onlineUsers = useMemo(() => allUsers?.filter(isOnline).length ?? 0, [allUsers, now]);
  const totalUsers = allUsers?.length ?? 0;
  const totalProjects = allProjects?.length ?? 0;
  const activeUsers = allUsers?.filter((u) => u.plan !== "free").length ?? 0;
  const totalCreditsUsed = allUsers?.reduce((sum, u) => sum + (u.totalCreditsUsed || 0), 0) ?? 0;

  const userMonthly = allUsers ? groupByMonth(allUsers.map((u) => ({ timestamp: u.joinedAt })), 6) : [];
  const projectMonthly = allProjects ? groupByMonth(allProjects.map((p) => ({ timestamp: p.createdAt })), 6) : [];

  const statStyles = [
    { bg: "from-indigo-500 to-indigo-600", shadow: "shadow-indigo-500/20" },
    { bg: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/20" },
    { bg: "from-amber-500 to-amber-600", shadow: "shadow-amber-500/20" },
    { bg: "from-cyan-500 to-cyan-600", shadow: "shadow-cyan-500/20" },
  ];

  const stats = [
    { label: "Total Users", value: totalUsers, icon: Users, change: `${onlineUsers} online \u00B7 ${activeUsers} paying` },
    { label: "Total Proyek", value: totalProjects, icon: Film, change: `${allProjects?.filter(p => p.status === "completed").length ?? 0} selesai` },
    { label: "Credits Used", value: totalCreditsUsed.toLocaleString("id-ID"), icon: CreditCard, change: "All time" },
    { label: "Platform", value: "Online", icon: TrendingUp, change: "All systems good" },
  ];

  const planData = [
    { plan: "Free", count: allUsers?.filter((u) => u.plan === "free").length ?? 0 },
    { plan: "Starter", count: allUsers?.filter((u) => u.plan === "starter").length ?? 0 },
    { plan: "Pro", count: allUsers?.filter((u) => u.plan === "pro").length ?? 0 },
    { plan: "Business", count: allUsers?.filter((u) => u.plan === "business").length ?? 0 },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900">Admin Overview</h1>
        <p className="mt-1 text-sm text-surface-500">Pantau pertumbuhan platform CutClips.</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-surface-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-surface-400">{stat.change}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${statStyles[idx].bg} text-white shadow-lg ${statStyles[idx].shadow}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <CardTitle>Pertumbuhan User</CardTitle>
              </div>
              <span className="text-xs text-surface-400">6 bulan terakhir</span>
            </div>
          </CardHeader>
          <CardContent>
            {allUsers ? (
              <Chart data={userMonthly} color="#6366f1" gradientId="userGradient" />
            ) : (
              <div className="flex h-[220px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <CardTitle>Pertumbuhan Proyek</CardTitle>
              </div>
              <span className="text-xs text-surface-400">6 bulan terakhir</span>
            </div>
          </CardHeader>
          <CardContent>
            {allProjects ? (
              <Chart data={projectMonthly} color="#22c55e" gradientId="projectGradient" />
            ) : (
              <div className="flex h-[220px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
                <Users className="h-4 w-4" />
              </div>
              <CardTitle>Users Terbaru</CardTitle>
            </div>
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
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold dark:bg-primary-950 dark:text-primary-300">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        {isOnline(user) && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-surface-900" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-surface-900 truncate">{user.name}</p>
                        <p className="text-xs text-surface-400 truncate">
                          {user.email} {user.role === "admin" && <span className="ml-1 text-[10px] font-medium text-primary-600 dark:text-primary-400">Admin</span>}
                        </p>
                      </div>
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
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <CardTitle>Paket Aktif</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!allUsers ? (
              <p className="py-8 text-center text-sm text-surface-400">Memuat...</p>
            ) : (
              planData.map((item) => (
                <PlanBar
                  key={item.plan}
                  label={item.plan}
                  count={item.count}
                  total={totalUsers}
                  color={planColors[item.plan.toLowerCase()] || "bg-surface-300"}
                  gradient={planGradients[item.plan.toLowerCase()] || planGradients.free}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
          {/* HIDE DULU TIDAK PERLU */}
      {/* <div className="mt-6">
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
      </div> */}
    </div>
  );
}
