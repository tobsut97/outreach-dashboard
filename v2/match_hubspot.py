#!/usr/bin/env python3
"""Match HubSpot lead/deal CSV exports onto data.json's LinkedIn conversations.

Neither HubSpot export carries an email or LinkedIn URL, so the join is a fuzzy
name+company match: leads carry the contact's full name in "Primary Associated
Object Name", scored against each conversation's full_name/company. Deals carry no
foreign key back to a lead at all, so a deal's company (parsed from "Deal Name" or
"Invoice name of Company") is fuzzy-matched against each lead's "Company" field.

Every match is tagged "high" or "medium" confidence; low-scoring pairs are left
unmatched rather than guessed at. Unmatched leads/deals still count in `aggregate`,
which totals every CSV row regardless of match — only `matches` is the
conversation-attributable subset. Re-run whenever fresh CSVs are exported; this is
independent of extract.py's slower LinkedIn/Ollama pipeline.
"""
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

SOURCES = {
    "leads": "/Users/tobias/Downloads/260730-all-leads.csv",
    "deals": "/Users/tobias/Downloads/260730-all-deals.csv",
}

DATA_JSON = Path(__file__).parent / "data.json"
OUT_PATH = Path(__file__).parent / "hubspot.json"

# combined = 0.6 * name_score + 0.4 * company_score (name is more discriminating: many
# prospects share an employer, so company alone under-distinguishes people).
NAME_WEIGHT = 0.6
COMPANY_WEIGHT = 0.4
HIGH_COMBINED = 0.90
HIGH_COMPANY_FLOOR = 0.75  # guards against two same-named people at different companies
MEDIUM_COMBINED = 0.75

UMLAUT_MAP = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})
LEGAL_SUFFIX_RE = re.compile(r"\b(gmbh|mbh|ag|se|kg|inc|ltd|llc|co)\b\.?")
WHITESPACE_RE = re.compile(r"\s+")
DEAL_PREFIX_RE = re.compile(r"^\([a-z]{2,3}\)\s*")

BANT_FIELDS = ["Authority", "Budget", "Need", "Timeline"]
BANT_VALUES = ["Yes", "No", "Maybe", "TBD", "blank"]
LEAD_STAGES = ["Disqualified", "Qualified", "New"]
LEAD_QUALITIES = ["Low", "Medium", "High", "blank"]
DEAL_STAGES = ["Closed lost", "Closed won", "Qualified", "Proposal", "Negotiation"]


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def normalize_name(s: str) -> str:
    s = (s or "").strip().lower().translate(UMLAUT_MAP)
    s = strip_accents(s)
    return WHITESPACE_RE.sub(" ", s).strip()


def normalize_company(s: str) -> str:
    s = normalize_name(s)
    s = LEGAL_SUFFIX_RE.sub("", s)
    return WHITESPACE_RE.sub(" ", s).strip()


def parse_deal_company(deal_name: str) -> str:
    s = (deal_name or "").strip().lower()
    s = DEAL_PREFIX_RE.sub("", s)
    return s.split(" - ")[0].strip()


def ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def match_score(lead_name: str, lead_company: str, conv_name: str, conv_company: str) -> tuple[float, float | None]:
    """company_score is None (not 0) when either side has no company on file — a missing
    company must not drag down or corroborate an otherwise-good name match."""
    name_score = ratio(normalize_name(lead_name), normalize_name(conv_name))
    norm_lead_company = normalize_company(lead_company)
    norm_conv_company = normalize_company(conv_company)
    if norm_lead_company and norm_conv_company:
        company_score = ratio(norm_lead_company, norm_conv_company)
        combined = NAME_WEIGHT * name_score + COMPANY_WEIGHT * company_score
    else:
        company_score = None
        combined = name_score
    return combined, company_score


