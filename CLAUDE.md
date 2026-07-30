# outreach-dashboard

See [v2/notes.md](v2/notes.md) for a running log of what changed and why — check it before
starting new work so past fixes/decisions aren't relitigated or undone.

## Project overview

Pina Earth LinkedIn outreach dashboard: React 19 + Vite 8 + TypeScript, built as a
single-file bundle (`vite-plugin-singlefile`) so it works over `file://` with no server —
that's why the app uses hash-based routing instead of a router library. Data pipeline:
`v2/extract.py` parses raw LinkedIn CSV exports into `v2/data.json`, with LLM sentiment
classifications cached in `v2/classify_cache.json`.

## Commands

Run from `v2/`:

- `npm run dev` — dev server
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — `oxlint`
- `npx tsc --noEmit -p tsconfig.app.json` — type check only

## UI components — shadcn first

Always prefer an existing shadcn component over hand-rolled markup or a new styling
approach. Before building something custom, check whether shadcn already has it:

- Use the `mcp__shadcn__*` tools (`search_items_in_registries`, `view_items_in_registries`,
  `get_add_command_for_items`) to look up and install components.
- When unsure how a component works, consult https://ui.shadcn.com/docs/installation rather
  than guessing.
- This project's shadcn install is `@base-ui/react`-based, **not Radix** — compose triggers
  with the `render` prop (e.g. `<PopoverTrigger render={<Button/>}>`), not `asChild`.
- Don't introduce a second component library or a parallel styling system.

## Git workflow

The user is not a developer, so the workflow is optimized for reviewability without
overhead:

- Every **task** (not every chat message) gets its own feature branch and its own PR —
  e.g. one branch/PR for "add insights callout to dashboard", one for "fix reply-rate
  audit". Small follow-up tweaks within the same task land as additional commits on that
  branch, not new PRs.
- Branch naming: `<type>/<short-description>`, e.g. `fix/lara-reply-rate`,
  `feat/insights-callout`.
- Never commit straight to `main`.
- Confirm with the user before opening a PR if it wasn't already the explicit ask.

## Commit messages

Conventional Commits: `<type>: <imperative summary>`, ≤72 char subject line.

- Types: `feat | fix | chore | docs | refactor | test`
- One logical change per commit.
- Add a body only when the "why" isn't obvious from the subject line — skip it otherwise.

## Data pipeline caveat

Some data corrections (see [v2/notes.md](v2/notes.md)'s reply-rate audit) were applied by
hand directly to `data.json` and `classify_cache.json`, not by patching `extract.py`. If the
pipeline is ever re-run from raw CSVs, those fixes need to be re-applied or ported into
`extract.py` first — otherwise they'll silently disappear.
