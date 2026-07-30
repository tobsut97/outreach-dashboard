# Outreach Dashboard — v2

Vite + React + TypeScript + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com).

This is the active version of the dashboard. Branding (colors, typography) will be
customized in `src/index.css` and `components.json` once brand assets are provided —
for now it's the shadcn default theme.

## Develop

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173` with hot reload. This is the primary way to work on v2 —
don't open `index.html`/`dist/` directly during development.

## Add components

```bash
npx shadcn@latest add <component>
```

## Build

```bash
npm run build
```

Writes a single self-contained `dist/index.html` (via `vite-plugin-singlefile`) with all
JS/CSS inlined, so it can be opened directly via `file://` with no server — same as
`v1/dashboard.html`, and needed because browsers block loading separate JS module files
over `file://`. The root `index.html` picker links here. Run this after any change and
commit the result.

## Data pipeline

v2 uses a different CSV format and pipeline than v1 — a LinkedHelper *profile export*
(one row per contact, with `full_messaging_history`) rather than v1's per-campaign
Replies/Processed/Failed exports.

### Requirements

- Python 3.10+ (stdlib only)
- [Ollama](https://ollama.com), running locally, with the `qwen2.5:7b-instruct` model
  pulled (`brew install ollama && brew services start ollama && ollama pull qwen2.5:7b-instruct`).
  Classification runs entirely on-device — no data leaves the machine, no API cost.

### Running it

1. Add an entry to the `SOURCES` list at the top of [extract.py](extract.py) for each
   LinkedHelper profile-export CSV (owner name + file path).
2. Run it:

   ```bash
   python3 extract.py
   ```

   This parses every conversation, drops messages excluded by the history rules below,
   classifies every replied conversation's sentiment (`positive`/`negative`/`neutral`,
   always exactly one) and up to 2 tags via the local Ollama model, and writes
   `data.json`.

   Classification results are cached in `classify_cache.json` (keyed by profile +
   reply content) so re-runs only classify new or changed conversations. Progress is
   saved every 5 classifications, so an interrupted run can be safely resumed.

3. Rebuild the app (`npm run build`) so the dashboard picks up the new `data.json`.

### History rules

These apply to every entry in `SOURCES`, so they hold for each new export without
per-CSV tweaking. A message is kept only if it falls on/after **both**:

- `HISTORY_CUTOFF` in [extract.py](extract.py) — currently 2023-01-01. LinkedIn exports
  carry years of unrelated personal history for contacts who were already connections
  before any campaign existed. Change the constant to move the boundary.
- the row's `add_to_target_date_iso`, i.e. when the contact became a campaign target.
  Rows with a blank value are only subject to the cutoff.

A conversation left with no outgoing message is dropped entirely. On the current export
this removes 7 conversations dating from 2018 and 2020.

### Tags

Fixed list, up to 2 per replied conversation, independent of sentiment: `meeting_booked`,
`open_to_call`, `referred_colleague`, `future_timing`, `has_existing_solution`,
`no_budget`, `not_relevant`, `role_change`, `no_reason_given`, `unclear`. Defined in
`ALLOWED_TAGS` in extract.py — the model is constrained to only pick from this list.
`ALLOWED_TAGS` in [src/lib/sentiment.ts](src/lib/sentiment.ts) mirrors it for the editor;
keep the two in step.

## Deployment

Deployed on Vercel from this directory (`v2/vercel.json` sets the build command and output
directory; `v2/.nvmrc` pins the Node version). CI (`.github/workflows/ci.yml` at the repo root)
runs lint, type-check, and build on every PR and on push to `main` — it's a quality gate only;
Vercel's own Git integration handles the actual deploy (Preview per PR, Production on merge),
so there's no custom deploy step or `VERCEL_TOKEN` secret involved.

**One-time setup, done in the Vercel dashboard (not automatable from the repo):**

1. Import `tobsut97/outreach-dashboard` into Vercel, and set **Root Directory** to `v2`. The
   repo-root version-picker page and the frozen `v1/` are intentionally not deployed.
2. Confirm the first deploy picks up `v2/vercel.json`.
3. **Project Settings → Deployment Protection → enable Password Protection**, for both
   Production and Preview, before treating the URL as safe to share. `data.json`/`hubspot.json`
   contain real prospect and lead data (names, companies, emails, LinkedIn URLs, HubSpot
   deal info) baked into the build — see the warning in the repo-root `README.md`.
4. No environment variables are needed — all data is baked in at build time from the committed
   JSON files.

## Manual corrections

Clicking a row in a sentiment detail page opens a side sheet with the full message thread.
**Edit** allows changing the sentiment, swapping the reasons (still capped at 2), and
marking a conversation irrelevant, which excludes it from every metric while leaving it
visible but dimmed in the table so it can be undone.

Edits are keyed by `profile_url` and stored in `localStorage`, then layered over
`data.json` at render time — so they survive re-running `extract.py`, but they are
per-browser and do **not** feed back into the pipeline. `classify_cache.json` still holds
the model's original answer, so a re-run will not learn from a correction.
