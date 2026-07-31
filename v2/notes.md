# Outreach Dashboard v2 — Working Notes

Running log of what changed and why, kept so this project can be picked up in a fresh chat
without re-deriving context. Newest entries at the top.

## Pipeline page rebuilt as "Funnel": qualified/lost leads and deals (2026-07-31, branch `feat/funnel-qualified-lost`)

**Why:** User wants to see qualified leads, lost leads, qualified deals, and lost deals — the
existing `#/pipeline` page (funnel chain, BANT breakdown, matched-leads table, raw HubSpot
totals) was replaced entirely with this, not extended, per explicit confirmation. User also
asked to rename the page "Funnel" (label/route only — not a request to keep the funnel chain
visualization, confirmed separately).

**Terminology, confirmed with the user:** leads have no separate "lost" stage
(`lead_stage` is `New`/`Qualified`/`Disqualified`), so lost lead = Disqualified. Deals do have a
literal `Qualified` stage and a `Closed lost` stage, used as-is.

**Data:** no new ingestion needed — `hubspot.json` (built by `match_hubspot.py` from
`260730-all-leads.csv`/`260730-all-deals.csv`) was already newer than both CSVs, so it didn't
need regenerating.

**Changes:**
- `src/lib/hubspot.ts`: removed `deriveHubspotFunnel`/`deriveBantBreakdown`/`primaryDeal` (all
  now-dead code, confirmed via grep to have no other call sites) and `PipelineFunnel`. Added
  `matchedLeads` (the date/profile-filtered join, factored out of what used to be inline in
  `PipelinePage.tsx`), `qualifiedLeads`, `lostLeads`, `dealsInStage`, `lostDeals`.
- `src/components/PipelinePage.tsx`: KPI row (Qualified Leads / Lost Leads / Qualified Deals +€ /
  Lost Deals +€) followed by four `Card`+`Table` sections, one per bucket. Lead tables show
  contact/BANT chips/owner (Lost Leads adds a "Disqualified because" column from
  `bant_disqualification_reasons`, previously unused in the UI). Deal tables show
  contact/amount/close date/owner. Row click still opens `ConversationSheet` via
  `conversation_key`, same as before.
- Renamed "HubSpot Pipeline" → "Funnel" throughout: `App.tsx`'s `View` union (`'pipeline'` →
  `'funnel'`), hash route (`#/pipeline` → `#/funnel`), breadcrumb/headline text,
  `AppSidebar.tsx`'s `pipelineActive` prop → `funnelActive`, sidebar group label and link text.
  `PipelinePage.tsx`'s filename/component name were deliberately left as-is (rename would touch
  more import sites for no user-visible benefit).

**Checks run:** `oxlint`/`tsc --noEmit`/`build` all clean (no new warnings beyond the 3
pre-existing unrelated ones). **Browser verification was not possible this session** — the
preview tooling returned a navigation/policy error in this sandbox. Cross-checked the expected
default-view counts against `hubspot.json` directly instead: 14 qualified leads, 44 lost leads,
5 qualified deals (€621,200), 22 lost deals (€1,980,428). Still needs an actual browser check
(page renders, row click opens the right conversation, profile/date filters re-scope the
counts) before merging.

### Follow-up round, from live feedback on the running dev server (same day, same branch)

User looked at the page locally and gave four pieces of feedback:

1. **Breadcrumb bug**: `App.tsx`'s `trail` always started with a `{label: 'Profiles', hash: '#/'}`
   root crumb regardless of view, so Funnel rendered as "Profiles > Funnel" — implying it's a
   child of Profiles. It isn't; they're sibling top-level sections in the sidebar. Fixed: the
   trail only starts with "Profiles" for non-funnel views; Funnel gets its own single-crumb
   trail (`[{ label: 'Funnel' }]`).
2. **Profile-scoping bug**: navigating to Funnel from a profile page kept that profile's owner
   filter applied — the page only showed that person's leads/deals. User: "Funnel should always
   show, like, everything... maybe we can introduce filters later, but only later." Fixed:
   `App.tsx` now computes a separate `allManaged` (overrides applied, but no owner/date
   filtering) and passes that to `PipelinePage` instead of the profile/date-scoped
   `dateFiltered`. The `DateRangeFilter` control is also hidden on the Funnel page now, since it
   no longer does anything there — showing it would be misleading.
3. **Match column removed**: the high/medium confidence badge column (how confident the
   fuzzy conversation↔HubSpot-record join is) was confusing and not needed day-to-day — dropped
   from every lead/deal table. `MatchConfidence`/`CONFIDENCE_BADGE` are gone from
   `PipelinePage.tsx` as a result (only used there).
