# Manufacturer Data Sync Engine

A generic, multi-manufacturer AV product catalog sync engine. HDCVT is the first manufacturer adapter, used to validate the architecture — the sync engine itself has no HDCVT-specific (or any manufacturer-specific) code.

```
Browser
  |
  v
Next.js UI (frontend/)
  |  Next.js API routes (thin proxy)
  v
FastAPI service (backend/)
  |
  v
sync_manufacturer_data()  <-- the one generic entry point
  |
  v
Manufacturer Registry  -->  BaseManufacturerAdapter subclasses (HDCVT, ...)
  |
  v
crawl -> normalize -> validate -> deduplicate -> transform -> persist
  |
  v
SQLite (SQLAlchemy) — Product, SyncJob
```

## This is a standalone, greenfield project

`D:\TRAN VAN GIOI\DataCrawler` was empty when this was built — no existing Next.js app, database, or catalog code to audit or integrate with. Everything here (Next.js app, Python service, schema) was created from scratch, not adapted from a pre-existing system. Every architectural default below (SQLite, plain `Base.metadata.create_all()` instead of Alembic, in-process background tasks instead of a job queue, no auth) reflects that — see "Known limitations."

**Note:** during testing, a second, unrelated, actively-developed project was found at `D:\TRAN VAN GIOI\website\AV_Catalog` (a Next.js app that already does manufacturer product discovery, AI enrichment, and syncs to a Wix Studio CMS, with uncommitted local changes). That project was deliberately left untouched — this repo does not integrate with it, run on top of it, or share any code, database, or ports with it.

## Running everything

Two independent services. Start the Python API first (the Next.js UI calls it).

```bash
# Terminal 1 — Python/FastAPI (see backend/README.md)
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000

# Terminal 2 — Next.js (see frontend/README.md)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev -- --port 3001   # AV_Catalog (unrelated project) already uses 3000 on this machine
```

Open http://localhost:3001/admin/sync, pick "HDCVT", click "Start Synchronization".

## Core function

```python
from core.engine import sync_manufacturer_data

sync_manufacturer_data(manufacturer="hdcvt")
# sync_manufacturer_data(manufacturer="yealink")  # once registered — same call, same engine
```

`sync_manufacturer_data()` (`backend/core/engine.py`) never branches on manufacturer name. It resolves an adapter from the registry and runs the same crawl -> normalize -> validate -> dedupe -> transform -> persist pipeline regardless of which manufacturer it's given. See [`backend/README.md`](backend/README.md) for "Adding a new manufacturer."

## What's implemented

- Generic sync engine + manufacturer registry + `BaseManufacturerAdapter` contract (`backend/core/`, `backend/manufacturers/base.py`)
- HDCVT adapter: sitemap-based discovery, verified selectors, real-site-tested (`backend/manufacturers/hdcvt/`)
- Normalization, validation (VALID/WARNING/INVALID), deterministic deduplication (manufacturer+model, falling back to a manufacturer+hash(name+URL) identity), transformation
- SQLite persistence via SQLAlchemy (`Product`, `SyncJob` tables)
- Async job-based sync: `POST /api/sync/manufacturer` returns a `job_id` immediately; a background task runs the sync; `GET /api/sync/status/{job_id}` reports live progress (`queued` -> `running` -> `completed` / `completed_with_warnings` / `failed`)
- Per-item error isolation: one bad product can't abort a sync (see the live-run numbers below)
- Structured logging (manufacturer + job_id on every line), rate limiting + retry/backoff + robots.txt awareness in the shared HTTP client
- Optional Google Sheets export: every successfully-persisted product is also written to a per-manufacturer tab (auto-created) in a shared spreadsheet, best-effort/non-fatal (`backend/services/google_sheets.py`) — see `backend/README.md` → "Google Sheets export"
- "Request a new manufacturer" intake form on the admin UI (name + **required** website) — queues a `ManufacturerRequest` row (`GET/POST /api/manufacturer-requests`, `PATCH .../{id}`) for a developer to pick up. On submission it automatically runs a best-effort recon (`backend/services/recon.py`: sitemap.xml? robots.txt disallow? static HTML or JS-rendered?) and attaches the findings as a checklist in `notes` — this does not register an adapter or crawl products itself, since selectors still need human/AI verification against real pages (see "Adding a new manufacturer")
- Next.js admin UI (manufacturer dropdown, start button, live progress bar/counts) talking to FastAPI only through Next.js API routes (`PYTHON_API_URL` env var, never hard-coded)
- 34 automated tests (registry, normalizer, validator, deduplicator, engine, HDCVT adapter against saved fixtures, API) — all passing, no network access required
- `GET /api/products` for browsing the synced catalog (used for verification, not yet wired into the UI)

## Verified against the live site

Ran a real sync against hdcvt.com during development (not part of the automated test suite — see `backend/README.md`):

```
total: 138, success: 138, failed: 0, status: completed
```

(An earlier run caught two real bugs this way: the sitemap's URL pattern also matched the site's news/solutions pages, and the validator was rejecting products that legitimately have no model number instead of using the deduplicator's documented fallback identity. Both are fixed and covered by tests — see `backend/README.md` → "HDCVT adapter notes.")

## Known limitations

- **No Alembic migration tooling yet.** Tables are created with `Base.metadata.create_all()` on startup since there's no pre-existing schema to preserve. Introduce Alembic before the schema needs to change without a fresh `create_all()`.
- **In-process background tasks, not a task queue.** `BackgroundTasks` runs the sync in the same process/thread pool as the API. Fine for one manufacturer at a time; a real queue (Celery/RQ/arq) would be needed for concurrent syncs across many manufacturers at scale.
- **In-process, single-worker job state.** Job rows are persisted to the DB (so `GET /api/sync/status` survives a restart), but there's no distributed locking — running multiple API replicas would need a real queue for correctness, not just persistence.
- **No authentication/authorization** on any endpoint. This wasn't in scope and there's no existing auth system here to integrate with.
- **Incremental sync is not implemented** — `sync_manufacturer_data(mode="incremental")` raises `NotImplementedError` with an explanation. The pipeline's dedup/update primitives already support it; only `discover_product_urls()` would need a "changed since" cursor, which no adapter currently has a data source for.
- **HDCVT model-number extraction is best-effort.** It's read from the first `<strong>` tag in the product intro and matched against a simple pattern; a few product types (e.g. some cable variants) don't expose a model number in that spot and are persisted without one (flagged `WARNING`, deduplicated via the name+URL fallback) rather than dropped.
- **Only HDCVT is implemented.** Yealink/Logitech/Cisco/etc. are architecturally supported (see "Adding a new manufacturer") but not built — that was explicitly out of scope for this pass.

## Recommended next step

Add a second manufacturer adapter to prove out the "no core engine changes" claim in practice, not just in test fixtures — see `backend/README.md` → "Adding a new manufacturer."
