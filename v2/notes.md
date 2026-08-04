# Outreach Dashboard v2 — Working Notes

Running log of what changed and why, kept so this project can be picked up in a fresh chat
without re-deriving context. Newest entries at the top.

## Overview pie chart, treemap consolidation, per-theme drill-through, sortable tables (2026-08-03, branch `feat/reply-theme-clusters`)

**Why:** follow-up feedback on the reply-theme work above. The Overview page's "Answer
sentiment" card had an expandable row (5 most recent replies) that wasn't useful. The
sentiment subpage's "Why" card (old coarse tags) was now redundant with the treemap added
above — same ground, coarser. Clicking a treemap leaf only filtered the table further down the
same page, when the user wanted a dedicated drill-through page. And none of the tables in the
app could be sorted.

**Overview card (`SentimentBreakdown.tsx`):** replaced the expandable rows with a split layout —
a recharts `Pie`/`PieChart` on the left (3 sentiment slices), the sentiment rows as directly
clickable buttons on the right (no more expand-then-"Show all X" two-step). `Pie`/`Cell` need
real CSS colors, not `DOT_COLOR`'s Tailwind classes — resolved via `var(--color-emerald-500)`
etc., which Tailwind v4 exposes globally for every default-palette shade, so the pie stays in
sync with the existing dot/bar colors for free. **Hit a rendering bug along the way**: wrapping
the pie in the shadcn `ChartContainer`/`ResponsiveContainer` pattern (`DailyChart.tsx`'s
pattern) rendered an empty `<g class="recharts-pie">` with zero sectors in this environment,
even once the container had correct non-zero pixel dimensions — a fixed-size `PieChart` (no
`ResponsiveContainer`) rendered correctly immediately. Since the fill color also needs
`ChartContainer`'s injected CSS vars to resolve, dropping it meant resolving colors directly
too (`HUE_VAR` map) instead of through `chartConfig`'s indirection.

**Sentiment subpage (`SentimentDetail.tsx`):** forks by sentiment now. Positive is untouched
(still the old "Why" card, tags column, reason-filter popover — there's no `reply_theme` data
for positive to replace it with). Negative/neutral: "Why" card removed, replaced by the
treemap; reason-filter popover removed (filtering by theme now means navigating to the new
per-theme page, not two competing inline filters); the Conversations table's "Reasons" column
shows the single `reply_theme` badge instead of the `tags` array; "Reasons identified" KPI
counts distinct `reply_theme` values instead of `tag_counts`.

**Treemap (`ReplyThemeTreemap.tsx`):** leaves were a single flat fill — replaced with a
per-leaf `color-mix()` ramp, biggest leaf closest to the sentiment's own hue, smallest mixed
toward the card surface, so adjacent similarly-sized leaves stay visually separable without a
border. Clicking a leaf (or a ranked-list row) now calls `onSelectTheme` to navigate to a new
page instead of toggling local filter state — dropped the dimming/selected-state styling since
a click always navigates away now.

**Per-theme drill-through:** new `SentimentThemeDetail.tsx` page + `View` variant in `App.tsx`
(`#/sentiment/:sentiment/theme/:themeId`), added to the breadcrumb. Extracted the ~120-line
conversations table/search/pagination block out of `SentimentDetail.tsx` into a shared
`ConversationsCard.tsx` (title+count, search, an optional extra-controls slot, table,
pagination) so both pages reuse it instead of duplicating it.

