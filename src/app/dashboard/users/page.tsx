"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { convexMutation } from "@/lib/convex-rest";
import {
  Loader2, Search, Trash2, Shield, ShieldOff, X, Check, AlertTriangle,
} from "lucide-react";

/* ---------- helpers ---------- */

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function getOnlineStatus(lastActive?: number): { label: string; color: string; dot: string } {
  if (!lastActive) return { label: "Offline", color: "text-zinc-600", dot: "bg-zinc-600" };
  const diff = Date.now() - lastActive;
  if (diff < 5 * 60 * 1000) return { label: "Online", color: "text-emerald-400", dot: "bg-emerald-400" };
  if (diff < 30 * 60 * 1000) return { label: "Away", color: "text-yellow-400", dot: "bg-yellow-400" };
  return { label: "Offline", color: "text-zinc-600", dot: "bg-zinc-600" };
}

/* ---------- modal ---------- */

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function UsersPage() {
  const { data: session } = useSession();
  const queryUsers = useQuery(api.users.list);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  /* modals */
  const [roleModal, setRoleModal] = useState<{
    user: Doc<"users">;
    role: "user" | "admin";
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<Doc<"users"> | null>(null);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  const userList = queryUsers ?? [];
  const filtered = useMemo(
    () => userList.filter(
      (x) =>
        x.name.toLowerCase().includes(search.toLowerCase()) ||
        x.email.toLowerCase().includes(search.toLowerCase()),
    ),
    [userList, search],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((u) => u._id)));
  };

  /* actions */
  const handleRoleChange = async () => {
    if (!roleModal) return;
    setBusy("role");
    try {
      await convexMutation("users:updateRole", {
        userId: roleModal.user._id,
        role: roleModal.role,
        adminEmail: session!.user!.email,
      });
      setRoleModal(null);
    } catch {
      alert("Failed to update role");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setBusy("delete");
    try {
      await convexMutation("users:remove", {
        userId: deleteModal._id,
        adminEmail: session!.user!.email,
      });
      setDeleteModal(null);
    } catch {
      alert("Failed to delete user");
    } finally {
      setBusy(null);
    }
  };

  const handleBulkDelete = async () => {
    setBusy("bulk");
    try {
      await convexMutation("users:bulkRemove", {
        userIds: Array.from(selected),
        adminEmail: session!.user!.email,
      });
      setSelected(new Set());
      setBulkDeleteModal(false);
    } catch {
      alert("Failed to delete users");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-up opacity-0" style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage all registered users.</p>
      </div>

      {/* toolbar */}
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 opacity-0"
        style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
      >
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-zinc-700"
          />
        </div>

        {selected.size > 0 && (
          <button
            onClick={() => setBulkDeleteModal(true)}
            disabled={busy === "bulk"}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy === "bulk" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete ({selected.size})
          </button>
        )}
      </div>

      {/* table */}
      {!queryUsers ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="animate-fade-up overflow-hidden rounded-2xl border border-zinc-800 opacity-0"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleAll}
                    className="cursor-pointer rounded border-zinc-700 bg-zinc-800 text-emerald-500 outline-none"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-zinc-400">User</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Status</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Credits</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Role</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Joined</th>
                <th className="w-24 px-4 py-3 font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.map((user) => {
                const status = getOnlineStatus(user.lastActive);
                return (
                  <tr
                    key={user._id}
                    className={`transition-colors hover:bg-zinc-900/30 ${
                      selected.has(user._id) ? "bg-zinc-800/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(user._id)}
                        onChange={() => toggleSelect(user._id)}
                        className="cursor-pointer rounded border-zinc-700 bg-zinc-800 text-emerald-500 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-xs text-zinc-600">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                        <span className={`text-xs ${status.color}`}>{status.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{user.credits}</td>
                    <td className="px-4 py-3">
                      {user.role === "admin" ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">User</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {formatDate(user.joinedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {user.role === "admin" ? (
                          <button
                            onClick={() => setRoleModal({ user, role: "user" })}
                            className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-yellow-400"
                            title="Remove admin"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setRoleModal({ user, role: "admin" })}
                            className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-emerald-400"
                            title="Make admin"
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteModal(user)}
                          className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-600">
                    {search ? "No users match your search." : "No users yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Role modal */}
      <Modal open={!!roleModal} onClose={() => setRoleModal(null)} title="Change Role">
        {roleModal && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              {roleModal.role === "admin"
                ? `Grant admin privileges to "${roleModal.user.name}"?`
                : `Remove admin privileges from "${roleModal.user.name}"?`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRoleModal(null)}
                className="flex-1 cursor-pointer rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={busy === "role"}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy === "role" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete User">
        {deleteModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-red-500/10 p-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
              <p className="text-sm text-red-300">
                This action cannot be undone. All data for &quot;{deleteModal.name}&quot; will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 cursor-pointer rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busy === "delete"}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
              >
                {busy === "delete" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk delete modal */}
      <Modal open={bulkDeleteModal} onClose={() => setBulkDeleteModal(false)} title="Delete Users">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-red-500/10 p-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <p className="text-sm text-red-300">
              This will permanently delete {selected.size} user(s). This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setBulkDeleteModal(false)}
              className="flex-1 cursor-pointer rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={busy === "bulk"}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
            >
              {busy === "bulk" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete All
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
