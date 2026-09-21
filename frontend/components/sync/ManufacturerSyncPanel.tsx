"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "./ProgressBar";

interface Manufacturer {
  key: string;
  display_name: string;
  base_url: string;
}

interface SyncStatus {
  job_id: string;
  manufacturer: string;
  status: "queued" | "running" | "completed" | "completed_with_warnings" | "failed";
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  progress: number;
  error: string | null;
  warnings: string[];
}

const TERMINAL_STATUSES = new Set(["completed", "completed_with_warnings", "failed"]);
const POLL_INTERVAL_MS = 2000;

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  completed_with_warnings: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function ManufacturerSyncPanel() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/manufacturers")
      .then((res) => res.json())
      .then((data: Manufacturer[]) => {
        setManufacturers(data);
        if (data.length > 0) setSelected(data[0].key);
      })
      .catch(() => setError("Could not load manufacturers from the sync service."));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollStatus(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sync/status/${jobId}`);
        if (!res.ok) throw new Error("status request failed");
        const data: SyncStatus = await res.json();
        setStatus(data);
        if (TERMINAL_STATUSES.has(data.status) && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        setError("Lost connection while polling sync status.");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleStart() {
    if (!selected) return;
    setError(null);
    setIsStarting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturer: selected, mode: "full" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? "Failed to start sync");
      }
      const data = await res.json();
      setStatus({
        job_id: data.job_id,
        manufacturer: data.manufacturer,
        status: "queued",
        total: 0,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        progress: 0,
        error: null,
        warnings: [],
      });
      pollStatus(data.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start sync");
    } finally {
      setIsStarting(false);
    }
  }

  const isRunning = status !== null && !TERMINAL_STATUSES.has(status.status);

  return (
    <div className="max-w-xl w-full rounded-xl border border-black/10 dark:border-white/15 p-6 space-y-5 bg-white dark:bg-black/20">
      <div>
        <h2 className="text-lg font-semibold">Manufacturer Data Sync</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          Crawl a manufacturer&apos;s catalog and sync it into the product database.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <label className="flex-1 text-sm">
          <span className="block mb-1 text-black/70 dark:text-white/70">Manufacturer</span>
          <select
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isRunning}
          >
            {manufacturers.map((m) => (
              <option key={m.key} value={m.key}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={handleStart}
          disabled={!selected || isRunning || isStarting}
          className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {isRunning ? "Syncing..." : "Start Synchronization"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {status && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status.status] ?? ""}`}>
              {status.status}
            </span>
            <span className="text-black/60 dark:text-white/60">
              {status.processed}/{status.total} processed
            </span>
          </div>

          <ProgressBar progress={status.progress} />

          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <Stat label="Found" value={status.total} />
            <Stat label="Success" value={status.success} />
            <Stat label="Failed" value={status.failed} />
            <Stat label="Skipped" value={status.skipped} />
          </div>

          {status.error && <p className="text-sm text-red-600 dark:text-red-400">{status.error}</p>}

          {status.warnings.length > 0 && (
            <details className="text-xs text-black/60 dark:text-white/60">
              <summary className="cursor-pointer">{status.warnings.length} warning(s)</summary>
              <ul className="mt-1 space-y-1 max-h-40 overflow-auto">
                {status.warnings.slice(0, 20).map((w, i) => (
                  <li key={i} className="truncate">
                    {w}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-black/[.03] dark:bg-white/[.06] py-2">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-black/50 dark:text-white/50">{label}</div>
    </div>
  );
}
