# BB Daily Ops Report (DOR)

Web app that replaces Bright Beginnings' weekly copy-a-template Google Sheet. Site directors file one Daily Ops Report per site per day; each report is written to Firestore and surfaced on a live cross-site dashboard for leadership. Built standalone, designed to lift into **bb-platform** later (routes `/ops/daily-report`, `/ops/dashboard`).

- **Repo:** https://github.com/robhichens/bb-daily-ops-report
- **Live:** https://bbdor.netlify.app/ *(currently the MVP.html placeholder)*
- **Full build spec:** see `bb-dor.md` (field-by-field spec, dashboard spec, phases, open decisions). The spec is authoritative; this README covers setup.

## Stack

Vite + React 19 + TypeScript · Tailwind CSS + shadcn/ui · Framer Motion · Firebase (Auth + Firestore) · GitHub · Netlify. Node 20 LTS, npm.

## Getting started

```bash
git clone https://github.com/robhichens/bb-daily-ops-report.git
cd bb-daily-ops-report

# scaffold the Vite app in place if not already done:
# npm create vite@latest . -- --template react-ts
npm install
npm install firebase
npm install framer-motion
# then init Tailwind + shadcn per their docs

# environment
cp .env.example .env.local   # .env.local already contains the real bb-daily-ops-report values
npm run dev
```

App entry expects a router with `/login`, `/report`, `/dashboard`. See `bb-dor.md` §3 for the intended file structure.

## Environment variables

Six `VITE_FIREBASE_*` values (see `.env.example`). The real values for the `bb-daily-ops-report` project are in `.env.local` (gitignored). **Add the same six to Netlify** under Site settings → Environment variables, or the deployed build won't connect.

## Firebase

- Project: **`bb-daily-ops-report`** (data lives here; bb-platform can read it later by pointing at the same project, or migrate the collection).
- **Auth:** email/password to start. Create a `users/{uid}` doc per user: `{ role: 'admin' | 'director' | 'teacher' | 'assistant' | 'floater' | 'new_hire', siteId?: 'crozet' | 'forest-lakes' | 'mill-creek' }`. Only `director` (scoped to their `siteId`) and `admin` (all sites) reach the DOR.
- **Firestore:** one collection, `dailyOpsReports`, document id `{siteId}_{date}` (e.g. `crozet_2026-06-22`) → one report per site per day, idempotent draft upserts.

### ⚠️ Security — read this

The project currently uses Firebase's default **open** dev rules: anyone with the project reference can read/write **all** data until **2026-07-23**, after which all client requests are denied. Before loading any real data, deploy the hardened role-based rules in `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

Those rules require `users/{uid}` docs to exist, so set up Auth + at least one admin user first.

## Data model

The TypeScript contract lives in `src/lib/schema.ts` (`DailyOpsReport`) and is the single source of truth — the form, dashboard, and exporter all iterate its field config. Derived fields (`total`, `day`, `weekOf`) are computed in `src/lib/derive.ts`; call `withDerived(report)` before every save.

## Deploy (Netlify)

`netlify.toml` is configured: build `npm run build`, publish `dist`, SPA redirect to `index.html`. Connect the GitHub repo to the `bbdor.netlify.app` site, add the env vars, and pushes to `main` auto-deploy. The MVP.html placeholder is replaced once the Vite build publishes.

## Build phases

Scaffold → Auth + roles → Report form (autosave + submit) → Dashboard (KPIs, funnel, table, export) → polish + ship. Details and acceptance criteria in `bb-dor.md` §10–11.

## Open decisions

Seven flags in `bb-dor.md` §12 (e.g. single vs opening/closing director; "Time Spent Recruiting" unit; finance out of scope for v1). Resolve as you build.
