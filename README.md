# Marginal — trial: Distribution of Income & Wealth

A single-topic mastery trial of the study app. One HSC Economics topic, broken into **six mastery areas** (not chapter order), each mixing flashcards, calculations, typed short answers and AI-marked extended responses.

**Zero build step.** Static files only — it runs the moment GitHub Pages serves it.

## Launch tonight (5 minutes)

1. Create a new GitHub repo and push these files (or upload them via the web UI).
2. Repo → **Settings → Pages → Source: Deploy from a branch → `main` / root → Save.**
3. Your app is live at `https://<user>.github.io/<repo>/` within a minute or two.

That's it — flashcards, calculations and typed short answers are fully working with **no backend and no API key**.

## Real AI essay marking on YOUR account (10 minutes, for your class)

This connects long-answer marking to your own Anthropic account, locked to your students:

1. **Get a key:** console.anthropic.com → API keys → create key. Then Settings → Limits → set a **monthly spend cap** (US$5 is generous for 12 students — Haiku grades an essay for around a cent).
2. **Deploy the worker:** workers.cloudflare.com (free) → Create Worker → paste `proxy/worker.js` → Deploy.
3. **Add two secrets** on the worker (Settings → Variables and Secrets):
   - `ANTHROPIC_API_KEY` = your key
   - `CLASS_CODE` = a code you'll give your students, e.g. `ECON26`
4. **Bake it into the app:** open `index.html`, find the `TEACHER SETUP` block at the bottom, and fill in your worker URL and the class code. Push to GitHub.

Your 12 students now get real AI marking with zero setup — the endpoint and code ship with the app. Anyone else who stumbles on your public page gets a 403 from the worker (wrong/missing class code), the worker rate-limits each IP to 20 grades per 10 minutes, and your spend cap bounds the absolute worst case. The key itself never leaves the worker.

If you'd rather not bake the code into the public page, leave `code: ""` and tell students to enter it once under **Settings → Class code** in the app instead.

## Optional: deploy details (reference)

Without a backend, extended responses get an honest **demo grade** (structure + key-term check, clearly labelled). To switch on real marking:

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) (free tier) → Create Worker → paste `proxy/worker.js`.
2. Worker → **Settings → Variables → Add secret** `ANTHROPIC_API_KEY` = your key from console.anthropic.com.
3. Deploy, copy the worker URL, and paste it into the `TEACHER SETUP` block at the bottom of `index.html` (see the section above), then push. Students don't enter the URL themselves — the app's **Settings — AI essay grading** panel just shows them *AI marking: connected ✓*.

The key lives only in the worker. The worker rate-limits to 20 grades / 10 min per IP, and uses Haiku (≈ a cent per essay; swap `MODEL` to Sonnet for sharper feedback). Set a monthly spend cap on your Anthropic account as a backstop.

## How it works

| Question type | Grading | Cost |
|---|---|---|
| Multiple choice | Hardcoded key + per-option rationale | none |
| Calculate | Numeric check with tolerance + worked solution | none |
| Define / short answer | Local: required key terms + content overlap vs model answer | none |
| Extended response | Worker → Claude, structured JSON (score, criteria, missing vocab, next steps) | ~cents |

- **Mastery areas:** the topic is split by *skill*, not page order — Measuring inequality · Income · Wealth · Patterns & people · The inequality debate · Policy. Pick any area; the map shows mastery per area.
- **Spaced repetition:** Leitner boxes 1–5 in `localStorage` (≥70% → up a box; <40% → back to box 1; due at 0/1/3/7/14 days). Mastered = box 4+.
- **Click-to-define glossary:** dotted blue terms in any question or model answer pop a definition.
- **Scaffolds:** every essay has an optional collapsible scaffold; missing-term chips are tappable.
- Progress is per-device (localStorage). "Reset my progress" is in Settings.

## Files

```text
index.html        app shell + theme + TEACHER SETUP block (no framework, no build)
app.js            session flow, 3-tier grading, Leitner scheduling, glossary
content.js        the question bank — 35+ original questions across 6 areas
proxy/worker.js   Cloudflare Worker that holds the API key for essay grading
build.js          regenerates marginal-preview.html from the three sources above
```

## Build (single-file preview)

The app itself needs **no build** — GitHub Pages serves `index.html`, `app.js` and
`content.js` directly. `build.js` only regenerates the optional single-file build:

```bash
node build.js
```

This inlines `content.js` and `app.js` into the `index.html` shell (TEACHER SETUP
config and all) and writes `marginal-preview.html` — one self-contained file you can
open locally or share without the separate scripts. `marginal-preview.html` is a
**generated artifact**: never hand-edit it; edit the three sources and re-run `node build.js`.

## Adding or editing questions

Everything is data in `content.js`. Add a card to any area:

```js
{ id:"unique", type:"mc"|"calc"|"define"|"short"|"essay", marks:N,
  prompt:"…", model:"…", vocab:["term", …],
  // mc:   choices:[{t,ok,why}, …]
  // calc: expected:Number, tolerance:Number, working:"…"
  // essay: scaffold:["…", …]
}
```


## Create your own flashcard sets

The **Create** tab lets anyone build a set (all five question types), study it like any area, and **export it as JSON** to share. Sets are imported on the same tab — paste the JSON and it appears on the Study map as a 🧩 area. The exported format is:

```json
{ "format": "marginal-set@1", "name": "My set", "cards": [ ...card schema above... ] }
```

`marginal-preview.html` is a single-file build of the whole app (no separate js files) — handy for previewing or sharing as one file; identical features.

## Content note

All questions, model answers and definitions in `content.js` are **original**, written for this app. Statistics referenced (ABS quintile shares, Gini values, tax thresholds, budget figures) are public data. The textbook itself is not included and should not be committed to the repo.

## Known limits of the trial

- Local short-answer grading is a keyword/overlap heuristic — good enough to practise against, not a marker. The full build escalates borderline answers to the LLM.
- Demo essay grades are structural only and capped below top marks, and say so.
- Progress doesn't sync between devices (no accounts in the trial — that's the Supabase build).
