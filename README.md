# Truce

One-screen (plus optional deck) cultural bridge card for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

Two taste tables → Qloo Insights overlap → memory prompts, dinner games, static Venn, optional Truce Deck.

## Run locally

```bash
cp .env.example .env
# set QLOO_API_KEY and QLOO_BASE_URL=https://hackathon.api.qloo.com
npm install
npm start
```

Default local port: **3847** (`PORT` / `TRUCE_PORT` override).

## Deploy (Railway)

1. Connect this GitHub repo to Railway.
2. Set variables:
   - `QLOO_API_KEY` = your hackathon key
   - `QLOO_BASE_URL` = `https://hackathon.api.qloo.com`
3. Deploy. Railway injects `PORT` automatically.

## Docs in repo

- [`FEEDBACK.md`](FEEDBACK.md) — API lessons for Qloo
- [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) — demo VO / playthrough
- [`DEVPOST.md`](DEVPOST.md) — Devpost copy

## License

MIT
