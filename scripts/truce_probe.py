#!/usr/bin/env python3
"""Truce-by-Taste data probe. Run in your own Terminal (Cursor sandbox blocks the API).

Usage:
  cd ~/Desktop/Qloo
  set -a && source .env && set +a
  python3 scripts/truce_probe.py

Writes JSON + a short markdown verdict under probe-output/.
Never prints the API key.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BASE = os.environ.get("QLOO_BASE_URL", "https://hackathon.api.qloo.com").rstrip("/")
KEY = os.environ.get("QLOO_API_KEY", "").strip()
OUT = Path(__file__).resolve().parents[1] / "probe-output"
TYPES = ("urn:entity:artist", "urn:entity:brand", "urn:entity:place")
TAKE = 25


def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def get(path: str, params: dict | None = None, *, fatal: bool = True) -> dict:
    if not KEY:
        die("QLOO_API_KEY is not set. source .env first.")
    q = urllib.parse.urlencode(params or {}, doseq=True)
    url = f"{BASE}{path}" + (f"?{q}" if q else "")
    req = urllib.request.Request(url, headers={"X-Api-Key": KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        msg = f"HTTP {e.code} on {path}: {body[:800]}"
        if fatal:
            die(msg)
        print(f"  warn: {msg}")
        return {"_error": msg, "_status": e.code}
    except urllib.error.URLError as e:
        msg = f"Network error on {path}: {e}"
        if fatal:
            die(msg)
        print(f"  warn: {msg}")
        return {"_error": msg}


def entities_from(payload: dict) -> list[dict]:
    for key in ("entities", "results", "audiences", "data"):
        val = payload.get(key)
        if isinstance(val, list):
            return [x for x in val if isinstance(x, dict)]
        if isinstance(val, dict):
            for nested in ("entities", "results", "audiences"):
                if isinstance(val.get(nested), list):
                    return [x for x in val[nested] if isinstance(x, dict)]
    # some responses nest under success/results
    success = payload.get("success")
    if isinstance(success, dict):
        return entities_from(success)
    return []


def name_of(item: dict) -> str:
    props = item.get("properties") if isinstance(item.get("properties"), dict) else {}
    return (
        item.get("name")
        or props.get("name")
        or item.get("title")
        or item.get("id")
        or "?"
    )


def id_of(item: dict) -> str:
    return str(item.get("entity_id") or item.get("id") or item.get("urn") or "")


def affinity_of(item: dict) -> float | None:
    for key in ("affinity", "query.affinity", "score"):
        if key in item and isinstance(item[key], (int, float)):
            return float(item[key])
    q = item.get("query")
    if isinstance(q, dict) and isinstance(q.get("affinity"), (int, float)):
        return float(q["affinity"])
    return None


def list_political_audiences():
    # Find Audiences requires at least one of the documented filters.
    # Parent-type filter name differs across docs; try both, then query.
    attempts = [
        {
            "filter.audience.types": "urn:audience:political_preferences",
            "take": "50",
        },
        {
            "filter.parents.types": "urn:audience:political_preferences",
            "take": "50",
        },
        {"filter.query": "conservative", "take": "20"},
        {"filter.query": "liberal", "take": "20"},
        {"filter.query": "republican", "take": "20"},
        {"filter.query": "democrat", "take": "20"},
        {"filter.query": "political", "take": "20"},
    ]
    seen: dict[str, dict] = {}
    raw_dumps = []
    for params in attempts:
        print(f"  try /v2/audiences {params}")
        payload = get("/v2/audiences", params, fatal=False)
        raw_dumps.append(
            {
                "params": params,
                "error": payload.get("_error"),
                "sample_keys": [k for k in payload.keys() if not k.startswith("_")],
                "entity_count": len(entities_from(payload)),
            }
        )
        if payload.get("_error"):
            continue
        for a in entities_from(payload):
            aid = id_of(a)
            if aid and aid not in seen:
                seen[aid] = a
    types_payload = get("/v2/audiences/types", {"take": "50"}, fatal=False)
    if not seen:
        return [], types_payload, raw_dumps
    return list(seen.values()), types_payload, raw_dumps


def pick_pair(audiences: list[dict]) -> tuple[dict, dict] | None:
    """Heuristic: prefer names that look opposing. Fallback: first two."""
    names = [(a, name_of(a).lower()) for a in audiences]
    left_keys = ("liberal", "democrat", "progressive", "left", "blue")
    right_keys = ("conservative", "republican", "right", "maga", "red", "libertarian")

    def score(name: str, keys: tuple[str, ...]) -> int:
        return sum(1 for k in keys if k in name)

    left = sorted(names, key=lambda x: score(x[1], left_keys), reverse=True)
    right = sorted(names, key=lambda x: score(x[1], right_keys), reverse=True)
    if left and right and id_of(left[0][0]) != id_of(right[0][0]):
        if score(left[0][1], left_keys) or score(right[0][1], right_keys):
            return left[0][0], right[0][0]
    if len(audiences) >= 2:
        return audiences[0], audiences[1]
    return None


def insights_for_audience(audience_id: str, entity_type: str) -> list[dict]:
    payload = get(
        "/v2/insights",
        {
            "filter.type": entity_type,
            "signal.demographics.audiences": audience_id,
            "take": str(TAKE),
        },
    )
    return entities_from(payload)


def summarize(label: str, by_type: dict[str, list[dict]]) -> dict[str, list[dict]]:
    out = {}
    for t, ents in by_type.items():
        rows = []
        for e in ents:
            rows.append(
                {
                    "name": name_of(e),
                    "id": id_of(e),
                    "affinity": affinity_of(e),
                    "type": t,
                }
            )
        out[t] = rows
    return out


def overlap(a: dict[str, list[dict]], b: dict[str, list[dict]]) -> dict:
    result = {}
    for t in TYPES:
        map_a = {r["name"].lower(): r for r in a.get(t, []) if r.get("name")}
        map_b = {r["name"].lower(): r for r in b.get(t, []) if r.get("name")}
        shared = []
        for key in sorted(set(map_a) & set(map_b)):
            shared.append(
                {
                    "name": map_a[key]["name"],
                    "id_a": map_a[key]["id"],
                    "id_b": map_b[key]["id"],
                    "affinity_a": map_a[key]["affinity"],
                    "affinity_b": map_b[key]["affinity"],
                    "type": t,
                }
            )
        result[t] = shared
    return result


def is_generic(name: str) -> bool:
    n = name.lower()
    generics = (
        "taylor swift",
        "beyoncé",
        "beyonce",
        "drake",
        "nike",
        "apple",
        "amazon",
        "starbucks",
        "coca-cola",
        "coca cola",
        "mcdonald",
        "netflix",
        "spotify",
        "disney",
        "google",
        "facebook",
        "instagram",
        "youtube",
        "walmart",
        "target",
    )
    return any(g in n for g in generics)


def verdict(shared: dict) -> tuple[str, str]:
    all_shared = [x for rows in shared.values() for x in rows]
    if not all_shared:
        return "WAKE", "No name overlap in top results. Data does not support Truce."
    specific = [x for x in all_shared if not is_generic(x["name"])]
    if not specific:
        return (
            "WAKE",
            f"Overlap exists but only global defaults ({', '.join(x['name'] for x in all_shared[:8])}). Boring intersection — cannot be saved with copy.",
        )
    sample = ", ".join(x["name"] for x in specific[:8])
    return (
        "TRUCE",
        f"Specific overlap looks real ({sample}). Build the bridge card.",
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    print(f"Base URL: {BASE}")
    print("Listing political_preferences audiences…")

    audiences, types_payload, raw_dumps = list_political_audiences()
    catalog = [
        {"name": name_of(a), "id": id_of(a)}
        for a in audiences
    ]
    print(f"Found {len(catalog)} audiences.")
    for row in catalog[:30]:
        print(f"  - {row['name']}  ({row['id']})")

    report: dict = {
        "stamp": stamp,
        "base_url": BASE,
        "audience_catalog": catalog,
        "raw_list_attempts": raw_dumps,
    }
    if types_payload is not None:
        report["audience_types_fallback"] = types_payload

    if len(audiences) < 2:
        report["verdict"] = "WAKE"
        report["reason"] = "Fewer than 2 political audiences returned. Cannot probe Truce."
        path = OUT / f"truce-probe-{stamp}.json"
        path.write_text(json.dumps(report, indent=2))
        (OUT / "LATEST_VERDICT.md").write_text(
            f"# Truce probe → WAKE\n\n{report['reason']}\n\nSee `{path.name}`.\n"
        )
        print("\nVERDICT: WAKE — not enough audience data.")
        print(f"Wrote {path}")
        return

    pair = pick_pair(audiences)
    assert pair is not None
    a, b = pair
    print(f"\nComparing:\n  A: {name_of(a)} ({id_of(a)})\n  B: {name_of(b)} ({id_of(b)})")

    by_a: dict[str, list[dict]] = {}
    by_b: dict[str, list[dict]] = {}
    for t in TYPES:
        short = t.split(":")[-1]
        print(f"  insights {short} for A…")
        by_a[t] = insights_for_audience(id_of(a), t)
        print(f"  insights {short} for B…")
        by_b[t] = insights_for_audience(id_of(b), t)

    sum_a = summarize(name_of(a), by_a)
    sum_b = summarize(name_of(b), by_b)
    shared = overlap(sum_a, sum_b)
    decision, reason = verdict(shared)

    report.update(
        {
            "group_a": {"name": name_of(a), "id": id_of(a)},
            "group_b": {"name": name_of(b), "id": id_of(b)},
            "top_a": sum_a,
            "top_b": sum_b,
            "overlap": shared,
            "overlap_counts": {t: len(shared[t]) for t in TYPES},
            "verdict": decision,
            "reason": reason,
        }
    )

    path = OUT / f"truce-probe-{stamp}.json"
    path.write_text(json.dumps(report, indent=2))
    md = [
        f"# Truce probe → {decision}",
        "",
        f"**A:** {name_of(a)}",
        f"**B:** {name_of(b)}",
        "",
        reason,
        "",
        "## Overlap counts",
        "",
    ]
    for t in TYPES:
        md.append(f"- `{t}`: {len(shared[t])}")
        for row in shared[t][:10]:
            md.append(
                f"  - {row['name']} (A affinity={row['affinity_a']}, B affinity={row['affinity_b']})"
            )
    md.append("")
    md.append(f"Full dump: `{path.name}`")
    (OUT / "LATEST_VERDICT.md").write_text("\n".join(md) + "\n")

    print(f"\nVERDICT: {decision}")
    print(reason)
    print(f"Wrote {path}")
    print(f"Wrote {OUT / 'LATEST_VERDICT.md'}")


if __name__ == "__main__":
    main()
