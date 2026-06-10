"use client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 text-center">
      <div className="rounded-2xl border border-red-800 bg-red-500/10 p-12">
        <h2 className="text-lg font-semibold text-red-400">Dashboard error bro</h2>
        <p className="mt-2 text-sm text-zinc-400">{error.message}</p>
        <button
          onClick={reset}
          className="mt-6 cursor-pointer rounded-xl bg-red-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-400"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
