export function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className="w-full h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
