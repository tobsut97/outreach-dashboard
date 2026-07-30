# Outreach Dashboard v2 — Working Notes

Running log of what changed and why, kept so this project can be picked up in a fresh chat
without re-deriving context. Newest entries at the top.

## Lara campaign backfill: 396 missing conversations (2026-07-30, branch `feat/hubspot-pipeline`)

**Why:** User exported 12 raw LinkedHelper campaign CSVs (all launched from Lara Ebert's
LinkedIn account) and suspected some conversations never made it into `data.json`. Confirmed:
396 were missing (breakdown by campaign in `v2/add_lara_campaigns.py`'s docstring/output), plus
5 within-batch duplicates (same contact in two overlapping campaigns, added once) and 11 people
who *also* have an existing conversation under a different owner (Leos/Christine/Christian) —
verified these are genuinely separate, independent outreach threads (different templates,
months apart), not duplicate exports, so they were added as their own Lara-owned records
alongside the existing ones, per user's decision.

**Why a new script instead of `extract.py`:** `extract.py`'s `SOURCES` list only has Christian
Lutz's export, yet `data.json` already held five owners' conversations — it's drifted out of
sync with what actually built the file over time. Running `extract.py` as-is would have
overwritten `data.json` and silently dropped everyone except Christian. `v2/add_lara_campaigns.py`
is additive instead: loads the existing `data.json`, adds only genuinely-new conversations
(identified by `(owner, profile_url|email|full_name)`, not just the identity key alone — that
scoping is what keeps the 11 cross-owner people as separate records instead of colliding), and
writes the merged result back. Verified other owners' counts are byte-identical before/after
(Leos 948, Christine 916, Christian 443, Max 106 — unchanged; Lara 1185 → 1581).

**Classification note:** mid-session, hit the org's monthly Claude API spend limit while trying
to classify the 395 replied conversations via parallel Agent-tool subagents (same rubric as
`extract.py`'s `SYSTEM_PROMPT`). Per user's explicit choice, fell back to classifying all 395
directly in-conversation (no Ollama, no API-billed subagents) rather than waiting — this is a
one-off for this batch, not a standing pipeline change; `extract.py` still uses local Ollama for
everything else, and that remains the default going forward. The two-phase script design
(`prepare` dumps candidates + pending-classification list, `apply` merges results back) exists
specifically to support this: classification method is decoupled from the parsing/merging logic.

**Checks run and passing:** owner counts verified unchanged for the other four owners;
`match_hubspot.py` re-run afterward (below) with the enlarged conversation set; `tsc`/`build`/
`oxlint` clean (no source changes, just data); browser-verified Lara's dashboard now shows 1581
messaged (was 1185) and the Pipeline page's Lara-scoped numbers update accordingly, including a
previously-cross-owned contact (Alissa Ritter) now appearing as her own independent match.

## HubSpot pipeline: outreach → lead → deal + BANT (2026-07-30, branch `feat/hubspot-pipeline`)

**Why:** User wants to see conversion from LinkedIn outreach into HubSpot leads, BANT scoring
on those leads, and the fuller funnel through to closed deals. Exported two HubSpot CSVs
(`~/Downloads/260730-all-leads.csv`, `~/Downloads/260730-all-deals.csv`).

**Key constraint:** neither CSV has an email or LinkedIn URL field, so there's no clean join
key to `data.json`'s conversations. Built `v2/match_hubspot.py` — a repeatable script (same
`SOURCES`-from-absolute-path convention as `extract.py`, run manually, independent of the
slower Ollama pipeline) that fuzzy-matches:
- Leads → conversations, via `Primary Associated Object Name` vs `full_name` + `Company` vs
  `company`, using stdlib `difflib.SequenceMatcher` (0.6 name / 0.4 company weighted score).
- Deals → leads, via a company name parsed out of `Deal Name` (or `Invoice name of Company`
  when populated) vs the lead's `Company` field.

Every match is tagged `high` or `medium` confidence — `medium` matches are shown in the UI for
spot-checking but excluded from headline funnel KPIs. A blank company on either side is
treated as "no signal" (not scored as 0), since that was silently tanking otherwise-perfect
name matches in an early version of the threshold logic. Initial result: 60 leads matched to
conversations (48 high, 12 medium) out of 1599 leads / 3598 conversations; after the Lara
campaign backfill above added 396 more conversations, a re-run found 64 matches (52 high, 12
medium) out of 3994 conversations — low coverage is expected and is a direct consequence of
there being no reliable join key, not a matching bug; `hubspot.json`'s `aggregate` block still
totals every CSV row regardless of match, so raw HubSpot pipeline numbers aren't limited by
outreach attribution.

Output is `v2/hubspot.json` (committed to git, same treatment as `data.json`) — re-run
`python3 match_hubspot.py` whenever fresh CSVs are exported; it does not touch
`classify_cache.json` or `data.json`.

New `#/pipeline` page (own sidebar group, separate from profile filtering): KPI strip
(leads/deals matched, closed-won $, still-open $), an outreach→lead→deal funnel strip, a BANT
breakdown (Authority/Budget/Need/Timeline, Yes/No/Maybe/TBD/blank bars) recomputed over the
matched-and-filtered leads, a matched-leads table (confidence badge, BANT chips, best matched
deal, click-through to `ConversationSheet` when resolvable), and a raw HubSpot totals card
independent of matching. New files: `src/types/hubspot.ts`, `src/lib/hubspot.ts`,
`src/components/PipelinePage.tsx`.

**Checks run and passing:** `tsc --noEmit`, `npm run build`, `oxlint src/` (only the 3
pre-existing unrelated warnings); `hubspot.json`'s `aggregate` totals verified to exactly match
raw CSV ground truth (leads by stage, deals by stage/amount); browser-verified `#/pipeline`
renders KPI/funnel/BANT/table/totals correctly and a matched-lead row opens the right
`ConversationSheet`.

**Not yet done:** branch not pushed / no PR opened yet — pending user confirmation.

## Data audit: reply rates and CSV contamination (2026-07-30-ish)

**Why:** User was confident Lara Ebert's reply rate was wrong. Audited reply-rate math for
all five owners (Christian Lutz, Christine Rzepka, Lara Ebert, Leos Bloch, Maximilian
Venhofen) and removed the "Gesa" placeholder profile (no real CSV ever ingested for her).

**Found two real bugs, not just Lara's:**

1. **Parsing bug** — the message-splitting regexes (`extract.py`'s German-date regex, and an
   ad-hoc ISO-date regex used for Leos) missed some sender-name headers with curly
   apostrophes, diacritics (í, š), or ISO-date edge cases. When that happened, a prospect's
   reply got silently concatenated onto the end of the owner's message instead of becoming
   its own message — so the conversation was wrongly marked `replied: False`.
   Fixed 7 conversations this way (re-split the merged text, set `replied=True`, manually
   assigned sentiment/tags after reading the thread): Eilís O'Keefe, Marlene O'Sullivan,
   Svenja 班诗雅, M. Shaikh (Lara); Alexandra P, Oleg S. (Leos); Maxim D. (Lara, excluded
   anyway — see below).

2. **Denominator contamination** — "full career history" LinkedIn exports for Lara, Leos,
   and especially Max included non-outreach conversations that inflated `messaged` counts:
   personal chats, the owner's own job search, investor/fundraising pitches unrelated to
   Pina Earth, warm referrals for unrelated products, family members, data artifacts (empty
   "attachments count: 0" rows), and — new pattern — pitches for a completely different
   company (Senken, Tree.ly) that leaked into Max's export. Removed 36 such conversations
   total (7 Lara, 16 Leos, 12 Max, one rule catching 4 "LinkedIn Member" rows via
   `"senken" in text.lower() or "tree.ly" in text.lower()`).

**Result (`v2/data.json`, `v2/classify_cache.json` updated in place, not via `extract.py`
re-run — used ad-hoc Python importing `extract.compute_daily_counts`/`compute_summary` to
keep both consistent):**

```
Christian Lutz:        443 messaged / 113 replied / 25.5%
Christine Rzepka:      916 messaged / 298 replied / 32.5%
Lara Ebert:           1185 messaged / 233 replied / 19.7%   (was 1192/230/19.3%)
Leos Bloch:            948 messaged / 276 replied / 29.1%   (was 964/274/28.4%)
Maximilian Venhofen:   106 messaged /  27 replied / 25.5%   (was 119/26/21.8%)
Overall: 3598 messaged, 947 replied, 26.3% reply rate
```

**Code change:** removed `'Gesa'` from `ProfileName` and `PROFILES` in
[src/filters.ts](src/filters.ts) (no other file referenced it).

**Not yet done:** `extract.py` itself was not patched to fix the regex bug at the source —
the 7 conversations were hand-corrected in `data.json` directly. If the export is ever
re-run from raw CSVs, the same parsing bug will resurface. Worth fixing the regex in
`extract.py` properly at some point (out of scope for this pass).

## UI overhaul: page-level date range, sentiment select, insights callout (2026-07-30-ish)

**Why (user's request, paraphrased):** move the date-range picker below the breadcrumbs and
make it filter every chart/KPI, not just the daily chart; add a sentiment ("Answers") select
next to it; drop the old sentiment selector from the sidebar; add a findings callout to every
profile page that states (not recommends) the top 3 sentiment/tag patterns in that page's
data, each clickable to see the underlying conversations — reusing the existing sidebar for
that list rather than inventing a new component.

**Key design decisions:**

- Date range now filters by each conversation's **first message date** (`firstMessageKey` in
  [src/lib/dateRange.ts](src/lib/dateRange.ts)) — a conversation that started in-range but got
  a reply later doesn't get pulled out of scope by an early "to" date.
- `App.tsx` computes `dateFiltered` conversations once and feeds the same `deriveMetrics()`
  call that KPIs, the daily chart, and the sentiment breakdown all read from — this is what
  makes the date range affect everything uniformly instead of just the chart's own x-axis.
- Findings are computed from real data (`computeFindings` in
  [src/lib/findings.ts](src/lib/findings.ts)): ranks `(sentiment, tag)` buckets by size using
  the same `tag_counts` data `SentimentDetail`'s "Why" card already uses, turns the top 3 into
  plain sentences. No recommendation language, by design.
- "Use the sidebar, don't invent a new component" → extended
  [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx) with an optional second
  group (`highlighted`) that lists the conversations behind whichever finding is selected,
  with a "×" to clear it. Clicking a name opens the existing `ConversationSheet` — its
  ownership was lifted from `SentimentDetail` up to `App.tsx` so both the sentiment-detail
  table and the new sidebar group can open the same single sheet instance.

**New files:**
- [src/lib/dateRange.ts](src/lib/dateRange.ts) — `firstMessageKey`, `conversationInRange`,
  `dateBounds`, `rangePresets`.
- [src/lib/findings.ts](src/lib/findings.ts) — `computeFindings`, `findingConversations`.
- [src/components/DateRangeFilter.tsx](src/components/DateRangeFilter.tsx) — extracted out of
  `DailyChart.tsx`'s old inline Popover+Calendar+presets; now a controlled component owned by
  `App.tsx`.
- [src/components/SentimentSelect.tsx](src/components/SentimentSelect.tsx) — the "Answers"
  dropdown, now living next to the date range filter instead of in the sidebar.
- [src/components/InsightsCallout.tsx](src/components/InsightsCallout.tsx) — "Main findings"
  card, one button per finding, toggles the sidebar highlight.

**Changed files:**
- [src/App.tsx](src/App.tsx) — the header row below breadcrumbs now holds
  `DateRangeFilter` + `SentimentSelect`; owns `range`/`activeFinding`/`selected`/`sheetOpen`
  state; renders `InsightsCallout` above `KpiStrip` on the dashboard view; single
  `ConversationSheet` instance at the top level.
- [src/components/DailyChart.tsx](src/components/DailyChart.tsx) — stripped down to just the
  Daily/Weekly/Monthly/Quarterly/Yearly bucketing `Select` + chart; date range is now a
  page-level filter applied before `daily` reaches this component.
- [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx) — removed the "Answers"
  group entirely; added the `highlighted` conversations group described above.
- [src/components/SentimentDetail.tsx](src/components/SentimentDetail.tsx) — no longer owns a
  `ConversationSheet` or override-saving; takes `onOpenConversation` prop instead, calls up to
  `App.tsx`.

**Verified in browser (screenshots):** date-range filter and sentiment select render below
breadcrumbs; sidebar shows only "Profiles" (Gesa gone); "Main findings" callout shows exactly
3 data-backed findings on "Show All"; clicking one highlights it and populates a sidebar group
with matching conversations; clicking a name opens `ConversationSheet` with the right
sentiment/reasons/thread.

**Known loose end, not yet resolved:** clicking the "Profiles" breadcrumb link does **not**
clear `activeFinding` — the highlighted sidebar group and its "×" persist even though you're
back on the dashboard root. Not yet decided whether that's a bug or acceptable; needs a call
next time this is picked up. If it should clear, the fix is a one-line `setActiveFinding(null)`
wherever the "Profiles" breadcrumb link's navigation is handled (currently it's a plain
`<a href="#/">`, so this may need to become an `onClick` instead of relying on the hashchange
listener).

