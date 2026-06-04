"use client";

import { useQuery } from "convex/react";
import { useUser } from "@/providers/auth";
import { api } from "@convex/_generated/api";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoading: authLoading } = useUser();
  const isAdmin = useQuery(api.users.isAdmin);

  if (authLoading || isAdmin === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-surface-900">Akses Ditolak</p>
          <p className="mt-2 text-sm text-surface-500">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
