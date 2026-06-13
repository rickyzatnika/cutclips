"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  LogOut,
  CreditCard,
  ChevronRight,
  Shield,
  Calendar,
  TrendingDown,
} from "lucide-react";

export default function UserInfoPage() {
  const { data: session } = useSession();
  const setOffline = useMutation(api.users.setOffline);
  const user = useQuery(
    api.users.getByEmail,
    session?.user?.email ? { email: session.user.email } : "skip",
  );
  const isLoading = user === undefined;

  const handleSignOut = () => {
    if (session?.user?.email) {
      setOffline({ email: session.user.email }).catch(() => {});
    }
    signOut({ callbackUrl: "/" });
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-white">Akun Saya</h1>

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="h-14 w-14 overflow-hidden rounded-full bg-emerald-500/10">
          {isLoading ? (
            <Skeleton className="h-14 w-14 rounded-full" />
          ) : session?.user?.image ? (
            <Image
              src={session.user.image}
              alt=""
              width={56}
              height={56}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-xl font-bold text-emerald-400">
                {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              session?.user?.name || "Pengguna"
            )}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {isLoading ? (
              <Skeleton className="mt-1 h-3 w-40" />
            ) : (
              session?.user?.email || ""
            )}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-white">Kredit</p>
                <p className="text-xs text-zinc-500">Sisa kredit kamu</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {isLoading ? (
                  <Skeleton className="inline-block h-4 w-10 align-middle" />
                ) : (
                  (user?.credits ?? 0)
                )}
              </span>
              <Link
                href="/workspace/billing"
                className="rounded-lg bg-zinc-800 p-1.5 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-white">Nama</p>
                <p className="text-xs text-zinc-500">
                  {session?.user?.name || "-"}
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-800" />
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-white">Email</p>
                <p className="text-xs text-zinc-500">
                  {session?.user?.email || "-"}
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-800" />
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-white">
                  Kredit Terpakai
                </p>
                <p className="text-xs text-zinc-500">
                  Total kredit yang sudah digunakan
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-white">
              {isLoading ? (
                <Skeleton className="inline-block h-4 w-10 align-middle" />
              ) : (
                (user?.totalCreditsUsed ?? 0)
              )}
            </span>
          </div>
          <div className="border-t border-zinc-800" />
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-white">Bergabung</p>
                <p className="text-xs text-zinc-500">
                  Tanggal pendaftaran akun
                </p>
              </div>
            </div>
            <span className="text-sm text-zinc-300">
              {isLoading ? (
                <Skeleton className="inline-block h-4 w-24 align-middle" />
              ) : user?.joinedAt ? (
                new Date(user.joinedAt).toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              ) : (
                "-"
              )}
            </span>
          </div>
          {user?.role === "admin" && (
            <>
              <div className="border-t border-zinc-800" />
              <Link
                href="/dashboard"
                className="flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Dashboard Admin
                    </p>
                    <p className="text-xs text-zinc-500">
                      Monitoring & pengelolaan
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-500" />
              </Link>
            </>
          )}
        </div>
      </div>

      <button
        onClick={handleSignOut}
        className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-3.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
      >
        <LogOut className="h-4 w-4" />
        Keluar
      </button>
    </div>
  );
}
