"use client";

import { useSession } from "next-auth/react";

export function useUser() {
  const { data: session, status } = useSession();
  return {
    user: session?.user ?? null,
    isLoading: status === "loading",
  };
}

export function useIsAuthenticated() {
  const { data: session, status } = useSession();
  return { isAuthenticated: !!session, isLoading: status === "loading" };
}
