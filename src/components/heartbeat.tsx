"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";

export function Heartbeat() {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.users.heartbeat);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => { heartbeat(); }, 60000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isAuthenticated, heartbeat]);

  return null;
}