4. **Meetings-booked → funnel disconnect**: user's mental model is
   outreach → meeting booked → lead (qualified/lost) → deal (qualified/lost/won), and the page
   didn't connect to the meeting-booked step at all. Added, in `src/lib/hubspot.ts`:
   `meetingBookedConversations` (conversations tagged `meeting_booked`) and
   `leadsFromMeetingBooked` (the subset of matched leads whose *own* outreach conversation was
   tagged `meeting_booked` — not just any matched lead). `PipelinePage.tsx` now opens with a
   "Meeting booked → lead → deal" funnel strip (reusing the old `FunnelStep`/`FunnelArrow` visual
   from the pre-rebuild funnel chain) computed specifically along that meeting-booked lineage:
   Meetings booked → Became a lead → Qualified → Became a deal → Won. Also added a "Won deals"
   KPI + table (`wonDeals` in `lib/hubspot.ts`, `deal.is_closed_won`) — previously only
   Qualified/Lost deals were shown, no won bucket at all.

**Caveat surfaced while sanity-checking:** this branch was cut from `main`, which does not yet
include the `meeting_booked` tag corrections from the (still unmerged) `chore/audit-meeting-booked`
branch — so the funnel strip's "Meetings booked" count here is 84 (the original, uncorrected
figure), not 102. Will self-correct once that branch merges too; not re-fixed here to avoid
duplicating that unrelated branch's work.

**Checks run:** `oxlint`/`tsc --noEmit`/`build` clean. Cross-checked the meeting-booked funnel
chain against raw `data.json`/`hubspot.json` in Python: 84 meetings booked → 26 became a lead →
6 qualified → 52 became a deal → 47 won. Still not verified in an actual browser this session
(same sandbox limitation as above) — the user is checking on their own running dev server
instead.

**Not yet addressed:** user said they're "not happy with how it's displayed" overall (six
full-width stacked Card+Table sections plus the funnel strip is a lot of scrolling) but wasn't
sure what to change yet — asked to fix the above first and revisit layout separately.

## Vercel deployment + CI prep (2026-07-30, branch `chore/vercel-ci-cd`)

**Why:** User wants this dashboard published on Vercel with a CI/CD pipeline. Nothing existed
for either before this — no `.github/workflows/`, no `vercel.json`, no Node version pin.

**Key constraint:** `v2/data.json`, `v2/hubspot.json`, and the pre-built `v2/dist/index.html`
all contain real prospect/lead data (names, companies, emails, LinkedIn URLs, HubSpot lead/deal
info) baked directly into the bundle — the repo-root `README.md` already flags this. Confirmed
with the user: deployment uses **Vercel Password Protection** (manual dashboard step, both
Production and Preview) rather than shipping this publicly, and **only `v2/` is deployed**
(Vercel Root Directory = `v2`) — the repo-root version-picker page and frozen `v1/` (which has
its own separate real data) are excluded.

**Added:**
- `v2/.nvmrc` (`22`, matching the org's Node LTS standard) and `v2/vercel.json`
  (`framework: vite`, explicit build command/output dir) so the build config is versioned
  rather than left to dashboard-only settings.
- `.github/workflows/ci.yml` at the repo root — lint (oxlint) + type-check (`tsc --noEmit`) +
  build, triggered on PRs and pushes to `main`, scoped to `v2/` via `defaults.run.working-directory`.
  Actions pinned to full commit SHA with version comments, `persist-credentials: false`,
  a `concurrency` group to cancel superseded runs. This is CI only (a quality gate) — CD is
  Vercel's own Git integration (Preview per PR, Production on merge to `main`), not a custom
  `vercel deploy` Action, so no `VERCEL_TOKEN` secret is needed anywhere.
- A "Deployment" section in `v2/README.md` documenting the one-time manual Vercel setup steps
  (import repo, set Root Directory, enable Password Protection) — these require the user's own
  Vercel account and can't be done from the repo.

**Checks run and passing:** `actionlint` and `zizmor --persona=pedantic` clean on the new
workflow (two initial pedantic-only findings — missing job name, missing concurrency group —
fixed); `npm run lint` / `npx tsc --noEmit` / `npm run build` all pass locally, matching exactly
what CI runs. The CI workflow itself is verified by opening this PR and confirming it runs and
passes (`gh pr checks`). No test-runner step — none exists in the project yet.

## Card title color: grey to black (2026-07-30, branch `fix/card-title-color`)

**Why:** User feedback — card headers were too grey, wanted them black.

Swapped `text-muted-foreground` → `text-foreground` on every `CardTitle` (11 occurrences across
`DailyChart.tsx`, `KpiCard.tsx`, `NegativeTagBreakdown.tsx`, `PositionBreakdown.tsx`,
`SentimentBreakdown.tsx`, `PipelinePage.tsx` ×4, `SentimentDetail.tsx` ×2). `CardTitle`'s base
component (`ui/card.tsx`) has no color of its own, so this per-instance override is what
controlled the color. `Label`s in `ConversationSheet.tsx` (form field labels, not card titles)
were left as `text-muted-foreground` — out of scope for this change.

**Checks run and passing:** `tsc`/`build`/`oxlint` clean; browser-verified headers render black.

## Conversations table: reason multi-select, search, pagination (2026-07-30, branch `feat/dashboard-charts`)

**Why:** The first pass at filtering the sentiment pages' conversations table (see the entry
below) made the "Why" breakdown's bars themselves clickable — user feedback: that's a weird,
bespoke interaction; they wanted a plain multi-select control instead, plus search and
pagination, since the table can run into the hundreds of rows.

