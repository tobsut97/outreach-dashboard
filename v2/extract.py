#!/usr/bin/env python3
"""Parse LinkedHelper profile-export CSVs into data.json for the v2 dashboard.

Classifies each replied conversation's sentiment (positive/negative/neutral,
always exactly one) and up to 2 descriptive tags using a local Ollama model —
no data leaves the machine. Results are cached in classify_cache.json so
re-running only classifies new or changed conversations.
"""
import csv
import hashlib
import json
import re
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path

# Add an entry here for each new LinkedHelper CSV export as it arrives.
SOURCES = [
    {
        "owner": "Christian Lutz",
        "path": "/Users/tobias/Downloads/Archive/Profiles downloaded from lh-Christian-Lutz-#533046 at 2026-07-24T07-35-25.780Z.csv",
    },
]

# Messages before this date are dropped, and a conversation left with nothing is dropped
# with them. LinkedIn exports carry years of unrelated personal history for contacts who
# were already connections before any campaign existed. This applies to every entry in
# SOURCES, not just the first one.
HISTORY_CUTOFF = datetime(2023, 1, 1)

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "qwen2.5:7b-instruct"

ALLOWED_TAGS = [
    "meeting_booked",
    "open_to_call",
    "referred_colleague",
    "future_timing",
    "has_existing_solution",
    "no_budget",
    "not_relevant",
    "role_change",
    "no_reason_given",
    "unclear",
]

SYSTEM_PROMPT = f"""You classify replies to a German-language B2B cold outreach campaign \
about carbon-offset/climate projects (Pina Earth). You are given the full conversation \
(owner = the salesperson, prospect = the other person). Classify the PROSPECT's overall \
reply sentiment and up to 2 tags.

sentiment: exactly one of "positive", "negative", "neutral".
- positive: prospect agrees to a call/meeting, asks for a booking link, or otherwise says \
yes to continuing the conversation.
- negative: prospect declines in ANY form, however politely worded. This includes: \
"kein Interesse", "aktuell nicht relevant", "haben schon eine Lösung/Strategie/Partner", \
"kein Budget", "gerade keine Kapazität", or any other soft/polite "no". A polite tone does \
NOT make it neutral — if the substance is a decline, it is negative.
- neutral: prospect does not give a yes or no at all — e.g. only acknowledges receipt, \
asks an unrelated clarifying question, is out of office, or refers the request onward \
without stating their own position.

tags: 0 to 2 values from this fixed list only: {ALLOWED_TAGS}

Examples:
1. Prospect: "Wir haben bereits eine Klimastrategie, die wir verfolgen." -> \
{{"sentiment": "negative", "tags": ["has_existing_solution"]}}
2. Prospect: "Aktuell kein Budget dafür, vielleicht nächstes Jahr wieder." -> \
{{"sentiment": "negative", "tags": ["no_budget", "future_timing"]}}
3. Prospect: "Klingt spannend, schick mir gerne einen Kalenderlink." -> \
{{"sentiment": "positive", "tags": ["open_to_call"]}}
4. Prospect: "Ich bin aktuell im Urlaub, schaue nächste Woche in meinen Kalender." -> \
{{"sentiment": "neutral", "tags": ["unclear"]}}
5. Prospect: "Das ist nicht mein Bereich, wende dich an meine Kollegin Julia." -> \
{{"sentiment": "neutral", "tags": ["referred_colleague"]}}

Respond with strict JSON only: {{"sentiment": "...", "tags": ["..."]}}"""

_MSG_RE = re.compile(
    r"([A-ZÀ-ÞĀ-ſ][A-Za-zÀ-ÿßĀ-ſ\-]+(?: [A-ZÀ-ÞĀ-ſ][A-Za-zÀ-ÿßĀ-ſ\-]+){1,2})"
    r"\s+\[(\d+\.\s+\w+\s+\d{4}\s+\d{1,2}:\d{2}:\d{2})\]\s*"
)

DE_MONTHS = {
    "Januar": 1, "Februar": 2, "März": 3, "April": 4, "Mai": 5, "Juni": 6,
    "Juli": 7, "August": 8, "September": 9, "Oktober": 10, "November": 11, "Dezember": 12,
}


def parse_de_date(s: str) -> datetime | None:
    m = re.match(r"(\d+)\.\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})", s)
    if not m:
        return None
    day, mon, year, h, mi, se = m.groups()
    month = DE_MONTHS.get(mon)
    if not month:
        return None
    return datetime(int(year), month, int(day), int(h), int(mi), int(se))


def parse_iso(s: str) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def build_conversation(row: dict, owner: str) -> dict | None:
    """Parse one CSV row's full_messaging_history into a conversation.

    Messages are kept only if they fall on/after both HISTORY_CUTOFF and the date the row
    was added as a campaign target, which excludes pre-existing personal message history
    for contacts who predate the campaign. A row with no surviving outgoing message is
    dropped by returning None.
    """
    history = (row.get("full_messaging_history") or "").replace("\xa0", " ")
    if not history.strip():
        return None
    floor = parse_iso(row.get("add_to_target_date_iso", ""))

    matches = list(_MSG_RE.finditer(history))
    messages = []
    for i, m in enumerate(matches):
        date = parse_de_date(m.group(2))
        if date is None or date < HISTORY_CUTOFF or (floor and date < floor):
            continue
        text_start = m.end()
        text_end = matches[i + 1].start() if i + 1 < len(matches) else len(history)
        text = history[text_start:text_end].strip()
        if not text:
            continue
        sender = m.group(1).strip()
        messages.append({
            "sender": "owner" if sender == owner else "prospect",
            "sender_name": sender,
            "date": date.isoformat(),
            "text": text,
        })
    if not any(m["sender"] == "owner" for m in messages):
        return None

    return {
        "profile_url": row.get("profile_url", ""),
        "full_name": f"{row.get('original_first_name', '')} {row.get('original_last_name', '')}".strip(),
        "email": row.get("email", ""),
        "company": row.get("original_current_company", ""),
        "position": row.get("original_current_company_position", ""),
        "connected_at": row.get("connected_at_iso", ""),
        "messages": messages,
        "replied": any(m["sender"] == "prospect" for m in messages),
    }