**Still to verify** (was mid-verification when this session was interrupted): date range
actually narrowing KPIs/chart/breakdown/findings together; profile switch resetting `range`
and `activeFinding`; sentiment select returning to dashboard view (`navigate('#/')`) from a
sentiment-detail page; findings rendering sensibly on every other profile, not just "Show
All"; the `managed.length === 0` empty-state guard correctly short-circuiting before
`InsightsCallout` for a profile with no data.

**Checks run and passing after the refactor:** `tsc --noEmit`, `npm run build`, `oxlint src/`
(only 3 pre-existing unrelated warnings in `ui/button.tsx`/`ui/badge.tsx`/`ui/sidebar.tsx`).

## Standing project facts worth remembering

- Single-file Vite build (`vite-plugin-singlefile`) that must work over `file://`, hence hash
  routing instead of a router library.
- shadcn components here are `@base-ui/react`-based, not Radix — compose triggers with the
  `render` prop, not `asChild`.
- `data.json` is generated by `extract.py` from raw LinkedIn CSV exports, then hand-corrected
  in a few places per the audit above — those hand corrections are NOT reflected in
  `extract.py` and would be lost if it's re-run without also porting the fixes back.
- Sentiment is outcome-based, not tone-based: a polite decline is still negative; positive
  requires real forward motion (meeting booked, open to call, concrete named referral).
- A PR-creation request was interrupted mid-session and never carried out — do not assume any
  outstanding changes have been pushed or a PR opened unless explicitly reconfirmed.
