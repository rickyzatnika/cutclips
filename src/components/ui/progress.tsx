export function Progress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700 ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function ProgressSmooth({ value, label }: { value: number; label?: string }) {
  return (
    <div className="space-y-1">
      <Progress value={value} />
      {label && (
        <p className="text-right text-xs text-surface-500 dark:text-surface-400">{label}</p>
      )}
    </div>
  );
}
