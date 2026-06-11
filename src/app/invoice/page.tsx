"use client";

import { Suspense, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowLeft, CheckCircle, AlertCircle, Upload } from "lucide-react";

const PACK_LABELS: Record<string, string> = {
  starter: "Paket Starter",
  creator: "Paket Creator",
};

function InvoiceContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const packId = searchParams.get("packId") || "";
  const credits = searchParams.get("credits") || "0";
  const amount = parseInt(searchParams.get("amount") || "0", 10);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const formatPrice = (n: number) =>
    `Rp${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  const handleUpload = async () => {
    if (!selectedFile || !session) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("proof", selectedFile);
      formData.append("packId", packId);
      formData.append("credits", credits);
      formData.append("amount", String(amount));

      const res = await fetch("/api/upload-proof", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload gagal");

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-zinc-500" />
          <p className="mt-4 text-sm text-zinc-400">
            Silakan <Link href="/login" className="text-emerald-400 hover:underline">masuk</Link> terlebih dahulu.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-4 text-lg font-semibold text-white">Bukti Terkirim!</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Bukti pembayaran akan diverifikasi oleh admin. Kredit akan masuk setelah disetujui.
          </p>
          <Link
            href="/workspace"
            className="mt-6 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-lg px-4 py-8">
        <Link
          href="/workspace/billing"
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h1 className="text-lg font-bold text-white">Invoice Pembayaran</h1>

          <div className="mt-6 space-y-3 border-t border-zinc-800 pt-6">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Paket</span>
              <span className="text-white">{PACK_LABELS[packId] || packId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Kredit</span>
              <span className="text-white">{credits} Kredit</span>
            </div>
            <div className="flex justify-between text-sm border-t border-zinc-800 pt-3">
              <span className="text-zinc-300 font-semibold">Total</span>
              <span className="text-emerald-400 font-bold">{formatPrice(amount)}</span>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 text-center">
            <p className="mb-3 text-sm text-zinc-400">Scan QRIS untuk membayar</p>
            <div className="mx-auto flex items-center justify-center">
              <Image
                src="/QRIS.jpeg"
                alt="QRIS"
                width={200}
                height={200}
                className="max-w-50 rounded-lg"
                onError={(e) => {
                  (e.currentTarget).style.display = "none";
                }}
              />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Scan menggunakan GoPay, OVO, ShopeePay, Mobile Banking, dll.
            </p>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm text-zinc-400">Upload Bukti Pembayaran</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/30 px-4 py-8 text-sm text-zinc-500 transition-colors hover:border-emerald-500 hover:text-emerald-400"
            >
              <Upload className="h-5 w-5" />
              {selectedFile ? selectedFile.name : "Pilih file bukti bayar"}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {uploading ? "Mengupload..." : "Kirim Bukti Bayar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <InvoiceContent />
    </Suspense>
  );
}
