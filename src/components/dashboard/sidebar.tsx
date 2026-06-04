"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Video,
  Settings,
  Palette,
  Scissors,
  LogOut,
  ChevronLeft,
  Menu,
  FileText,
  Globe,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useUser } from "@/providers/auth";
import { signOut } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Proyek Saya",
    href: "/dashboard/projects",
    icon: Video,
  },
  {
    label: "YouTube URL",
    href: "/dashboard/new",
    icon: Globe,
  },
  {
    label: "Text to Video",
    href: "/dashboard/script-generator",
    icon: FileText,
  },
  {
    label: "Brand Templates",
    href: "/dashboard/brand-templates",
    icon: Palette,
  },
  {
    label: "Pengaturan",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useUser();
  const isAdmin = useQuery(api.users.isAdmin);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-surface-200 bg-white transition-all duration-300 dark:bg-surface-900",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-surface-200 px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-bold text-surface-900 dark:text-surface-100">
              CutClips
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto">
            <Scissors className="h-5 w-5 text-primary-600" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors",
            collapsed && "mx-auto mt-4",
          )}
        >
          {collapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {!collapsed && user && (
        <div className="flex items-center gap-3 border-b border-surface-100 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-surface-900 dark:text-surface-100">
              {user.name || "User"}
            </p>
            <p className="truncate text-xs text-surface-400">
              {user.email}
            </p>
          </div>
          <ThemeToggle />
        </div>
      )}

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                  : "text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200",
                collapsed && "justify-center px-2",
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className={cn("border-t border-surface-200 pt-2 dark:border-surface-700", collapsed && "mx-2")} />
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                  : "text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200",
                collapsed && "justify-center px-2",
              )}
            >
              <Shield className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-surface-200 p-3 dark:border-surface-800">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-100 hover:text-red-600 dark:text-surface-400 dark:hover:bg-surface-800",
            collapsed && "justify-center",
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
