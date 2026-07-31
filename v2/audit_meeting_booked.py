#!/usr/bin/env python3
"""Validate the local classifier's `meeting_booked` tag against HubSpot's own record of
booked meetings.

Join key: `data.json` conversations carry a LinkedIn `profile_url` (near-universal) and
sometimes an `email`; the HubSpot contacts export carries `LinkedIn Profile URL`, `Linkedin
Public ID`, and `Email`. Joining on the LinkedIn vanity slug is primary since it covers ~all
conversations — tried against both `LinkedIn Profile URL` and `Linkedin Public ID`, since either
column can hold the real vanity slug while the other holds a non-matchable member id (see
`is_vanity_slug`). Email is a fallback for rows where neither column has a slug. Rows still
unmatched after that fall back to fuzzy name+company (or name-only when the conversation has no
company on file), reusing `match_hubspot.py`'s name/company normalization so the two audits
behave consistently.

Ground truth for "a meeting was booked" is HubSpot's `First Meeting Date` or `Date of last
meeting booked in meetings tool` being non-blank. Only replied conversations are in scope,
since `meeting_booked` is only ever assigned to a reply.

This only reports; it does not write. Confirmed mismatches are corrected by hand in data.json
per the project's existing manual-correction pattern (see v2/notes.md).
"""
import csv
import json
import re
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import unquote

from match_hubspot import normalize_company, normalize_name

CONTACTS_CSV = "/Users/tobias/Downloads/260731-all-contacts-all-properties.csv"
DATA_JSON = Path(__file__).parent / "data.json"

SLUG_RE = re.compile(r"linkedin\.com/in/([^/?]+)")
VANITY_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
FUZZY_MATCH_FLOOR = 0.90  # same bar match_hubspot.py uses for a company-less name match


def is_vanity_slug(raw: str) -> bool:
    """A real LinkedIn vanity slug is lowercase-only (LinkedIn enforces this at signup).
    Member-id forms aren't: the `LinkedIn Profile URL` column's non-vanity fallback is an
    `ACoAA...`-prefixed id, and the `Linkedin Public ID` column's is a mixed-case base64-ish
    id (e.g. `AEEAABZwGNwB...`) — checking case on the *raw* string (before lowercasing)
    catches both without hardcoding either prefix."""
    return bool(VANITY_SLUG_RE.match(raw))


def normalize_slug(url: str) -> str | None:
    """Returns the lowercased, URL-decoded vanity slug from a full LinkedIn URL, or None if
    it's a non-vanity member-id URL."""
    match = SLUG_RE.search(url or "")
    if not match:
        return None
    raw = unquote(match.group(1)).rstrip("/")
    return raw.lower() if is_vanity_slug(raw) else None


def normalize_public_id(raw_id: str) -> str | None:
    """Returns the lowercased public id if it's a real vanity slug, else None — the
    `Linkedin Public ID` column holds a vanity slug for some rows and a non-vanity id for
    others (see `is_vanity_slug`)."""
    raw = unquote((raw_id or "").strip())
    return raw.lower() if raw and is_vanity_slug(raw) else None


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def has_meeting(row: dict) -> bool:
    return bool((row.get("First Meeting Date") or "").strip()) or bool(
        (row.get("Date of last meeting booked in meetings tool") or "").strip()
    )


