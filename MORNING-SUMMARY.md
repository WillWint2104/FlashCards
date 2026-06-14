# Overnight run — morning summary (Chapter 5 review mode)

## TL;DR
The launch-critical review-mode core is built, verified, and merged to `main`, but
**OFF for students** (gated behind `CONFIG.reviewMode`, default off). Two things
are yours in the morning, in order: (1) **redeploy the worker** and run the real
honesty check (Gate 1 could not be closed overnight — see below); (2) eyeball the
review UI via `?reviewdemo=1` and decide whether to promote it live.

## What merged to main tonight (all via PR, self-verified)
- #5 — Derive practice starters in code (the real fix for the worker timeout).
- #6 — BUILD-CHECKS.md (standing pre-PR checklist).
- #7 — Review step 2: focus-mode shell (modal, score-ring header, tabs, slim rail,
  rubric pane, question/stimulus overlays).
- #8 — Review step 3: paragraph default view (severity spans, missing-sentence
  chip, tappable status list) + the navigable issue walkthrough.
- #9 — Review step 5: rewrite ladder + spaced practice (deriveStarters) + live
  "your paragraph now" rebuild + re-grade gating + the gated student entry.

Nothing was promoted to the live student site. Pages serves `main`, but the review
entry is gated off, so the live experience is unchanged.

## Gate 1 (grading honesty) — NOT closed overnight, needs you
- The code fix is merged: the model no longer emits starters (the app derives
  them), which roughly halves output. `proxy/worker.js` is at `max_tokens: 8000`.
- I could not run the live honesty check, because the live worker still runs the
  PRE-fix code and **only you can redeploy it** (Cloudflare dashboard + your API
  key, which I must never touch). Earlier live attempts: 8000 truncated (502),
  16000 timed out (`upstream 524`). The starter-derivation fix is expected to fit
  comfortably, but this is UNVERIFIED on real input.
- ACTION: re-paste `proxy/worker.js` into Cloudflare, Deploy, then submit a real
  long answer and check the raw grade for honest marking (flags real faults; marks
  consistent with flags; level-scaled; writable no-em-dash register). If it still
  times out or marks leniently, that is a worker-prompt fix BEFORE promoting the UI.
  The UI is grade-agnostic, so a prompt tune will not require UI rework.

## How to eyeball the review UI (no grade needed, no credits spent)
Open `https://willwint2104.github.io/FlashCards/?reviewdemo=1` (after Pages
redeploys main) — it opens the review on `CONTENT.reviewSample` (the tax-transfer
example). Click ¶2 (the detailed paragraph): severity spans, the missing-link
chip, the status list, "Work through the issues", the ladder, practice reps, fresh
write, and "your paragraph now". Tap the score ring for the rubric.

## Screenshots — could not capture (tool outage)
The preview screenshot tool timed out for the ENTIRE session, including on the bare
home page with the modal closed — so it is the capture tool/browser stuck, not the
review UI. Step-2 screenshots captured before the outage (shell, rubric, question
overlay) are in the session transcript. For steps 3 and 5 I verified with
`preview_inspect` (exact computed colours/sizes — more accurate than a screenshot
for contrast) and the accessibility-tree snapshot, plus full click-through. Please
do a visual pass via `?reviewdemo=1` in the morning as the final eyeball.

## Verified (per BUILD-CHECKS)
- CONTRAST: body/paragraph/practice text is `--ink` on white (21px and 15.5px /
  600); muted colours only on 1-2 word pills/labels. No muted-on-tint behind text.
- PER-RUNG STARTER (CHECK 3): each rung's starter derives from its OWN sentence
  (Clear blanks `0.324`; Better derives from the Better sentence).
- TARGETED JUMPS (CHECK 4): the missing-sentence chip opens its own link issue
  (Issue 2 of 6), not the first.
- MARK CONSISTENCY (CHECK 5): asserted in code on open; reviewSample is 13/20 both
  by paragraph sum and rubric sum; no console warnings.
- NO EM-DASHES (CHECK 6): none in any review/model/feedback string.
- node --check on all three sources; deterministic `build.js` rebuild in sync;
  no console errors through the whole flow; normal load (no `?reviewdemo`) is
  unchanged.

## Deferred (not started — lower priority per the build order)
- Step 6: clickable key-term popover. Terms currently render as plain text (the
  `{{term|def|page}}` markup is stripped). Architecture is ready for the swap.
- Step 8: charting module (Lorenz renderer, Gini "how it's built" visualiser) and
  rendered graph stimulus. The Stimulus button auto-hides when a question has none.
- Step 9: a final whole-stylesheet contrast sweep (audited per-PR so far) and a
  full screen-by-screen screenshot pass (blocked tonight by the tool outage).
- Note: the layered rubric (step 7) is already built (it shipped in step 2).

## Uncertainties / judgement calls to confirm
- Re-grade: "Re-grade this paragraph" currently shows a prompt to copy the rebuilt
  paragraph back and resubmit (it does NOT auto-resubmit to the worker). Resubmit
  would be a second worker call with the same timeout budget; deferred deliberately.
  Confirm you are happy with the copy-back behaviour for the trial.
- Rail dot colour uses the paragraph score ratio (green/gold/coral). For the
  fully-detailed real grade this matches worst-outstanding-severity; flagging in
  case you want it strictly severity-driven once resolution state changes mid-review.
- CodeRabbit was rate-limited and did NOT review #7/#8/#9. I merged on my own
  self-verification (the directive's primary gate). Worth letting CodeRabbit run on
  these later and batch-addressing anything it raises.
- `reviewSample` only details ¶2 (as the prototype did); ¶1/¶3/¶4 are rail-only.
  Real worker output details every paragraph.
