"use client";

import { useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@convex/_generated/api";

export default function AdminSettingsPage() {
  const allUsers = useQuery(api.users.list);

  const freeUsers = allUsers?.filter((u) => u.plan === "free").length ?? 0;
  const paidUsers = allUsers?.filter((u) => u.plan !== "free").length ?? 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900">
          Pengaturan Platform
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          Informasi dan statistik platform ShortAI.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Total Users</span>
                <span className="font-medium text-surface-900">{allUsers?.length ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Free Users</span>
                <span className="font-medium text-surface-900">{freeUsers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Paid Users</span>
                <span className="font-medium text-surface-900">{paidUsers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Free Credits Baru</span>
                <span className="font-medium text-surface-900">150</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Reset Period</span>
                <span className="font-medium text-surface-900">30 hari</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
