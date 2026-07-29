#!/usr/bin/env python3
"""Extract outreach replies and classify dispositions using Claude API."""
import csv
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

# Matches: "First Last [D. Month YYYY HH:MM:SS] " — 2-3 word name.
# Accepts accented characters used in European names (À-Þ uppercase range,
# Latin-1 + Latin Extended-A for body characters).
_MSG_RE = re.compile(
    r'([A-ZÀ-ÞĀ-ſ][A-Za-zÀ-ÿßĀ-ſ\-]+(?: [A-ZÀ-ÞĀ-ſ][A-Za-zÀ-ÿßĀ-ſ\-]+){1,2})'
    r'\s+\[(\d+\.\s+\w+\s+\d{4}\s+\d{1,2}:\d{2}:\d{2})\]\s*'
)


def parse_conversation(history: str, owner_full_name: str | None = None) -> list[dict]:
    """Parse campaign_messaging_history into a list of {sender, date, text, is_owner}."""
    if not history:
        return []
    history = history.replace("\xa0", " ")
    matches = list(_MSG_RE.finditer(history))
    if not matches:
        return []
    # Infer owner name from first message if not provided
    first_sender = matches[0].group(1).strip()
    owner = owner_full_name or first_sender
    messages = []
    for i, m in enumerate(matches):
        sender = m.group(1).strip()
        date_str = m.group(2).strip()
        text_start = m.end()
        text_end = matches[i + 1].start() if i + 1 < len(matches) else len(history)
        text = history[text_start:text_end].strip()
        if text:
            messages.append({
                "sender": sender,
                "date": date_str,
                "text": text,
                "is_owner": sender == owner,
            })
    return messages


def detect_owner_name(rows: list[dict]) -> str | None:
    """Detect the owner's full name by majority vote of who sends first in each conversation."""
    from collections import Counter
    counts: Counter = Counter()
    for row in rows:
        h = (row.get("campaign_messaging_history") or "").replace("\xa0", " ").strip()
        m = _MSG_RE.match(h)
        if m:
            counts[m.group(1).strip()] += 1
    if counts:
        return counts.most_common(1)[0][0]
    # Fallback for CSVs without campaign_messaging_history: the owner is the
    # sender that recurs across rows (prospects appear once, owner appears in all).
    for row in rows:
        for prefix in ("message_1", "replied_message_1", "last_sent_message", "last_received_message"):
            sender = (row.get(f"{prefix}_from") or "").strip()
            if sender:
                counts[sender] += 1
    return counts.most_common(1)[0][0] if counts else None


def build_conversation_from_fields(row: dict, owner_full_name: str | None) -> list[dict]:
    """Build a conversation list from structured message_* CSV columns
    (used when campaign_messaging_history is missing)."""
    candidates = []
    for prefix in ("message_1", "replied_message_1", "last_sent_message", "last_received_message"):
        sender = (row.get(f"{prefix}_from") or "").strip()
        text = (row.get(f"{prefix}_text") or "").strip()
        if not text:
            continue
        candidates.append({
            "sender": sender,
            "date": (row.get(f"{prefix}_send_at") or "").strip(),
            "date_iso": (row.get(f"{prefix}_send_at_iso") or "").strip(),
            "text": text,
        })
    candidates.sort(key=lambda c: c["date_iso"] or "")
    seen: set = set()
    out: list[dict] = []
    for c in candidates:
        key = (c["sender"], c["text"])
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "sender": c["sender"],
            "date": c["date"],
            "text": c["text"],
            "is_owner": bool(owner_full_name) and c["sender"] == owner_full_name,
        })
    return out

