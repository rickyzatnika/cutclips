"use client";

import { DesktopNav } from "@/components/layout/desktop-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#050505]">
      <DesktopNav />
      <main className="flex-1 pb-20 sm:pb-0">{children}</main>
    </div>
  );
}
