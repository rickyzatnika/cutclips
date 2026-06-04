"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useToast } from "@/components/ui/toast";

function SettingsSkeleton() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader><Skeleton className="h-5 w-16" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-10 w-36 rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const userData = useQuery(api.users.getMe);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (userData) setName(userData.name);
  }, [userData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
  };

  if (!userData) return <SettingsSkeleton />;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 ">Pengaturan</h1>
        <p className="mt-1 text-sm text-surface-500 ">
          Kelola pengaturan akun Anda.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="name"
                  label="Nama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  id="email"
                  label="Email"
                  value={userData?.email || ""}
                  disabled
                />
              </div>
              <p className="text-xs text-surface-400 dark:text-surface-500">
                Email tidak dapat diubah karena terhubung dengan akun Auth0 Anda.
              </p>
              <Button onClick={handleSave} loading={saving}>
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paket & Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Paket Saat Ini</span>
                <span className="font-medium text-surface-900 capitalize dark:text-surface-100">{userData?.plan || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Sisa Credits</span>
                <span className="font-medium text-surface-900 dark:text-surface-100">{userData?.credits ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Total Credits Digunakan</span>
                <span className="font-medium text-surface-900 dark:text-surface-100">{userData?.totalCreditsUsed ?? "-"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
