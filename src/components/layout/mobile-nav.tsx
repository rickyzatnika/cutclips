"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Film, History, Sparkles, CreditCard } from "lucide-react";

const tabs = [
  { href: "/workspace", label: "Clip", icon: Film },
  { href: "/workspace/history", label: "Riwayat", icon: History },
  { href: "/workspace/billing", label: "Isi Credit", icon: CreditCard },
  { href: "/chat-ai", label: "Tanya AI", icon: Sparkles },
];

export function MobileNav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const isAuthPage =
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/analyze") ||
    pathname.startsWith("/generate") ||
    pathname === "/chat-ai";

  if (!isAuthPage) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center border-t border-zinc-800 bg-zinc-900/90 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-[14px] font-medium transition-colors ${
              active ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <tab.icon className="h-6 w-6" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
