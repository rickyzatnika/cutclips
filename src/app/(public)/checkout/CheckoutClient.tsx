"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CreditCard, QrCode, Shield, Clock, CheckCircle, AlertCircle, Loader2, Upload, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/providers/auth";
import { ConvexProvider, useMutation, useQuery } from "convex/react";
import { convex } from "@/lib/convex-client";
import { api } from "@convex/_generated/api";
import { useToast } from "@/components/ui/toast";

const PACKAGES: Record<string, { id: string; label: string; price: number; credits: number; desc: string; popular?: boolean }> = {
  starter: { id: "starter", label: "Starter", price: 25000, credits: 100, desc: "Untuk creative individu" },
  pro: { id: "pro", label: "Pro", price: 75000, credits: 200, desc: "Untuk professional creator & tim", popular: true },
  business: { id: "business", label: "Business", price: 150000, credits: 500, desc: "Untuk organisasi dengan kebutuhan khusus" },
};

export function CheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useUser();
  const packageId = searchParams.get("package") || "starter";
  const pkg = PACKAGES[packageId as keyof typeof PACKAGES] || PACKAGES.starter;

  const [invoice, setInvoice] = useState<{ _id: string; invoiceNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const createInvoice = useMutation(api.payments.createInvoice);
  const uploadBuktiTransfer = useMutation(api.payments.uploadBuktiTransfer);
  const invoiceQuery = useQuery(
    api.payments.getInvoiceById,
    invoice ? { invoiceId: invoice._id as any } : "skip"
  );

  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/checkout?package=${packageId}`);
    }
  }, [user, authLoading, router, packageId]);

  const handleCreateInvoice = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createInvoice({ packageId });
      setInvoice(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && !invoice && !loading) {
      handleCreateInvoice();
    }
  }, [user, authLoading, invoice, loading, createInvoice]);

  if (authLoading || !pkg) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CreditCard className="h-16 w-16 text-surface-300 mb-4" />
        <h2 className="text-2xl font-bold text-surface-900 mb-2">Silakan Login Terlebih Dahulu</h2>
        <p className="text-surface-500 mb-6 max-w-md">Anda perlu login untuk melanjutkan pembelian paket {pkg?.label}.</p>
        <Button size="lg" onClick={() => router.push(`/login?redirect=/checkout?package=${packageId}`)}>
          Login / Daftar
        </Button>
      </div>
    );
  }

  if (loading && !invoice) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-surface-900 mb-2">Terjadi Kesalahan</h2>
        <p className="text-surface-500 mb-6 max-w-md">{error}</p>
        <Button variant="outline" onClick={handleCreateInvoice}>Coba Lagi</Button>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  const status = invoiceQuery?.status || "pending";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-surface-900">Checkout Paket {pkg?.label}</h1>
        <p className="mt-2 text-surface-500">Pembayaran sekali bayar, credit tidak kadaluarsa</p>
      </div>

      <Card className={pkg?.id === "pro" ? "ring-2 ring-primary-500" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {pkg?.label}
                {pkg?.id === "pro" && (
                  <span className="text-sm px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                    Paling Populer
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-surface-500">{pkg?.id === "starter" ? "Untuk creative individu" : pkg?.id === "pro" ? "Untuk professional creator & tim" : "Untuk organisasi dengan kebutuhan khusus"}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-surface-900">Rp{pkg?.price.toLocaleString("id-ID")}</div>
              <div className="text-sm text-surface-500">{pkg?.credits.toLocaleString("id-ID")} credits</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-600">Jumlah</span>
              <span className="font-semibold text-surface-900">Rp{pkg?.price.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-600">Credits</span>
              <span className="font-semibold text-primary-600">+{pkg?.credits.toLocaleString("id-ID")} credits</span>
            </div>
            <hr className="border-surface-200" />
            <div className="flex items-center justify-between text-lg font-semibold">
              <span className="text-surface-900">Total</span>
              <span className="text-surface-900">Rp{pkg?.price.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {status === "pending" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Pembayaran QRIS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-surface-50 rounded-xl p-8 text-center border border-surface-200">
                <div className="mx-auto mb-4 w-48 h-48 bg-white rounded-lg flex items-center justify-center border border-surface-200">
                  <QrCode className="h-24 w-24 text-surface-400" />
                </div>
                <p className="text-sm text-surface-500 mb-2">Scan QRIS di atas untuk membayar</p>
                <p className="text-lg font-semibold text-surface-900">Rp{pkg?.price.toLocaleString("id-ID")}</p>
                <p className="text-xs text-surface-400 mt-1">QRIS Placeholder - Integrasi payment gateway nanti</p>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">Batas Waktu Pembayaran</p>
                    <p className="text-sm text-amber-700">Invoice berlaku selama 24 jam. Jika melewati batas waktu, invoice akan dibatalkan otomatis.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-surface-600">
                <p><strong>Nomor Invoice:</strong> {invoice.invoiceNumber}</p>
                <p><strong>Status:</strong> <span className="text-amber-600 font-medium">Menunggu Pembayaran</span></p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full">Kembali ke Dashboard</Button>
                </Link>
                <Button variant="secondary" className="w-full" disabled>Sudah Bayar (Manual Check)</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Bukti Transfer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoiceQuery?.buktiTransfer ? (
                <div className="space-y-3">
                  <p className="text-sm text-green-700 font-medium">Bukti transfer sudah diupload</p>
                  <div className="bg-white border border-surface-200 rounded-lg p-3">
                    <img
                      src={invoiceQuery.buktiTransfer}
                      alt="Bukti transfer"
                      className="max-h-48 rounded-md"
                    />
                    <p className="text-xs text-surface-500 mt-2 text-center">Klik untuk memperbarui</p>
                  </div>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
                  onClick={() => document.getElementById("bukti-upload")?.click()}
                >
                  <input
                    id="bukti-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setBuktiFile(file);
                    }}
                    disabled={uploading}
                  />
                  <Upload className="mx-auto h-12 w-12 text-surface-400 mb-3" />
                  <p className="text-surface-600">Klik atau drag & drop untuk upload bukti transfer</p>
                  <p className="text-xs text-surface-400 mt-1">Format: JPG, PNG (max 5MB)</p>
                </div>
              )}

              {buktiFile && !invoiceQuery?.buktiTransfer && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg">
                    <FileText className="h-6 w-6 text-primary-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-surface-900">{buktiFile.name}</p>
                      <p className="text-xs text-surface-500">{(buktiFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={async () => {
                      if (!buktiFile) return;
                      setUploading(true);
                      try {
                        const base64 = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(buktiFile);
                        });
                        await uploadBuktiTransfer({ invoiceId: invoice._id as any, buktiTransfer: base64 });
                        addToast("Bukti transfer berhasil diupload!", "success");
                        setBuktiFile(null);
                      } catch (err) {
                        addToast("Gagal upload: " + (err instanceof Error ? err.message : "Unknown error"), "error");
                      } finally {
                        setUploading(false);
                      }
                    }}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Mengupload...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Bukti Transfer
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Keamanan & Garansi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-surface-600">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Pembayaran manual diverifikasi admin (maks 1x24 jam)</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Credit masuk otomatis setelah verifikasi</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Credit tidak kadaluarsa (one-time purchase)</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Bisa top-up kapan saja</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {status === "paid" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 pb-6 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-2xl font-bold text-green-800">Pembayaran Berhasil!</h3>
            <p className="mt-2 text-green-700">{pkg?.credits.toLocaleString("id-ID")} credits telah ditambahkan ke akun Anda.</p>
            <p className="mt-1 text-sm text-green-600">Invoice: {invoice.invoiceNumber} • Dibayar: {new Date(invoiceQuery?.paidAt || Date.now()).toLocaleDateString("id-ID")}</p>
            <Link href="/dashboard" className="mt-6 inline-block">
              <Button size="lg"><CreditCard className="mr-2 h-4 w-4" /> Ke Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {status === "cancelled" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-2xl font-bold text-red-800">Invoice Dibatalkan</h3>
            <p className="mt-2 text-red-700">Invoice ini telah kadaluarsa atau dibatalkan.</p>
            <Link href={`/checkout?package=${packageId}`} className="mt-6 inline-block">
              <Button size="lg">Buat Invoice Baru</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}