def confidence_for(combined: float, company_score: float | None) -> str | None:
    if company_score is None:
        # No company on one side to corroborate against — require a stricter name-only bar.
        # Same-first-name-different-surname pairs ("Christin Schneider" / "Christian Scheibe")
        # commonly land around 0.86-0.89, so the medium floor sits above that band; a
        # middle-initial addition ("Hannes Krieg" / "Hannes M. Krieg") scores ~0.92 and still
        # clears it.
        if combined >= 0.97:
            return "high"
        if combined >= 0.90:
            return "medium"
        return None
    if combined >= HIGH_COMBINED and company_score >= HIGH_COMPANY_FLOOR:
        return "high"
    if combined >= MEDIUM_COMBINED:
        return "medium"
    return None


def conversation_key(conv: dict) -> str:
    return conv.get("profile_url") or conv.get("email") or conv.get("full_name") or ""


def blank_or(value: str, allowed: list[str]) -> str:
    value = (value or "").strip()
    return value if value in allowed else "blank"


def bant_value(value: str) -> str | None:
    value = (value or "").strip()
    return value if value in ("Yes", "No", "Maybe", "TBD") else None


def load_conversations() -> list[dict]:
    data = json.loads(DATA_JSON.read_text())
    return data["conversations"]


def load_csv(path: str) -> list[dict]:
    return list(csv.DictReader(Path(path).open(newline="", encoding="utf-8")))


def match_leads_to_conversations(leads: list[dict], conversations: list[dict]) -> dict[str, dict]:
    """Best-scoring conversation per lead, blocked by normalized company to avoid an
    all-pairs scan. Returns {lead_record_id: {"conversation_key", "confidence", "score"}}."""
    by_company = defaultdict(list)
    for conv in conversations:
        by_company[normalize_company(conv.get("company", ""))].append(conv)

    result = {}
    for lead in leads:
        lead_name = lead.get("Primary Associated Object Name", "")
        lead_company = lead.get("Company", "")
        norm_company = normalize_company(lead_company)
        # Company-blocked candidates when the normalized company lands in an existing
        # bucket; otherwise fall back to a full scan — a blank lead company (~3.5% of
        # leads) or a company spelled differently on each side both need this, since a
        # narrower fuzzy match must still be found by name even without an exact bucket hit.
        candidates = (by_company.get(norm_company) or conversations) if norm_company else conversations

        best = None
        for conv in candidates:
            combined, company_score = match_score(
                lead_name, lead_company, conv.get("full_name", ""), conv.get("company", "")
            )
            if best is None or combined > best[0]:
                best = (combined, company_score, conv)

        if best is None:
            continue
        combined, company_score, conv = best
        confidence = confidence_for(combined, company_score)
        if confidence:
            result[lead["Record ID"]] = {
                "conversation_key": conversation_key(conv),
                "confidence": confidence,
                "score": round(combined, 4),
                "lead_name": lead_name,
                "conv_name": conv.get("full_name", ""),
            }
    return result


def match_deals_to_leads(deals: list[dict], leads: list[dict]) -> dict[str, list[dict]]:
    """All deals scoring >= medium against a lead's company (a company can have several
    deals over time), keyed by lead Record ID."""
    result = defaultdict(list)
    for deal in deals:
        invoice_name = deal.get("Invoice name of Company", "").strip()
        deal_company = invoice_name if invoice_name else parse_deal_company(deal.get("Deal Name", ""))
        norm_deal_company = normalize_company(deal_company)
        if not norm_deal_company:
            continue
        for lead in leads:
            company_score = ratio(norm_deal_company, normalize_company(lead.get("Company", "")))
            confidence = confidence_for(company_score, company_score)
            if confidence:
                result[lead["Record ID"]].append({
                    "deal_record_id": deal["Record ID"],
                    "match_confidence": confidence,
                    "match_score": round(company_score, 4),
                    "deal_stage": deal.get("Deal Stage", ""),
                    "amount": float(deal.get("Amount") or 0),
                    "close_date": (deal.get("Close Date") or "")[:10] or None,
                    "is_closed_won": deal.get("Is Closed Won", "").lower() == "true",
                    "is_closed_lost": deal.get("Is closed lost", "").lower() == "true",
                    "is_open": deal.get("Is Open (numeric)", "0") == "1.0",
                    "deal_owner": deal.get("Deal owner", ""),
                })
    return result


