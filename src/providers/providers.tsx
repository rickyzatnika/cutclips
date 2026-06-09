"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import { ConvexProvider, useMutation } from "convex/react";
import { convex } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

function Heartbeat() {
  const { data: session } = useSession();
  const heartbeat = useMutation(api.users.heartbeat);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;

    heartbeat({ email });
    intervalRef.current = setInterval(() => heartbeat({ email }), 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user?.email, heartbeat]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
        <Heartbeat />
        {children}
      </SessionProvider>
    </ConvexProvider>
  );
}
