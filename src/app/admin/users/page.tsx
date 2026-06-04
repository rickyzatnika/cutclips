"use client";

import { useState, useEffect, useMemo } from "react";
import { MoreHorizontal, Search, CreditCard, Shield, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useToast } from "@/components/ui/toast";

const ONLINE_WINDOW = 2 * 60 * 1000;

function isOnline(user: { lastActive?: number }) {
  return user.lastActive && Date.now() - user.lastActive < ONLINE_WINDOW;
}

export default function AdminUsersPage() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const allUsers = useQuery(api.users.list);
  const onlineUsers = useMemo(() => allUsers?.filter(isOnline).length ?? 0, [allUsers, now]);
  const addCredits = useMutation(api.credits.addCredits);
  const updatePlan = useMutation(api.users.updatePlan);
  const { addToast } = useToast();

  const [selectedUser, setSelectedUser] = useState<{
    _id: string;
    name: string;
    credits: number;
    plan: string;
  } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddCredits = async () => {
    if (!selectedUser) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount === 0) {
      addToast("Masukkan jumlah credit valid", "error");
      return;
    }
    setSaving(true);
    try {
      await addCredits({
        userId: selectedUser._id as any,
        amount,
        description: creditDesc.trim() || `Admin adjustment: ${amount > 0 ? "+" : ""}${amount}`,
      });
      addToast(`Credit ${amount > 0 ? "ditambahkan" : "dikurangi"} untuk ${selectedUser.name}`, "success");
      setSelectedUser(null);
      setCreditAmount("");
      setCreditDesc("");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Gagal", "error");
    }
    setSaving(false);
  };

  const handlePlanChange = async (userId: string, plan: string) => {
    try {
      await updatePlan({ userId: userId as any, plan: plan as any });
      addToast("Plan berhasil diubah", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Gagal mengubah plan", "error");
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Users</h1>
            <p className="mt-1 text-sm text-surface-500">Kelola semua pengguna platform.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            <Wifi className="h-4 w-4" />
            <span className="font-medium">{onlineUsers}</span>
            <span className="text-emerald-600 dark:text-emerald-500">online</span>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="px-6 py-4 font-medium text-surface-500">User</th>
                  <th className="px-6 py-4 font-medium text-surface-500">Role</th>
                  <th className="px-6 py-4 font-medium text-surface-500">Paket</th>
                  <th className="px-6 py-4 font-medium text-surface-500">Credits</th>
                  <th className="px-6 py-4 font-medium text-surface-500">Status</th>
                  <th className="px-6 py-4 font-medium text-surface-500">Langganan</th>
                  <th className="px-6 py-4 font-medium text-surface-500">Bergabung</th>
                  <th className="px-6 py-4 font-medium text-surface-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {!allUsers ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-surface-400">Memuat...</td></tr>
                ) : allUsers.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-surface-400">Belum ada user</td></tr>
                ) : (
                  allUsers.map((user) => {
                    const joined = new Date(user.joinedAt).toLocaleDateString("id-ID", { dateStyle: "medium" });
                    return (
                      <tr key={user._id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold dark:bg-primary-950 dark:text-primary-300">
                                {user.name?.charAt(0)?.toUpperCase() || "U"}
                              </div>
                              {isOnline(user) && (
                                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-surface-900" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-surface-900">{user.name}</p>
                              <p className="text-xs text-surface-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.role === "admin" ? (
                            <Badge variant="success" className="gap-1">
                              <Shield className="h-3 w-3" /> Admin
                            </Badge>
                          ) : (
                            <span className="text-surface-400">User</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user.plan}
                            onChange={(e) => handlePlanChange(user._id, e.target.value)}
                            className="rounded border border-surface-200 bg-white px-2 py-1 text-xs text-surface-700"
                          >
                            <option value="free">Free</option>
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="business">Business</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-surface-600">{user.credits.toLocaleString("id-ID")}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${isOnline(user) ? "bg-emerald-500" : "bg-surface-300 dark:bg-surface-600"}`} />
                            <span className="text-xs text-surface-500">{isOnline(user) ? "Online" : "Offline"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={user.plan !== "free" ? "success" : "neutral"}>
                            {user.plan !== "free" ? "Active" : "Free"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-surface-600">{joined}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setSelectedUser({ _id: user._id, name: user.name, credits: user.credits, plan: user.plan });
                              setCreditAmount("");
                              setCreditDesc("");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 transition-colors"
                          >
                            <CreditCard className="h-3 w-3" /> Atur Credit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-surface-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-surface-900">
              Atur Credit: {selectedUser.name}
            </h3>
            <p className="mt-1 text-sm text-surface-500">
              Saat ini: <strong>{selectedUser.credits.toLocaleString("id-ID")}</strong> credits | Plan: <strong>{selectedUser.plan}</strong>
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-surface-700">Jumlah</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Contoh: 100 atau -50"
                  className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-surface-400">Positif = nambah, negatif = kurangi</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700">Keterangan</label>
                <input
                  type="text"
                  value={creditDesc}
                  onChange={(e) => setCreditDesc(e.target.value)}
                  placeholder="Bonus, refund, penalti, dll"
                  className="mt-1 block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
              >
                Batal
              </button>
              <button
                onClick={handleAddCredits}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
