import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.join(__dirname, "..", ".env");
dotenv.config({ path: rootEnv });
if (!process.env.QLOO_API_KEY) {
  dotenv.config({ path: path.join(process.cwd(), ".env") });
}

const PORT = Number(process.env.PORT || process.env.TRUCE_PORT || 3847);
const BASE = (process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com").replace(/\/$/, "");
const KEY = process.env.QLOO_API_KEY;

/** Section keys on the home cards → how we resolve / what they mean */
const SECTIONS = [
  { key: "media", label: "Media", searchType: "urn:entity:brand", placeholder: "e.g. NPR" },
  { key: "movies", label: "Movies", searchType: "urn:entity:movie", placeholder: "e.g. The Big Lebowski" },
  { key: "artists", label: "Music artists", searchType: "urn:entity:artist", placeholder: "e.g. Neil Young" },
  { key: "music", label: "Music / podcasts", searchType: "urn:entity:podcast", placeholder: "e.g. This American Life" },
  { key: "food", label: "Food & drink", searchType: "urn:entity:brand", placeholder: "e.g. Chipotle" },
  { key: "destinations", label: "Holidays & places", searchType: "urn:entity:destination", placeholder: "e.g. Austin" },
];

const DEMO = {
  left: {
    label: "Blue table",
    sections: {
      media: ["MSNBC", "The New York Times", "NPR"],
      movies: ["The Big Lebowski", "Lady Bird"],
      artists: ["Joni Mitchell", "Paul Simon"],
      music: ["This American Life"],
      food: ["Whole Foods", "Trader Joe's"],
      destinations: ["Portland", "Berlin"],
    },
  },
  right: {
    label: "Red table",
    sections: {
      media: ["Fox News", "The Wall Street Journal", "Blaze Media"],
      movies: ["Top Gun Maverick", "Friday Night Lights"],
      artists: ["Toby Keith", "Lynyrd Skynyrd"],
      music: ["The Joe Rogan Experience"],
      food: ["Whataburger", "Cracker Barrel"],
      destinations: ["Nashville", "Dallas"],
    },
  },
};

/** Known IDs so demo media brands resolve reliably */
const KNOWN_IDS = {
  msnbc: "A34AD40F-6B5F-48D3-A159-53FF7C544575",
  "the new york times": "46DB54ED-CBA2-4F52-9512-EAA9B7C2CB69",
  npr: "36A3F981-5BFB-45B5-A8CF-A16F273B04F0",
  "fox news": "F1AA9F1A-6594-48E0-980C-14C52EE247A0",
  "the wall street journal": "8C07C9D4-3B47-4138-902B-C9B9E150FACF",
  "blaze media": "836040EE-D964-48AC-9D39-E1023174A8B9",
};

const NEWSY = [
  "news", "times", "post", "cnn", "fox", "msnbc", "npr", "reuters", "politico",
  "huffpost", "atlantic", "new yorker", "forbes", "bloomberg", "wsj", "wall street",
  "blaze", "cato", "judicial watch", "weather channel", "cbs news", "abc news",
  "nbc news", "bbc", "guardian", "daily mail", "daily beast", "economist",
  "business insider", "flipboard", "rogan",
];

const OUTPUT_TYPES = [
  { type: "urn:entity:artist", key: "artists", label: "Music", take: 50 },
  { type: "urn:entity:movie", key: "movies", label: "Movies", take: 40 },
  { type: "urn:entity:brand", key: "food_brands", label: "Food & brands", take: 40 },
  { type: "urn:entity:destination", key: "destinations", label: "Holidays", take: 30 },
];

const searchCache = new Map();
const insightsCache = new Map();
const MAX_SIGNALS_PER_SIDE = 10;
const QLOO_TIMEOUT_MS = 20000;
const QLOO_CONCURRENCY = 1;
const QLOO_GAP_MS = 450;
const QLOO_MAX_RETRIES = 6;

/** Sections safe to use as Insights signals. Opposing artists/movies as signals
 *  pull graphs apart and erase bridges — keep those on the card as profile only. */
const SIGNAL_SECTIONS = new Set(["media", "food", "destinations"]);

function isNewsy(name) {
  const n = String(name || "").toLowerCase();
  return NEWSY.some((x) => n.includes(x));
}

function explainBridge(item) {
  const kind = (item.type || "").split(":").pop();
  const name = item.name;
  const score = Math.round((item.bridge_score || 0) * 100);
  switch (kind) {
    case "artist":
      return {
        why: `Both tables show strong affinity for ${name} (${score}% bridge). Qloo’s graph links their cultural signals to the same artist — a shared soundtrack, not a negotiated middle.`,
        prompt: `What was the first car you were in when ${name} was playing — or who put this artist on for you the first time?`,
        game: `Blind Pick: Blue chooses a ${name} track (no phone). Red guesses the decade — or the person who first played it for them. Winner picks the next song.`,
      };
    case "movie":
      return {
        why: `${name} sits in the overlap of both taste graphs (${score}% bridge). Put the film on the table instead of the argument.`,
        prompt: `Where were you the first time you saw ${name} — living room, cinema, laptop at 1am — and who was next to you?`,
        game: `Watch Swap: Commit to the first 20 minutes of ${name} together. If either person checks their phone, they do the dishes.`,
      };
    case "destination":
      return {
        why: `Both sides lean toward ${name} as a destination (${score}% bridge). A trip idea beats a quote-tweet.`,
        prompt: `What’s your earliest memory that feels like ${name} — even if you’ve never been? A postcard, a relative’s story, a film still?`,
        game: `Pack Light: Each person names three things they’d bring to ${name}. If both name the same item, that’s the trip mascot.`,
      };
    case "place":
      return {
        why: `${name} shows up as a shared place affinity (${score}% bridge) — somewhere both graphs already recognize.`,
        prompt: `What’s the first smell or sound you associate with a place like ${name}?`,
        game: `Order Blind: Each writes a first order for ${name}. Reveal together — closest match shares an appetizer.`,
      };
    case "podcast":
      return {
        why: `Both profiles pull toward ${name} (${score}% bridge). Shared listening is a low-stakes truce.`,
        prompt: `When did you first hear something like ${name} — commute, kitchen, late night — and what were you doing with your hands?`,
        game: `Episode Dare: Each assigns the other one episode of ${name}. No spoilers. Report back in one sentence that isn’t a review.`,
      };
    case "brand":
    default:
      return {
        why: `${name} is a shared brand affinity (${score}% bridge) after filtering out pure news orgs. Everyday culture, not punditry.`,
        prompt: `What’s your first real-life run-in with ${name} — a receipt, a gift, a road trip stop — and who was with you?`,
        game: `Origin Story: 60 seconds each — how ${name} entered your life. No brand takes, only autobiography.`,
      };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serialise Qloo calls — hackathon keys 429 hard under parallel bursts. */
const qlooQueue = [];
let qlooActive = 0;

function enqueueQloo(task) {
  return new Promise((resolve, reject) => {
    qlooQueue.push({ task, resolve, reject });
    pumpQloo();
  });
}

function pumpQloo() {
  while (qlooActive < QLOO_CONCURRENCY && qlooQueue.length) {
    const job = qlooQueue.shift();
    qlooActive += 1;
    job
      .task()
      .then(job.resolve, job.reject)
      .finally(async () => {
        qlooActive -= 1;
        await sleep(QLOO_GAP_MS);
        pumpQloo();
      });
  }
}

async function qlooFetchOnce(pathname, params) {
  if (!KEY) {
    const err = new Error("QLOO_API_KEY is not configured on the server");
    err.status = 500;
    throw err;
  }
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QLOO_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      headers: { "X-Api-Key": KEY, Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (cause) {
    const aborted = cause?.name === "AbortError";
    const err = new Error(
      aborted
        ? `Qloo timed out after ${QLOO_TIMEOUT_MS / 1000}s on ${pathname}`
        : `Cannot reach Qloo at ${BASE} (${cause?.cause?.message || cause.message}).`
    );
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(body?.errors?.[0]?.message || `Qloo HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function qlooGet(pathname, params) {
  return enqueueQloo(async () => {
    let attempt = 0;
    while (true) {
      try {
        return await qlooFetchOnce(pathname, params);
      } catch (err) {
        attempt += 1;
        if (err.status === 429 && attempt <= QLOO_MAX_RETRIES) {
          const wait = Math.min(8000, 800 * 2 ** (attempt - 1));
          console.warn(`[qloo] 429 on ${pathname} — retry ${attempt}/${QLOO_MAX_RETRIES} in ${wait}ms`);
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }
  });
}

function entitiesFrom(payload) {
  const results = payload?.results;
  if (results && Array.isArray(results.entities)) return results.entities;
  if (Array.isArray(results)) return results;
  if (Array.isArray(payload?.entities)) return payload.entities;
  return [];
}

function searchResults(payload) {
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.results?.entities)) return payload.results.entities;
  if (Array.isArray(payload?.entities)) return payload.entities;
  return [];
}

function normalize(entity, type) {
  const q = entity?.query && typeof entity.query === "object" ? entity.query : {};
  return {
    name: entity?.name || "Unknown",
    id: entity?.entity_id || entity?.id || null,
    type,
    affinity: typeof q.affinity === "number" ? q.affinity : null,
    popularity: typeof entity?.popularity === "number" ? entity.popularity : null,
  };
}

async function resolveName(name, searchType) {
  const trimmed = String(name || "").trim();
  const key = trimmed.toLowerCase();
  if (!key) return null;
  if (KNOWN_IDS[key]) {
    return { name: trimmed, id: KNOWN_IDS[key], sectionType: searchType, via: "known" };
  }
  const cacheKey = `${searchType || "*"}::${key}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);

  const params = { query: trimmed, take: "3" };
  if (searchType) params.types = searchType;
  const payload = await qlooGet("/search", params);
  const hits = searchResults(payload);
  const hit = hits[0];
  const value = hit
    ? {
        name: hit.name || trimmed,
        id: hit.entity_id || hit.id,
        sectionType: searchType,
        via: "search",
      }
    : null;
  searchCache.set(cacheKey, value);
  return value;
}

async function resolveSide(side) {
  const label = String(side?.label || "Table").slice(0, 80);
  const sectionsIn = side?.sections || {};
  const profile = [];
  const unresolved = [];
  const jobs = [];

  // Only hit /search for signal sections (media/food/destinations).
  // Movies/artists/music stay as display profile — searching them burned rate limit on Railway.
  for (const spec of SECTIONS) {
    const items = Array.isArray(sectionsIn[spec.key]) ? sectionsIn[spec.key] : [];
    for (const raw of items.slice(0, 6)) {
      const name = String(raw || "").trim();
      if (!name) continue;
      if (!SIGNAL_SECTIONS.has(spec.key)) {
        profile.push({
          name,
          id: null,
          section: spec.key,
          via: "display",
        });
        continue;
      }
      jobs.push(
        resolveName(name, spec.searchType)
          .then((hit) =>
            hit?.id
              ? { ok: true, row: { ...hit, section: spec.key } }
              : { ok: false, name, section: spec.key }
          )
          .catch(() => ({ ok: false, name, section: spec.key }))
      );
    }
  }

  const settled = await Promise.all(jobs);
  const signalResolved = [];
  for (const row of settled) {
    if (row.ok) {
      signalResolved.push(row.row);
      profile.push(row.row);
    } else unresolved.push({ name: row.name, section: row.section });
  }

  const rank = { media: 0, food: 1, destinations: 2, movies: 3, artists: 4, music: 5 };
  signalResolved.sort((a, b) => (rank[a.section] ?? 9) - (rank[b.section] ?? 9));

  let signals = signalResolved.filter((r) => SIGNAL_SECTIONS.has(r.section));
  if (!signals.length) {
    signals = signalResolved.slice(0, 6);
  } else {
    const mediaOnly = signals.filter((r) => r.section === "media");
    if (mediaOnly.length >= 1) signals = mediaOnly.slice(0, 6);
    else signals = signals.slice(0, 6);
  }

  profile.sort((a, b) => (rank[a.section] ?? 9) - (rank[b.section] ?? 9));

  return {
    label,
    resolved: profile.slice(0, MAX_SIGNALS_PER_SIDE + 8),
    signals,
    unresolved,
  };
}

async function insightsForIds(ids, type, take, popularityMin = "0.15") {
  if (!ids.length) return [];
  const cacheKey = `${ids.slice().sort().join(",")}|${type}|${take}|${popularityMin}`;
  if (insightsCache.has(cacheKey)) {
    console.log(`[cache] insights hit ${type}`);
    return insightsCache.get(cacheKey);
  }
  const params = {
    "filter.type": type,
    "signal.interests.entities": ids.join(","),
    "filter.popularity.min": popularityMin,
    take: String(take),
  };
  try {
    const payload = await qlooGet("/v2/insights", params);
    const rows = entitiesFrom(payload).map((e) => normalize(e, type));
    if (rows.length) insightsCache.set(cacheKey, rows);
    return rows;
  } catch (err) {
    console.warn(`insights skip ${type}:`, err.status || "", err.message);
    if (err.status === 429) err.rateLimited = true;
    return Object.assign([], { rateLimited: err.status === 429, error: err.message });
  }
}

async function buildBuckets(leftIds, rightIds) {
  const buckets = {};
  let rateLimited = false;
  // Sequential per type (left then right) so we stay under rate limits
  for (const spec of OUTPUT_TYPES) {
    const a = await insightsForIds(leftIds, spec.type, spec.take);
    const b = await insightsForIds(rightIds, spec.type, spec.take);
    if (a.rateLimited || b.rateLimited) rateLimited = true;
    buckets[spec.key] = {
      label: spec.label,
      type: spec.type,
      bridges: overlap(a, b),
      left_sample: a.slice(0, 6).map((x) => x.name),
      right_sample: b.slice(0, 6).map((x) => x.name),
      left_all: a.slice(0, 15).map((x) => x.name),
      right_all: b.slice(0, 15).map((x) => x.name),
    };
    console.log(
      `[bridge] ${spec.key}: L=${a.length} R=${b.length} shared=${buckets[spec.key].bridges.length}`
    );
  }
  buckets._rateLimited = rateLimited;
  return buckets;
}

function overlap(left, right) {
  const mapL = new Map(left.map((r) => [r.name.toLowerCase(), r]));
  const mapR = new Map(right.map((r) => [r.name.toLowerCase(), r]));
  const shared = [];
  for (const [key, a] of mapL) {
    const b = mapR.get(key);
    if (!b) continue;
    if (isNewsy(a.name)) continue;
    const affL = a.affinity ?? 0;
    const affR = b.affinity ?? 0;
    const item = {
      name: a.name,
      id: a.id,
      type: a.type,
      affinity_left: a.affinity,
      affinity_right: b.affinity,
      bridge_score: Math.min(affL, affR),
    };
    const copy = explainBridge(item);
    shared.push({ ...item, why: copy.why, prompt: copy.prompt, game: copy.game });
  }
  shared.sort((x, y) => y.bridge_score - x.bridge_score);
  return shared;
}

function buildVenn(buckets, headline) {
  const artists = buckets.artists || { left_sample: [], right_sample: [], bridges: [] };
  // Prefer fuller lists when present
  const leftNames = artists.left_all || artists.left_sample || [];
  const rightNames = artists.right_all || artists.right_sample || [];
  const leftSet = new Set(leftNames.map((n) => n.toLowerCase()));
  const rightSet = new Set(rightNames.map((n) => n.toLowerCase()));

  const left_only = leftNames.filter((n) => !rightSet.has(n.toLowerCase())).slice(0, 8);
  const right_only = rightNames.filter((n) => !leftSet.has(n.toLowerCase())).slice(0, 8);
  const sharedFromArtists = (artists.bridges || []).map((b) => b.name);
  const sharedFromHeadline = (headline || []).map((h) => h.name);
  const shared = [];
  const seen = new Set();
  for (const n of [...sharedFromArtists, ...sharedFromHeadline]) {
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    shared.push(n);
    if (shared.length >= 10) break;
  }

  return {
    left_only,
    shared,
    right_only,
    note: "Real entity names from this run’s Insights lists (artists + bridge headline). No invented overlap percentages.",
  };
}

function diversifyHeadline(buckets) {
  const picks = [];
  const perType = {
    "urn:entity:artist": 3,
    "urn:entity:movie": 2,
    "urn:entity:brand": 2,
    "urn:entity:destination": 2,
  };
  for (const spec of OUTPUT_TYPES) {
    const list = buckets[spec.key]?.bridges || [];
    picks.push(...list.slice(0, perType[spec.type] || 1));
  }
  picks.sort((a, b) => b.bridge_score - a.bridge_score);
  // keep order diversified: round-robin by type a bit
  const byType = new Map();
  for (const p of picks) {
    const k = p.type;
    if (!byType.has(k)) byType.set(k, []);
    byType.get(k).push(p);
  }
  const out = [];
  let added = true;
  while (out.length < 10 && added) {
    added = false;
    for (const spec of OUTPUT_TYPES) {
      const arr = byType.get(spec.type);
      if (arr?.length) {
        out.push(arr.shift());
        added = true;
      }
      if (out.length >= 10) break;
    }
  }
  return out;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "96kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, qloo: Boolean(KEY), base: BASE, port: PORT });
});

app.get("/api/demo", (_req, res) => {
  res.json({ sections: SECTIONS, demo: DEMO });
});

app.post("/api/bridge", async (req, res) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  try {
    const leftIn = req.body?.left || DEMO.left;
    const rightIn = req.body?.right || DEMO.right;

    const started = Date.now();
    console.log("[bridge] start");
    const [left, right] = await Promise.all([resolveSide(leftIn), resolveSide(rightIn)]);
    console.log(
      `[bridge] resolved L=${left.resolved.length} R=${right.resolved.length} in ${Date.now() - started}ms`
    );

    if (left.signals.length < 1 || right.signals.length < 1) {
      return res.status(400).json({
        error:
          "Need at least one resolvable media / food / destination signal on each side. Check spellings or use Reset demo.",
        left_unresolved: left.unresolved,
        right_unresolved: right.unresolved,
        left_profile: left.resolved.map((r) => r.name),
        right_profile: right.resolved.map((r) => r.name),
      });
    }

    const leftIds = [...new Set(left.signals.map((r) => r.id))];
    const rightIds = [...new Set(right.signals.map((r) => r.id))];
    console.log(
      `[bridge] insights signals L=${leftIds.length} (${left.signals.map((s) => s.name).join(", ")}) R=${rightIds.length} (${right.signals.map((s) => s.name).join(", ")})`
    );

    // Brief pause after resolve so Insights aren't immediately 429'd
    await sleep(400);

    let buckets = await buildBuckets(leftIds, rightIds);
    let headline = diversifyHeadline(buckets);
    let strategy = "media-first signals (rate-limited queue)";
    const rateLimited = Boolean(buckets._rateLimited);
    delete buckets._rateLimited;

    if (!headline.length && rateLimited) {
      console.log("[bridge] empty after 429s — cooling 5s then artists-only retry");
      await sleep(5000);
      // Minimal retry: artists only (cheapest path that still ships a bridge)
      const a = await insightsForIds(leftIds, "urn:entity:artist", 40);
      const b = await insightsForIds(rightIds, "urn:entity:artist", 40);
      buckets = {
        artists: {
          label: "Music",
          type: "urn:entity:artist",
          bridges: overlap(a, b),
          left_sample: a.slice(0, 6).map((x) => x.name),
          right_sample: b.slice(0, 6).map((x) => x.name),
          left_all: a.slice(0, 15).map((x) => x.name),
          right_all: b.slice(0, 15).map((x) => x.name),
        },
        movies: { label: "Movies", type: "urn:entity:movie", bridges: [], left_sample: [], right_sample: [] },
        food_brands: { label: "Food & brands", type: "urn:entity:brand", bridges: [], left_sample: [], right_sample: [] },
        destinations: { label: "Holidays", type: "urn:entity:destination", bridges: [], left_sample: [], right_sample: [] },
      };
      headline = diversifyHeadline(buckets);
      strategy = "artists-only retry after rate-limit cooldown";
    }

    const duration_ms = Date.now() - started;
    const venn = buildVenn(buckets, headline);
    console.log(`[bridge] done in ${duration_ms}ms · ${headline.length} bridges · ${strategy}`);

    res.json({
      left: {
        label: left.label,
        signals: left.signals.map((r) => ({ name: r.name, section: r.section })),
        profile: left.resolved.map((r) => ({ name: r.name, section: r.section })),
        unresolved: left.unresolved,
      },
      right: {
        label: right.label,
        signals: right.signals.map((r) => ({ name: r.name, section: r.section })),
        profile: right.resolved.map((r) => ({ name: r.name, section: r.section })),
        unresolved: right.unresolved,
      },
      headline,
      buckets,
      venn,
      meta: {
        duration_ms,
        strategy,
        rate_limited: rateLimited && !headline.length,
        evidence:
          "Bridge computed from media (preferred) / food / destination signals via Qloo Insights. Artists & movies on the cards are profile context — using opposing artists as signals erases overlap. Affinities are Qloo’s; news-only brands filtered from bridges.",
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[bridge] fail", err);
    res.status(err.status || 500).json({ error: err.message || "Bridge failed" });
  }
});

app.get("/{*spath}", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Truce bridge card → http://0.0.0.0:${PORT}`);
  if (!process.env.QLOO_API_KEY) {
    console.warn(`WARNING: QLOO_API_KEY missing (looked for ${rootEnv})`);
  }
});