CAMPAIGNS = {
    "lara": [
        ("New Sustainability Manager", "/Users/tobias/Downloads/New-Sustainability-Manager-Replies.csv"),
        ("Holz als Rohstoff", "/Users/tobias/Downloads/Holz-als-Rohstoff-Replies.csv"),
        ("Klimaschutz Holzindustrie", "/Users/tobias/Downloads/Klimaschutz-Holzindustrie-Replies.csv"),
        ("EcoVadis", "/Users/tobias/Downloads/EcoVadis-Replies.csv"),
        ("Stiftung Allianz Klima", "/Users/tobias/Downloads/Stiftung-Allianz-Klima-Replies.csv"),
        ("Nachhaltigkeit in Unternehmen", "/Users/tobias/Downloads/Nachhaltigkeit-in-Unternehmen-Replies.csv"),
    ],
    "chrissy": [
        ("Banken DE/AT", "/Users/tobias/Downloads/Banken-DE-AT-Replies_Chrissy.csv"),
        ("Klimabündnis AT", "/Users/tobias/Downloads/Klimabüdnis-AT-Replies_Chrissy.csv"),
        ("Gemeinwohl-Ökonomie", "/Users/tobias/Downloads/Gemeinwohl-Ökonomie-Replies_Chrissy.csv"),
        ("Climate Partner Kunden", "/Users/tobias/Downloads/Climate-Parnter-Kunden-Replies_Chrissy.csv"),
    ],
    "caro": [
        ("New Sustainability Managers AT", "/Users/tobias/Downloads/Caro-New-Sustainability-Managers-AT.csv"),
        ("Sustainability Manager AT", "/Users/tobias/Downloads/Caro-Sustainability-Manager-AT.csv"),
    ],
    "christian": [
        ("Unternehmensnetzwerk Klimaschutz", "/Users/tobias/Downloads/Christian-Unternehmensnetwerk-Klimaschutz.csv"),
        ("Pharmaindustrie", "/Users/tobias/Downloads/Christian-Pharmaindustrie-Replies.csv"),
    ],
}

# Full-funnel data sources: failed + processing + processed CSVs per campaign
FUNNELS = {
    "lara": [
        {
            "campaign": "Nachhaltigkeit in Unternehmen",
            "processed":  "/Users/tobias/Downloads/Nachhaltigkeit-in-Unternehmen-Lara-Processed.csv",
            "processing": "/Users/tobias/Downloads/Nachhaltigkeit-in-Unternehmen-Lara-Processing.csv",
            "failed":     "/Users/tobias/Downloads/Nachhaltigkeit-in-Unternehmen-Lara-Failed.csv",
        },
    ],
}


def _read_csv(path: str) -> list[dict]:
    p = Path(path)
    if not p.exists():
        print(f"missing funnel csv: {path}", file=sys.stderr)
        return []
    with p.open(newline="", encoding="utf-8") as f:
        sample = f.readline()
        f.seek(0)
        delim = ";" if sample.count(";") > sample.count(",") else ","
        return list(csv.DictReader(f, delimiter=delim))


