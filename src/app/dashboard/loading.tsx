export default function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="mb-8 h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 p-5">
            <div className="mb-2 h-4 w-24 animate-pulse rounded bg-zinc-800" />
            <div className="h-8 w-20 animate-pulse rounded bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-xl bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}
