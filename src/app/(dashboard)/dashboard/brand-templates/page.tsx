"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Palette } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const FONTS = [
  "Arial",
  "Impact",
  "Verdana",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Trebuchet MS",
  "Comic Sans MS",
];

const PRESET_COLORS = [
  { name: "Hijau", hex: "#00FF00" },
  { name: "Merah", hex: "#FF0000" },
  { name: "Kuning", hex: "#FFD700" },
  { name: "Biru", hex: "#00BFFF" },
  { name: "Putih", hex: "#FFFFFF" },
  { name: "Hitam", hex: "#000000" },
  { name: "Ungu", hex: "#9B59B6" },
  { name: "Pink", hex: "#FF69B4" },
];

export default function BrandTemplatesPage() {
  const { addToast } = useToast();
  const templates = useQuery(api.brandTemplates.list);
  const createTemplate = useMutation(api.brandTemplates.create);
  const deleteTemplate = useMutation(api.brandTemplates.remove);

  const [name, setName] = useState("");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [outlineColor, setOutlineColor] = useState("#00FF00");
  const [fontSize, setFontSize] = useState(13);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createTemplate({ name: name.trim(), fontFamily, outlineColor, fontSize });
      addToast("Template berhasil dibuat", "success");
      setName("");
    } catch {
      addToast("Gagal membuat template", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate({ id: id as any });
      addToast("Template dihapus", "success");
    } catch {
      addToast("Gagal menghapus template", "error");
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 ">Brand Templates</h1>
        <p className="mt-1 text-sm text-surface-500 ">
          Atur font, warna outline, dan ukuran teks untuk subtitle video.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Template Baru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Nama Template"
                placeholder="Contoh: Gaming, Edukasi, Vlog"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Font</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Warna Outline
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setOutlineColor(c.hex)}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        outlineColor === c.hex
                          ? "border-surface-900 scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={outlineColor}
                    onChange={(e) => setOutlineColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border"
                  />
                  <span className="text-xs text-surface-500 dark:text-surface-400">{outlineColor}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Ukuran Font: {fontSize}
                </label>
                <input
                  type="range"
                  min={8}
                  max={28}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500">
                  <span>8</span>
                  <span>28</span>
                </div>
              </div>

              <Button type="submit" disabled={!name.trim()} loading={saving}>
                Simpan Template
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Template Saya
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!templates ? (
              <p className="text-sm text-surface-400 dark:text-surface-500">Memuat...</p>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-surface-200 p-8 text-center text-sm text-surface-400 dark:border-surface-700 dark:text-surface-500">
                Belum ada template. Buat template baru di samping.
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((t) => (
                  <div
                    key={t._id}
                    className="flex items-center justify-between rounded-lg border border-surface-200 p-3 dark:border-surface-800"
                  >
                    <div>
                      <p className="font-medium text-surface-900 dark:text-surface-100">{t.name}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {t.fontFamily} · {t.fontSize}px ·{" "}
                        <span
                          className="inline-block h-3 w-3 rounded align-middle"
                          style={{ backgroundColor: t.outlineColor }}
                        />
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(t._id)}
                      className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-red-500 dark:text-surface-500 dark:hover:bg-surface-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