def build_funnel(processed_path: str, processing_path: str, failed_path: str,
                 classified_replies: list[dict]) -> dict:
    """Build a deduplicated funnel.

    Failed.csv is a subset of Processed.csv (it's a status flag, not a separate
    bucket). Dedup via profile_url so every contact is counted exactly once."""
    failed_rows = _read_csv(failed_path)
    processing_rows = _read_csv(processing_path)
    processed_rows = _read_csv(processed_path)

    failed_ids = {(r.get("profile_url") or "").strip() for r in failed_rows}

    def has(row: dict, key: str) -> bool:
        return bool((row.get(key) or "").strip())

    def url(row: dict) -> str:
        return (row.get("profile_url") or "").strip()

    def contact(row: dict) -> dict:
        return {
            "full_name":  first(row, "full_name", "original_full_name"),
            "company":    first(row, "current_company", "original_current_company", "organization_1"),
            "position":   first(row, "current_company_position", "original_current_company_position", "organization_title_1"),
            "headline":   first(row, "headline", "original_headline"),
            "profile_url": url(row),
            "email":      first(row, "email"),
        }

    # Within Processed, split by failed flag
    succeeded_rows = [r for r in processed_rows if url(r) not in failed_ids]
    succeeded_ids = {url(r) for r in succeeded_rows}
    replies_by_url = {url(r): r for r in succeeded_rows if has(r, "replied_message_1_send_at_iso")}
    meeting_urls = {
        (r.get("profile_url") or "").strip() for r in classified_replies
        if "meeting_requested" in (r.get("dispositions") or [])
    }

    # Stage counts across the whole Processed set
    invited   = sum(1 for r in processed_rows if has(r, "invited_date_iso"))
    connected = sum(1 for r in processed_rows if has(r, "connected_at_iso"))
    # Drop-offs that line up exactly with the Failed flag:
    invite_failed_to_send = len(processed_rows) - invited                 # 23 (all failed)
    invite_not_accepted   = invited - connected                            # 256 (all failed)
    # Of the connected, failed ones = LH aborted before/during conversation
    connected_failed   = sum(1 for r in processed_rows
                             if has(r, "connected_at_iso")
                             and (r.get("profile_url") or "").strip() in failed_ids)
    active_convo       = connected - connected_failed                      # succeeded conversations

    replied  = sum(1 for r in succeeded_rows if has(r, "replied_message_1_send_at_iso"))
    no_reply = active_convo - replied

    meetings = sum(1 for r in classified_replies
                   if "meeting_requested" in (r.get("dispositions") or []))
    other_reply = max(0, replied - meetings)

    total = len(processed_rows) + len(processing_rows)  # processed ∪ processing (disjoint)

    # ── Per-node membership for click-through ────────────────────────────
    contacts: dict[str, dict] = {}
    def add_to(d: dict, key: str, row: dict) -> None:
        u = url(row)
        if not u:
            return
        contacts.setdefault(u, contact(row))
        d.setdefault(key, []).append(u)

    members: dict[str, list[str]] = {}
    for r in processing_rows:
        add_to(members, "processing", r)
    for r in processed_rows:
        add_to(members, "processed", r)
        invited_here = has(r, "invited_date_iso")
        connected_here = has(r, "connected_at_iso")
        if invited_here:
            add_to(members, "invited", r)
        else:
            add_to(members, "invite_failed", r)
        if invited_here and not connected_here:
            add_to(members, "not_accepted", r)
        # Only count as connected when LH also recorded the invite — keeps the
        # funnel conservation tight (drops a tiny number of pre-existing
        # connections that LH picked up without an invite).
        if invited_here and connected_here:
            add_to(members, "connected", r)
            if url(r) in failed_ids:
                add_to(members, "convo_failed", r)
            else:
                add_to(members, "active_convo", r)
                if has(r, "replied_message_1_send_at_iso"):
                    add_to(members, "replied", r)
                    if url(r) in meeting_urls:
                        add_to(members, "meetings", r)
                    else:
                        add_to(members, "other_reply", r)
                else:
                    add_to(members, "no_reply", r)

    n = lambda k: len(members.get(k, []))
    return {
        "contacts": contacts,
        "members":  members,
        "total":                 n("processing") + n("processed"),
        "processing":            n("processing"),
        "processed":             n("processed"),
        "failed":                len(failed_ids),
        "invite_failed_to_send": n("invite_failed"),
        "invited":               n("invited"),
        "invite_not_accepted":   n("not_accepted"),
        "connected":             n("connected"),
        "connected_failed":      n("convo_failed"),
        "active_convo":          n("active_convo"),
        "no_reply":              n("no_reply"),
        "replied":               n("replied"),
        "other_reply":           n("other_reply"),
        "meetings":              n("meetings"),
    }

PRIORITY = [
    "hard_decline",
    "meeting_requested",
    "curious_question",
    "interested_future",
    "polite_decline",
    "already_handled",
    "not_now_busy",
    "referred_to_colleague",
    "person_unavailable",
    "polite_acknowledgement",
    "unclear",
]
DISP_SET = set(PRIORITY)

OUTCOMES = {
    "meeting_requested": "positive",
    "curious_question": "positive",
    "interested_future": "positive",
    "polite_acknowledgement": "neutral",
    "referred_to_colleague": "neutral",
    "person_unavailable": "neutral",
    "unclear": "neutral",
    "not_now_busy": "declined",
    "already_handled": "declined",
    "polite_decline": "declined",
    "hard_decline": "declined",
}

CACHE_PATH = Path(__file__).parent / "classify_cache.json"
DECLINE_CACHE_PATH = Path(__file__).parent / "decline_reasons_cache.json"

DECLINE_REASONS = [
    "already_handled",        # already have a partner / provider / project
    "handled_internally",     # manage in-house, don't buy external solutions
    "no_budget",              # budget constraints / cost concerns
    "wrong_timing",           # too busy / not on agenda right now
    "not_relevant",           # wrong fit — industry, size, focus
    "prefers_other_approach", # skeptical of voluntary offsets / different climate strategy
    "no_reason_stated",       # polite "no" without specifics
]
DECLINE_REASON_SET = set(DECLINE_REASONS)

