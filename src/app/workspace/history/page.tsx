import type { Metadata } from "next";
import HistoryPage from "./page.client";

export const metadata: Metadata = {
  title: "Riwayat Highlight",
  description:
    "Lihat semua hasil analisis highlight video YouTube kamu. Cari, filter, kelola, dan buat clip dari highlight yang sudah dianalisis.",
};

export default function HistoryPageWrapper() {
  return <HistoryPage />;
}
