# Outreach Dashboard

Turns LinkedIn outreach exports (LinkedHelper CSVs) into a dashboard showing reply
sentiment, tags, and outreach volume per campaign owner.

## Versions

- [`index.html`](index.html) — open this first. Lets you pick a version.
- [`v2/`](v2/) — current, actively developed. Vite + React + TypeScript + Tailwind CSS +
  [shadcn/ui](https://ui.shadcn.com), with local (Ollama-based) reply classification. See
  [v2/README.md](v2/README.md).
- [`v1/`](v1/) — frozen snapshot of the original static-HTML dashboard, kept for
  reference. Contains only the built `dashboard.html`; it's never rebuilt or edited again.
  Its data pipeline (Claude CLI-based classification of per-campaign CSV exports) is
  frozen along with it — see the notes in `v1`'s own extract.py if you ever need to
  reconstruct how it worked.

To cut a new version later (e.g. `v3`), copy `v2/` to `v3/`, keep developing in `v3/`,
and freeze `v2/` the same way `v1/` was frozen (drop its source files, keep only its
built output). Then update the cards in [`index.html`](index.html).

## Data pipeline

v1 and v2 use different LinkedHelper export formats and different classification
pipelines — they are not shared. See [v2/README.md](v2/README.md#data-pipeline) for how
v2's pipeline works (local Ollama model, no external API calls).

## Notes

- `data.json` and both versions' built dashboards contain real prospect data (names,
  emails, message content) — keep this repo private.
- CSV/file paths referenced by each version's `extract.py` are hardcoded to a local
  machine; update them if running from a different environment.