DECLINE_PROMPT = """\
You analyze LinkedIn outreach replies where the prospect DECLINED Pina Earth's offer of forest-based \
carbon credits to businesses in the DACH region.
Your task: identify WHY they declined. Read carefully but stay faithful to what's actually written.

Reason labels (multi-label allowed only when two distinct reasons are clearly stated):
- already_handled: They already have a climate/sustainability partner, provider, project, or solution in place
- handled_internally: They manage climate/carbon topics in-house and do not buy external solutions
- no_budget: Cite budget constraints, no spending allocated, cost concerns
- wrong_timing: Decline because of timing — too busy, focused on other priorities, not on agenda right now
- not_relevant: The offer doesn't fit — wrong industry, wrong company size, not their topic
- prefers_other_approach: Skeptical of voluntary offsets / carbon credits, prefer a different climate strategy (e.g. focus on reduction over offsetting)
- no_reason_stated: A polite decline without specifying any reason

Rules:
- Assign exactly one label whenever possible; multi-label only when two distinct reasons are clearly present
- Prefer a specific reason over no_reason_stated when there is ANY signal
- For German replies, interpret cultural norms
- "Kein Interesse" / "kein Bedarf" alone (no further reason) → no_reason_stated
- "Kein Budget" / "keine Mittel" → no_budget
- "Machen wir intern" / "managen wir selbst" → handled_internally
- "Haben schon einen Partner" / "arbeiten bereits mit X" → already_handled
- "Aktuell keine Zeit" / "andere Prioritäten" → wrong_timing
- "Nicht unser Thema" / "passt nicht zu uns" → not_relevant
- "Setzen auf Reduktion statt Kompensation" / kritisch ggü. Offsets → prefers_other_approach

Return ONLY a JSON array — no explanation, no markdown:
[{"id": 1, "reasons": ["label"]}, ...]
"""

CLASSIFICATION_PROMPT = """\
You classify LinkedIn outreach replies for Pina Earth, a company selling forest-based carbon credits \
to businesses in German-speaking countries (DACH region). The outreach asks companies whether they \
want to use Pina Earth's climate protection projects to meet their climate/sustainability goals.

Disposition labels (multi-label allowed when clearly warranted):
- meeting_requested: Person explicitly asks for a meeting, call, or exchange — or shares a calendar \
link, their email, or says "schreib mir eine Mail / let's schedule / buche dir einen Termin"
- curious_question: Person asks genuine questions about Pina Earth, the offer, how it works, pricing, \
certification, etc.
- interested_future: Interest but not now — mentions future timing, upcoming review cycle, or \
"vielleicht später / next quarter / remind me in X months"
- polite_acknowledgement: Brief neutral thank-you or acknowledgement with no clear stance or question
- referred_to_colleague: Redirects to a colleague who handles this topic
- person_unavailable: On parental leave, retired, left the company, or no longer responsible for this
- not_now_busy: Declines citing being busy, wrong timing, or current priorities — but not a hard no
- already_handled: Company already has a solution, ongoing project, or handles this internally
- polite_decline: Clear but polite "no interest / not relevant" without aggression
- hard_decline: Aggressive refusal, spam accusation, or explicit demand to stop contacting
- unclear: Reply is too short, off-topic, or genuinely impossible to classify

Rules:
- Assign at least one label per reply
- Use multi-label only when two distinct signals are clearly present (e.g. curious_question + not_now_busy)
- For German replies, interpret cultural norms (e.g. "kein Bedarf aktuell" = not_now_busy, not hard_decline)
- A shared email address or calendar link always means meeting_requested regardless of other wording
- "Kein Interesse" alone = polite_decline; aggressive wording = hard_decline
- Short replies like "Danke, kein Bedarf" = polite_decline (not unclear)

Return ONLY a JSON array — no explanation, no markdown:
[{"id": 1, "dispositions": ["label"]}, ...]
"""

BATCH_SIZE = 25


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:24]


def sort_by_priority(disps: list) -> list:
    return [d for d in PRIORITY if d in disps] or ["unclear"]


def classify_decline_batch(batch: list[tuple[str, str, str]], cache: dict) -> None:
    """Classify a batch of declined replies for *why* they declined."""
    parts = []
    for i, (_, reply, sent) in enumerate(batch, 1):
        context = f"Outreach: {sent[:300]}\nReply: {reply[:500]}" if sent else f"Reply: {reply[:500]}"
        parts.append(f"[{i}]\n{context}")
    prompt = DECLINE_PROMPT + "\n\nReplies:\n" + "\n\n".join(parts)
    result = subprocess.run(
        ["claude", "-p", prompt],
        capture_output=True, text=True, timeout=120,
    )
    raw = result.stdout.strip()
    start, end = raw.find("["), raw.rfind("]") + 1
    results = json.loads(raw[start:end])
    for item in results:
        idx = item["id"] - 1
        if 0 <= idx < len(batch):
            h = batch[idx][0]
            valid = [r for r in item.get("reasons", []) if r in DECLINE_REASON_SET]
            cache[h] = valid if valid else ["no_reason_stated"]


