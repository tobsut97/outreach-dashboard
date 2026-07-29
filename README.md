# Outreach Dashboard

Turns LinkedIn outreach exports (LinkedHelper CSVs) into a static HTML dashboard
showing reply dispositions and funnel stages per campaign owner.

## Requirements

- Python 3.10+ (stdlib only, no pip dependencies)
- [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) (`claude`) installed and
  authenticated — `extract.py` shells out to it to classify replies and decline reasons
- LinkedHelper CSV exports (Replies / Processed / Processing / Failed) for each campaign

## Setup

1. Export the campaign CSVs from LinkedHelper into `~/Downloads`, using the exact
   filenames referenced in `CAMPAIGNS` and `FUNNELS` at the top of [extract.py](extract.py).
   Add or edit entries there if your campaigns or owners differ.

2. Run the extractor to parse conversations, classify replies via Claude, and write `data.json`:

   ```bash
   python3 extract.py
   ```

   Classification results are cached in `classify_cache.json` and
   `decline_reasons_cache.json` so re-runs only classify new replies.

3. Inject the data into the template to produce the dashboard:

   ```bash
   python3 build.py
   ```

   This writes `dashboard.html`.

4. Open `dashboard.html` in a browser.

## Notes

- `data.json` and `dashboard.html` contain real prospect data (names, emails, message
  content) — keep this repo private.
- File paths in `extract.py`/`build.py` are currently hardcoded to a local machine; update
  them if running from a different environment.
