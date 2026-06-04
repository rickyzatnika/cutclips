"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/providers/auth";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";

export function UserSync() {
  const { user, isLoading } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);
  const synced = useRef(false);

  useEffect(() => {
    if (user && !isLoading && isAuthenticated && !synced.current) {
      synced.current = true;
      createOrUpdateUser({
        name: user.name || "User",
        email: user.email || "",
        image: user.image || undefined,
      });
    }
    if (!user && !isLoading) {
      synced.current = false;
    }
  }, [user, isLoading, isAuthenticated, createOrUpdateUser]);

  return null;
}
