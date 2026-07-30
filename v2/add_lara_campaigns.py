#!/usr/bin/env python3
"""Backfill Lara Ebert's missing campaign conversations into data.json.

Additive, not a replacement for extract.py's main(): extract.py's SOURCES list has drifted
out of sync with what actually built data.json (it only lists Christian Lutz's export, yet
data.json holds five owners' conversations), so re-running extract.py as-is would overwrite
data.json and silently drop everyone except Christian. This script instead loads the existing
data.json, adds only conversations that aren't already present, and writes the merged result
back — every other owner's conversations are untouched.

A conversation is identified by (owner, profile_url|email|full_name), matching the fallback
order of conversationKey() in src/lib/overrides.ts. Scoping by owner (not just the identity
key) is deliberate: the same person can have independent, unrelated outreach threads with two
different salespeople, and those must not collide or overwrite each other.

Two phases, since classification here is done by Claude directly rather than local Ollama
(per-project decision for this batch, not a pipeline-wide change to extract.py):

  1. `python3 add_lara_campaigns.py prepare` — parses the CSVs, dedups against data.json and
     within this batch, writes lara_backfill_candidates.json (every new conversation, full
     content) and lara_pending_classification.json (just the replied ones' transcripts, for
     an agent/human to classify).
  2. Classify lara_pending_classification.json's entries externally (same rubric as
     extract.py's SYSTEM_PROMPT), write results to lara_classifications.json as
     {"<index>": {"sentiment": ..., "tags": [...]}, ...}.
  3. `python3 add_lara_campaigns.py apply` — merges lara_classifications.json into the
     candidates, appends everything to data.json, recomputes daily/summary, writes.
"""
import csv
import json
import sys
from pathlib import Path

import extract

NEW_SOURCES = [
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/260610-DENEFF.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/260127-Nachhaltigkeit-in-Unternehmen.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/260504-New-Sustainability-Manager-DE.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/260512-Sustainability-Manager-DE.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/260410-Holz-als-Rohstoff.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/251110-Construction.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/260310-EcoVadis.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/251110-Klimaschutz-Unternehmen-eV.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/251120-Deutscher-Nachhaltigkeitspreis.csv"},
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/260113-Airports.csv"},
    {
        "owner": "Lara Ebert",
        "path": "/Users/tobias/Downloads/260217-Stiftung-Allianz-für-Entwicklung-und-Klima-Processed.csv",
    },
    {"owner": "Lara Ebert", "path": "/Users/tobias/Downloads/260318-Klimaschutz-Holzindustrie-Processed.csv"},
]

HERE = Path(__file__).parent
DATA_JSON = HERE / "data.json"
CANDIDATES_PATH = HERE / "lara_backfill_candidates.json"
PENDING_PATH = HERE / "lara_pending_classification.json"
CLASSIFICATIONS_PATH = HERE / "lara_classifications.json"


def identity(owner: str, conv: dict) -> tuple[str, str]:
    key = conv.get("profile_url") or conv.get("email") or conv.get("full_name")
    return (owner, key)


def transcript_for(conv: dict) -> str:
    return "\n".join(f"{m['sender']}: {m['text']}" for m in conv["messages"])


def prepare() -> None:
    data = json.loads(DATA_JSON.read_text())
    conversations = data["conversations"]

    existing_identities = {identity(c["owner"], c) for c in conversations}
    existing_owners_by_key: dict[str, set[str]] = {}
    for c in conversations:
        _, key = identity(c["owner"], c)
        existing_owners_by_key.setdefault(key, set()).add(c["owner"])

    candidates = []
    per_campaign: dict[str, int] = {}
    cross_owner_hits = []
    within_batch_dupes = 0
    seen_this_run = set()

    for source in NEW_SOURCES:
        owner = source["owner"]
        path = Path(source["path"])
        rows = list(csv.DictReader(path.open(newline="", encoding="utf-8")))
        campaign_name = path.stem
        campaign_added = 0

        for row in rows:
            conv = extract.build_conversation(row, owner)
            if conv is None:
                continue
            conv["owner"] = owner
            ident = identity(owner, conv)

            if ident in existing_identities:
                continue
            if ident in seen_this_run:
                within_batch_dupes += 1
                continue
            seen_this_run.add(ident)

            other_owners = existing_owners_by_key.get(ident[1], set()) - {owner}
            for other_owner in other_owners:
                cross_owner_hits.append((conv["full_name"], conv["company"], other_owner))

            conv["_campaign"] = campaign_name
            candidates.append(conv)
            campaign_added += 1

        per_campaign[campaign_name] = campaign_added

    pending = [
        {"index": i, "full_name": c["full_name"], "transcript": transcript_for(c)}
        for i, c in enumerate(candidates)
        if c["replied"]
    ]

    CANDIDATES_PATH.write_text(json.dumps(candidates, ensure_ascii=False, indent=2))
    PENDING_PATH.write_text(json.dumps(pending, ensure_ascii=False, indent=2))

    print(f"Found {len(candidates)} new conversations, {within_batch_dupes} within-batch duplicates skipped.")
    print("Per campaign:")
    for name, count in sorted(per_campaign.items(), key=lambda kv: -kv[1]):
        print(f"  {name}: {count}")
    print()
    print(f"{len(cross_owner_hits)} people also have an existing conversation under a different owner")
    print("(kept as separate records — different templates/dates confirm independent threads):")
    for name, company, other_owner in cross_owner_hits:
        print(f"  {name} ({company}) — also owned by {other_owner}")
    print()
    print(f"{len(pending)} conversations need classification -> wrote {PENDING_PATH}")
    print(f"wrote {CANDIDATES_PATH} ({len(candidates)} candidates)")
    print(f"Next: classify {PENDING_PATH}'s entries into {CLASSIFICATIONS_PATH}, then run `apply`.")


def apply() -> None:
    candidates = json.loads(CANDIDATES_PATH.read_text())
    classifications = json.loads(CLASSIFICATIONS_PATH.read_text())

    missing = []
    for i, conv in enumerate(candidates):
        conv.pop("_campaign", None)
        if not conv["replied"]:
            conv["sentiment"] = None
            conv["tags"] = []
            continue
        result = classifications.get(str(i))
        if result is None:
            missing.append((i, conv["full_name"]))
            continue
        conv["sentiment"] = result["sentiment"]
        conv["tags"] = result["tags"]

    if missing:
        print(f"ERROR: {len(missing)} replied conversations have no classification entry:")
        for i, name in missing[:20]:
            print(f"  index {i}: {name}")
        sys.exit(1)

    data = json.loads(DATA_JSON.read_text())
    conversations = data["conversations"]
    conversations.extend(candidates)
    data["conversations"] = conversations
    data["daily"] = extract.compute_daily_counts(conversations)
    data["summary"] = extract.compute_summary(conversations)
    DATA_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    print(f"Merged {len(candidates)} conversations into {DATA_JSON} — {len(conversations)} total.")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("prepare", "apply"):
        print("usage: add_lara_campaigns.py {prepare|apply}")
        sys.exit(1)
    {"prepare": prepare, "apply": apply}[sys.argv[1]]()