**Changes to `src/components/SentimentDetail.tsx`:**
- Reverted the "Why" bars to plain, non-interactive rows (back to the original design).
- Added a search `Input` (name/company/reply text, case-insensitive substring match) and a
  reason multi-select — a `Popover` of `Checkbox` rows (added via `npx shadcn add checkbox
  pagination`) behind a trigger button showing "All reasons" / the tag name / "N reasons" —
  above the table. Selecting reasons is OR logic (any selected tag matches).
- Added pagination (added shadcn `pagination` component; 20 rows/page) since a sentiment can
  have 600+ conversations. Search/filter changes reset to page 1.

**Checks run and passing:** `tsc`/`build`/`oxlint` clean; browser-verified: popover multi-select
checks/unchecks correctly and updates the trigger label and table count, search combines with
the reason filter (AND), and Next/Previous pagination advances the shown page and page count.

## Dashboard polish: headline, card titles, job-title categories, reason filter (2026-07-30, branch `feat/dashboard-charts`)

**Why:** Follow-up requests on top of this branch's just-added charts, before the PR was
reviewed — landed as more commits on the same branch per the project's convention for
same-task tweaks.

**Headline:** `App.tsx`'s dashboard headline is now `` `Outreach Analytics ${profile}` `` instead
of the fixed `'Outreach Overview'` — becomes "Outreach Analytics Overview" by default and
"Outreach Analytics Chrissy" etc. per profile, since `profile`'s default value is `'Overview'`.

**Card titles:** every `CardTitle` across the app dropped `uppercase`/`tracking-wide` in favor of
sentence-case (`text-sm font-semibold`) — the JSX strings were already written in sentence case,
so this was a pure styling change, no copy changes.