def classify_batch(batch: list[tuple[str, str, str]], cache: dict) -> None:
    """Classify a batch and write results into cache. batch = [(hash, reply_text, sent_text)]"""
    parts = []
    for i, (_, reply, sent) in enumerate(batch, 1):
        context = f"Outreach: {sent[:300]}\nReply: {reply[:500]}" if sent else f"Reply: {reply[:500]}"
        parts.append(f"[{i}]\n{context}")

    prompt = CLASSIFICATION_PROMPT + "\n\nReplies:\n" + "\n\n".join(parts)

    result = subprocess.run(
        ["claude", "-p", prompt],
        capture_output=True, text=True, timeout=120,
    )
    raw = result.stdout.strip()
    start, end = raw.find("["), raw.rfind("]") + 1
    results = json.loads(raw[start:end])

    for item in results:
        idx = item["id"] - 1
        if 0 <= idx < len(batch):
            h = batch[idx][0]
            raw_disps = [d for d in item.get("dispositions", []) if d in DISP_SET]
            cache[h] = sort_by_priority(raw_disps) if raw_disps else ["unclear"]


def derive_outcome(dispositions: list) -> str:
    outcomes = {OUTCOMES.get(d, "neutral") for d in dispositions}
    if "positive" in outcomes:
        return "positive"
    if "declined" in outcomes:
        return "declined"
    return "neutral"


def first(row: dict, *keys: str) -> str:
    for k in keys:
        v = row.get(k)
        if v and v.strip():
            return v.strip()
    return ""