**Sortable tables:** checked shadcn's own data-table pattern first — it requires
`@tanstack/react-table` plus a full rewrite into a `ColumnDef`/`useReactTable` architecture,
disproportionate for these small, plain tables. Hand-rolled instead: `lib/sort.ts`
(`useSort`/`sortRows`, none→asc→desc→none on repeated clicks) + `SortableTableHead.tsx` (same
Button+arrow-icon convention shadcn's demo uses, no new dependency). Wired into
`ConversationsCard.tsx` (Name/Company/Replied/Reasons) and all three Funnel table shapes in
`PipelinePage.tsx` (leads: Contact/Lead owner; deals: Contact/Amount/Close date/Deal owner;
meetings-without-lead: Contact/Company/Owner).

**Checks run:** `npx tsc --noEmit`, `npx oxlint src/`, `npm run build` all clean. Browser-
verified the pie renders and rows navigate; user confirmed the rest live via HMR in their own
browser.

## Fine-grained reply-theme categorization + treemap (2026-08-03, branch `feat/reply-theme-clusters`)

**Why:** the user wanted to know what negative/neutral contacts actually wrote, beyond the
existing 11 coarse tags (`ALLOWED_TAGS`) — categorized more specifically, and classified by
Claude directly rather than the local Ollama pipeline in `extract.py`.

**Taxonomy:** sampled negative/neutral replies stratified across the existing coarse tags to
see what more specific content each one was hiding, then drafted 20 named categories + an
`other_unclear` catch-all (`v2/src/lib/replyThemes.ts`) — e.g. `generic_decline`,
`reduction_not_offsetting`, `own_climate_project`, `not_the_decision_maker`,
`leaving_company`, `already_in_contact_with_colleague`. Confirmed with the user before mass-
classifying. These cut across the old coarse tags rather than mirroring them — e.g. the old
`not_relevant` bucket (295 conversations) splits into `generic_decline`,
`no_own_footprint_to_offset`, and others; `has_existing_solution` (207) splits into
`reduction_not_offsetting`, `own_climate_project`, `works_with_competitor`,
`already_certified_reported`.

**Classification:** all 1101 negative/neutral conversations (669 negative + 432 neutral), split
into 8 batches of ~140, each classified by an independent `Agent`-tool subagent (Claude reading
the batch directly, not Ollama/an API) reading the prospect's reply text against the taxonomy.
Merged results back positionally (batch order, not by `profile_url` — 15 conversations share a
duplicate `profile_url` with another conversation, a known cross-owner-duplicate pattern per
the meeting_booked audit above, so a profile_url-keyed merge would have collapsed them). Added
as a new, additive `reply_theme: string | null` field per conversation — `sentiment` and `tags`
untouched.

**Result:** `other_unclear` came out to only 5.0% overall (3.0% negative, 8.1% neutral) — well
under the ~10-15% threshold that would've signaled the taxonomy needed another split. Top
negative themes: `generic_decline` (27.8%), `revisit_later` (13.3%), `too_busy_no_capacity`
(6.9%). Top neutral themes: `not_the_decision_maker` (14.8%), `referred_named_contact` (13.2%),
`leaving_company` (10.9%) — neutral replies skew toward "not my call/not my job anymore" rather
than an actual stance on the pitch. Spot-checked 14 random assignments against the source text:
12-13 solid, 1-2 defensible near-misses (e.g. one reply saying "we ourselves offer similar
consulting services" landed in `other_unclear` when `works_with_competitor` fit better) — no
systematic failure pattern, didn't warrant a re-run.

**Visualization:** ran treemap/sunburst/circle-packing/word-cloud/bar-list through this
project's `dataviz` skill rules before picking. Governing constraint: ~15-20 leaf categories is
past the skill's ~7-8-color categorical ceiling, so a single chart combining negative+neutral
with one hue per category was never on the table. Fix: don't combine sentiments in one chart —
`SentimentDetail.tsx` already renders once per sentiment, so each page's module only needs its
own categories, all sharing that page's existing single sentiment color. Zero categorical color
decisions needed, and no value-ramp on the leaves either (skill flags ramping nominal/unordered
categories as double-encoding, since area already carries magnitude). Picked treemap over
sunburst (arc area reads worse than rectangle area) and circle-packing (nested circles waste
space and viewers underestimate circle-area differences) and word-cloud (font-size is the
least accurate magnitude encoding, and it isn't in the skill's job→form table at all). recharts
3.x has no `Treemap`/`Sunburst`, so none of the four options came for free regardless of pick —
hand-rolled a squarified-treemap layout (`v2/src/lib/treemap.ts`, ~90 lines, no new dependency)
rather than add d3.

**New component:** `v2/src/components/ReplyThemeTreemap.tsx` — single flat fill (that page's
`TAG_BAR_COLOR`), leaves sized by count, labels only where they measure-fit, native `title`
tooltip as the hover fallback, a ranked-list "table view" twin underneath (required by the
skill — every chart needs an accessible twin), and click-to-filter wired into
`SentimentDetail.tsx`'s existing conversations table via a new `selectedTheme` state
(parallel to the existing `selectedReasons` tag filter, single-select, clearable via a badge).

**Checks run:** `npx tsc --noEmit`, `npx oxlint src/`, `npm run build` all clean. Browser-
verified on `#/sentiment/negative` and `#/sentiment/neutral`: treemap renders with correct
counts, clicking a leaf filters the table (651 → 181 for `generic_decline`), clearing the badge
restores the full set; confirmed hidden on `#/sentiment/positive`.

## match_hubspot.py: fix phantom deals and duplicate leads (2026-08-03, branch `fix/company-primary-lead-matching`)

**Why:** the user spotted a "qualified deal" for Udo Gassner / "SWAP", €1,562,500, that doesn't
exist for him in HubSpot at all, and many duplicate covolution GmbH rows in Won Deals. Traced
both to distinct bugs, verified against the raw CSV export (`270731-all-deals-v2.csv`) rather
than guessed at:

1. **Fuzzy company-name fallback in `match_deals_to_leads`** (used when a deal's own contact
   doesn't resolve to a conversation) accepted any `SequenceMatcher` ratio ≥ "medium" (0.75)
   between a deal's company and a lead's company. Checked all 32 unique deals attached this
   way — **29 (91%) were wrong**: Udo Gassner/"SWAP" had 3 of SAP's real deals attached
   (€1.56M + €1.56M + €818K), Robert Lee/"Catona Climate" had all 20 of ConClimate's deals,
   Natalie Kraemer/"Carlsberg Group" had a Caritas deal, Friederschütz/"ClimateGrid" had
   ClimAid's and ClimateTrade's deals. Short/similar company names ("SWAP"/"SAP", "Catona
   Climate"/"ConClimate") score deceptively high on a fuzzy ratio. The 3 correct fuzzy matches
   were all exact strings after normalization anyway. **Fix:** replaced the ratio scoring with a
   direct `normalize_company(deal) == normalize_company(lead)` equality check — no more guessing
   at similar-looking names, consistent with this file's existing "don't guess" approach to
   leads.

2. **Duplicate HubSpot Lead records per contact** — 6 contacts have more than one Lead record
   for the same person in HubSpot itself (confirmed: duplicate rows share the identical
   "Associated Contact" email — a HubSpot data-hygiene issue, not a matching bug). Paul
   Dunca/Furthr alone has 8. `match_hubspot.py` emitted one `matches[]` entry per Lead record,
   so the same identity-matched deals got flattened and counted once per duplicate downstream —
   85 of 167 deal attachments (51%) were pure duplicates from this, which is why covolution GmbH
   kept appearing multiple times in Won Deals. **Fix:** added `collapse_duplicate_leads`, called
   at the end of `main()` — groups `matches` by `conversation_key`, keeps the group member whose
   stage ranks highest by `Qualified > Disqualified > New` (a lead that was ever qualified
   should count as qualified, not hidden behind a stale duplicate — the pattern seen in every
   group), and unions each group's deals de-duplicated by `deal_record_id`.

**Result:** `matches` 103 → 90 (one entry per real contact). Qualified leads 17 → 12, lost leads
61 → 54. Deal totals dropped sharply, as expected since both fixes only remove
phantom/duplicated attributions, never add any: qualified deals €2.18M → €511K (6 → 3 deals),
lost deals €4.90M → €1.30M (75 → 31), won deals €2.01M → €112K (85 → 14) — the won-deal drop is
dominated by Robert Lee's 20 phantom ConClimate deals and the duplicate-lead multiplication
(Paul Dunca ×8, Friederschütz ×3, covolution GmbH ×2) both going away.

**Checks run:** re-ran `match_hubspot.py`, spot-checked Udo Gassner (0 deals now, correct — he
has none in HubSpot), Paul Dunca/Furthr (1 entry, 9 unique deals, was 8×9=72), covolution
GmbH/Michael Müller (1 entry, 4 unique deals, was 2×4=8), Robert Lee/Catona Climate (1 real deal
left, was 20 ConClimate phantoms) — all against the raw CSV. `npx tsc --noEmit`, `npx oxlint
src/`, `npm run build` all clean.

## match_hubspot.py: match deals directly by contact identity too (2026-07-31, same branch as the lead-matching fix above)

**Why:** After fixing lead matching, the user supplied a fresh deals export
(`270731-all-deals-v2.csv`) and asked whether it helped. It has the same `Associated
Contact`/`Primary Contact` column (`"Name (email@domain)"`) that fixed lead matching —
1257 of 1491 deals have it. Deals previously had no identity-based join at all: they were
only ever attached to a lead by fuzzy-matching a deal's company name (parsed from "Deal
Name" or "Invoice name of Company") against a lead's company — weak, and prone to
attaching a deal to the wrong lead when several people at the same company each have
their own lead/deal.

**Fix:** `match_deals_to_leads` now tries an identity link first: parse the deal's
`Associated Contact` (falling back to `Primary Contact`) the same way leads' `Associated
Contact` is parsed, resolve it to a conversation via exact email or an unambiguous exact
name match (`resolve_contact_conversation` — deliberately not fuzzy, since this is meant
to be a precise corroborating link, not another scored guess), then check whether that's
the *same* conversation the deal's candidate lead already matched to
(`conv_key_to_lead_ids`, built from `lead_conv_matches`). Only falls back to the old
fuzzy company-name matching for deals whose contact doesn't resolve to anything.

**Result:** total deal attachments 107 → 167 (+56%). The meetings-booked funnel's deal
numbers shifted accordingly: total deals from booked-meeting leads 67 → 117, mostly more
correctly-attributed **lost** deals (8 → 50) rather than won ones (56 → 64) — the earlier
company-fuzzy approach was apparently missing a lot of lost deals specifically, not just
undercounting deals generally.

**Checks run:** `npm run build` clean (no TS changes, only `match_hubspot.py` +
regenerated `hubspot.json`).

## match_hubspot.py: fix lead matching for company-primary leads (2026-07-31, branch `fix/company-primary-lead-matching`)

**Why:** User manually found a contact ("Stefan Brenken") who has a real lead in HubSpot
("(DE) Bank für Kirche und Diakonie") that our matcher had missed, and asked to investigate
whether this was a bigger problem.

**Root cause #1 — company-primary leads:** ~31% of lead rows (495 of 1599, blank "Primary
Associated Contact Object ID") have their "Primary Associated Object" set to a Company rather
than a Contact. For these, `Primary Associated Object Name` *is* the company name, not a
person's name — Stefan Brenken's lead literally had no person name anywhere in the old CSV
export. Fuzzy name matching was structurally incapable of ever finding these; this wasn't a
tuning problem.

**Fix, made possible by a new export the user supplied** (`270731-all-leads-v2.csv`, replacing
`260730-all-leads.csv` in `SOURCES`): it has an `Associated Contact` column (`"Name
(email@domain)"`) that HubSpot apparently didn't expose in the earlier export, giving the real
contact's name and email regardless of which object is primary. `match_hubspot.py` now:
- Parses `Associated Contact` (`parse_associated_contact`) for `lead_contact_name` /
  `lead_contact_email`, falling back to the old `Primary Associated Object Name` only when the
  column is blank (322 of 1598 rows).
- Tries an **exact email match** first (via `by_email`, built from conversations' `email`
  field) — always "high" confidence, since email is a unique identifier rather than a fuzzy
  score. Only 12 conversations actually have a HubSpot-matching email on file (most
  conversations have no email at all), but this is strictly additive.
- Falls back to the existing fuzzy name+company match, now using the *corrected* contact name
  for company-primary leads instead of the company name.

**Root cause #2 — company-bucket fallback bug, found while debugging why Stefan Brenken still
didn't match after fix #1:** the fuzzy-match blocking step falls back to a full scan across all
conversations only when a company's bucket is *empty*. But Stefan's employer's bucket wasn't
empty — a *different* person (Christian Müller) at the same company had their conversation's
`company` field filled in and occupied the only slot in that bucket, so the real match
candidate (Stefan's own conversation, which has a blank `company` field) was never considered.
Fixed: if the best bucketed candidate doesn't even clear "medium" confidence, retry across every
conversation before giving up, instead of accepting a bad bucketed match (or no match) as final.

**Performance note:** re-normalizing every conversation's name/company on every pairwise
comparison inside the matching loop (rather than once per conversation up front) made a full
scan take several minutes once enough leads started hitting it — refactored to precompute
normalized name/company once per conversation (`all_conv_norms`). Full run is still ~5-8
minutes (large SequenceMatcher call volume when many leads fall through to a full scan), but
that's now inherent to the fuzzy-matching approach at this data volume, not wasted repeat work.

**Result:** total lead matches 64 → 103 (86 high, 17 medium) — a 61% increase. Meeting-booked
funnel numbers improved sharply once this and the earlier `meeting_booked` tag fixes were both
in place: of 102 meetings booked, leads found jumped from 38 → 70 (20 open / 12 qualified / 38
lost), and the "no matching lead" drop-off shrank from 73 → 40. Deals from those leads: 67 total
(2 qualified / 8 lost / 56 won).

**Checks run:** `npm run build` clean (no TS changes, only `match_hubspot.py` + regenerated
`hubspot.json`). Verified Stefan Brenken's lead now matches at high confidence by hand.

## Funnel page: custom visual redesign + meeting_booked audit merged (2026-07-31, branch `feat/funnel-visual-redesign`)

**Why:** After the previous Funnel rebuild (below) shipped, the user was still unhappy: the
page was a flat KPI-grid + six stacked tables, not "a proper funnel." They also noticed the
numbers looked off (roughly "71 meetings booked, 46 leads" from memory) and asked to find out
what happened to the rest.

**Root cause of the number confusion:** two unrelated PRs had landed on `main` separately —
#17 (this Funnel rebuild) and, unmerged until now, #18 (the `meeting_booked` HubSpot audit that
corrected the tag count 84 → 102). Depending on which the user's browser/localStorage was
actually reflecting, the visible numbers wouldn't match either branch cleanly. **Merged #18
into `main` first** (`chore/audit-meeting-booked`, already reviewed/described in the entry
below) so there's one consistent baseline before building on top of it.

**Investigated "what happened to the rest":** of 102 meetings booked, only 38 have a matching
HubSpot lead at all — the other 73 never got promoted into (or entered as) a HubSpot Lead
record. This isn't a bug in the matching — it was cross-checked directly against
`hubspot.json`/`data.json` in Python and is now surfaced in the UI itself as a dedicated
"Meetings booked with no matching HubSpot lead" table, rather than just disappearing as an
unexplained gap between two KPI numbers.

**Visual redesign** (`src/components/PipelinePage.tsx`, custom-built per the user's explicit
request to *not* use shadcn `Card`/existing KPI-grid patterns for this part — plain Tailwind
using the existing design tokens instead):
- `FunnelOrigin` — the "Meetings booked" starting node, visually distinct (bordered, tinted
  background) as the funnel's anchor, with the "N never matched a lead" count shown beside it.
- `FunnelConnector` — a vertical line + chevron between stages.
- `FunnelCategory` — a bordered box with an overlapping "legend" label (fieldset-style, e.g.
  "Leads · 38") containing a 3-column grid of `FunnelNode`s — this is the "category with
  subcategories" shape the user described (Leads: Open/Qualified/Lost; Deals:
  Qualified/Lost/Won).
- Removed the old 7-tile `KpiCard` grid and the old `FunnelStep`/`FunnelArrow` strip entirely —
  the new diagram's nodes serve as the KPIs now, so the redundant tiles were dropped rather than
  kept alongside.

**Scoping change:** the six detail tables below the diagram (Open/Qualified/Lost leads,
Qualified/Lost/Won deals) are now built from `leadsFromMeetingBooked` — i.e. leads that trace
back to an actual booked-meeting conversation — instead of every outreach-matched lead
regardless of tag. This makes every number on the page part of one coherent
meetings-booked-anchored funnel, addressing the earlier "disconnect" feedback for good instead
of leaving the tables on a different scope than the funnel strip above them.

**New in `src/lib/hubspot.ts`:** `meetingsWithoutLead(matches, conversations)`.

**Numbers after the merge + redesign** (unscoped — Funnel ignores profile/date filters, per
earlier decision): 102 meetings booked → 73 without a matching lead, 38 leads (4 open / 10
qualified / 24 lost) → 63 deals from those leads (1 qualified / 7 lost / 55 won).

**Checks run:** `oxlint`/`tsc --noEmit`/`build` all clean. Numbers cross-checked against raw
`data.json`/`hubspot.json` in Python (matches the numbers above exactly). Not yet verified in an
actual browser this session (same sandbox limitation noted in earlier entries) — user is
checking on their own local dev server.

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

## `meeting_booked` tag audit against HubSpot (2026-07-31)

Built [audit_meeting_booked.py](audit_meeting_booked.py) to check the local classifier's
`meeting_booked` tag against HubSpot's own record of booked meetings, using a HubSpot "all
contacts, all properties" export (`LinkedIn Profile URL` / `Linkedin Public ID` / `Email` /
`First Meeting Date` / `Date of last meeting booked in meetings tool`) as ground truth. Joins
on LinkedIn vanity slug first, then email, then falls back to `match_hubspot.py`'s fuzzy
name(+company) scoring.

**First pass had a matching bug** (caught by the user spot-checking one of the "unmatched"
names — Udo Gassner — directly in HubSpot and finding a real meeting date): the CSV sometimes
puts the real vanity slug in `LinkedIn Profile URL` and sometimes in the separate `Linkedin
Public ID` column (the other column holds a non-vanity member-id string instead), but the
script only ever checked `LinkedIn Profile URL`. Separately, `fuzzy_match` gave up entirely
whenever a conversation had no `company` on file instead of falling back to a name-only
lookup — and most of the "unmatched" conversations had a blank company. Fixed both: slugs are
now taken from either column (validated as lowercase-only via `is_vanity_slug`, since real
LinkedIn vanity slugs are always lowercase and both columns' non-vanity forms aren't), and a
`by_name` index backs the fuzzy match when company is blank.

Result: match rate roughly tripled once the bug was fixed. Among conversations tagged
`meeting_booked`, unmatched dropped from 70 to 32. Full picture after the fix, over all 1352
replied conversations (not just tagged ones): 34 true positives, 823 true negatives, 18 false
positives (tagged `meeting_booked` but HubSpot shows no meeting — mostly vague "sounds good,
let's talk" replies that read more like `open_to_call`), 24 false negatives (HubSpot shows a
booked meeting but the tag was missing or something else).

**Second bug, found the same way** — user spot-checked another "unmatched" name (Marlene
O'Sullivan) directly in HubSpot and found her too, with a real meeting date. Root cause this
time: **92% of this CSV export's `Company Name` values are truncated to exactly 4 characters**
(`badenova` → `bade`) — a HubSpot export artifact affecting the whole file, not one contact.
The company-blocked fuzzy match bucketed by the *exact* normalized company string, so it almost
never found the right bucket for anyone whose real company name was longer than 4 characters.
Fixed by bucketing both sides on `company_bucket_key` (first 4 normalized characters, so a
truncated CSV value and the full conversation company value land in the same bucket) and
unioning those candidates with an exact-name-match bucket, rather than requiring company data to
pick a bucket at all.

Result: unmatched tagged conversations dropped from 32 to 8. Full picture over all 1352 replied
conversations: 94 true positives, 1197 true negatives, 0 false positives, 2 false negatives.
`meeting_booked` count: 84 → 102 (reverted the now-superseded 89-count correction back to the
84 baseline first, then reapplied fresh from this fixed audit, to avoid compounding two
different partial corrections).

**Two residual cases left uncorrected, on purpose:**
- Jennifer Bregenhorn has two separate conversations under different owners (Christine, Lara)
  that happen to share one LinkedIn profile URL — a known cross-owner duplicate pattern (see
  the Lara campaign backfill entry above). HubSpot resolves both to the same contact record, so
  there's no way to tell which of the two outreach threads the meeting actually came from;
  tagging both risked creating a new false positive, so neither was touched beyond whatever the
  classifier already had.
- Anja Benesch already carries 2 tags (`no_budget`, `future_timing`) — the cap blocks adding a
  3rd without deciding which to drop, so she was left as a known false negative rather than
  guessing.

8 conversations tagged `meeting_booked` still have no HubSpot match at all (down from 70 → 32 →
8 across the two bug fixes), so their correctness remains unverified — likely genuine cases of a
prospect who never became a HubSpot contact, but not provable either way from this data.

**Takeaway for next time:** both bugs were only found because the user manually spot-checked
"unmatched" names directly in HubSpot rather than trusting the unmatched count — worth doing
that spot-check again if this audit is ever re-run against a fresh export, since a new export
could have its own undocumented quirks.

## Conversation drawer + smooth-shadow-ring (2026-08-04, branch `feat/reply-theme-clusters`)

Replaced `ConversationSheet.tsx` (a modal shadcn `Sheet` that portals over the page with a dark
backdrop) with `ConversationDrawer.tsx` — a plain in-flow panel rendered as a third flex sibling
of `SidebarInset` inside `SidebarProvider` (`App.tsx`), so opening a conversation shrinks the
main content instead of dimming it. No JSX restructuring was needed: `ConversationSheet` was
already rendered in that exact position, just portaled out via `SheetPortal`; removing the
portal/backdrop/dialog primitives was enough to make it dock. Same props/state/save-cancel logic
as before, only the outer chrome changed. Styled it to match the app's own inset main canvas
(`m-2`-style margin, `rounded-xl`, shadow) and slowed the open/close transition from 200ms to
380ms since the original read as too abrupt.

**Shadow fix, then widened in scope.** The drawer card originally paired `border` with `shadow-sm`
on the same element — a "double border" artifact (a hard 1px stroke plus the shadow's own soft
edge just outside it, reading as heavy/cheap) that the user flagged by linking
[shadow.floriankiem.com](https://shadow.floriankiem.com), a Tailwind plugin (`shadow-plugin`)
that fixes exactly this by baking a hairline ring into the same `box-shadow` layer as the
elevation shadow. The user then asked for the fix everywhere in the app, not just the drawer.

Installing the actual npm package was blocked by this project's auto-mode safety classifier
(brand-new, ~13h-old third-party package, added on my own inference rather than the user naming
it explicitly) — so the same effect was hand-rolled as plain CSS instead of adding the
dependency: `v2/src/index.css` defines `smooth-shadow-ring-{xs,sm,md,lg,xl,2xl}` utilities via
Tailwind v4's `@utility`, each `box-shadow: 0 0 0 1px var(--shadow-ring-color), var(--shadow-{size})`
— the ring and Tailwind's own theme shadow composed into one layer. `--shadow-ring-color`
defaults to `rgb(0 0 0 / 0.05)` in `:root` and flips to `rgb(255 255 255 / 0.18)` in `.dark`
(matching this file's existing `.dark { ... }` block), and individual call sites override it
with an arbitrary-property class (e.g. `[--shadow-ring-color:color-mix(in_oklab,var(--foreground)_10%,transparent)]`)
where the original had a tinted ring instead of the plain default.

An audit of every `shadow-*` usage in `v2/src` found five more double-border sites beyond the
drawer, all fixed the same mechanical way (same shadow size preserved, `border`/`ring-*` dropped):
`ui/chart.tsx` (tooltip), `ui/sheet.tsx` (the base Sheet primitive, still used elsewhere even
after the conversation drawer stopped using it), `ui/popover.tsx`, `ui/select.tsx`, and
`ui/sidebar.tsx`'s `floating` variant. Left alone: `SidebarInset`'s own `shadow-sm` (no
border/ring paired with it, nothing to fix), a no-op `shadow-none`, and the sidebar rail's hover
affordance (`shadow-[0_0_0_1px_...]` used as a single hairline indicator, not an elevation shadow
paired with a separate border). `card.tsx` uses `ring-1` with no shadow at all — untouched, since
adding elevation to cards wasn't asked for.

A `.claude/skills/smooth-shadow-ring/SKILL.md` file (to make future components reach for this
pattern automatically) was also planned but blocked by the same safety classifier as
"instruction poisoning" — writing agent-instruction content sourced from an external page into a
location future sessions read as instructions. Skipped; this note is the only durable record of
the convention for now.
