"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { convexQuery } from "@/lib/convex-rest";
import { Loader2, LayoutDashboard, Users, Banknote, Activity, Menu, X } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: Activity },
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/payments", label: "Pembayaran", icon: Banknote },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {/* overlay backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 flex h-screen w-56 flex-col border-r border-zinc-800 bg-zinc-900/50 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">CutClips</span>
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              Admin
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
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
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-800/50 hover:text-zinc-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to App
          </Link>
        </div>
      </aside>

      {/* main */}
      <main className="flex min-h-screen flex-1 flex-col lg:ml-56">
        {/* mobile top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-white">CutClips</span>
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
            Admin
          </span>
        </div>

        <div className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
