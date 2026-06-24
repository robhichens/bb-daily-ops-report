# BB Daily Ops Report (DOR) — Build Handover

**For:** Claude Code
**Owner:** Rob Hichens, Director of Operations, Bright Beginnings Preschool
**Status:** Greenfield build. A localStorage HTML MVP exists (proof of concept only — do not port its code; use it only to understand UX intent).
**Last updated:** 2026-06-23 — field spec reflects the current Google Sheet `NEW - Daily Ops Report TEMPLATE` (Drive ID `1aHnOmvkfYWUJPrU_EiqjelliBW06WebcYjaoAVmCQRk`).

---

## 1. What we're building & why

Three site directors (Crozet, Forest Lakes, Mill Creek) currently fill out a **Daily Ops Report** by copying a Google Sheet template every week. We're replacing that with a web app that:

1. Presents the DOR as a clean, validated, autosaving form (one submission per site, per day).
2. Writes each report as a structured document to **Firebase/Firestore**.
3. Renders a **live cross-site dashboard** so leadership (KP / Molly / Rob) sees rollups the instant a director submits — the thing a copied spreadsheet can never do.

**This is a bb-platform module.** Build it standalone (own repo, own Netlify site) but against the **bb-platform Firebase project** and shared `dailyOpsReports` collection, so the data is immediately usable by bb-platform dashboards and the whole thing later lifts into bb-platform as routes (`/ops/daily-report`, `/ops/dashboard`) under the existing role-based auth. Do not invent a throwaway data shape — the schema in §4 is the contract.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | **Vite + React 19 + TypeScript** | `react@19`, `react-dom@19` |
| Styling | **Tailwind CSS** + **shadcn/ui** | Theme tokens in §8 |
| Animation | **Framer Motion** | View/section transitions, list add/remove, number ticks on dashboard |
| Backend | **Firebase** | Auth + Firestore (no custom server) |
| Source | **GitHub** | Repo `robhichens/bb-dor` |
| Deploy | **Netlify** | Suggested site `bb-dor.netlify.app`; SPA redirect to `/index.html` |
| Node / PM | Node 20 LTS | Use npm unless told otherwise |

Forms: do **not** use native `<form>` submit; use controlled components + `onClick`/`onChange` handlers.

---

## 3. Suggested structure

```
src/
  main.tsx
  App.tsx                      # router: /report, /dashboard, /login
  lib/
    firebase.ts                # init app, auth, db
    schema.ts                  # DailyOpsReport types + field config (single source of truth)
    reports.ts                 # data layer: subscribe, upsertDraft, submit, byWeek, bySite
    derive.ts                  # total, day-of-week, weekOf(Monday), goals
    export.ts                  # CSV / JSON
  auth/
    AuthProvider.tsx           # user + role + assigned siteId via users/{uid}
    RequireAuth.tsx
  components/
    report/
      ReportForm.tsx
      HeaderSection.tsx
      AttendanceSection.tsx
      LaborSection.tsx
      EnrollmentMarketingSection.tsx
      StaffSection.tsx
      DirectorPacketSection.tsx
      DirectorReportList.tsx   # dynamic numbered notes
      CountNoteRow.tsx         # reusable: label + count input + notes input + goal pill
    dashboard/
      Dashboard.tsx
      KpiCards.tsx
      AttendanceBySite.tsx
      EnrollmentFunnel.tsx
      StaffWatch.tsx
      PacketCompliance.tsx
      ReportsTable.tsx         # expandable rows
    ui/                        # shadcn components
  styles/
    globals.css                # Tailwind + shadcn CSS vars
```

Keep `schema.ts` as the **single source of truth** — section/field definitions live there as typed config, and both the form and the CSV exporter iterate over it so they can never drift.

---

## 4. Data model (the contract — do not deviate)

Firestore collection: **`dailyOpsReports`**. Document ID is deterministic: **`{siteId}_{date}`** (e.g. `crozet_2026-06-22`). This gives one report per site per day for free and makes draft autosave an idempotent upsert.

