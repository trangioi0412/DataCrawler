"use client";

import { useEffect, useRef, useState } from "react";
import type { AiPreviewResponse, SyncStatus } from "@/lib/pythonApi";
import { previewManufacturerRequest, approveManufacturerRequest } from "@/lib/pythonApi";
import { ProgressBar } from "./ProgressBar";

interface ManufacturerRequest {
  id: number;
  name: string;
  website_url: string | null;
  status: "pending" | "in_progress" | "done" | "rejected";
  notes: string | null;
  ai_sync_enabled: boolean;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  in_progress: "Đang xử lý",
  done: "Hoàn tất",
  rejected: "Từ chối",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const SYNC_TERMINAL_STATUSES = new Set(["completed", "completed_with_warnings", "failed"]);
const SYNC_POLL_INTERVAL_MS = 2000;

const SYNC_STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  completed_with_warnings: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

interface PreviewState {
  loading: boolean;
  error: string | null;
  data: AiPreviewResponse | null;
}

interface ApproveState {
  loading: boolean;
  error: string | null;
  jobId: string | null;
}

export function ManufacturerRequestForm() {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [requests, setRequests] = useState<ManufacturerRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [previewByRequest, setPreviewByRequest] = useState<Record<number, PreviewState>>({});
  const [approveByRequest, setApproveByRequest] = useState<Record<number, ApproveState>>({});
  const [jobStatusByRequest, setJobStatusByRequest] = useState<Record<number, SyncStatus>>({});
  const pollIntervals = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  async function loadRequests() {
    try {
      const res = await fetch("/api/manufacturer-requests");
      if (!res.ok) return;
      setRequests(await res.json());
    } catch {
      // Best-effort list refresh; the form itself still works without it.
    }
  }

  useEffect(() => {
    loadRequests();
    const intervals = pollIntervals.current;
    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập tên hãng.");
      return;
    }
    if (!website.trim()) {
      setError("Vui lòng nhập website chính thức của hãng.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/manufacturer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), website_url: website.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? "Gửi yêu cầu thất bại");
      }
      setSuccessMessage(`Đã ghi nhận yêu cầu cho "${name.trim()}".`);
      setName("");
      setWebsite("");
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi yêu cầu thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreview(requestId: number) {
    setPreviewByRequest((s) => ({ ...s, [requestId]: { loading: true, error: null, data: s[requestId]?.data ?? null } }));
    try {
      const data = await previewManufacturerRequest(requestId);
      setPreviewByRequest((s) => ({ ...s, [requestId]: { loading: false, error: null, data } }));
    } catch (err) {
      setPreviewByRequest((s) => ({
        ...s,
        [requestId]: { loading: false, error: err instanceof Error ? err.message : "Xem trước thất bại", data: null },
      }));
    }
  }

  function pollJobStatus(requestId: number, jobId: string) {
    if (pollIntervals.current[requestId]) clearInterval(pollIntervals.current[requestId]);
    pollIntervals.current[requestId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/sync/status/${jobId}`);
        if (!res.ok) throw new Error("status request failed");
        const data: SyncStatus = await res.json();
        setJobStatusByRequest((s) => ({ ...s, [requestId]: data }));
        if (SYNC_TERMINAL_STATUSES.has(data.status)) {
          clearInterval(pollIntervals.current[requestId]);
          delete pollIntervals.current[requestId];
          loadRequests();
        }
      } catch {
        clearInterval(pollIntervals.current[requestId]);
        delete pollIntervals.current[requestId];
      }
    }, SYNC_POLL_INTERVAL_MS);
  }

  async function handleApprove(requestId: number) {
    setApproveByRequest((s) => ({ ...s, [requestId]: { loading: true, error: null, jobId: null } }));
    try {
      const result = await approveManufacturerRequest(requestId);
      setApproveByRequest((s) => ({ ...s, [requestId]: { loading: false, error: null, jobId: result.job_id } }));
      pollJobStatus(requestId, result.job_id);
      await loadRequests();
    } catch (err) {
      setApproveByRequest((s) => ({
        ...s,
        [requestId]: { loading: false, error: err instanceof Error ? err.message : "Duyệt thất bại", jobId: null },
      }));
    }
  }

  return (
    <div className="max-w-xl w-full rounded-xl border border-black/10 dark:border-white/15 p-6 space-y-5 bg-white dark:bg-black/20">
      <div>
        <h2 className="text-lg font-semibold">Yêu cầu thêm hãng mới</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          Nhập tên và website chính thức của hãng. Hệ thống sẽ tự động kiểm tra sơ bộ website (sitemap, robots.txt,
          có cần JavaScript không) và ghi thành checklist ngay khi gửi. Sau đó có thể để AI cục bộ (Ollama) đọc thử
          rồi tự động đồng bộ, không cần dev viết adapter riêng.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="block mb-1 text-black/70 dark:text-white/70">Tên hãng</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Yealink"
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
            disabled={submitting}
          />
        </label>
        <label className="block text-sm">
          <span className="block mb-1 text-black/70 dark:text-white/70">Website chính thức (bắt buộc)</span>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="VD: yealink.com"
            required
            className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
            disabled={submitting}
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {successMessage && <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>}

      {requests.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/15">
          <h3 className="text-sm font-medium text-black/70 dark:text-white/70">Danh sách yêu cầu</h3>
          <ul className="space-y-3 max-h-[32rem] overflow-auto">
            {requests.map((r) => {
              const preview = previewByRequest[r.id];
              const approve = approveByRequest[r.id];
              const jobStatus = jobStatusByRequest[r.id];
              const busy = Boolean(preview?.loading || approve?.loading);

              return (
                <li key={r.id} className="text-sm border-b border-black/5 dark:border-white/10 pb-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      {r.website_url && (
                        <a
                          href={r.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 truncate block"
                        >
                          {r.website_url}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.ai_sync_enabled && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                          AI đã bật
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? ""}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </div>
                  </div>

                  {r.notes && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-black/60 dark:text-white/60">
                        Kết quả kiểm tra sơ bộ
                      </summary>
                      <pre className="mt-1 whitespace-pre-wrap text-xs text-black/70 dark:text-white/70 font-sans">
                        {r.notes}
                      </pre>
                    </details>
                  )}

                  {!r.ai_sync_enabled && r.website_url && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePreview(r.id)}
                          disabled={busy}
                          className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                        >
                          {preview?.loading ? "Đang đọc thử..." : "Xem trước (AI)"}
                        </button>
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={busy}
                          className="rounded-md bg-purple-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
                        >
                          {approve?.loading ? "Đang duyệt..." : "Duyệt & đồng bộ (AI)"}
                        </button>
                      </div>
                      <p className="text-[11px] text-black/50 dark:text-white/50">
                        AI đọc thử vài trang sản phẩm bằng model cục bộ (chậm, có thể mất vài phút) -- xem trước
                        trước khi duyệt để tránh dữ liệu sai bị đồng bộ vào hệ thống chính.
                      </p>
                    </div>
                  )}

                  {preview?.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{preview.error}</p>}

                  {preview?.data && (
                    <div className="mt-2 space-y-2 rounded-md bg-black/[.03] dark:bg-white/[.06] p-2">
                      <p className="text-xs text-black/60 dark:text-white/60">
                        Đã thử {preview.data.checked_urls} trang -- mã hãng dự kiến:{" "}
                        <code>{preview.data.manufacturer_key}</code>
                      </p>
                      <ul className="space-y-2">
                        {preview.data.products.map((p, i) => (
                          <li key={i} className="text-xs border border-black/10 dark:border-white/10 rounded-md p-2">
                            <a
                              href={p.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-blue-600 dark:text-blue-400"
                            >
                              {p.source_url}
                            </a>
                            {p.ok ? (
                              <div className="mt-1 space-y-0.5">
                                <div>
                                  <span className="font-medium">{p.name ?? "(không xác định)"}</span>
                                  {p.model && <span className="text-black/50 dark:text-white/50"> · {p.model}</span>}
                                </div>
                                {p.category && <div className="text-black/60 dark:text-white/60">{p.category}</div>}
                                {p.description && (
                                  <div className="text-black/60 dark:text-white/60 line-clamp-2">{p.description}</div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-1 text-red-600 dark:text-red-400">{p.error ?? "Lỗi không xác định"}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {approve?.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{approve.error}</p>}

                  {jobStatus && (
                    <div className="mt-2 space-y-1.5 rounded-md bg-black/[.03] dark:bg-white/[.06] p-2">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${SYNC_STATUS_STYLES[jobStatus.status] ?? ""}`}
                        >
                          {jobStatus.status}
                        </span>
                        <span className="text-black/60 dark:text-white/60">
                          {jobStatus.processed}/{jobStatus.total} sản phẩm
                        </span>
                      </div>
                      <ProgressBar progress={jobStatus.progress} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
