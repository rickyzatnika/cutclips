"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import { ConvexProvider, useMutation } from "convex/react";
import { convex } from "@/lib/convex-client";
import { api } from "@convex/_generated/api";
import { ToastProvider } from "@/components/ui/toast";

function Heartbeat() {
  const { data: session } = useSession();
  const heartbeat = useMutation(api.users.heartbeat);

  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;

    heartbeat({ email });
    const interval = setInterval(() => heartbeat({ email }), 60000);
    return () => clearInterval(interval);
  }, [session?.user?.email, heartbeat]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
        <ToastProvider>
          <Heartbeat />
          {children}
        </ToastProvider>
      </SessionProvider>
    </ConvexProvider>
  );
}