```ts
export type SiteId = 'crozet' | 'forest-lakes' | 'mill-creek';

export interface CountNote {
  count: number;      // >= 0, integer
  notes: string;      // free text; prompt text differs per field (see §5)
}

export interface DailyOpsReport {
  id: string;                 // `${siteId}_${date}`
  siteId: SiteId;
  siteName: string;           // 'Crozet' | 'Forest Lakes' | 'Mill Creek'
  date: string;               // 'YYYY-MM-DD'
  day: string;                // derived weekday, e.g. 'Monday'
  weekOf: string;             // derived Monday 'YYYY-MM-DD' (grouping key)
  director: string;

  attendance: {
    preschool: number;
    subsidy: number;          // DSS, CCA, Foster, United Way
    total: number;            // derived = preschool + subsidy
  };

  labor: {
    totalHours: number;       // 2 decimals
    overtimeHours: number;    // 2 decimals
    directorMinutesInRooms: number;
  };

  enrollmentMarketing: {
    toursGiven: CountNote;
    toursScheduled: CountNote;
    callsInEmailsWeb: CountNote;
    enrollmentCommsOut: CountNote;   // daily goal = 15
    regFeesPaid: CountNote;
    newStarts: CountNote;
    enrollmentsToday: CountNote;
    terminationsToday: CountNote;
  };

  staff: {
    callOutsLate: CountNote;
    rtoVacation: CountNote;
    sentHome: CountNote;
    staffTerminating: CountNote;
    timeSpentRecruiting: CountNote;  // see FLAG-2 re: unit
    futureHires: CountNote;
  };

  directorPacket: {
    completed: boolean;              // "Director Packet Completed Today" Yes/No
    incompleteReason: string;        // required when completed === false
  };

  directorReport: string[];          // ordered notes, empties stripped on submit

  status: 'draft' | 'submitted';
  submittedAt: string | null;        // ISO
  createdAt: string;                 // ISO
  updatedAt: string;                 // ISO
  createdByUid: string;
}

export const ENROLLMENT_COMMS_DAILY_GOAL = 15;
```

Derived fields (`total`, `day`, `weekOf`) are computed client-side in `derive.ts` and written on every save so the dashboard can query without recomputation. `weekOf` = the Monday of `date` (ISO week start Monday).

---

## 5. Form spec — exact fields from the current sheet

Render in this order. Every count field is a non-negative integer; labor fields allow 2 decimals. "Notes prompt" is the placeholder/helper text shown beside the input.

### 5.1 Header
| Field | Type | Rules |
|---|---|---|
| Site | select (Crozet / Forest Lakes / Mill Creek) | required; for directors, default + lock to their assigned site |
| Date | date | required; defaults to today; derives Day + Week |
| Day | auto (read-only) | derived from Date |
| Director | text (autocomplete: Jacqueline Lang, Jess Rybak, Laura Baker) | required |

> **FLAG-1:** The current canonical template uses a single **Director** field. The older per-site sheets used **Opening Director + Closing Director**. Confirm whether you want one or both. Spec above assumes one.

### 5.2 Attendance
| Field | Type | Notes prompt |
|---|---|---|
| Pre-School | number | — |
| Subsidy (DSS, CCA, Foster, United Way) | number | — |
| Total ATTENDANCE | auto (read-only) | = Pre-School + Subsidy |

### 5.3 Labor
| Field | Type | Notes prompt |
|---|---|---|
| Total Labor Hours | number (2 dp) | — |
| Total Overtime Hours | number (2 dp) | Add names |
| Director Minutes in Rooms | number | Bathroom breaks, Sub, Classroom Management |

### 5.4 Enrollment / Marketing  *(sheet section header: "ENROLLMENT/MARKETING")*
Each row = count + notes.
| Field | Notes prompt | Special |
|---|---|---|
| Number of Tours Given | Add names | |
| Number of Tours Scheduled | Check IKS | |
| Number of Calls In/Emails & Web Inq | Provide all details | |
| Enrollment Communication Out/IKS | Provide all details (daily goal is 15 — two-way comms) | **Goal pill: green at ≥15, amber below** |
| Number of Reg Fees Paid | With Names, Room and Start Date | |
| Number of New Starts | With Names, Room | |
| Number of Enrollments (Today) | With Names, Rooms, Start Date (Reg PD, Enhancement PD, Start Date confirmed) | |
| Number of Terminations (Today) | With Names, Room, Termination Date and Reason | |

### 5.5 Staff
| Field | Notes prompt |
|---|---|
| Call Outs/Late for Shift | Name and Reason |
| RTO/Vacation | Name and Reason |
| Number of Staff Sent Home | Name and Reason (Over staffed, sick, etc.) |
| Staff Terminating | Name, Reason and Last Day |
| Time Spent Recruiting | Phone screening, Hiring Correspondence, Interviews |
| Future Hires | Name, Position, Start Date |

> **FLAG-2:** "Time Spent Recruiting" — confirm the unit. Modeled as a `CountNote` for now; it's likely **hours**, not a count. If hours, relabel the input and treat `count` as a decimal hours value (and consider renaming the key to `timeRecruitingHours`).