def main() -> None:
    cache = load_cache()

    # --- Pass 1: read all CSVs, collect raw rows ---
    raw_rows: list[dict] = []
    owner_for_row: list[str] = []
    # Collect all CSV rows per owner so we can detect the owner's full name
    csv_rows_by_owner: dict[str, list[dict]] = {o: [] for o in CAMPAIGNS}

    for owner, files in CAMPAIGNS.items():
        for campaign_name, path in files:
            p = Path(path)
            if not p.exists():
                print(f"missing: {path}", file=sys.stderr)
                continue
            with p.open(newline="", encoding="utf-8") as f:
                sample = f.readline()
                f.seek(0)
                delim = ";" if sample.count(";") > sample.count(",") else ","
                for row in csv.DictReader(f, delimiter=delim):
                    csv_rows_by_owner[owner].append(row)
                    reply = first(row, "replied_message_1_text", "last_received_message_text")
                    if not reply:
                        continue
                    raw_rows.append({
                        "campaign": campaign_name,
                        "full_name": first(row, "full_name", "original_full_name"),
                        "headline": first(row, "headline", "original_headline"),
                        "company": first(row, "current_company", "original_current_company", "organization_1"),
                        "position": first(row, "current_company_position", "original_current_company_position", "organization_title_1"),
                        "location": first(row, "location_name"),
                        "industry": first(row, "industry", "current_company_industry"),
                        "profile_url": first(row, "profile_url"),
                        "email": first(row, "email"),
                        "sent_text": first(row, "message_1_text", "last_sent_message_text"),
                        "reply_text": reply,
                        "reply_at": first(row, "replied_message_1_send_at_iso", "last_received_message_send_at_iso"),
                        "_history": first(row, "campaign_messaging_history"),
                        "_owner": owner,
                        "_raw": row,
                    })
                    owner_for_row.append(owner)

    # Detect each owner's real full name from their first conversation message
    owner_full_names: dict[str, str | None] = {
        o: detect_owner_name(csv_rows_by_owner[o]) for o in CAMPAIGNS
    }
    print("owner names detected:", owner_full_names)

    print(f"loaded {len(raw_rows)} replies")

    # --- Pass 2: classify uncached replies in batches ---
    uncached = [
        (text_hash(r["reply_text"]), r["reply_text"], r["sent_text"])
        for r in raw_rows
        if text_hash(r["reply_text"]) not in cache
    ]
    # deduplicate by hash
    seen: set[str] = set()
    uncached_dedup = []
    for item in uncached:
        if item[0] not in seen:
            seen.add(item[0])
            uncached_dedup.append(item)

    if uncached_dedup:
        n_batches = (len(uncached_dedup) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"classifying {len(uncached_dedup)} new replies ({n_batches} batches)…")
        for i in range(0, len(uncached_dedup), BATCH_SIZE):
            batch = uncached_dedup[i : i + BATCH_SIZE]
            classify_batch(batch, cache)
            save_cache(cache)
            done = min(i + BATCH_SIZE, len(uncached_dedup))
            print(f"  {done}/{len(uncached_dedup)}")
    else:
        print("all replies already cached — skipping API calls")

    # --- Pass 2b: classify decline reasons for declined replies ---
    decline_cache = (
        json.loads(DECLINE_CACHE_PATH.read_text(encoding="utf-8"))
        if DECLINE_CACHE_PATH.exists() else {}
    )

    declined_rows = [
        r for r in raw_rows
        if derive_outcome(cache.get(text_hash(r["reply_text"]), ["unclear"])) == "declined"
    ]
    uncached_declined = []
    seen_d: set[str] = set()
    for r in declined_rows:
        h = text_hash(r["reply_text"])
        if h in decline_cache or h in seen_d:
            continue
        seen_d.add(h)
        uncached_declined.append((h, r["reply_text"], r["sent_text"]))

    if uncached_declined:
        n_batches = (len(uncached_declined) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"classifying {len(uncached_declined)} decline reasons ({n_batches} batches)…")
        for i in range(0, len(uncached_declined), BATCH_SIZE):
            batch = uncached_declined[i : i + BATCH_SIZE]
            classify_decline_batch(batch, decline_cache)
            DECLINE_CACHE_PATH.write_text(
                json.dumps(decline_cache, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            done = min(i + BATCH_SIZE, len(uncached_declined))
            print(f"  {done}/{len(uncached_declined)}")
    else:
        print("all decline reasons already cached — skipping API calls")

    # --- Pass 3: build output ---
    out: dict = {
        "people": {
            owner: {
                "name": owner.capitalize(),
                "owner_full_name": owner_full_names.get(owner),
                "replies": [],
            }
            for owner in CAMPAIGNS
        }
    }

    for row, owner in zip(raw_rows, owner_for_row):
        h = text_hash(row["reply_text"])
        disps = cache.get(h, ["unclear"])
        conversation = parse_conversation(row["_history"], owner_full_names.get(owner))
        if not conversation:
            conversation = build_conversation_from_fields(row["_raw"], owner_full_names.get(owner))
        out["people"][owner]["replies"].append({
            **{k: row[k] for k in ("campaign", "full_name", "headline", "company", "position",
                                   "location", "industry", "profile_url", "email",
                                   "sent_text", "reply_text", "reply_at")},
            "dispositions": disps,
            "outcome": derive_outcome(disps),
            "decline_reasons": decline_cache.get(h, []) if derive_outcome(disps) == "declined" else [],
            "conversation": conversation,
        })

    # --- Pass 4: build funnel summaries ---
    out["funnels"] = []
    for owner, funnels in FUNNELS.items():
        for f in funnels:
            camp_replies = [r for r in out["people"][owner]["replies"]
                            if r["campaign"] == f["campaign"]]
            stages = build_funnel(f["processed"], f["processing"], f["failed"], camp_replies)
            out["funnels"].append({
                "owner": owner,
                "campaign": f["campaign"],
                "stages": stages,
            })
            print(f"funnel {owner} / {f['campaign']}: {stages}")

    Path(__file__).parent.joinpath("data.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    total = sum(len(p["replies"]) for p in out["people"].values())
    print(f"\nwrote {total} replies to data.json")
    for owner, p in out["people"].items():
        primary = Counter(r["dispositions"][0] for r in p["replies"])
        outcomes = Counter(r["outcome"] for r in p["replies"])
        multi = sum(1 for r in p["replies"] if len(r["dispositions"]) > 1)
        print(f"--- {owner} ({len(p['replies'])}) ---")
        print(f"  primary: {dict(primary)}")
        print(f"  outcomes: {dict(outcomes)}  multi-tag: {multi}")


if __name__ == "__main__":
    main()
