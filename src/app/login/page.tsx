import type { Metadata } from "next";
import LoginPage from "./page.client";

export const metadata: Metadata = {
  title: "Masuk",
  description:
    "Masuk ke akun CutClips untuk mulai membuat clip viral dari video YouTube dengan AI.",
  openGraph: {
    title: "Masuk | CutClips",
    description:
      "Masuk dan ubah video YouTube jadi Shorts, Reels, dan TikTok viral.",
  },
};

export default function LoginPageWrapper() {
  return <LoginPage />;
}
