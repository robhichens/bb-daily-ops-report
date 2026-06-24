# SETUP — getting this repo running

You barely touch the terminal. Claude Code runs the commands; you install a couple of things, drop the files in this folder, and paste one message.

## 1. Install Node.js
The app is a Node project, so your computer needs Node to build it. Go to **nodejs.org**, download the **LTS** installer, and run it (this also installs `npm`). Node 18+ is required; LTS gives you v22.

## 2. Install Claude Code
Easiest: the **Claude Code desktop app** (macOS/Windows) — it runs Claude Code without the terminal. Download it from the Claude Code docs and sign in with your Claude account.
Terminal alternative (no Node needed for this part): `curl -fsSL https://claude.ai/install.sh | bash` (Mac) or `irm https://claude.ai/install.ps1 | iex` (Windows PowerShell).

## 3. Get this repo on your computer
Clone `robhichens/bb-daily-ops-report` with **GitHub Desktop** (GUI), or `git clone https://github.com/robhichens/bb-daily-ops-report.git` in a terminal. You now have a local folder.

## 4. Put the files in the folder
Drop **`bb-dor.md`** and the foundation files into this repo folder. Don't worry about exact subfolders — the kickoff message tells Claude Code to place each one. Keep the two env files named exactly `.env.example` and `.env.local`, and keep `bb-dor.md` in the root.

## 5. Open Claude Code on this folder and paste the kickoff message
Open the project in the Claude Code app (or `cd` into the folder and run `claude`). Paste the message below and approve the commands it runs. It stops after the scaffold so you can confirm the dev server works, then continues building.

```
You're building the Bright Beginnings Daily Ops Report in this repo.

Read bb-dor.md first — it's the full spec (data model, fields, dashboard,
design tokens, build phases, open flags). Treat it as authoritative.

These foundation files are already in this folder and must be PRESERVED,
not regenerated: README.md, .gitignore, .env.example, .env.local,
netlify.toml, firestore.rules, src/lib/schema.ts, src/lib/firebase.ts,
src/lib/derive.ts, src/lib/reports.ts, src/env.d.ts. If any are in the
wrong place, move them to the paths in bb-dor.md §3. src/lib/schema.ts is
the single source of truth for the data model — do not rewrite it, and
build the form/dashboard against the helpers in src/lib/reports.ts.

Do these in order, and STOP after #4 so I can confirm the dev server runs
before you build features:

1. Scaffold a Vite React + TypeScript app into this repo WITHOUT deleting
   the foundation files. Scaffold into a temp folder and merge in, keeping
   my versions of any conflicting files (README.md, .gitignore, anything
   under src/).
2. Install firebase and framer-motion. Set up Tailwind CSS and shadcn/ui,
   and wire the Tailwind theme + shadcn CSS variables to the bbonboard
   brand tokens in bb-dor.md §8 (navy/orange/teal/purple/cream, Playfair
   Display + Inter, 22px card radius, 5px left-border card accents).
3. Add routing for /login, /report, and /dashboard with a basic app shell
   in the brand style.
4. Run the dev server, confirm it builds with no errors, and tell me the
   localhost URL. STOP here.

After I confirm it runs, continue through bb-dor.md phases 2–5 (Auth +
roles, Report form with autosave + submit to Firestore, Dashboard, polish),
and commit to git after each phase.

Security: the Firestore project is on open dev rules right now. Do NOT load
real data — test data only until I deploy firestore.rules.
```

When it finishes step 4 it'll give you a `http://localhost:5173`-style link — open it and you should see the app shell in the BB colors. Reply to keep it building.

## After it's running
- Add the six `VITE_FIREBASE_*` vars (from `.env.local`) to Netlify → Site settings → Environment variables, or the deployed build won't connect.
- Before any real data goes in, set up Auth + an admin `users/{uid}` doc, then deploy `firestore.rules` (`firebase deploy --only firestore:rules`). Until then the database is open to anyone.
- Resolve the seven flags in `bb-dor.md` §12 as Claude Code reaches them.
