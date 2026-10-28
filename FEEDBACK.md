# Feedback for Qloo — Agentic Hackathon (28 Oct 2026)

Working notes from API probes while choosing between two product ideas. Intended as useful product/API feedback, not a complaint. All calls against `https://hackathon.api.qloo.com` with a hackathon key.

---

## The two ideas we tested against

### 1. Truce-by-Taste (cultural blind-date / matchmaker for enemies)

**Premise:** Bridging political or tribal division rarely works through debate. It works through shared fringe passions.

**Intended Qloo use:** Take two opposing cohorts, find the narrow unexpected intersection in the taste graph (artist, brand, place, etc.), and centre an interaction on that bridge — not on political compromise.

**Why an LLM alone fails:** Models invent middle-ground policy language. They do not return entity-backed, cross-domain affinity clusters with scores.

### 2. The Wake (cultural estate / memorial executor)

**Premise:** End-of-life tools handle wills and passwords, not cultural legacy.

**Intended Qloo use:** From a few idiosyncratic loves of the departed (obscure folk, a bitter spirit-as-brand, brutalist film/place), expand a sensory wake: artists, books, brands, reception place — grounded in the graph, not cliché funeral defaults.

**Why an LLM alone fails:** Defaults to “My Way,” white lilies, somber piano. Qloo can expand authentic cross-domain clusters from real seeds.

**Fallback rule we set:** Probe Truce first. If the data cannot show a real bridge, switch to Wake the same day. Do not build both.

---

## Probe method (short)

1. **Probe 1** — `political_preferences` audiences (`Politically Progressive` vs `Politically Conservative`) → Insights for artist / brand / place.
2. **Probe 2** — Same audiences with `filter.popularity.min`, plus movies/TV/books; then **media-brand entity proxies** (MSNBC+NYT+NPR vs Fox+WSJ+Blaze) as `signal.interests.entities`.
3. **Probe 3** — Same media-diet proxies, `take=50`, find **name overlap**, strip obvious news orgs, rank bridges by `min(affinity_left, affinity_right)`.

Scripts: `scripts/truce_probe.py`, `truce_probe2.py`, `truce_probe3_overlap.py`. Raw dumps under `probe-output/`.

---

## Headline finding

> **Qloo can tell the tribes apart when you feed cultural signals, not the audience URN.**  
> Truce only works if we redefine the inputs as **media diets**, then find what they share that **isn’t politics**.

That is both a product decision for us and the main feedback for Qloo.

---

## Finding 1 — `political_preferences` audiences did not differentiate Insights

Audience catalog worked fine via `/v2/audiences?filter.query=…`:

| Audience | ID |
|---|---|
| Politically Progressive | `B3A035FD-0D99-4980-98FD-A5B81D7E402A` |
| Politically Center | `A2F107FD-2A38-4100-AFFB-037A6A2DF338` |
| Politically Conservative | `555258C9-2696-496A-B1C1-C46A6F7795C8` |
| Political Junkie | `539308D1-B0B5-4C9D-8B67-E7B565B59B09` |

Passing those IDs as `signal.demographics.audiences` into `/v2/insights` for Progressive vs Conservative returned:

- **Identical** top entity lists (artists, brands, places, movies, TV, books)
- **Identical** affinity on every row: `0.764996…`
- Same result with or without `filter.popularity.min=0.4`

So either:

- the hackathon Insights path is not applying `signal.demographics.audiences` for these audience IDs, or
- these audiences are too coarse / under-signal to move rankings, or
- the parameter expects a different ID/URN form than `entity_id` from `/v2/audiences`

**Ask for Qloo:** Document the exact `signal.demographics.audiences` value format for hackathon keys, and whether political_preferences audiences are expected to change `/v2/insights` rankings. Identical lists + a single repeated affinity look like a silent no-op (which matches the broader “invalid params are ignored” footgun).

---

## Finding 2 — Cultural entity signals work immediately

Resolving media brands via `/search`, then using them as `signal.interests.entities`, produced clearly different taste graphs:

**Left media diet** (MSNBC, NYT, NPR) → artists like The Band, Van Morrison, Paul Simon, Neil Young, Joni Mitchell, Jackson Browne…

**Right media diet** (Fox News, WSJ, Blaze Media) → artists like Eagles, Bob Seger, Doobie Brothers, Lynyrd Skynyrd, Mellencamp, Chicago, Boston…

Affinities were varied and high (~0.94–0.97), not the flat `0.765` default.

**Takeaway:** For “opposing cohorts,” **proxy the cohort with cultural entities the group is known to follow**, not the political audience URN — at least on this hackathon surface.

---

## Finding 3 — Differentiation ≠ bridge (but overlap exists)

Probe 2 only showed different lists. Probe 3 asked for **shared** entities across the two media diets (`take=50`, popularity floor 0.2).

### Strong bridges (artists) — the product story

