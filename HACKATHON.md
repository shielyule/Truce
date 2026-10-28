# Qloo Agentic Hackathon — logged 27 Oct 2026

Source: Qloo onboarding email after requesting API access. Deadline on Devpost: **30 Oct 2026, 11:45pm EDT**.

## API key

- Request form and guide: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key
- Keys usually arrive by email within **one business day**. Check spam.
- The key is personal. Do not share it, commit it, or put it in a web page or mobile app.
- Hackathon keys only work against `https://hackathon.api.qloo.com`.
- Leaked key: email ian@qloo.com. Other help: Discord `#qloo-hackathon` — https://discord.gg/rF9PKsD5Q7

Applied the evening of 27 Oct 2026. Key received morning of 28 Oct 2026.
Server: `https://hackathon.api.qloo.com`. Key stays in local `.env` / `qloo setup` only — never in chat or git.

## Rules that change the build

- Qloo results describe what **groups** tend to like, not what one person will do.
- Do not send personal data (names, emails, device IDs) to Qloo.
- Supported at the event: `qloo exec` and `qloo mcp`.
- Not supported: the harness chat, plan, or build modes.
- Submission checklist lives in `docs/SUBMISSION.md` in the kit repo.

## Kit (local install in this folder)

- Official kit is in `qloo-hackathon-kit/` (zip download; same as github.com/qloo/qloo-hackathon-kit).
- Harness is installed locally: `npm install @qloo/qloo-harness` → run via `npx qloo …`
- Needs Node.js **22.19+** (this machine has v24).

In your **own Terminal** (not the Cursor sandbox — setup writes `~/.qloo`):

```bash
cd ~/Desktop/Qloo
cp .env.example .env
# paste the real key into .env as QLOO_API_KEY=…

# optional: also persist via harness (hides input)
export QLOO_BASE_URL=https://hackathon.api.qloo.com
export QLOO_TRUSTED_BASE_URL=https://hackathon.api.qloo.com
npx qloo setup --qloo
npx qloo setup --status
```

Ready state is **"Qloo data: ready"**. Ignore the Model and Chat lines.

Smoke test:

```bash
cd ~/Desktop/Qloo/qloo-hackathon-kit/starter/cli-workflow
npx qloo exec find_tags --input-file request.json
```

Nine supported workflows: `recommend`, `rank`, `describe`, `where_popular`, `compare_audiences`, `entity_tags`, `audience_demographics`, `trends`, `find_tags`.

`compare_audiences` is the Truce probe path. Chat / plan / build modes are off-limits for the event.

## Decision (28 Oct)

**Building Truce** on media-diet entity proxies (not political audience URNs). Wake parked. See `FEEDBACK.md`.

App: `npm run truce` → http://localhost:3847 (not 3000/3001).
