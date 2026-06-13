"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

const LS_KEY = "cutclips_install_dismissed";

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }
    if (localStorage.getItem(LS_KEY)) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setHidden(false);
    };

    const installedHandler = () => {
      localStorage.setItem(LS_KEY, "1");
      setHidden(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const result = await (deferredPrompt as any).userChoice;
    if (result.outcome === "accepted") {
      localStorage.setItem(LS_KEY, "1");
      setHidden(true);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(LS_KEY, "1");
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 shrink-0">
          <Smartphone className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Install Aplikasi</p>
          <p className="text-xs text-zinc-500">
            Pasang CutClips di layar utama untuk akses lebih cepat.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 cursor-pointer rounded-lg p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={handleInstall}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
      >
        <Download className="h-4 w-4" />
        Install
      </button>
    </div>
  );
}
