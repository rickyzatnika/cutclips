"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { convexQuery } from "@/lib/convex-rest";
import { Loader2, LayoutDashboard, Users, Banknote } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/payments", label: "Pembayaran", icon: Banknote },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    convexQuery("users:getByEmail", { email: session!.user!.email })
      .then((user: { role?: string } | null) => setIsAdmin(user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [session, sessionStatus]);

  if (sessionStatus === "loading" || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
        <p className="text-sm text-zinc-500">You do not have admin access.</p>
        <button
          onClick={() => router.push("/workspace")}
          className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-700"
        >
          Back to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black">
      <aside className="flex w-56 flex-col border-r border-zinc-800 bg-zinc-900/50">
        <div className="border-b border-zinc-800 px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">CutClips</span>
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              Admin
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-800/50 text-white"
                    : "text-zinc-500 hover:bg-zinc-800/30 hover:text-zinc-300"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-3">
          <Link
            href="/workspace"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-800/50 hover:text-zinc-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to App
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
