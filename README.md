# Outreach Dashboard

Turns LinkedIn outreach exports (LinkedHelper CSVs) into a static HTML dashboard
showing reply dispositions and funnel stages per campaign owner.

## Versions

- [`index.html`](index.html) — open this first. Lets you pick a version.
- [`v2/`](v2/) — current, actively developed. All new work happens here.
- [`v1/`](v1/) — frozen snapshot of the original dashboard, kept for reference. Contains
  only the built `dashboard.html`; it's never rebuilt or edited again.

To cut a new version later (e.g. `v3`), copy `v2/` to `v3/`, keep developing in `v3/`,
and freeze `v2/` the same way `v1/` was frozen (drop its source files, keep only its
built `dashboard.html`). Then update the cards in [`index.html`](index.html).

## Requirements

- Python 3.10+ (stdlib only, no pip dependencies)
- [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) (`claude`) installed and
  authenticated — `extract.py` shells out to it to classify replies and decline reasons
- LinkedHelper CSV exports (Replies / Processed / Processing / Failed) for each campaign

## Setup (v2)

1. Export the campaign CSVs from LinkedHelper into `~/Downloads`, using the exact
   filenames referenced in `CAMPAIGNS` and `FUNNELS` at the top of [v2/extract.py](v2/extract.py).
   Add or edit entries there if your campaigns or owners differ.

2. Run the extractor to parse conversations, classify replies via Claude, and write `v2/data.json`:

   ```bash
   cd v2 && python3 extract.py
   ```

   Classification results are cached in `v2/classify_cache.json` and
   `v2/decline_reasons_cache.json` so re-runs only classify new replies.

3. Inject the data into the template to produce the dashboard:

   ```bash
   python3 build.py
   ```

   This writes `v2/dashboard.html`.

4. Open `index.html` (or `v2/dashboard.html` directly) in a browser.

## Notes

- `data.json` and `dashboard.html` (in both `v1/` and `v2/`) contain real prospect data
  (names, emails, message content) — keep this repo private.
- CSV paths in `extract.py` are hardcoded to `~/Downloads` on a local machine; update
  them if running from a different environment.