def load_contacts() -> list[dict]:
    with open(CONTACTS_CSV, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_replied_conversations() -> list[dict]:
    data = json.loads(DATA_JSON.read_text())
    return [c for c in data["conversations"] if c.get("replied")]


def build_indexes(contacts: list[dict]) -> tuple[dict, dict, dict]:
    by_slug = defaultdict(list)
    by_email = defaultdict(list)
    by_name = defaultdict(list)
    for row in contacts:
        slug = normalize_slug(row.get("LinkedIn Profile URL", ""))
        if slug:
            by_slug[slug].append(row)
        public_id = normalize_public_id(row.get("Linkedin Public ID", ""))
        if public_id:
            by_slug[public_id].append(row)
        email = normalize_email(row.get("Email", ""))
        if email:
            by_email[email].append(row)
        name = normalize_name(f"{row.get('First Name', '')} {row.get('Last Name', '')}")
        if name:
            by_name[name].append(row)
    return by_slug, by_email, by_name


def fuzzy_match(conv: dict, contacts_by_company: dict, contacts_by_name: dict) -> dict | None:
    """Company-blocked when the conversation has a company on file (narrows an otherwise
    all-pairs scan); falls back to a name-blocked scan when it doesn't, rather than giving up —
    a blank company must not make an otherwise-good name match unfindable."""
    conv_name = normalize_name(conv.get("full_name", ""))
    conv_company = normalize_company(conv.get("company", ""))
    candidates = contacts_by_company.get(conv_company) if conv_company else contacts_by_name.get(conv_name)
    if not candidates:
        return None
    best_score, best_row = 0.0, None
    for row in candidates:
        name = normalize_name(f"{row.get('First Name', '')} {row.get('Last Name', '')}")
        score = SequenceMatcher(None, conv_name, name).ratio()
        if score > best_score:
            best_score, best_row = score, row
    return best_row if best_score >= FUZZY_MATCH_FLOOR else None


def match_conversation(
    conv: dict, by_slug: dict, by_email: dict, contacts_by_company: dict, contacts_by_name: dict
) -> dict | None:
    slug = normalize_slug(conv.get("profile_url", ""))
    if slug and by_slug.get(slug):
        return by_slug[slug][0]
    email = normalize_email(conv.get("email", ""))
    if email and by_email.get(email):
        return by_email[email][0]
    return fuzzy_match(conv, contacts_by_company, contacts_by_name)


def main() -> None:
    contacts = load_contacts()
    conversations = load_replied_conversations()
    by_slug, by_email, contacts_by_name = build_indexes(contacts)

    contacts_by_company = defaultdict(list)
    for row in contacts:
        company = normalize_company(row.get("Company Name", ""))
        if company:
            contacts_by_company[company].append(row)

    false_positives, false_negatives, unmatched = [], [], []
    true_positives = true_negatives = 0

    for conv in conversations:
        row = match_conversation(conv, by_slug, by_email, contacts_by_company, contacts_by_name)
        tagged = "meeting_booked" in conv.get("tags", [])
        if row is None:
            if tagged:
                unmatched.append(conv)
            continue
        booked = has_meeting(row)
        if tagged and booked:
            true_positives += 1
        elif tagged and not booked:
            false_positives.append((conv, row))
        elif not tagged and booked:
            false_negatives.append((conv, row))
        else:
            true_negatives += 1

    def describe(conv: dict, row: dict | None = None) -> str:
        reply = next((m["text"] for m in conv["messages"] if m["sender"] == "prospect"), "")
        base = f"  {conv['full_name']!r} @ {conv['company']!r} tags={conv['tags']} reply={reply[:80]!r}"
        if row is not None:
            base += f" hubspot_meeting_date={row.get('First Meeting Date') or row.get('Date of last meeting booked in meetings tool')!r}"
        return base

    print(f"{len(conversations)} replied conversations")
    print(f"true positives (tagged + HubSpot confirms): {true_positives}")
    print(f"true negatives (not tagged + no HubSpot meeting): {true_negatives}")
    print(f"false positives (tagged but no HubSpot meeting): {len(false_positives)}")
    for conv, row in false_positives:
        print(describe(conv, row))
    print(f"false negatives (HubSpot meeting but not tagged): {len(false_negatives)}")
    for conv, row in false_negatives:
        print(describe(conv, row))
    print(f"tagged meeting_booked but no HubSpot contact match at all: {len(unmatched)}")
    for conv in unmatched:
        print(describe(conv))


if __name__ == "__main__":
    main()
