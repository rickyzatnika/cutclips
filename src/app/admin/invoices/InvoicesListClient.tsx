"use client";

import { CreditCard, Clock, CheckCircle, AlertCircle, User, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@convex/_generated/api";
import { convex } from "@/lib/convex-client";
import { ConvexProvider, useQuery } from "convex/react";
import Link from "next/link";

function formatDistanceToNow(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} detik lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Clock },
  paid: { label: "Lunas", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle },
  cancelled: { label: "Dibatalkan", color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
};

function InvoicesListContent() {
  const invoices = useQuery(api.payments.listAllInvoices);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Kelola Invoice</h1>
          <p className="text-surface-400">Verifikasi pembayaran & kelola transaksi</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-white">Daftar Invoice</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <Input
                placeholder="Cari invoice..."
                className="pl-10 w-64"
                type="search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-surface-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">Pelanggan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">Paket</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">Jumlah</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {invoices?.map((invoice) => {
                  const statusConfig = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={invoice._id} className="hover:bg-surface-800/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-mono text-sm text-white">{invoice.invoiceNumber}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-surface-400" />
                          <span className="font-mono text-sm text-surface-300">{invoice.userId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-900/30 text-primary-300">
                          {invoice.package}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-white">Rp{invoice.price.toLocaleString("id-ID")}</div>
                        <div className="text-xs text-surface-400">{invoice.credits.toLocaleString("id-ID")} credits</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-white">{new Date(invoice.createdAt).toLocaleDateString("id-ID")}</div>
                        <div className="text-xs text-surface-400">{formatDistanceToNow(new Date(invoice.createdAt))}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/invoices/${invoice.invoiceNumber}`}
                          className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                        >
                          <CreditCard className="h-4 w-4" />
                          Detail
                        </Link>
                      </td>
                    </tr>
                  );
                }) || []}
              </tbody>
            </table>
            {(!invoices || invoices.length === 0) && (
              <div className="p-12 text-center">
                <CreditCard className="mx-auto h-12 w-12 text-surface-500 mb-4" />
                <p className="text-surface-400">Belum ada invoice</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function InvoicesListClient() {
  return (
    <ConvexProvider client={convex}>
      <InvoicesListContent />
    </ConvexProvider>
  );
}