**Job-title categorization** (`src/lib/position.ts`'s `categorizePosition`): the "Most common job
titles among replies" chart (added earlier this session) grouped by exact raw string, which sent
64% of replies into "Other" since DE/EN variants of the same role split the count (e.g.
"Geschäftsführer" vs "CEO" vs "Managing Director"). Added a keyword-based categorizer — patterns
inferred by reading the actual title strings in the ingested CSVs — folding titles into ~11 role
buckets (Sustainability/ESG, Executive/Managing Director, Marketing/Communications, Finance,
HR/People, Consulting, Sales/Business Development, Procurement/Supply Chain, Legal/Compliance,
IT/Technology, Operations). Verified against the real dataset before implementing (Python
prototype) and after (browser): "Other" dropped from 64.1% to 13.6% of replies. Titles that don't
match any category still fall through to their raw string, so they still contribute to the long
tail rather than getting miscategorized.

**Reason filter on sentiment pages** (`src/components/SentimentDetail.tsx`): the existing "Why"
breakdown's reason rows are now clickable buttons (same interaction pattern as
`SentimentBreakdown.tsx`'s expandable rows) — clicking one filters the conversations table below
to only that tag, with a clearable `Badge` chip in the table's header showing which reason is
active. The table's own count/hidden-count recompute against the filtered set, not the full
sentiment set (the "Why" bars and KPIs above stay based on the full set, since those are
overview stats, not table state).

**Checks run and passing:** `tsc`/`build`/`oxlint` clean; browser-verified all four changes:
headline text, sentence-case card titles, the shrunk "Other" share with the new category names,
and the reason-filter click/clear cycle on the Negative Answers page.

## Two new dashboard charts: job titles among replies, negative reason breakdown (2026-07-30, branch `feat/dashboard-charts`)

**Why:** User asked for a job-position chart and a most-mentioned-negative-tag chart on the
profile dashboards. First pass read "reply rate by job position" as a per-position reply rate;
user corrected it — they meant the composition of repliers: "out of all replies, what are the
most common job titles."

**Most common job titles among replies** (`src/lib/metrics.ts`'s `positionShareAmongReplies`,
`src/components/PositionBreakdown.tsx`): groups replied conversations by the prospect's raw
`position` string (2076 distinct values across 4004 conversations) — no DE/EN synonym merging
(e.g. `CEO`/`Geschäftsführer`, `CFO`/`Chief Financial Officer` stay separate), matching
`extract.py`'s existing lack of normalization for this field. Shows the top 8 titles by volume
as a share of *all* replies, folding the long tail into "Other." Replies with no title on file
(324 of 1295, overall) count toward the percentage denominator but aren't shown as their own
row — a caption below the bars states how many, so the percentages' shortfall from 100% is
explained rather than silently unaccounted for.

**Most mentioned negative reasons** (`src/components/NegativeTagBreakdown.tsx`): no new
aggregation needed — `deriveMetrics`'s `summary.tag_counts.negative` already had this. Renders
tag counts sorted descending, bar width = share of negative-sentiment conversations.

Both follow the existing bar-list visual pattern (`SentimentBreakdown.tsx`'s dot/label/bar/count
row), slotted into the dashboard view in `App.tsx` between the sentiment breakdown and the daily
chart, in a 2-column grid. Both re-scope correctly under the existing profile/date filters (no
new filtering logic needed — they take the same `conversations`/`summary` already computed for
the rest of the dashboard).

**Checks run and passing:** `tsc`/`build`/`oxlint` clean; browser-verified both charts render
with correct top-8-plus-Other rows and negative-tag counts, and re-scope correctly when
switching profiles (verified against Chrissy).

## Sidebar IA fix: profiles are pages, not filters (2026-07-30, branch `fix/sidebar-ia`)

**Why:** User feedback — "Show All" read like a filter toggle rather than a page name, and
clicking a profile while the HubSpot Pipeline page was open didn't feel right: Pipeline is its
own top-level entity (already its own sidebar group, separate from "Profiles"), not something
that should stay open while silently re-scoping to whichever profile you click. Each profile
button is a page (that person's Outreach Overview), not a filter layered on top of the current
view.

**Changes:**
- Renamed `ProfileName`'s `'Show All'` to `'Overview'` (`src/filters.ts`) — same value used for
  the sidebar label, the default profile, and the breadcrumb, so this is a single-source rename.
- `App.tsx`'s `handleProfileChange` now navigates to `#/` (dashboard) whenever a profile is
  clicked, in addition to setting the profile — so clicking a profile from the Pipeline page (or
  a sentiment drill-down) always takes you to that profile's Overview page, matching the
  "profiles are pages" model instead of leaving Pipeline open with a changed scope underneath it.

**Checks run and passing:** `tsc`/`build`/`oxlint` clean; browser-verified: sidebar shows
"Overview" instead of "Show All", and clicking a profile while Pipeline is open navigates to
that profile's Outreach Overview (breadcrumb + KPI numbers update, Pipeline is exited).

## Chrissy campaign backfill: 10 missing conversations (2026-07-30, branch `feat/chrissy-campaign-backfill`)

**Why:** Same suspicion as the Lara backfill (below), this time for Christine "Chrissy" Rzepka:
user exported 12 raw LinkedHelper campaign CSVs, all launched from her LinkedIn account. Unlike
Lara's campaigns, these were already well-represented in `data.json`'s existing 916 Christine
Rzepka conversations — only **10 new conversations** turned up (all from the "260609 Thinktank
Nachhaltigkeit & CSR" campaign), 0 within-batch duplicates, 0 cross-owner overlaps.

One file (`260703 BNW-Chrissy.csv`) was initially the wrong export type — a LinkedHelper
*campaign settings* CSV (action/template config, no people rows) rather than a people export.
User re-exported and re-attached the correct file before the backfill ran; it contributed 0 new
conversations (all 17 of its people rows were already present).

**Script:** `v2/add_chrissy_campaigns.py` — a straight copy of `v2/add_lara_campaigns.py`'s
`identity()`/`prepare()`/`apply()` logic (already owner-agnostic) with `NEW_SOURCES` pointed at
Christine's 12 CSVs instead. Same additive rationale applies: `extract.py`'s `SOURCES` list is
still just Christian Lutz's export, so this avoids the same overwrite landmine. Verified owner
counts before/after: Christine 916 → 926; Lara (1581), Leos (948), Christian (443), Max (106)
unchanged.

**Classification:** the 10 replied conversations were classified directly in-conversation (same
one-off fallback as the Lara batch, not a pipeline change).

**Checks run and passing:** owner counts verified; `match_hubspot.py` re-run — match count
unchanged at 64 (52 high, 12 medium; none of the 10 new conversations happened to match a
HubSpot lead), aggregate CSV totals unchanged (1599 leads, 1490 deals); `tsc`/`build`/`oxlint`
clean.

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
