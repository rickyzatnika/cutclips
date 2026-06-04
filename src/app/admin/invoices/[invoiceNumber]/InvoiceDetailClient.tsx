"use client";

import { notFound } from "next/navigation";
import { CreditCard, CheckCircle, Clock, AlertCircle, User, QrCode, Shield, Image, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@convex/_generated/api";
import { convex } from "@/lib/convex-client";
import { ConvexProvider, useQuery } from "convex/react";

const STATUS_LABELS = {
  pending: { label: "Menunggu", color: "text-amber-600 bg-amber-50", icon: Clock },
  paid: { label: "Lunas", color: "text-green-600 bg-green-50", icon: CheckCircle },
  cancelled: { label: "Dibatalkan", color: "text-red-600 bg-red-50", icon: AlertCircle },
};

function InvoiceDetailContent({ invoiceNumber }: { invoiceNumber: string }) {
  const invoices = useQuery(api.payments.listAllInvoices);
  const invoice = invoices?.find((inv) => inv.invoiceNumber === invoiceNumber);

  if (!invoice) {
    notFound();
  }

  const statusConfig = STATUS_LABELS[invoice.status as keyof typeof STATUS_LABELS] || STATUS_LABELS.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Detail Invoice</h1>
          <p className="text-surface-500">{invoice.invoiceNumber}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusConfig.color}`}>
          <StatusIcon className="h-4 w-4" />
          <span className="font-medium">{statusConfig.label}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Informasi Paket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-surface-500">Paket</p>
              <p className="text-xl font-semibold text-surface-900">{invoice.package}</p>
            </div>
            <div>
              <p className="text-sm text-surface-500">Credits</p>
              <p className="text-xl font-semibold text-primary-600">{invoice.credits.toLocaleString("id-ID")} credits</p>
            </div>
            <div>
              <p className="text-sm text-surface-500">Harga</p>
              <p className="text-xl font-semibold text-surface-900">Rp{invoice.price.toLocaleString("id-ID")}</p>
            </div>
            <div>
              <p className="text-sm text-surface-500">Tanggal Dibuat</p>
              <p className="text-surface-900">{new Date(invoice.createdAt).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            {invoice.paidAt && (
              <div>
                <p className="text-sm text-surface-500">Tanggal Dibayar</p>
                <p className="text-surface-900">{new Date(invoice.paidAt).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informasi Pelanggan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-surface-500">User ID</p>
              <p className="font-mono text-sm text-surface-900">{invoice.userId}</p>
            </div>
            <div>
              <p className="text-sm text-surface-500">Dikonfirmasi Oleh</p>
              <p className="text-surface-900">{invoice.confirmedBy ? `Admin ${invoice.confirmedBy}` : "Belum dikonfirmasi"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QRIS Placeholder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-surface-50 rounded-xl p-8 text-center border border-surface-200">
            <div className="mx-auto mb-4 w-48 h-48 bg-white rounded-lg flex items-center justify-center border border-surface-200">
              <QrCode className="h-24 w-24 text-surface-400" />
            </div>
            <p className="text-sm text-surface-500 mb-2">QRIS untuk pembayaran Rp{invoice.price.toLocaleString("id-ID")}</p>
            <p className="text-xs text-surface-400">Placeholder - Integrasi payment gateway nanti</p>
          </div>
        </CardContent>
      </Card>

      {invoice.buktiTransfer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Bukti Transfer Pelanggan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white border border-surface-200 rounded-lg p-3">
              <img
                src={invoice.buktiTransfer}
                alt="Bukti transfer"
                className="max-h-64 rounded-md"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {invoice.status === "pending" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Konfirmasi Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-white border border-amber-200 p-4 mb-4">
              <p className="text-amber-800 font-medium mb-2">Verifikasi Manual Admin</p>
              <p className="text-sm text-amber-700">Periksa bukti transfer pelanggan (screenshot/rekening) lalu konfirmasi di bawah ini. Credit akan otomatis ditambahkan ke akun user setelah konfirmasi.</p>
            </div>
            {!invoice.buktiTransfer && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-red-700 text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Belum ada bukti transfer dari pelanggan. Tidak bisa konfirmasi.
                </p>
              </div>
            )}
            <Button
              size="lg"
              className="w-full"
              disabled={!invoice.buktiTransfer}
              onClick={async () => {
                if (!invoice.buktiTransfer) return;
                const res = await fetch(`/api/admin/confirm-payment`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ invoiceId: invoice._id }),
                });
                if (res.ok) {
                  window.location.reload();
                } else {
                  alert("Gagal konfirmasi: " + (await res.text()));
                }
              }}
            >
              Konfirmasi Pembayaran & Berikan Credits
            </Button>
          </CardContent>
        </Card>
      )}

      {invoice.status === "paid" && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Pembayaran Terkonfirmasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-white border border-green-200 p-4">
              <p className="text-green-800 font-medium">Invoice ini telah dikonfirmasi dan {invoice.credits.toLocaleString("id-ID")} credits telah ditambahkan ke akun pelanggan.</p>
              <p className="text-sm text-green-700 mt-1">Dikonfirmasi pada: {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("id-ID") : "-"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {invoice.status === "cancelled" && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Invoice Dibatalkan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">Invoice ini telah dibatalkan (kadaluarsa atau dibatalkan manual).</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function InvoiceDetailClient({ invoiceNumber }: { invoiceNumber: string }) {
  return (
    <ConvexProvider client={convex}>
      <InvoiceDetailContent invoiceNumber={invoiceNumber} />
    </ConvexProvider>
  );
}