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

   This parses every conversation, filters out messages that predate the row's
   `add_to_target_date_iso` (excludes pre-existing personal LinkedIn history for
   contacts who were already connections before being added to a campaign), classifies
   every replied conversation's sentiment (`positive`/`negative`/`neutral`, always
   exactly one) and up to 2 tags via the local Ollama model, and writes `data.json`.

   Classification results are cached in `classify_cache.json` (keyed by profile +
   reply content) so re-runs only classify new or changed conversations. Progress is
   saved every 5 classifications, so an interrupted run can be safely resumed.

3. Rebuild the app (`npm run build`) so the dashboard picks up the new `data.json`.

### Tags

Fixed list, up to 2 per replied conversation, independent of sentiment: `meeting_booked`,
`open_to_call`, `referred_colleague`, `future_timing`, `has_existing_solution`,
`no_budget`, `not_relevant`, `role_change`, `no_reason_given`, `unclear`. Defined in
`ALLOWED_TAGS` in extract.py — the model is constrained to only pick from this list.
