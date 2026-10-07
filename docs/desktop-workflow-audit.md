# Desktop Test Mode workflow audit

Read-only. Nothing in the app, the contract or the tests was changed by this pass.

Walked in the real build (`marginal-walkthrough.html` at `82e2269`) at 1280×900
with Fredoka and Nunito proven loaded, starting from an **empty library**, and taken
through the real UI: Create tab, paste the synthetic Business Studies paper,
import, Test mode, sit every section, results. The marker was stubbed; nothing
else was. 23 screenshots, not committed (generated screenshots never are).

The journey completes, with no page errors and no source edits. It completes as
the **pre-design linear quiz**, not as the workflow the frozen states describe.

---

## The finding that changes the plan

**The five response formats are designed and frozen. They are not built.**

The frozen states exist as mockups in `docs/mockups/`: the sitting shell (8),
nested parts (14), the navigator (15), short answer (11), calculation (14-calc),
extended response (12) and business report (13). Multiple choice is designed
inside the shell. What shipped to the app from that work is narrow:

- the marking wire: format, source, authored requirements (state 13 and UX-TEST-11, -12);
- a report's own instructions, its placeholder, and no essay skeleton for it (UX-TEST-09, -10);
- the format-aware demo fallback (UX-TEST-15).

The screen a student actually sits is still `examRenderQuestion` from before the
audit:

- one question at a time, strictly forwards;
- no Previous, no navigator, no flag, no skip;
- the mark renders **below** the answer;
- the unconditional answer-shape block (the essay skeleton on a 12-mark short answer);
- the shared case study re-rendered above every part.

So "the question experience is mostly designed" is true, and it is the largest
piece of **build** work left, not design work. No new mockup is needed for it.

---

## Screen by screen

Four classes, as asked:

- **usable**: implemented and usable.
- **obsolete**: implemented, but visually obsolete against the frozen states.
- **missing**: no screen exists.
- **dependent**: cannot be settled until another state or decision is.

### 1. Assessment library / Test Mode home — obsolete, and dependent on persistence

- **What exists:** one row per paper, reading *"📝 Business Studies practice paper,
  Business Studies · 20 questions · 90 marks · 3 hours (plus 5 minutes reading time)"*,
  with **Sit this paper** and **Delete** at equal weight. The empty state is honest
  and points at Create.
