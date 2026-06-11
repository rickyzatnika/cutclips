"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { convexMutation } from "@/lib/convex-rest";
import Image from "next/image";
import { useToast } from "@/components/ui/toast";
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink, ImageIcon, Trash2, X } from "lucide-react";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = !payments ? [] : filter === "all"
    ? payments
    : payments.filter((p) => p.status === filter);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p._id)));
  }

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

  async function handleDelete(payment: Doc<"payments">) {
    if (!confirm(`Hapus pembayaran dari ${payment.email}?`)) return;
    setBusy(payment._id);
    try {
      const res = await fetch("/api/delete-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIds: [payment._id], proofUrls: payment.proofUrl ? [payment.proofUrl] : [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast({ title: "Pembayaran dihapus", variant: "success" });
    } catch (err) {
      toast({ title: "Gagal hapus", description: err instanceof Error ? err.message : String(err), variant: "error" });
    }
    setBusy(null);
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Hapus ${selected.size} pembayaran?`)) return;
    setBusy("bulk");
    try {
      const ids = Array.from(selected);
      const urls = ids.map((id) => payments?.find((p) => p._id === id)?.proofUrl).filter(Boolean) as string[];
      const res = await fetch("/api/delete-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIds: ids, proofUrls: urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast({ title: `${selected.size} pembayaran dihapus`, variant: "success" });
      setSelected(new Set());
    } catch (err) {
      toast({ title: "Gagal hapus", description: err instanceof Error ? err.message : String(err), variant: "error" });
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
            onClick={() => { setFilter(t.key); setSelected(new Set()); }}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === t.key ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bulk delete bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{selected.size} terpilih</span>
          <button
            onClick={handleBulkDelete}
            disabled={busy === "bulk"}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
          >
            {busy === "bulk" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Hapus Semua
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="cursor-pointer ml-auto text-zinc-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
        <div className="space-y-3">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-1 py-1">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={selectAll}
              className="cursor-pointer h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-zinc-500">Pilih semua</span>
          </div>

          {filtered.map((payment) => (
            <div key={payment._id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(payment._id)}
                  onChange={() => toggleSelect(payment._id)}
                  className="mt-1 h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                />

                <div className="flex flex-1 flex-col gap-4 sm:flex-row">
                  {/* Proof image */}
                  <div className="shrink-0">
                    {payment.proofUrl ? (
                      <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="group relative block h-32 w-32 overflow-hidden rounded-xl bg-zinc-800">
                        <Image src={payment.proofUrl} alt="Bukti transfer" width={128} height={128} className="h-full w-full object-cover transition-opacity group-hover:opacity-80" unoptimized />
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
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{payment.email}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{payment.packId} — {payment.credits} credits</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(payment.status)}
                        <button
                          onClick={() => handleDelete(payment)}
                          disabled={busy === payment._id}
                          className="cursor-pointer rounded-lg p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          title="Hapus"
                        >
                          {busy === payment._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
