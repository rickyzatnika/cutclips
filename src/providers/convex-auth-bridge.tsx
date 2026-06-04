"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { ConvexProviderWithAuth } from "convex/react";
import { convex } from "@/lib/convex-client";

export function ConvexAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthAdapter}>
      {children}
    </ConvexProviderWithAuth>
  );
}

function useConvexAuthAdapter() {
  const { data: session, status } = useSession();
  const isAuthenticated = !!session;
  const isLoading = status === "loading";

  const fetchAccessToken = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/token");
      const data = await res.json();
      return data.accessToken || null;
    } catch {
      return null;
    }
  }, []);

  return {
    isAuthenticated,
    isLoading,
    fetchAccessToken,
  };
}