### 5.6 Director Packet
| Field | Type | Rules |
|---|---|---|
| Director Packet Completed Today | toggle Yes/No (boolean) | required |
| If no — what didn't you complete / what got in the way | textarea | **required when "No"**, hidden when "Yes" |

### 5.7 Director Report on the Day
Dynamic numbered list (start with one empty line; "+ Add line"; remove per line). Free text. On submit, trim and drop empty lines. No fixed cap (sheet shows 1–9 but treat as unbounded).

---

## 6. Behaviors

- **Autosave draft.** Debounce ~800ms; upsert to `dailyOpsReports/{siteId}_{date}` with `status:'draft'`. Show a subtle "saved" indicator. Keep a localStorage mirror as offline fallback and reconcile on reconnect.
- **Submit.** Validate (below) → set `status:'submitted'`, `submittedAt=now`. After submit the form is read-only for directors; **admins can re-open/edit** any report.
- **One per site/day** is enforced by the deterministic doc ID. If a submitted doc exists for that site/date, load it (read-only for directors) rather than creating a duplicate.
- **Validation (on submit):** Site, Date, Director required; all counts ≥ 0 integers; labor ≥ 0; if `directorPacket.completed === false` then `incompleteReason` required; strip empty director-report lines.
- **Derived:** recompute `total`, `day`, `weekOf` on every change.

---

## 7. Dashboard spec

Filters: **Week** (dropdown of `weekOf` values present) and **Site** (All / each site). All aggregates respect the filter; attendance-by-site always shows all three for comparison.

- **KPI cards (Framer number tick-in):**
  - Avg Daily Attendance — `sum(total)/distinct days`
  - Overtime — `sum(overtimeHours)` and OT% = `sumOT / sumLaborHours` (amber if >5%)
  - Enrollment Comms Out — `sum(enrollmentCommsOut.count)` vs goal `days × 15` (green if ≥ goal)
  - Net New Starts — `sum(newStarts) − sum(terminationsToday)`
- **Attendance by Site** — horizontal bars, week totals per site.
- **Enrollment Pipeline funnel** — Tours Scheduled → Tours Given → Reg Fees Paid → New Starts → Enrollments (Today).
- **Staff Watch** — totals for Call Outs/Late, Sent Home, Staff Terminating, Future Hires, Time Spent Recruiting.
- **Director Packet Compliance** — % of reports with `completed === true`; list any "No" with reasons.
- **Reports table** — sortable by date/site; expandable row reveals all notes fields + the full Director Report list.
- **Export** — CSV and JSON of the filtered set (iterate `schema.ts` field config so columns stay in sync).

Charts: simple Tailwind/SVG bars are fine (keeps the bundle light and matches the MVP). If you reach for a lib, `recharts` is acceptable.

---

## 8. Design system (official **Bright Beginnings** brand — modernized style guide)

> **Updated 2026-06-24.** This app now uses the **public Bright Beginnings brand**, not the
> earlier "bbonboard internal" brand. The retired internal palette (navy/orange/teal/purple,
> Playfair+Inter) is superseded by everything below. Source of truth: the modernized style
> guide + the official logo assets in `public/brand/` (tree mark, full-color lockup, heart
> birds). **Use the actual logo PNGs — never recreate the logo in CSS/type.**

Fonts: **Inter** (body + section/UI titles, weights 300–900) · **Ubuntu** (brand wordmark /
product title, charcoal) · **Playfair Display** (reserved for hero/CTA titles only — never
body or UI). Tokens live in `src/index.css` (`@theme`). Cards: **5px left border**, **20px
radius**, soft flat-ish shadow.

| Token | Hex | Use |
|---|---|---|
| coral | `#F08782` | primary action / CTA, links, card titles |
| coral-dark | `#C45E59` | coral text on light |
| yellow | `#FFD437` | accent / warning, section rules |
| sky | `#AEDFE5` | accent / info / hover |
| sky-deep | `#3B9BA3` | sky-toned text on light |
| charcoal | `#545454` | headings, dark surfaces (header/CTA bg) |
| dk / mid / lt gray | `#6D6E71` / `#A7A9AC` / `#D1D2D4` | body text, muted, borders |
| cream | `#FAFAF5` | app background |
| card | `#FFFFFF` | card surface |

**Functional status colors** (NOT in the marketing palette — used ONLY for KPIs, streaks, and
red flags so the dashboard reads at a glance; coral stays the primary action color):
good `#5BB98C`, critical `#E5564E`, warning = yellow `#FFD437`, info = sky.

