"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { CirclePlay } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 p-3 shadow-lg shadow-emerald-500/10">
      <button
        onClick={handleInstall}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-emerald-500 transition-colors "
      >
        <Download className="h-4 w-4 animate-bounce" />
        Install Aplikasi
      </button>
      <button
        onClick={handleInstall}
        className="cursor-pointer flex items-center justify-center gap-3 text-sm text-white mb-2"
      >
        <CirclePlay className="h-5 w-5 text-emerald-400" />
        <span className="text-lg font-bold text-white">CutClips</span>
      </button>
    </div>
  );
}
