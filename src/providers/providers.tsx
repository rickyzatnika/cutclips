"use client";

import { SessionProvider } from "next-auth/react";
import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>{children}</SessionProvider>
    </ConvexProvider>
  );
}
