"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSession } from "next-auth/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Film,
  Brain,
  RotateCcw,
  Ban,
} from "lucide-react";

/* ---------- helpers ---------- */

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j`;
  return `${Math.floor(hrs / 24)}h`;
}

const statusColor: Record<string, string> = {
  queued: "text-yellow-400",
  processing: "text-blue-400",
  completed: "text-emerald-400",
  failed: "text-red-400",
};

const progressLabel: Record<string, string> = {
  downloading: "Download",
  cutting: "Cutting",
  uploading: "Upload",
  completing: "Finalize",
};

function StatusBadge({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    queued: <Clock className="h-3 w-3" />,
    processing: <Activity className="h-3 w-3" />,
    completed: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor[status]} bg-zinc-800`}
    >
      {icons[status]}
      {status}
    </span>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  loading,
  color,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  loading: boolean;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${color}`}
    >
      {loading ? (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {label}
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-500">{label}</p>
          <p className={`text-2xl font-bold ${accent || "text-white"}`}>
            {value}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-800/50 p-2.5">
          <Icon className={`h-5 w-5 ${accent || "text-zinc-400"}`} />
        </div>
      </div>
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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="mb-4 text-sm font-medium text-zinc-400">{title}</h3>
      <div className="flex items-center gap-6">
        <div
          className="h-24 w-24 shrink-0 rounded-full transition-all duration-1000"
          style={{
            background: total > 0 ? `conic-gradient(${conic})` : "#27272a",
          }}
        />
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-xs text-zinc-400">{d.label}</span>
              <span className="text-xs text-zinc-600">({d.value})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: string | null }) {
  if (!progress) return <span className="text-[11px] text-zinc-600">—</span>;
  const steps = ["downloading", "cutting", "uploading", "completing"];
  const idx = steps.indexOf(progress);
  const pct = idx >= 0 ? ((idx + 1) / steps.length) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-zinc-500">
        {progressLabel[progress] || progress}
      </span>
    </div>
  );
}

/* ---------- page ---------- */

export default function MonitoringPage() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const data = useQuery(api.exports.getMonitorData);
  const requeueExport = useMutation(api.exports.requeueExport);
  const cancelExport = useMutation(api.exports.cancelExport);
  const requeueAnalyze = useMutation(api.analyzeJobs.requeueAnalyze);
  const cancelAnalyze = useMutation(api.analyzeJobs.cancelAnalyze);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const ready = data !== undefined;

  const exportRate = useMemo(() => {
    if (!data) return { rate: 0, total: 0, failed: 0, success: 0 };
    const { completed, failed } = data.exports.counts;
    const total = completed + failed;
    return {
      rate: total > 0 ? Math.round((completed / total) * 100) : 100,
      total,
      failed,
      success: completed,
    };
  }, [data]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoadingMap((prev) => ({ ...prev, [key]: true }));
    try {
      await fn();
    } catch {
    } finally {
      setLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="space-y-8">
      {/* header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Monitoring</h1>
        <p className="mt-1 text-sm text-zinc-500">Worker & queue status</p>
      </div>

      {/* overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Film}
          label="Export Queue"
          value={
            ready
              ? data.exports.counts.queued + data.exports.counts.processing
              : "..."
          }
          accent="text-yellow-400"
        />
        <StatCard
          icon={Brain}
          label="Analyze Queue"
          value={
            ready
              ? data.analyzeJobs.counts.queued +
                data.analyzeJobs.counts.processing
              : "..."
          }
          accent="text-blue-400"
        />
        <StatCard
          icon={CheckCircle}
          label="Success Rate"
          value={ready ? `${exportRate.rate}%` : "..."}
          accent={exportRate.rate >= 80 ? "text-emerald-400" : "text-red-400"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Failed Jobs"
          value={ready ? exportRate.failed : "..."}
          accent={exportRate.failed > 0 ? "text-red-400" : "text-zinc-500"}
        />
      </div>

      {/* donut charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DonutChart
          title="Export Status"
          data={
            ready
              ? [
                  {
                    label: "Queued",
                    value: data.exports.counts.queued,
                    color: "#eab308",
                  },
                  {
                    label: "Processing",
                    value: data.exports.counts.processing,
                    color: "#3b82f6",
                  },
                  {
                    label: "Completed",
                    value: data.exports.counts.completed,
                    color: "#10b981",
                  },
                  {
                    label: "Failed",
                    value: data.exports.counts.failed,
                    color: "#ef4444",
                  },
                ]
              : []
          }
        />
        <DonutChart
          title="Analyze Job Status"
          data={
            ready
              ? [
                  {
                    label: "Queued",
                    value: data.analyzeJobs.counts.queued,
                    color: "#eab308",
                  },
                  {
                    label: "Processing",
                    value: data.analyzeJobs.counts.processing,
                    color: "#3b82f6",
                  },
                  {
                    label: "Completed",
                    value: data.analyzeJobs.counts.completed,
                    color: "#10b981",
                  },
                  {
                    label: "Failed",
                    value: data.analyzeJobs.counts.failed,
                    color: "#ef4444",
                  },
                ]
              : []
          }
        />
      </div>

      {/* recent exports */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="mb-4 text-sm font-medium text-zinc-400">
          Export Terbaru
        </h3>
        {!ready ? (
          <div className="py-8 text-center text-sm text-zinc-600">
            Loading...
          </div>
        ) : data.exports.recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-600">
            Belum ada export
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Video</th>
                  <th className="pb-2 pr-4 font-medium">Highlight</th>
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 pr-4 font-medium">Progress</th>
                  <th className="pb-2 pr-4 font-medium">Waktu</th>
                  <th className="pb-2 pr-4 font-medium">Error</th>
                  <th className="pb-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.exports.recent.map((exp: { _id: Id<"exports">; status: string; progress: string | null; error: string | null; videoTitle: string | null; highlightTitle: string | null; userEmail: string | null; createdAt: number }) => (
                  <tr
                    key={exp._id}
                    className="border-b border-zinc-800/50 text-zinc-300"
                  >
                    <td className="py-3 pr-4">
                      <StatusBadge status={exp.status} />
                    </td>
                    <td className="max-w-[140px] truncate py-3 pr-4 text-zinc-400">
                      {exp.videoTitle || "—"}
                    </td>
                    <td className="max-w-[120px] truncate py-3 pr-4 text-zinc-400">
                      {exp.highlightTitle || "—"}
                    </td>
                    <td className="max-w-[120px] truncate py-3 pr-4 text-zinc-500">
                      {exp.userEmail || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {exp.status === "processing" ? (
                        <ProgressBar progress={exp.progress} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-zinc-500">
                      {timeAgo(exp.createdAt)}
                    </td>
                    <td className="max-w-[140px] truncate py-3 text-red-400">
                      {exp.status === "failed" ? exp.error || "Unknown" : ""}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {exp.status === "failed" && (
                          <ActionButton
                            label="Rerun"
                            icon={RotateCcw}
                            loading={loadingMap[`rerun-${exp._id}`] ?? false}
                            color="text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() =>
                              act(`rerun-${exp._id}`, () =>
                                requeueExport({ exportId: exp._id, email }),
                              )
                            }
                          />
                        )}
                        {(exp.status === "queued" || exp.status === "processing") && (
                          <ActionButton
                            label="Batal"
                            icon={Ban}
                            loading={loadingMap[`cancel-${exp._id}`] ?? false}
                            color="text-red-400 hover:bg-red-500/10"
                            onClick={() =>
                              act(`cancel-${exp._id}`, () =>
                                cancelExport({ exportId: exp._id, email }),
                              )
                            }
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* recent analyze jobs */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="mb-4 text-sm font-medium text-zinc-400">
          Analyze Job Terbaru
        </h3>
        {!ready ? (
          <div className="py-8 text-center text-sm text-zinc-600">
            Loading...
          </div>
        ) : data.analyzeJobs.recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-600">
            Belum ada job
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Title</th>
                  <th className="pb-2 pr-4 font-medium">YouTube</th>
                  <th className="pb-2 pr-4 font-medium">Waktu</th>
                  <th className="pb-2 pr-4 font-medium">Error</th>
                  <th className="pb-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.analyzeJobs.recent.map((job: { _id: Id<"analyzeJobs">; status: string; title: string | null; youtubeUrl: string | null; createdAt: number; error: string | null }) => (
                  <tr
                    key={job._id}
                    className="border-b border-zinc-800/50 text-zinc-300"
                  >
                    <td className="py-3 pr-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="max-w-[160px] truncate py-3 pr-4 text-zinc-400">
                      {job.title || "—"}
                    </td>
                    <td className="max-w-[140px] truncate py-3 pr-4">
                      <a
                        href={`https://youtube.com/watch?v=${job.youtubeUrl}`}
                        target="_blank"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {job.youtubeUrl}
                      </a>
                    </td>
                    <td className="py-3 pr-4 text-zinc-500">
                      {timeAgo(job.createdAt)}
                    </td>
                    <td className="max-w-[160px] truncate py-3 text-red-400">
                      {job.status === "failed" ? job.error || "Unknown" : ""}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {job.status === "failed" && (
                          <ActionButton
                            label="Rerun"
                            icon={RotateCcw}
                            loading={loadingMap[`arun-${job._id}`] ?? false}
                            color="text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() =>
                              act(`arun-${job._id}`, () =>
                                requeueAnalyze({ jobId: job._id, email }),
                              )
                            }
                          />
                        )}
                        {(job.status === "queued" || job.status === "processing") && (
                          <ActionButton
                            label="Batal"
                            icon={Ban}
                            loading={loadingMap[`acancel-${job._id}`] ?? false}
                            color="text-red-400 hover:bg-red-500/10"
                            onClick={() =>
                              act(`acancel-${job._id}`, () =>
                                cancelAnalyze({ jobId: job._id, email }),
                              )
                            }
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
