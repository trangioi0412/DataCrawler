/**
 * Thin fetch wrapper around the FastAPI sync engine. Every Next.js API
 * route that proxies to Python goes through this module instead of
 * hard-coding the base URL, so `PYTHON_API_URL` is the only place the
 * service address is configured.
 */

const PYTHON_API_URL = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export class PythonApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Python API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PYTHON_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new PythonApiError(response.status, body);
  }

  return body as T;
}

export interface Manufacturer {
  key: string;
  display_name: string;
  base_url: string;
}

export interface SyncAcceptedResponse {
  success: boolean;
  job_id: string;
  status: string;
  manufacturer: string;
}

export interface SyncStatus {
  job_id: string;
  manufacturer: string;
  mode: string;
  status: "queued" | "running" | "completed" | "completed_with_warnings" | "failed";
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  progress: number;
  error: string | null;
  warnings: string[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function listManufacturers(): Promise<Manufacturer[]> {
  return request<Manufacturer[]>("/api/manufacturers");
}

export function startSync(manufacturer: string, mode = "full"): Promise<SyncAcceptedResponse> {
  return request<SyncAcceptedResponse>("/api/sync/manufacturer", {
    method: "POST",
    body: JSON.stringify({ manufacturer, mode }),
  });
}

export function getSyncStatus(jobId: string): Promise<SyncStatus> {
  return request<SyncStatus>(`/api/sync/status/${jobId}`);
}

export interface ManufacturerRequest {
  id: number;
  name: string;
  website_url: string | null;
  status: "pending" | "in_progress" | "done" | "rejected";
  notes: string | null;
  ai_sync_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function listManufacturerRequests(): Promise<ManufacturerRequest[]> {
  return request<ManufacturerRequest[]>("/api/manufacturer-requests");
}

export function createManufacturerRequest(name: string, websiteUrl: string): Promise<ManufacturerRequest> {
  return request<ManufacturerRequest>("/api/manufacturer-requests", {
    method: "POST",
    body: JSON.stringify({ name, website_url: websiteUrl || null }),
  });
}

export interface AiPreviewProduct {
  source_url: string;
  ok: boolean;
  name: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
  features: string[];
  specifications: Record<string, string>;
  image_urls: string[];
  error: string | null;
}

export interface AiPreviewResponse {
  manufacturer_key: string;
  checked_urls: number;
  products: AiPreviewProduct[];
}

export interface AiApproveResponse {
  success: boolean;
  manufacturer_key: string;
  job_id: string;
  status: string;
}

// AI preview/approve calls run a local LLM against real pages (~1-2 min per
// page observed on this hardware) -- much longer than the rest of the API,
// so callers need a generous timeout instead of relying on fetch defaults.
const AI_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

export function previewManufacturerRequest(requestId: number): Promise<AiPreviewResponse> {
  return request<AiPreviewResponse>(`/api/manufacturer-requests/${requestId}/preview`, {
    method: "POST",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });
}

export function approveManufacturerRequest(requestId: number): Promise<AiApproveResponse> {
  return request<AiApproveResponse>(`/api/manufacturer-requests/${requestId}/approve`, {
    method: "POST",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });
}
