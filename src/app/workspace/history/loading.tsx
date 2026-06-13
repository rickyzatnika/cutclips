export default function HistoryLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-2xl border border-zinc-800 p-4">
            <div className="h-20 w-36 shrink-0 animate-pulse rounded-xl bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
              <div className="flex gap-2">
                <div className="h-6 w-24 animate-pulse rounded-lg bg-zinc-800" />
                <div className="h-6 w-16 animate-pulse rounded-lg bg-zinc-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
