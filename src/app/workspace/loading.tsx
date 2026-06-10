export default function WorkspaceLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-10 h-14 animate-pulse rounded-xl bg-zinc-800" />
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
      <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-zinc-800">
            <div className="aspect-video animate-pulse bg-zinc-800" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
