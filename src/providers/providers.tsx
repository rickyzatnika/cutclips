"use client";

import { SessionProvider } from "next-auth/react";
import { ConvexAuthProvider } from "./convex-auth-bridge";
import { UserSync } from "@/components/dashboard/user-sync";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ConvexAuthProvider>
          <UserSync />
          {children}
        </ConvexAuthProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
