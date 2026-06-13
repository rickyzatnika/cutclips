import type { Metadata } from "next";
import AnalyzePage from "./page.client";

export const metadata: Metadata = {
  title: "Analisis Video",
  description:
    "AI menganalisis video YouTube kamu dan menemukan highlight terbaik. Ubah momen viral jadi Shorts, Reels, dan TikTok dalam hitungan menit.",
  openGraph: {
    title: "Analisis Video | CutClips",
    description:
      "AI menemukan momen terbaik dari video YouTube kamu secara otomatis.",
  },
};

export default function AnalyzePageWrapper() {
  return <AnalyzePage />;
}
