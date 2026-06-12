"use client";

import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 cursor-pointer rounded-lg p-1 text-zinc-500 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <Sparkles className="h-6 w-6 text-emerald-400" />
        </div>

        <h3 className="text-lg font-semibold text-white">
            Upgrade Paket
        </h3>

        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Silahkan upgrade paket untuk bisa menggunakan fitur ini
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Nanti
          </button>
          <button
            onClick={() => {
              onClose();
              router.push("/workspace/billing");
            }}
            className="flex-1 cursor-pointer rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
