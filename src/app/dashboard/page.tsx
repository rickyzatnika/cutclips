"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import {
  Users, CreditCard, DollarSign, Film, TrendingUp, TrendingDown,
} from "lucide-react";

/* ---------- helpers ---------- */

const formatPrice = (n: number) =>
  `Rp${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonthKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/* ---------- components ---------- */

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
  accent,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  accent?: string;
  delay: number;
}) {
  return (
    <div
      className="animate-fade-up rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 opacity-0 transition-colors hover:border-zinc-700"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-500">{label}</p>
          <p className={`text-2xl font-bold ${accent || "text-white"}`}>
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1">
              {trendUp !== undefined && (
                trendUp
                  ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )}
              <span className={`text-xs ${trendUp ? "text-emerald-400" : "text-red-400"}`}>
                {trend}
              </span>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-zinc-800/50 p-2.5">
          <Icon className={`h-5 w-5 ${accent || "text-zinc-400"}`} />
        </div>
      </div>
    </div>
  );
}

function BarChart({
  data,
  title,
  format,
  accent,
}: {
  data: { label: string; value: number }[];
  title: string;
  format?: (n: number) => string;
  accent?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="animate-fade-up rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 opacity-0"
      style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
    >
      <h3 className="mb-4 text-sm font-medium text-zinc-400">{title}</h3>
      {data.length === 0 ? (
        <div className="flex h-[140px] items-center justify-center text-xs text-zinc-600">
          No data yet
        </div>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height: 140 }}>
          {data.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] text-zinc-600">
                {format ? format(d.value) : d.value}
              </span>
              <div
                className="w-full rounded-t-md transition-all duration-700 ease-out"
                style={{
                  height: `${(d.value / max) * 100}%`,
                  backgroundColor: accent || "#10b981",
                  minHeight: d.value > 0 ? 4 : 0,
                }}
              />
              <span className="text-[10px] text-zinc-600">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DonutChart({
  data,
  title,
}: {
  data: { label: string; value: number; color: string }[];
  title: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const conic = data
    .map((d, i) => {
      const pct = total > 0 ? (d.value / total) * 100 : 0;
      const prev = data
        .slice(0, i)
        .reduce((s, x) => s + (total > 0 ? (x.value / total) * 100 : 0), 0);
      return `${d.color} ${prev}% ${prev + pct}%`;
    })
    .join(", ");

  return (
    <div className="animate-fade-up rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 opacity-0"
      style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
    >
      <h3 className="mb-4 text-sm font-medium text-zinc-400">{title}</h3>
      <div className="flex items-center gap-6">
        <div
          className="h-28 w-28 flex-shrink-0 rounded-full transition-all duration-1000"
          style={{
            background: total > 0 ? `conic-gradient(${conic})` : "#27272a",
          }}
        />
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-zinc-400">{d.label}</span>
              <span className="text-xs text-zinc-600">
                ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function DashboardPage() {
  const { data: session } = useSession();

  const queryUsers = useQuery(api.users.list);
  const queryPayments = useQuery(api.payments.listAll);
  const ready = queryUsers !== undefined && queryPayments !== undefined;
  const users = queryUsers;
  const payments = queryPayments;

  const stats = useMemo(() => {
    const u = users ?? [];
    const p = payments ?? [];
    const online = u.filter(
      (x: Doc<"users">) => x.lastActive && Date.now() - x.lastActive < 60 * 1000,
    ).length;
    const totalRevenue = p
      .filter((x: Doc<"payments">) => x.status === "approved")
      .reduce((s: number, x: Doc<"payments">) => s + x.amount, 0);
    const pendingCount = p.filter((x: Doc<"payments">) => x.status === "pending").length;
    const approvedCount = p.filter((x: Doc<"payments">) => x.status === "approved").length;
    const rejectedCount = p.filter((x: Doc<"payments">) => x.status === "rejected").length;
    const totalClipCredits = u.reduce((s: number, x: Doc<"users">) => s + x.totalCreditsUsed, 0);
    return { online, totalRevenue, pendingCount, approvedCount, rejectedCount, totalClipCredits };
  }, [users, payments]);

  const revenueByMonth = useMemo(() => {
    const p = payments ?? [];
    const map = new Map<string, number>();
    (p as Doc<"payments">[])
      .filter((x) => x.status === "approved")
      .forEach((x) => {
        const key = getMonthKey(x.createdAt);
        map.set(key, (map.get(key) || 0) + x.amount);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({
        label: MONTHS[+key.split("-")[1]],
        value,
      }));
  }, [payments]);

  const usersByMonth = useMemo(() => {
    const u = users ?? [];
    const map = new Map<string, number>();
    (u as Doc<"users">[]).forEach((x) => {
      const key = getMonthKey(x.joinedAt);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({
        label: MONTHS[+key.split("-")[1]],
        value,
      }));
  }, [users]);

  return (
    <div className="space-y-8">
      {/* header */}
      <div className="animate-fade-up opacity-0" style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Welcome back, {session?.user?.name}
        </p>
      </div>

      {/* stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={<>{ready ? stats.online : "..."}<span className="text-sm font-normal text-zinc-500"> / {ready ? (users?.length ?? 0) : "..."} online</span></>}
          trend="Active now"
          trendUp
          accent="text-white"
          delay={50}
        />
        <StatCard
          icon={CreditCard}
          label="Pending Payments"
          value={ready ? stats.pendingCount : "..."}
          trend="Awaiting approval"
          trendUp={stats.pendingCount > 0}
          accent="text-yellow-400"
          delay={150}
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={ready ? formatPrice(stats.totalRevenue) : "..."}
          trend={`${stats.approvedCount} approved`}
          trendUp
          accent="text-emerald-400"
          delay={250}
        />
        <StatCard
          icon={Film}
          label="Clips Generated"
          value={ready ? stats.totalClipCredits : "..."}
          trend="Credits used"
          trendUp
          accent="text-white"
          delay={350}
        />
      </div>

      {/* charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BarChart
          data={revenueByMonth}
          title="Revenue (last 6 months)"
          format={formatPrice}
          accent="#10b981"
        />
        <BarChart
          data={usersByMonth}
          title="New Users (last 6 months)"
          accent="#06b6d4"
        />
      </div>

      {/* payment distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        <DonutChart
          data={[
            { label: "Approved", value: stats.approvedCount, color: "#10b981" },
            { label: "Pending", value: stats.pendingCount, color: "#eab308" },
            { label: "Rejected", value: stats.rejectedCount, color: "#ef4444" },
          ]}
          title="Payment Status Distribution"
        />

        <div className="animate-fade-up rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 opacity-0 lg:col-span-2"
          style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
        >
          <h3 className="mb-4 text-sm font-medium text-zinc-400">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Total Revenue", value: ready ? formatPrice(stats.totalRevenue) : "...", accent: "text-emerald-400" },
              { label: "Pending Payments", value: String(stats.pendingCount), accent: "text-yellow-400" },
              { label: "Approved Payments", value: String(stats.approvedCount), accent: "text-emerald-400" },
              { label: "Rejected Payments", value: String(stats.rejectedCount), accent: "text-red-400" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-zinc-800/30 p-4">
                <p className="text-xs text-zinc-600">{item.label}</p>
                <p className={`mt-1 text-lg font-bold ${item.accent}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
