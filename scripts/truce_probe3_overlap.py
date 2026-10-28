#!/usr/bin/env python3
"""Find apolitical OVERLAP between left/right media-diet proxies.

Probe2 proved differentiation. Truce needs shared entities that are NOT news.

Usage:
  cd ~/Desktop/Qloo && set -a && source .env && set +a
  export QLOO_BASE_URL=https://hackathon.api.qloo.com
  python3 scripts/truce_probe3_overlap.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = os.environ.get("QLOO_BASE_URL", "https://hackathon.api.qloo.com").rstrip("/")
KEY = os.environ.get("QLOO_API_KEY", "").strip()
OUT = Path(__file__).resolve().parents[1] / "probe-output"

LEFT = [
    "A34AD40F-6B5F-48D3-A159-53FF7C544575",  # MSNBC
    "46DB54ED-CBA2-4F52-9512-EAA9B7C2CB69",  # NYT
    "36A3F981-5BFB-45B5-A8CF-A16F273B04F0",  # NPR
]
RIGHT = [
    "F1AA9F1A-6594-48E0-980C-14C52EE247A0",  # Fox News
    "8C07C9D4-3B47-4138-902B-C9B9E150FACF",  # WSJ
    "836040EE-D964-48AC-9D39-E1023174A8B9",  # Blaze Media
]

TYPES = [
    "urn:entity:artist",
    "urn:entity:brand",
    "urn:entity:movie",
    "urn:entity:tv_show",
    "urn:entity:book",
    "urn:entity:place",
]

NEWSY = (
    "news",
    "times",
    "post",
    "cnn",
    "fox",
    "msnbc",
    "npr",
    "reuters",
    "politico",
    "huffpost",
    "atlantic",
    "new yorker",
    "forbes",
    "bloomberg",
    "wsj",
    "wall street",
    "blaze",
    "cato",
    "judicial watch",
    "weather channel",
    "cbs news",
    "abc news",
    "nbc news",
    "bbc",
    "guardian",
)


def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def get(path: str, params: dict) -> dict:
    if not KEY:
        die("QLOO_API_KEY missing")
    url = f"{BASE}{path}?{urllib.parse.urlencode(params, doseq=True)}"
    req = urllib.request.Request(url, headers={"X-Api-Key": KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"_error": f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:600]}"}
    except urllib.error.URLError as e:
        return {"_error": str(e)}


def entities(payload: dict) -> list[dict]:
    if payload.get("_error"):
        return []
    res = payload.get("results")
    if isinstance(res, dict) and isinstance(res.get("entities"), list):
        return res["entities"]
    if isinstance(payload.get("entities"), list):
        return payload["entities"]
    return []


def row(e: dict, typ: str) -> dict:
    q = e.get("query") if isinstance(e.get("query"), dict) else {}
    return {
        "name": e.get("name") or "?",
        "id": e.get("entity_id") or e.get("id"),
        "affinity": q.get("affinity", e.get("affinity")),
        "popularity": e.get("popularity"),
        "type": typ,
    }


def is_newsy(name: str) -> bool:
    n = name.lower()
    return any(x in n for x in NEWSY)


def fetch(side_ids: list[str], typ: str, take: int = 50) -> list[dict]:
    params = {
        "filter.type": typ,
        "signal.interests.entities": ",".join(side_ids),
        "filter.popularity.min": "0.2",
        "take": str(take),
    }
    # places need a real geo; skip invalid WKT — use destination instead for travel vibe
    if typ == "urn:entity:place":
        params["filter.geocode.name"] = "United States"
    payload = get("/v2/insights", params)
    if payload.get("_error"):
        print(f"  warn {typ}: {payload['_error']}")
        return []
    return [row(e, typ) for e in entities(payload)]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report = {"stamp": stamp, "left": "MSNBC+NYT+NPR", "right": "Fox+WSJ+Blaze", "by_type": {}}

    all_bridges = []
    for typ in TYPES:
        short = typ.split(":")[-1]
        print(f"\n=== {short} ===")
        a = fetch(LEFT, typ)
        b = fetch(RIGHT, typ)
        map_a = {r["name"].lower(): r for r in a}
        map_b = {r["name"].lower(): r for r in b}
        shared_keys = sorted(set(map_a) & set(map_b))
        shared = []
        for k in shared_keys:
            item = {
                "name": map_a[k]["name"],
                "id": map_a[k]["id"],
                "affinity_left": map_a[k]["affinity"],
                "affinity_right": map_b[k]["affinity"],
                "type": typ,
                "newsy": is_newsy(map_a[k]["name"]),
            }
            shared.append(item)
        apolitical = [s for s in shared if not s["newsy"]]
        print(f"  left {len(a)} | right {len(b)} | shared {len(shared)} | apolitical shared {len(apolitical)}")
        for s in apolitical[:12]:
            print(
                f"  BRIDGE  {s['name']!r:40} L={s['affinity_left']} R={s['affinity_right']}"
            )
        for s in [x for x in shared if x["newsy"]][:5]:
            print(f"  (skip news) {s['name']}")
        report["by_type"][typ] = {
            "left_top": a[:15],
            "right_top": b[:15],
            "shared": shared,
            "apolitical_shared": apolitical,
        }
        all_bridges.extend(apolitical)

    # Rank bridges by min(affinity_left, affinity_right) descending
    def score(s):
        la = s["affinity_left"] or 0
        ra = s["affinity_right"] or 0
        return min(float(la), float(ra))

    all_bridges.sort(key=score, reverse=True)
    top = all_bridges[:20]
    print("\n=== TOP APOLITICAL BRIDGES ===")
    for s in top:
        print(f"  {s['type'].split(':')[-1]:7} {s['name']!r:40} min_aff={score(s):.4f}")

    if len(all_bridges) >= 3 and score(top[0]) >= 0.5:
        decision = "TRUCE"
        reason = (
            f"Found {len(all_bridges)} apolitical shared entities across media-diet proxies. "
            f"Top bridge: {top[0]['name']} ({top[0]['type']}). "
            "Build Truce on media-diet presets → cross-domain overlap card. "
            "Do NOT use political_preferences audiences."
        )
    elif len(all_bridges) >= 1:
        decision = "TRUCE_THIN"
        reason = (
            f"Only {len(all_bridges)} apolitical bridges; top={top[0]['name'] if top else 'none'}. "
            "Possible but thin — Wake is safer for a Friday ship unless you want to lean into classic-rock / Americana overlap storytelling."
        )
    else:
        decision = "WAKE"
        reason = "No apolitical name overlap in top-50 per type. Switch to Wake."

    report.update({"top_bridges": top, "decision": decision, "reason": reason})
    path = OUT / f"truce-probe3-{stamp}.json"
    path.write_text(json.dumps(report, indent=2))
    md = [f"# Truce probe 3 → {decision}", "", reason, "", "## Top apolitical bridges", ""]
    for s in top[:15]:
        md.append(
            f"- **{s['name']}** (`{s['type']}`) L={s['affinity_left']} R={s['affinity_right']}"
        )
    md.append(f"\nFull: `{path.name}`\n")
    (OUT / "LATEST_VERDICT.md").write_text("\n".join(md))
    print(f"\nVERDICT: {decision}")
    print(reason)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
