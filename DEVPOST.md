# Devpost entry copy — Truce

Paste/adapt into the Devpost form.

---

## Elevator pitch (tagline)

**Truce finds the culture two divided media diets already share — then hands the table a memory and a game, not another argument.**

Shorter alt: **Agents with taste: shared culture for divided tables.**

---

## About the project

### Inspiration

Bridging political or tribal division rarely works through debate. It works through shared fringe passions — a song, a film, a place — that let people meet as humans instead of avatars.

We also noticed recommendation engines and LLMs default to either echo chambers or bland “meet in the middle” advice. Qloo’s taste graph promised something different: entity-backed cultural affinity across music, film, brands, and destinations. The question was whether that graph could power an *agentic* product for a real social job — a dinner, a community meet-up, a host who needs a bridge card tonight.

### What it does

**Truce** is a working web app where you fill two taste tables (media, movies, artists, food, holidays). It calls Qloo Insights and returns:

- A **bridge list** of shared entities with both-side affinity scores  
- **Nostalgic prompts** (“Who showed you this artist first?”) instead of critique  
- **Dinner-table games** (Blind Pick, Watch Swap)  
- A static **Left only / Shared / Right only** Venn of real entity names (no fake percentages)  
- An optional **Truce Deck** — flashcards with Love / Hard Pass; when both sides Love, “Common ground locked”

The bridge is computed primarily from **media-diet signals** (the path that actually differentiates in Qloo). Artists and movies on the cards are profile context — feeding opposing artists *as signals* pulls the graphs apart.

### How we built it

- **Node + Express** server; static front end (no SPA framework)  
- Qloo **Search** to resolve names → **Insights** (`signal.interests.entities`) for artists, movies, brands, destinations  
- Server-side API key only; serial Qloo queue + 429 backoff (hackathon keys rate-limit hard under parallel bursts)  
- Demo presets for Blue/Red media diets; editable chips with `+`  
- Hosted intent: Railway + public GitHub (MIT)

Probe scripts and [`FEEDBACK.md`](FEEDBACK.md) document what we learned against `hackathon.api.qloo.com` before locking the product shape.

### Challenges we ran into

1. **`political_preferences` audiences** (Progressive vs Conservative) returned identical Insights lists and a flat affinity (~0.765). Cultural **media brands** as signals differentiated immediately.  
2. **Mixing opposing artists into Insights signals** erased the Americana overlap we’d found with media alone.  
3. **HTTP 429** from parallel Insights calls looked like “no shared bridges” until we logged status codes and serialized requests.  
4. Place/`filter.location` city strings failed WKT parsing; we scoped destinations/brands instead of unreliable place geo for the demo.  
5. Shipping a *complete* host experience (agenda, Venn, deck, games) in a very short window without turning into a generic chat wrapper.

### Accomplishments that we're proud of

- A demo judges can **use end-to-end**, not a slide deck  
- Product honesty about *how* Qloo is used (media diets → bridge; not magical audience URNs)  
- Human layer: memory prompts + games + optional deck celebration  
- A concrete **FEEDBACK.md** for Qloo on audiences, signals, rate limits, and overlap DX

### What we learned

- Qloo’s strength here is **cross-domain affinity from cultural entities**, not “political audience in → consensus out” on this hackathon surface.  
- Empty result arrays after a burst often mean **rate limit**, not empty taste.  
- Agents with taste still need a **table-shaped UX** — affinity scores alone feel clinical; autobiography unlocks the room.

### What's next for Truce

- Hosted multi-user rooms (two phones, one deck)  
- Deeper destination/place bridging once geo params are rock-solid on hackathon  
- Optional Spotify / JustWatch deep links on bridge cards  
- Community / civic host packs (libraries, dinner series) with preset table templates  
- Share learnings with Qloo on a first-class **overlap** helper and clearer 429/audience docs

---

## Built with (tags)

Suggested (≤25):

`Qloo` `Qloo Insights API` `Node.js` `Express` `JavaScript` `HTML` `CSS` `Railway` `GitHub` `Agentic` `Cultural AI` `Taste Graph`

---

## Try it out / repo links

- **Public URL:** `https://` ← paste Railway URL after deploy  
- **Public code repo:** `https://github.com/shielyule/Truce`

---

## When did you begin your project?

**October 27–28, 2026** (hackathon window; built for this event).

---

## If this was an existing project…

Not an existing product prior to the hackathon. Built new during the submission period with Qloo Insights as the cultural core.

---

## One-paragraph “text description” if Devpost asks separately

Truce is an agentic web app that takes two taste tables — especially opposing media diets — and uses Qloo Insights to find shared music, film, brands, and destinations. It returns a host-ready bridge card with both-side affinities, nostalgic conversation prompts, dinner-table games, a simple Left/Shared/Right Venn of real entities, and an optional Truce Deck where both sides can Love or Hard Pass until common ground is locked. The product is deliberately honest: bridges come from cultural entity signals in Qloo’s graph, not from LLM civility or unused political audience shortcuts.