def build_aggregate(leads: list[dict], deals: list[dict]) -> dict:
    leads_by_stage = Counter(l.get("Lead stage", "") for l in leads)
    leads_by_quality = Counter(blank_or(l.get("Lead Quality", ""), LEAD_QUALITIES[:-1]) for l in leads)

    bant_breakdown = {}
    for field in BANT_FIELDS:
        counts = Counter(blank_or(l.get(field, ""), BANT_VALUES[:-1]) for l in leads)
        bant_breakdown[field.lower()] = {v: counts.get(v, 0) for v in BANT_VALUES}

    deals_by_stage = Counter(d.get("Deal Stage", "") for d in deals)
    deals_amount_by_stage = defaultdict(float)
    for d in deals:
        deals_amount_by_stage[d.get("Deal Stage", "")] += float(d.get("Amount") or 0)

    return {
        "leads_by_stage": {s: leads_by_stage.get(s, 0) for s in LEAD_STAGES},
        "leads_by_quality": {q: leads_by_quality.get(q, 0) for q in LEAD_QUALITIES},
        "bant_breakdown": bant_breakdown,
        "deals_by_stage": {s: deals_by_stage.get(s, 0) for s in DEAL_STAGES},
        "deals_amount_by_stage": {s: round(deals_amount_by_stage.get(s, 0), 2) for s in DEAL_STAGES},
        "total_leads": len(leads),
        "total_deals": len(deals),
    }


def main() -> None:
    conversations = load_conversations()
    leads = load_csv(SOURCES["leads"])
    deals = load_csv(SOURCES["deals"])

    lead_conv_matches = match_leads_to_conversations(leads, conversations)
    lead_deal_matches = match_deals_to_leads(deals, leads)

    matches = []
    for lead in leads:
        conv_match = lead_conv_matches.get(lead["Record ID"])
        if not conv_match:
            continue
        matches.append({
            "conversation_key": conv_match["conversation_key"],
            "lead_record_id": lead["Record ID"],
            "match_confidence": conv_match["confidence"],
            "match_score": conv_match["score"],
            "_debug_lead_name": conv_match["lead_name"],
            "_debug_conv_name": conv_match["conv_name"],
            "company": lead.get("Company", ""),
            "authority": bant_value(lead.get("Authority", "")),
            "budget": bant_value(lead.get("Budget", "")),
            "need": bant_value(lead.get("Need", "")),
            "timeline": bant_value(lead.get("Timeline", "")),
            "bant_disqualification_reasons": lead.get("BANT Disqualification Reasons") or None,
            "lead_score": float(lead.get("Lead Score") or 0),
            "lead_quality": (lead.get("Lead Quality") or "").strip() or None,
            "lead_stage": lead.get("Lead stage", ""),
            "is_open": lead.get("Is Open", "").lower() == "true",
            "lead_owner": lead.get("Lead Owner", ""),
            "deals": lead_deal_matches.get(lead["Record ID"], []),
        })

    high = [m for m in matches if m["match_confidence"] == "high"]
    medium = [m for m in matches if m["match_confidence"] == "medium"]
    print(f"{len(leads)} leads, {len(deals)} deals, {len(conversations)} conversations")
    print(f"matched {len(matches)} leads to conversations ({len(high)} high, {len(medium)} medium)")
    print(f"unmatched leads: {len(leads) - len(matches)}")
    def describe(m: dict) -> str:
        return (
            f"  [{m['match_score']}] lead={m['_debug_lead_name']!r} "
            f"conv={m['_debug_conv_name']!r} company={m['company']!r}"
        )

    print()
    print("--- sample high-confidence matches ---")
    for m in high[:15]:
        print(describe(m))
    print()
    print("--- sample medium-confidence matches ---")
    for m in medium[:15]:
        print(describe(m))

    for m in matches:
        del m["_debug_lead_name"], m["_debug_conv_name"]

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "matches": matches,
        "unmatched_leads_count": len(leads) - len(matches),
        "aggregate": build_aggregate(leads, deals),
    }
    OUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"\nwrote {OUT_PATH}")


if __name__ == "__main__":
    main()
