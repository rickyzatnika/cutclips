"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ConvexAuthProvider } from "./convex-auth-bridge";
import { UserSync } from "@/components/dashboard/user-sync";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ToastProvider>
          <ConvexAuthProvider>
            <UserSync />
            {children}
          </ConvexAuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
