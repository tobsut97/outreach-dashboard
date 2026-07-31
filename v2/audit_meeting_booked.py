#!/usr/bin/env python3
"""Validate the local classifier's `meeting_booked` tag against HubSpot's own record of
booked meetings.

Join key: `data.json` conversations carry a LinkedIn `profile_url` (near-universal) and
sometimes an `email`; the HubSpot contacts export carries `LinkedIn Profile URL` and `Email`.
Joining on the LinkedIn vanity slug is primary since it covers ~all conversations; email is a
fallback for the export rows whose LinkedIn column holds a non-vanity `ACoAAB...` member id
instead of a slug. Rows still unmatched after that fall back to fuzzy name+company, reusing
`match_hubspot.py`'s scoring so the two audits behave consistently.

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
MEMBER_ID_RE = re.compile(r"^acoaa", re.IGNORECASE)
FUZZY_MATCH_FLOOR = 0.90  # same bar match_hubspot.py uses for a company-less name match


def normalize_slug(url: str) -> str | None:
    """Returns the lowercased, URL-decoded vanity slug, or None for a non-vanity
    (`ACoAAB...` member-id) LinkedIn URL, which can't be matched against a vanity slug."""
    match = SLUG_RE.search(url or "")
    if not match:
        return None
    slug = unquote(match.group(1)).lower().rstrip("/")
    if MEMBER_ID_RE.match(slug):
        return None
    return slug


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


def build_indexes(contacts: list[dict]) -> tuple[dict, dict]:
    by_slug = defaultdict(list)
    by_email = defaultdict(list)
    for row in contacts:
        slug = normalize_slug(row.get("LinkedIn Profile URL", ""))
        if slug:
            by_slug[slug].append(row)
        email = normalize_email(row.get("Email", ""))
        if email:
            by_email[email].append(row)
    return by_slug, by_email


def fuzzy_match(conv: dict, contacts_by_company: dict) -> dict | None:
    conv_name = normalize_name(conv.get("full_name", ""))
    conv_company = normalize_company(conv.get("company", ""))
    candidates = contacts_by_company.get(conv_company) if conv_company else None
    if not candidates:
        return None
    best_score, best_row = 0.0, None
    for row in candidates:
        name = normalize_name(f"{row.get('First Name', '')} {row.get('Last Name', '')}")
        score = SequenceMatcher(None, conv_name, name).ratio()
        if score > best_score:
            best_score, best_row = score, row
    return best_row if best_score >= FUZZY_MATCH_FLOOR else None


def match_conversation(conv: dict, by_slug: dict, by_email: dict, contacts_by_company: dict) -> dict | None:
    slug = normalize_slug(conv.get("profile_url", ""))
    if slug and by_slug.get(slug):
        return by_slug[slug][0]
    email = normalize_email(conv.get("email", ""))
    if email and by_email.get(email):
        return by_email[email][0]
    return fuzzy_match(conv, contacts_by_company)


def main() -> None:
    contacts = load_contacts()
    conversations = load_replied_conversations()
    by_slug, by_email = build_indexes(contacts)

    contacts_by_company = defaultdict(list)
    for row in contacts:
        company = normalize_company(row.get("Company Name", ""))
        if company:
            contacts_by_company[company].append(row)

    false_positives, false_negatives, unmatched = [], [], []
    true_positives = true_negatives = 0

    for conv in conversations:
        row = match_conversation(conv, by_slug, by_email, contacts_by_company)
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
