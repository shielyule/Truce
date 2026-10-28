# Truce

One-screen agentic bridge card for the Qloo Agentic Hackathon.

Two editable taste tables (media, movies, artists, podcasts, food, holidays) hit Qloo Insights. The app returns a diversified bridge card — music, film, food/brands, destinations — with affinity bars, a short explanation, and a conversation prompt on each panel.

## Why media diets

Probes showed `signal.demographics.audiences` for Progressive vs Conservative returned identical rankings. Cultural brands as `signal.interests.entities` differentiated immediately and produced real bridges (Van Morrison, Tom Petty, Jackson Browne, …). Details in [`../FEEDBACK.md`](../FEEDBACK.md).

## Run locally

Uses port **3847** (avoids 3000/3001).

```bash
cd ~/Desktop/Qloo
# .env must contain QLOO_API_KEY and QLOO_BASE_URL=https://hackathon.api.qloo.com
npm run truce
```

Open http://localhost:3847

## API

- `GET /api/health`
- `GET /api/diets`
- `POST /api/bridge` → `{ left: "blue", right: "red" }`

The browser never sees the Qloo key. All Insights calls are server-side.
