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
  const setOffline = useMutation(api.users.setOffline);
  const emailRef = useRef<string | undefined>();

  useEffect(() => {
    const email = session?.user?.email;
    if (!email) {
      if (emailRef.current) {
        setOffline({ email: emailRef.current });
        emailRef.current = undefined;
      }
      return;
    }

    emailRef.current = email;
    heartbeat({ email });
    const interval = setInterval(() => heartbeat({ email }), 60000);

    return () => {
      clearInterval(interval);
      setOffline({ email });
    };
  }, [session?.user?.email, heartbeat, setOffline]);

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