- **What is absent:**
  - no in-progress / completed / untouched state;
  - no Resume, no last score;
  - no source (the paper's own "original material" statement);
  - no thin-paper marker;
  - no imported-vs-built-in distinction, because nothing is built in.
- **Dependency:** in-progress and completed rows cannot exist until attempts
  persist (decision 1). Today leaving mid-paper at 1/20 and re-sitting reads
  *"0/20 answered · 0/90 marks"*, confirmed in this walk. The confirm dialog still
  says *"Your progress on this attempt is not saved"*.

### 2. JSON import — obsolete, and misplaced

- **What exists:** it is a textarea at the bottom of the **Create a flashcard set**
  page, below the card builder and the glossary, behind a button labelled
  **Import set**. It works: the paper imports.
- **What is absent:**
  - no file chooser (paste only);
  - no Test Mode entry point, except the empty state's link to Create.
- **The copy contradicts the paper:** the page says a paper will be sat *"as a
  guided past paper on your Study map"*. It appears in Test mode, not on the Study
  map, and this paper's own instructions say *"It is not a past examination"*.

### 3. Validation + curriculum review — missing

- **What the contract does:**
  - `PAPER.examine` returns every finding, each with a state, code, path and
    sentence;
  - the paper resolves to NSW · HSIE · Business Studies · Stage 6;
  - it issues the five verdicts (malformed, unsupported, blocked, thin, publishable).
- **What the student sees:** one line of grey text beside the button. Success
  reads *"Imported ✓ — open Test mode to sit it."* A refusal shows the first
  finding and *"and N others"*, which cannot be opened. A thin paper says it has
  notes and never says what they are. The curriculum it resolved to is shown
  nowhere before sitting.
- **Why this matters:** this is the screen where the contract's work is
  least visible, as the first audit found, and it is unchanged.

### 4. Exam overview / instructions — missing, and a picker stands in

- **What happens:** **Sit this paper** opens *"What do you want to sit?"*, a section
  picker with correct per-section counts and a live total. It is useful, and it is
  the first thing a student sees.
- **What is never shown, anywhere in the journey:**
  - the paper's instructions (*"Attempt all questions. This paper is original
    material…"*);
  - its total time;
  - its course.
- **Section intros exist and read well** (*"Begin Section I - Multiple choice"*),
  in the old visual language.
- **Resume:** there is no Start/Resume distinction, because there is nothing to
  resume.

### 5. Question experience — designed and frozen; not implemented

This is covered above. Two defects in the current build are **superseded** by the
frozen shell rather than worth fixing on their own:

- after a question is marked, its submit button stays disabled and reads
  **"Checking…"**;
- the page header reads **"HSC Economics / Distribution of Income & Wealth"** on
  every Test Mode screen of a Business Studies paper (UX-TEST-01, decision 4,
  still open).

The header shows on every screenshot in this walk, so on desktop it is the most
visible defect in Test Mode.

### 6. Questions navigator — designed (state 15); not implemented; either/or is dependent

- **Design:** state 15 settles answered / unanswered / flagged / current,
  section boundaries, parent-and-part nesting, and either/or as two chips on one
  item.
- **Build:** none of it exists in the app. Flag has no data behind it.
- **Either/or in the build:** it is a **choose-before-you-start** screen (*"Question
  15 / Question 16"* as buttons). It is irreversible and silent afterwards.
- **Dependency:** under free navigation the choice becomes something the
  student does by answering, and something submission must validate. That is
  settled by state 19, not by the navigator.

### 7. Submit paper — missing

There is no submission. After the last question, **Continue** becomes
**Finish paper** and goes straight to results. So there is:

- no unanswered warning (nothing *can* be unanswered in a forwards-only walk);
- no flagged list;
- no either/or check;
- no confirmation.

### 8. Results overview — obsolete

- **What works:** the arithmetic is right (55/90 in this walk; a refusal still
  costs its marks), and per-section subtotals are shown.
- **What is wrong or absent:**
  - parts are a flat list: 11(a)–(d) and 12(a)–(c) with **no question subtotal**,
    so question 11's 14 marks are never shown;
  - prompts are cut at 70 characters mid-word;
  - the either/or alternative that was not chosen is not mentioned;
  - "not marked" does not say whether it was refused or failed;
  - "unanswered" cannot occur yet.
- **Actions:** **Retake paper** discards the attempt; **Back to Test mode**.

### 9. Return to individual-question review — missing, and dependent on 7 and 8

- **What exists:** no result row is clickable (0 of 20 in this walk). The
  feedback a student saw during the paper is gone once they leave the question.
- **Design coverage:** the frozen marked states (11, 12, 13, 14-calc, MC in 8) are
  the review surfaces already, in place, with the collapsed response.
- **What is not designed:** how you **arrive** at one from results and get back:
  the review-mode shell.

---

## Summary

| # | step | class | blocked by |
| --- | --- | --- | --- |
| 1 | Library / home | obsolete | decision 1 (persistence) for in-progress and completed rows |
| 2 | JSON import | obsolete (misplaced in Create) | nothing |
| 3 | Validation + curriculum review | **missing** | nothing |
| 4 | Exam overview / instructions | **missing** (picker stands in) | persistence, for Resume |
| 5 | Question experience | designed, frozen, **not built** | build work only |
| 6 | Navigator | designed, frozen, **not built** | state 19 for either/or validation |
| 7 | Submit paper | **missing** | the navigator's status model |
| 8 | Results overview | obsolete | state 7 (what an unanswered or unsubmitted question is) |
| 9 | Individual review | **missing** | states 7 and 8 |

---

## One decision to take before the mockups

**Is "Exam conditions" in desktop v1?**

Decision 3 made the sitting policy a slot. Every frozen state is drawn under
**Practice**: each question is marked on submit, in place.

- **Practice only in v1:** submission closes an attempt whose marks already
  exist. Results are immediate, and no new state is needed.
- **Exam conditions in v1:** submission triggers marking of every written answer.
  For this paper that is 7 marker calls, some of which can refuse or fail. That
  needs a **marking-in-progress** state, and results that can arrive partially.

It is a real state with real failure modes, and nothing designed so far covers it.

**Recommendation:** ship v1 as Practice only. Keep the policy pill, and defer
Exam conditions and its marking-in-progress state until the Practice workflow is
end to end.

---

## Recommended mockup sequence: six desktop pages

Ten numbered states remain (1, 2, 3, 4, 5, 6, 7, 17, 18, 19). They close as **six
full-page mockups**, because four fold into others as variants:

1. **State 19: Submit paper.** Drawn over the frozen shell. Content:
   - unanswered, listed with display number and marks;
   - flagged, listed;
   - either/or: both answered, neither answered, or one chosen;
   - not marked, kept apart from unanswered;
   - final confirmation.

   It is small, it uses the navigator's frozen vocabulary, and it defines what
   "unanswered" means for everything after it.
2. **State 17: Results overview.** Content:
   - parents grouped with their subtotal;
   - the either/or shown as chosen;
   - unanswered, unmarked-refused and failed kept distinct;
   - every row a way into review.
3. **State 18: Question review.** One page: the review-mode shell (*"Reviewing ·
   Back to results"*, Previous/Next through the attempt, no submit, no Try again)
   around an **already frozen** marked state. No format is redesigned.
4. **State 6: Exam overview.** Absorbs state 7. Content:
   - title, course, source statement, total time, paper instructions;
   - sections with marks and instructions;
   - the section picker as a secondary "practise part of this paper";
   - Start, or Resume with progress.

   Section intros become section boundaries inside the shell, not a screen.
5. **State 1: Library.** Absorbs state 2 (empty). Row variants: untouched, in
   progress with Resume, completed with last score, thin. Delete demoted.
6. **States 3 + 4: Import and validation.** One template, absorbing state 5.
   Content:
   - choose a JSON file (paste as the fallback);
   - the resolved curriculum stated;
   - findings grouped by verdict, each with its sentence and path;
   - the three fatal verdicts as the no-go variant, thin as "can be sat, and here
     is what it lacks".

**Why this order:** it follows dependency, not journey. Each page settles
something the next one reads:

- submit defines unanswered;
- results define what review returns to;
- the overview and library both need the attempt states the first three settle.

Import and validation depend on nothing and could move earlier. They come last
because the student-facing chain matters more to v1.

## Build work, separate from mockups

These are not design questions. They are the frozen designs made real, and the
end-to-end acceptance journey needs them:

- **Attempt persistence** (decision 1): the attempt survives reload and leaving.
  It is a prerequisite for Resume, and for the library's and overview's states.
- **The sitting shell in the app** (state 8):
  - Previous / Flag / Next;
  - policy pill;
  - "Saved" line;
  - chrome from the active paper (UX-TEST-01);
  - the collapsed-response marked pattern.
- **The navigator** (15) and the **nested-part rail** (14).
- **Format-aware help** (decision 5): the answer-shape block withheld where
  nothing appropriate is authored.

**Proposed build order:** after states 19, 17 and 18 are approved, build the shell
and persistence first. Everything else renders inside the shell.

## Logged here, non-blocking for desktop v1

- **UX-TEST-14**, mobile responsive follow-up: the ~1px score/footer clearance at
  390×844. Not touched again in this phase.
- UX-TEST-07, -08, -13, -16, -17, as already logged.
- Import copy says *"past paper"* and *"Study map"* (item 2). It is fixed when
  import gets its own screen.
