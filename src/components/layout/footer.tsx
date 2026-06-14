"use client";

import { usePathname } from "next/navigation";
import { InstallAppButton } from "../install-app-button";

export function Footer() {
  const pathname = usePathname();
  const isChatPage = pathname.startsWith("/chat-ai");
  const isInvoicePage = pathname.startsWith("/invoice");

  return (
    <footer
      className={`w-full border-t border-zinc-200 dark:border-zinc-700 py-6 ${isChatPage || isInvoicePage ? "hidden" : ""}`}
    >
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-500 flex flex-col items-center gap-4">
        <InstallAppButton />
        <p>&copy; {new Date().getFullYear()} CutClips. All rights reserved.</p>
      </div>
    </footer>
  );
}
