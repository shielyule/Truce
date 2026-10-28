#!/usr/bin/env python3
"""Second-pass Truce probe. The first pass found identical Progressive/Conservative
lists — that is NOT a bridge. This checks whether any query shape differentiates.

Usage (your Terminal):
  cd ~/Desktop/Qloo && set -a && source .env && set +a
  export QLOO_BASE_URL=https://hackathon.api.qloo.com
  python3 scripts/truce_probe2.py
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

PROG = "B3A035FD-0D99-4980-98FD-A5B81D7E402A"
CONS = "555258C9-2696-496A-B1C1-C46A6F7795C8"


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
        body = e.read().decode("utf-8", errors="replace")
        return {"_error": f"HTTP {e.code}: {body[:500]}"}
    except urllib.error.URLError as e:
        return {"_error": str(e)}


def entities(payload: dict) -> list[dict]:
    if payload.get("_error"):
        return []
    res = payload.get("results")
    if isinstance(res, dict) and isinstance(res.get("entities"), list):
        return res["entities"]
    if isinstance(res, list):
        return [x for x in res if isinstance(x, dict)]
    if isinstance(payload.get("entities"), list):
        return payload["entities"]
    return []


def names(payload: dict, n: int = 10) -> list[str]:
    out = []
    for e in entities(payload)[:n]:
        out.append(e.get("name") or "?")
    return out


def affs(payload: dict) -> set:
    s = set()
    for e in entities(payload):
        q = e.get("query") if isinstance(e.get("query"), dict) else {}
        if isinstance(q.get("affinity"), (int, float)):
            s.add(round(float(q["affinity"]), 6))
        elif isinstance(e.get("affinity"), (int, float)):
            s.add(round(float(e["affinity"]), 6))
    return s


def run(label: str, params_a: dict, params_b: dict) -> dict:
    print(f"\n=== {label} ===")
    a = get("/v2/insights", params_a)
    b = get("/v2/insights", params_b)
    if a.get("_error") or b.get("_error"):
        print("  A error:", a.get("_error"))
        print("  B error:", b.get("_error"))
        return {"label": label, "error": True, "a": a.get("_error"), "b": b.get("_error")}
    na, nb = names(a), names(b)
    identical = na == nb
    print("  A:", na)
    print("  B:", nb)
    print("  identical:", identical, "| aff_a:", affs(a), "| aff_b:", affs(b))
    return {
        "label": label,
        "identical": identical,
        "a_names": na,
        "b_names": nb,
        "a_affs": sorted(affs(a)),
        "b_affs": sorted(affs(b)),
        "differentiated": not identical,
    }


def search_entity(query: str, typ: str | None = None) -> str | None:
    params = {"query": query, "take": "3"}
    if typ:
        params["types"] = typ
    payload = get("/search", params)
    if payload.get("_error"):
        print(f"  search fail {query}: {payload['_error']}")
        return None
    # search shapes vary
    res = payload.get("results") or payload.get("entities") or []
    if isinstance(payload.get("results"), dict):
        res = payload["results"].get("entities") or payload["results"].get("search") or []
    if isinstance(res, list) and res:
        e = res[0]
        eid = e.get("entity_id") or e.get("id")
        print(f"  search {query!r} -> {e.get('name')} ({eid})")
        return eid
    print(f"  search {query!r} -> none", list(payload.keys()))
    return None


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    results = []

    # 1) Same as probe1 — confirm broken baseline
    results.append(
        run(
            "artists audience-only",
            {"filter.type": "urn:entity:artist", "signal.demographics.audiences": PROG, "take": "10"},
            {"filter.type": "urn:entity:artist", "signal.demographics.audiences": CONS, "take": "10"},
        )
    )

    # 2) Popularity floor — escape long-tail soup
    for t in ("urn:entity:artist", "urn:entity:brand", "urn:entity:movie", "urn:entity:tv_show", "urn:entity:book"):
        results.append(
            run(
                f"{t} + popularity.min=0.4",
                {
                    "filter.type": t,
                    "signal.demographics.audiences": PROG,
                    "filter.popularity.min": "0.4",
                    "take": "10",
                },
                {
                    "filter.type": t,
                    "signal.demographics.audiences": CONS,
                    "filter.popularity.min": "0.4",
                    "take": "10",
                },
            )
        )

    # 3) Location-scoped places
    results.append(
        run(
            "places in Columbus OH",
            {
                "filter.type": "urn:entity:place",
                "signal.demographics.audiences": PROG,
                "filter.location": "Columbus, OH",
                "take": "10",
            },
            {
                "filter.type": "urn:entity:place",
                "signal.demographics.audiences": CONS,
                "filter.location": "Columbus, OH",
                "take": "10",
            },
        )
    )

    # 4) Entity-proxy tribes via analysis/compare if we can resolve media brands
    print("\n=== entity proxy resolve ===")
    left_ids = []
    right_ids = []
    for q, typ in (("MSNBC", "urn:entity:brand"), ("The New York Times", "urn:entity:brand"), ("NPR", "urn:entity:brand")):
        eid = search_entity(q, typ)
        if eid:
            left_ids.append(eid)
    for q, typ in (("Fox News", "urn:entity:brand"), ("The Wall Street Journal", "urn:entity:brand"), ("The Blaze", "urn:entity:brand")):
        eid = search_entity(q, typ)
        if eid:
            right_ids.append(eid)

    if left_ids and right_ids:
        # insights biased by entity signals instead of audiences
        results.append(
            run(
                "artists via media-brand entity signals",
                {
                    "filter.type": "urn:entity:artist",
                    "signal.interests.entities": ",".join(left_ids),
                    "filter.popularity.min": "0.3",
                    "take": "10",
                },
                {
                    "filter.type": "urn:entity:artist",
                    "signal.interests.entities": ",".join(right_ids),
                    "filter.popularity.min": "0.3",
                    "take": "10",
                },
            )
        )
        results.append(
            run(
                "brands via media-brand entity signals",
                {
                    "filter.type": "urn:entity:brand",
                    "signal.interests.entities": ",".join(left_ids),
                    "filter.popularity.min": "0.3",
                    "take": "10",
                },
                {
                    "filter.type": "urn:entity:brand",
                    "signal.interests.entities": ",".join(right_ids),
                    "filter.popularity.min": "0.3",
                    "take": "10",
                },
            )
        )
        # analysis compare endpoint
        print("\n=== /v2/analysis/compare ===")
        cmp_payload = get(
            "/v2/analysis/compare",
            {
                "a.signal.interests.entities": ",".join(left_ids),
                "b.signal.interests.entities": ",".join(right_ids),
            },
        )
        if cmp_payload.get("_error"):
            print("  compare error:", cmp_payload["_error"])
            results.append({"label": "analysis_compare", "error": cmp_payload["_error"]})
        else:
            print("  compare keys:", list(cmp_payload.keys()))
            print("  compare preview:", json.dumps(cmp_payload, indent=2)[:2000])
            results.append({"label": "analysis_compare", "payload_keys": list(cmp_payload.keys()), "preview": cmp_payload})

    # Also try qloo exec compare_audiences with names
    print("\n=== done collecting ===")
    differentiated = [r for r in results if r.get("differentiated")]
    if differentiated:
        decision = "TRUCE_MAYBE"
        reason = (
            "Some query shapes differentiate Progressive vs Conservative (or left/right proxies). "
            f"Working shapes: {', '.join(r['label'] for r in differentiated)}. "
            "Build only on those shapes — not audience-only long-tail."
        )
    else:
        decision = "WAKE"
        reason = (
            "No query shape produced different top lists for Progressive vs Conservative "
            "(or media-brand proxies). Audience taste bridge is not demonstrable with this API surface. Switch to Wake."
        )

    report = {
        "stamp": stamp,
        "decision": decision,
        "reason": reason,
        "results": results,
    }
    path = OUT / f"truce-probe2-{stamp}.json"
    path.write_text(json.dumps(report, indent=2, default=str))
    (OUT / "LATEST_VERDICT.md").write_text(
        f"# Truce probe 2 → {decision}\n\n{reason}\n\nSee `{path.name}`.\n"
    )
    print(f"\nVERDICT: {decision}")
    print(reason)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