def conversation_cache_key(conv: dict) -> str:
    prospect_text = "\n".join(m["text"] for m in conv["messages"] if m["sender"] == "prospect")
    digest = hashlib.sha256((conv["profile_url"] + "|" + prospect_text).encode()).hexdigest()
    return digest


def classify_reply(conv: dict, cache: dict) -> dict:
    """Classify a replied conversation's sentiment + tags via local Ollama, cached."""
    key = conversation_cache_key(conv)
    if key in cache:
        return cache[key]

    transcript = "\n".join(f"{m['sender']}: {m['text']}" for m in conv["messages"])
    payload = {
        "model": OLLAMA_MODEL,
        "format": "json",
        "stream": False,
        "options": {"temperature": 0},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
        ],
    }
    result = {"sentiment": "neutral", "tags": ["unclear"]}
    try:
        req = urllib.request.Request(
            OLLAMA_URL, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read())
        parsed = json.loads(body["message"]["content"])
        sentiment = parsed.get("sentiment")
        if sentiment in ("positive", "negative", "neutral"):
            tags = [t for t in parsed.get("tags", []) if t in ALLOWED_TAGS][:2]
            result = {"sentiment": sentiment, "tags": tags}
    except Exception as e:
        print(f"  classify failed for {conv['profile_url']}: {e}")

    cache[key] = result
    return result


def compute_daily_counts(conversations: list[dict]) -> dict:
    sent = Counter()
    received = Counter()
    for conv in conversations:
        for m in conv["messages"]:
            day = m["date"][:10]
            if m["sender"] == "owner":
                sent[day] += 1
            else:
                received[day] += 1
    return {"sent": dict(sorted(sent.items())), "received": dict(sorted(received.items()))}


def compute_summary(conversations: list[dict]) -> dict:
    messaged = [c for c in conversations if any(m["sender"] == "owner" for m in c["messages"])]
    replied = [c for c in messaged if c["replied"]]
    sentiment_counts = Counter(c["sentiment"] for c in replied if c.get("sentiment"))
    total_replied = sum(sentiment_counts.values())
    sentiment_share = {
        k: round(100 * v / total_replied, 1) if total_replied else 0
        for k, v in sentiment_counts.items()
    }
    return {
        "total_messaged": len(messaged),
        "total_replied": len(replied),
        "reply_rate": round(100 * len(replied) / len(messaged), 1) if messaged else 0,
        "sentiment_counts": dict(sentiment_counts),
        "sentiment_share": sentiment_share,
    }


DATA_PATH = Path(__file__).parent / "data.json"
CACHE_PATH = Path(__file__).parent / "classify_cache.json"


def merge_and_write(new_conversations: list[dict], owners_replaced: set[str]) -> dict:
    """Write new_conversations into data.json, replacing any existing conversation whose
    owner is in owners_replaced and leaving every other owner's data untouched.

    Both the CLI batch path (main(), below) and server.py's single-profile upload path
    call this, so a CLI run for one profile can never silently delete another profile
    that was added through the other path — each write only ever owns its own owners.
    """
    existing = json.loads(DATA_PATH.read_text()) if DATA_PATH.exists() else {}
    kept = [c for c in existing.get("conversations", []) if c.get("owner") not in owners_replaced]
    conversations = kept + new_conversations

    data = {
        "conversations": conversations,
        "daily": compute_daily_counts(conversations),
        "summary": compute_summary(conversations),
    }
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return data


def main() -> None:
    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}

    conversations = []
    for source in SOURCES:
        path = Path(source["path"])
        rows = list(csv.DictReader(path.open(newline="", encoding="utf-8")))
        before = len(conversations)
        to_classify = 0
        for row in rows:
            conv = build_conversation(row, source["owner"])
            if conv is None:
                continue
            conv["owner"] = source["owner"]
            if conv["replied"]:
                was_cached = conversation_cache_key(conv) in cache
                result = classify_reply(conv, cache)
                conv["sentiment"] = result["sentiment"]
                conv["tags"] = result["tags"]
                if not was_cached:
                    to_classify += 1
                    if to_classify % 5 == 0:
                        CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
                    print(f"  classified {to_classify}: {conv['full_name']} -> {result}", flush=True)
            else:
                conv["sentiment"] = None
                conv["tags"] = []
            conversations.append(conv)
        print(f"{source['owner']}: {len(rows)} rows -> {len(conversations) - before} conversations with a real sent message", flush=True)

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2))

    owners_replaced = {source["owner"] for source in SOURCES}
    data = merge_and_write(conversations, owners_replaced)
    print(f"wrote {DATA_PATH} — {len(data['conversations'])} total conversations, this run's summary: {compute_summary(conversations)}")


if __name__ == "__main__":
    main()
