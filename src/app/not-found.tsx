import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4">
      <h1 className="text-6xl font-bold text-emerald-400">404</h1>
      <p className="mt-4 text-lg text-zinc-400">Halaman nggak ditemukan bro</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
