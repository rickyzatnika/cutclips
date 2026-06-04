export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200 bg-[length:200%_100%] dark:from-surface-800 dark:via-surface-700 dark:to-surface-800 ${className}`}
    />
  );
}
