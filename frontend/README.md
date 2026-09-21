# Manufacturer Data Sync Engine — Web

Next.js (App Router, TypeScript, Tailwind) admin UI for the [manufacturer sync engine](../README.md). This app never talks to the database directly — every data operation goes through the FastAPI service in [`../backend`](../backend).

## Running

```bash
npm install
cp .env.local.example .env.local   # set PYTHON_API_URL if not http://localhost:8000
npm run dev
```

Open http://localhost:3000/admin/sync (pick a different `--port` if something else already owns 3000 locally).

The Python service (`../backend`) must be running for the sync panel and manufacturer dropdown to work — see its README.

## Structure

- `app/admin/sync/page.tsx` — the sync admin page.
- `components/sync/ManufacturerSyncPanel.tsx` — manufacturer dropdown, start button, polling status/progress UI.
- `app/api/manufacturers/route.ts`, `app/api/sync/route.ts`, `app/api/sync/status/[jobId]/route.ts` — thin server-side proxies to FastAPI. They exist so the browser never needs the Python service's URL or CORS config, and so `PYTHON_API_URL` stays a server-only secret/config value.
- `lib/pythonApi.ts` — the only place that knows FastAPI's request/response shapes.

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build/serve
- `npm run lint` — ESLint
