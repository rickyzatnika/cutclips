"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useToast } from "@/components/ui/toast";

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

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900">Pengaturan</h1>
        <p className="mt-1 text-sm text-surface-500">
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
              <p className="text-xs text-surface-400">
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
                <span className="text-surface-500">Paket Saat Ini</span>
                <span className="font-medium text-surface-900 capitalize">{userData?.plan || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Sisa Credits</span>
                <span className="font-medium text-surface-900">{userData?.credits ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Total Credits Digunakan</span>
                <span className="font-medium text-surface-900">{userData?.totalCreditsUsed ?? "-"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
