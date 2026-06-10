"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { convexMutation } from "@/lib/convex-rest";
import { useToast } from "@/components/ui/toast";
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink, ImageIcon } from "lucide-react";
import type { Doc } from "@convex/_generated/dataModel";

type Filter = "all" | "pending" | "approved" | "rejected";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function PaymentsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const payments = useQuery(api.payments.listAll);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = !payments ? [] : filter === "all"
    ? payments
    : payments.filter((p) => p.status === filter);

  async function handleApprove(payment: Doc<"payments">) {
    setBusy(payment._id);
    try {
      await convexMutation("payments:approve", { paymentId: payment._id, adminEmail: session!.user!.email });
      toast({ title: "Pembayaran di-approve!", description: `${payment.credits} credits ditambahkan ke ${payment.email}`, variant: "success" });
    } catch (err) {
      toast({ title: "Gagal approve", description: err instanceof Error ? err.message : String(err), variant: "error" });
    }
    setBusy(null);
  }

  async function handleReject(payment: Doc<"payments">) {
    const note = prompt("Alasan ditolak (opsional):");
    setBusy(payment._id);
    try {
      await convexMutation("payments:reject", { paymentId: payment._id, adminEmail: session!.user!.email, note: note || undefined });
      toast({ title: "Pembayaran di-reject", variant: "info" });
    } catch (err) {
      toast({ title: "Gagal reject", description: err instanceof Error ? err.message : String(err), variant: "error" });
    }
    setBusy(null);
  }

  const counts = {
    all: payments?.length || 0,
    pending: payments?.filter((p) => p.status === "pending").length || 0,
    approved: payments?.filter((p) => p.status === "approved").length || 0,
    rejected: payments?.filter((p) => p.status === "rejected").length || 0,
  };

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: `Semua (${counts.all})` },
    { key: "pending", label: `Pending (${counts.pending})` },
    { key: "approved", label: `Approved (${counts.approved})` },
    { key: "rejected", label: `Rejected (${counts.rejected})` },
  ];

  const statusBadge = (status: string) => {
    if (status === "pending") return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400"><Clock className="h-3 w-3" />Pending</span>;
    if (status === "approved") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400"><CheckCircle className="h-3 w-3" />Approved</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400"><XCircle className="h-3 w-3" />Rejected</span>;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pembayaran</h1>
        <p className="mt-1 text-sm text-zinc-500">Kelola pembayaran user & lihat bukti transfer</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === t.key ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!payments ? (
        <div className="rounded-2xl border border-zinc-800 p-12 text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-zinc-600" />
          <p className="text-sm text-zinc-500">Memuat...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 p-12 text-center">
          <p className="text-sm text-zinc-500">Belum ada pembayaran</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((payment) => (
            <div key={payment._id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* Proof image */}
                <div className="shrink-0">
                  {payment.proofUrl ? (
                    <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="group relative block h-32 w-32 overflow-hidden rounded-xl bg-zinc-800">
                      <img src={payment.proofUrl} alt="Bukti transfer" className="h-full w-full object-cover transition-opacity group-hover:opacity-80" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                        <ExternalLink className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </a>
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-zinc-800">
                      <ImageIcon className="h-8 w-8 text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{payment.email}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{payment.packId} — {payment.credits} credits</p>
                    </div>
                    {statusBadge(payment.status)}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <span>Rp{payment.amount.toLocaleString("id-ID")}</span>
                    <span>{formatDate(payment.createdAt)}</span>
                    {payment.approvedAt && <span>Diproses: {formatDate(payment.approvedAt)}</span>}
                    {payment.adminNote && <span className="w-full text-yellow-400">Catatan: {payment.adminNote}</span>}
                  </div>

                  {/* Actions */}
                  {payment.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleApprove(payment)}
                        disabled={busy === payment._id}
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {busy === payment._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(payment)}
                        disabled={busy === payment._id}
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
