# Essay practice mode (Ancient History) — reviewer guide

Essay practice is a new mode for coached essay writing plus a full timed attempt.
It is built behind a flag and is invisible to live students until you switch it
on. Economics is untouched.

## What is gated, and how to switch it on

Same convention as review mode:

- `MARGINAL_CONFIG.essayMode` in `index.html` (default `false`) is the promotion
  switch. `true` gives essay practice to every student whose class code maps to a
  known subject.
- `?essay=1` (or `localStorage["marginal.essay"]="1"`) turns it on for one person.
- `?essaydemo=1` opens all three screens on an Ancient History (`11Anc1`) context
  with the labelled demo coaching fallback, so you can walk the whole flow before
  the worker is updated.

Nothing about live students changes until you set `essayMode: true`.

## Subjects and class codes

- Class codes are still free-form. `11Anc1` works as a login today with no
  Supabase or Edge Function change.
- Routing is a client-side map of KNOWN codes only:
  - `11Anc...` -> Ancient History
  - `12Ec...` -> Economics (unchanged)
  - anything else -> an explicit "subject not set" screen. An unknown code is
    never assumed to be Economics, so a future code can never be misrouted.
- Economics resolves to a subject that has no essay content yet, so an Economics
  student who somehow reaches essay mode sees the graceful "not set up for your
  subject" screen, never Ancient History content.

## Walkthrough checklist (run on `?essaydemo=1`)

Sign in first if Supabase auth is configured (any account), then add
`?essaydemo=1` to the URL. Tick each:

**Setup (intake)**
- [ ] Only the essay question is marked "needed". Topic, rubric and structure are
      marked "optional".
- [ ] A quick-pick question chip fills the question box (and tags the topic).
- [ ] "Start practising" with an empty question nudges you to add one; with a
      question it starts. Skipping topic and rubric works and costs nothing.
- [ ] The structure selector defaults to "5 paragraphs (intro, 3 body,
      conclusion)".
- [ ] "Show the general band expectations" reveals the fallback bands used when
      no rubric is pasted.

**Coached practice (one element at a time)**
- [ ] Only the current paragraph renders: its planned point pinned (muted) above,
      one editable box, and feedback in the right margin. No other paragraphs show.
- [ ] The stepper (Intro, Body 1..3, Conclusion) is a position indicator only.
      Back / Next move one paragraph at a time and the ring tracks (1/5, 2/5, ...).
- [ ] "Get feedback" fills the margin with a note, question-nudges, and word-level
      chips. There is no rewritten or paste-ready paragraph anywhere.
- [ ] Picking a chip swaps that one word in YOUR text (you apply it, the coach
      never substitutes).
- [ ] After feedback, "Get feedback" is disabled with "Revise, then ask again".
      Editing the paragraph re-enables it. (Cooldown.)

**Full attempt (write cold)**
- [ ] One continuous surface, no feedback margin.
- [ ] Standing line offers "switch to practice".
- [ ] A per-paragraph "Coach ..." link carries THAT paragraph into the coached
      view. Edits flow back to the same draft (no second draft, no fork).
- [ ] A gentle, declinable completion check sits above Submit ("you wrote this
      without feedback... you can decline").

**No fork**
- [ ] Apply a chip in coached view, switch to full attempt: the change is in the
      single essay text. Switch back: still one draft.

## The one manual step to turn on REAL coaching: re-paste the worker

Coaching uses the Cloudflare Worker, the same as marking. The repo copy of
`proxy/worker.js` does NOT update the live worker. Until you re-paste it, all
three screens still work using the labelled demo coaching fallback.

To switch on real Haiku coaching:

1. Open Cloudflare -> Workers -> your `marginal-grader` worker -> Edit code.
2. Replace the whole script with the current `proxy/worker.js` from this repo and
   Deploy. (No new secrets are needed; coaching reuses `ANTHROPIC_API_KEY` and the
   same `CLASS_CODE` gate as marking.)
3. That is it. The app already sends `{ action: "coach", ... }`; once the new
   worker is live, the demo banner disappears and feedback comes from Haiku.

Notes:
- Coaching runs on `claude-haiku-4-5` with a short output cap. Marking is left on
  its current model on purpose.
- The coaching system prompt is prompt-cached (it repeats every call).
- The rubric is sent only when the student pasted one; otherwise the worker falls
  back to generic HSC band expectations (no empty rubric field is sent).

## Where drafts live (for now)

Essay drafts persist in the browser via the existing safe-storage wrapper, so the
demo is fully walkable immediately. The go-live step is an `essay_drafts` table
with `owner = auth.uid()` Row Level Security, mirroring the `sets` table pattern.
That SQL is not run yet and is the next step when you decide to go live.