| Entity | Affinity L | Affinity R | min |
|---|---:|---:|---:|
| Van Morrison | 0.958 | 0.947 | **0.947** |
| Jackson Browne | 0.945 | 0.944 | **0.944** |
| Buffalo Springfield | 0.935 | 0.943 | **0.935** |
| Tom Petty | 0.931 | 0.948 | **0.931** |
| The Allman Brothers Band | 0.925 | 0.956 | **0.925** |
| Traveling Wilburys | 0.924 | 0.951 | **0.924** |

This is the Truce card: classic Americana / roots rock that both media diets already lean toward. A dinner around Van Morrison or Tom Petty is legible, apolitical, and entity-backed.

### Weaker / noisier “bridges”

- **Brands:** After stripping obvious news orgs, leftovers still skew media-adjacent (Economist, Daily Beast, Onion, Daily Mail, Business Insider). Better non-media hits: **Funny or Die**, **Cleveland Clinic**, **Amnesty International**, Flipboard.
- **Movies:** Shared documentary / business-story titles (The Founder, Molly’s Game, Becoming Warren Buffett, O.J.: Made in America, Betting on Zero). Fine as secondary colour; less “fringe passion” than the artists.
- **TV / books:** Zero name overlap in top 50.
- **Places:** `filter.location` as a city string returned WKT parse errors; `filter.geocode.name=United States` returned empty. Place bridging needs a documented geo shape for hackathon.

---

## Finding 4 — API / DX footguns we hit

1. **`/v2/audiences` requires at least one filter** (`filter.audience.types`, `filter.parents.types`, `filter.query`, etc.). Easy to 400 on first try.
2. **`filter.parents.types=urn:audience:political_preferences`** did not return the four political audiences for us; **`filter.query=politically|conservative|…`** did.
3. **Invalid / ineffective params fail soft** — audience signal produced HTTP 200 with a flat default ranking. Hard to distinguish “no effect” from “true consensus.”
4. **`filter.location=Columbus, OH`** → `WKT format is invalid`. City strings are not accepted here; docs should show a hackathon-valid place filter example (geohash, WKT, or geocode fields).
5. **Harness `compare_audiences` takes entity groups**, not audience IDs — naming suggests demographics audiences; behaviour is entity-set compare. Easy to misunderstand when designing “Truce.”
6. **News affinity dominates brand results** when signals are news brands. Expected, but for cross-domain products you need an easy way to exclude tag families (news/politics) from outputs.

---

## Finding 5 — Rate limits (HTTP 429) look like “no taste overlap”

During the live app build we got UI copy like “No shared bridges” with empty artist samples. That was **not** empty taste data.

**Cause:** blasting many `/v2/insights` calls in parallel (resolve burst + several entity types × two sides, then an immediate fallback retry) returned **HTTP 429**. Our code treated failures as empty lists → zero overlap → false “no bridges” product state.

**Lesson for builders:**
- Empty Insights arrays after a burst often mean rate limit, not “no affinity.”
- Log status codes; surface 429 distinctly in the UI (“cooling down / retrying”).
- Serialize Qloo calls (concurrency 1), add gaps, retry with backoff on 429.
- Don’t immediately double the load with a fallback pass while still 429’d — cool down first.

**Lesson for Qloo:** clearer 429 bodies + docs on hackathon QPS, and ideally a bulk/overlap endpoint so one product action isn’t 8–20 Insights GETs.

---

## Finding 6 — Signal choice can erase a real bridge

Putting opposing **artists/movies** into `signal.interests.entities` (e.g. Joni Mitchell vs Toby Keith on the two tables) pulls the graphs apart and can wipe the Americana overlap we found with **media brands alone**.

**Product rule we shipped:** cards show full taste profile (media, movies, artists, food, holidays); the **bridge is computed from media diets** (food/destinations optional). Artists/movies on the card are context, not Insights signals.

---

## Decision for our hackathon build

| Path | Status |
|---|---|
| Truce via `political_preferences` audiences | **Dead** (this environment) |
| Truce via media-diet entity proxies → artist (and selective brand/movie) overlap | **Alive — building this** |
| Wake | Parked as same-day fallback; not needed unless Truce ship slips |

**Product shape we will ship:** editable taste tables; bridge from media diets; long bridge list with nostalgic prompts + dinner games; static Left-only / Shared / Right-only Venn (real names, no fake %); optional Truce Deck (Love / Hard Pass) on top of the list. Tagline honesty: *taste overlap between cultural media diets*, not magic from the political audience URN.

---

## What would make Truce (and similar agentic products) stronger in the API

1. Confirm / fix `signal.demographics.audiences` on Insights for hackathon keys — or document that political audiences are Insights-UI-only.
2. A first-class **overlap / intersection** helper: given signal group A and B, return entities ranked by `min(affinity_A, affinity_B)` or similar, with optional tag excludes.
3. One copy-paste **location example** that works on `hackathon.api.qloo.com` for `urn:entity:place`.
4. Clearer naming: audience compare vs entity-group compare.
5. Publish hackathon rate limits and recommend serial client patterns; distinguish quota errors from empty result sets in examples.

Happy to share redacted request/response pairs from `probe-output/` with the Qloo team (`ian@qloo.com` / Discord `#qloo-hackathon`).
