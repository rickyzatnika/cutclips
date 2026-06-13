import type { Metadata } from "next";
import WorkspacePage from "./page.client";

export const metadata: Metadata = {
  title: "Workspace",
  description:
    "Kelola semua clip video YouTube kamu di satu tempat. Lihat clip yang sudah jadi, pantau proses rendering, dan akses riwayat highlight.",
  openGraph: {
    title: "Workspace | CutClips",
    description:
      "Kelola dan buat clip viral dari video YouTube dengan AI.",
  },
};

export default function WorkspacePageWrapper() {
  return <WorkspacePage />;
}