Section/card accent colors (left border), per the modernized guide: **coral · yellow · sky ·
gray** (cycle in that order). The shadcn CSS variables in `src/index.css` are already wired
(primary = coral, accent = sky, destructive = critical red). Use Framer Motion for: view
switches, section mount, list add/remove, KPI count-up, and streak/celebration moments
(the heart-bird elements are the celebratory motif).

---

## 9. Firebase

- **Project:** point at the **bb-platform Firebase project** (so data is shared). If it doesn't exist yet, create `bb-platform` now and use it — do **not** spin a throwaway.  *(see FLAG-3)*
- **Auth:** email/password to start. Roles live in `users/{uid}` = `{ role, siteId? }` with roles `admin | director | teacher | assistant | floater | new_hire` (bb-platform's set). Only `director` and `admin` reach the DOR; directors are scoped to their `siteId`, admins see all.  *(Google Workspace SSO restricted to the BB domain is the eventual target — see FLAG-4.)*
- **Env (Netlify + `.env.local`):** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

Starter security rules (tighten before production):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function role() {
      return get(/databases/$(db)/documents/users/$(request.auth.uid)).data.role;
    }
    function userSite() {
      return get(/databases/$(db)/documents/users/$(request.auth.uid)).data.siteId;
    }
    match /dailyOpsReports/{id} {
      allow read: if request.auth != null && role() in ['admin','director'];
      allow create, update: if request.auth != null && (
        role() == 'admin' ||
        (role() == 'director' && request.resource.data.siteId == userSite())
      );
      allow delete: if request.auth != null && role() == 'admin';
    }
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && role() == 'admin';
    }
  }
}
```

---

## 10. Build phases

1. **Scaffold** — Vite+React19+TS, Tailwind, shadcn init, Framer, Firebase SDK, router, theme tokens, fonts. Deploy empty shell to Netlify with SPA redirect.
2. **Auth + roles** — login, `AuthProvider`, `users/{uid}` role/site, route guards, site-scoping.
3. **Report form** — all sections per §5, `schema.ts` config, validation, derived fields, autosave draft + submit to Firestore. Seed 2–3 `users` docs for testing.
4. **Dashboard** — week/site filters, live Firestore subscription, KPI cards, attendance bars, funnel, staff watch, packet compliance, table, export.
5. **Polish + ship** — Framer transitions, loading/empty/error states, mobile layout, lock/edit rules, final rules, README, production deploy.

---

## 11. Acceptance criteria

- A director logs in, lands on their site's report for today, fills it, sees autosave, submits; re-opening shows it read-only.
- Two directors on the same day produce two distinct docs; neither can overwrite the other's site.
- Admin opens the dashboard, picks a week, and every KPI/chart/table reflects submitted reports live; CSV export matches on-screen data.
- All §5 fields present, correctly labeled, with the exact notes prompts; goal pill behaves at the 15 threshold; packet "No" forces a reason.
- Lighthouse: no console errors; mobile usable; first load reasonable.

---

## 12. Open decisions for Rob (resolve before / during build)

- **FLAG-1 — Director field:** single `Director`, or `Opening`/`Closing` (older site sheets)?
- **FLAG-2 — Time Spent Recruiting unit:** count vs hours? (Likely hours — affects label + type.)
- **FLAG-3 — Firebase project:** confirm we build against the bb-platform project/collection now (recommended) vs a temporary one.
- **FLAG-4 — Auth method:** email/password for v1, or wait for Google Workspace SSO (domain-restricted) since the BB email migration is in flight.
- **FLAG-5 — Finance scope:** the current `NEW` template intentionally **drops** the Billing / Deposits / Productivity blocks that older per-site sheets carried (Tuition Charges, Tuition Express batches, Reg Fees $, etc.). Confirm finance data is **out of scope** for the DOR v1.
- **FLAG-6 — "Openings to capacity":** some site sheets had this FUTURES line; the `NEW` template omits it. Confirm omit (or add, derived from licensed capacity − enrollment).
- **FLAG-7 — Edit/lock window:** after submit, are directors fully locked (admin-only edits), or is there a same-day grace window to amend?

---

## 13. Reference

- **UX intent (do not copy code):** the localStorage proof-of-concept `bb-daily-ops-report-mvp.html` shows the form+dashboard flow and the goal-pill / pipeline / expandable-table patterns.
- **Source of field truth:** Google Sheet `NEW - Daily Ops Report TEMPLATE` (`1aHnOmvkfYWUJPrU_EiqjelliBW06WebcYjaoAVmCQRk`). If the sheet and this doc disagree, the sheet wins — re-verify before building.
