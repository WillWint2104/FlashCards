# Test Mode UX audit

Read-only. No CSS, no HTML structure, no behaviour and no data contract was
changed in this pass. Every screen below was opened in the real build and
photographed; nothing is inferred from filenames.

Captured against `claude/gate3c-exam-contract` at `6fff419`, which is
byte-identical to what #66 will put on `main`. Desktop 1280×1000 first, then
390×844 for phone. 39 screenshots in `ux/`.

The paper used throughout is the synthetic Business Studies practice paper Gate
3C added: four sections, 20 answerables, 90 marks, two parents with nested parts,
an either/or, and all five canonical formats.

---

## Part 1 — what exists today

Test Mode is **eight screens**. That is the whole surface.

| # | screen | route / state | shot |
| --- | --- | --- | --- |
| 1 | Library | `examHome()` — Test mode tab | `02` |
| 2 | Library, empty | `examHome()` with `state.exams = []` | `03` |
| 3 | Section picker | `examPick(paper)` — "Sit this paper" | `11`, `22` |
| 4 | Section intro | `examRenderSection(item)` | `12`, `15`, `23` |
| 5 | Question | `examRenderQuestion(item)` | `13`, `16`, `19`, `21`, `24`, `27` |
| 6 | Feedback sheet | `examSheet(item, key, g)` — in place, below the question | `14`, `17`, `20`, `37` |
| 7 | Either/or choice | the `choose` branch of `examRenderSection` | `26` |
| 8 | Results | `examResults()` | `29`, `30`, `38` |

Import is **not a Test Mode screen**. It is a textarea in the Create tab
alongside flashcard-set import (`04`), and the only feedback is one line of text
next to the button.

---

## Part 2 — screen by screen

### 1. Library — `02`, `10`, `36`
**Consumes** `state.exams`, `examCounts()` → `PAPER.totals`, `examCourse()` →
`curriculum.course || subjectKey`.

**Works.** The row is genuinely informative and now correct after Gate 3C:
*"Business Studies practice paper — Business Studies · 20 questions · 90 marks ·
3 hours"*. 20 is answerables, not array length; 90 counts the either/or once.
A paper with no subject key reads *"no subject declared"* rather than guessing.

**Confusing or missing.** Nothing distinguishes a `thin` paper from a
`publishable` one — after importing both, the two rows are identical (`10`). No
year, no source, no paper status, no attempt history, no "last sat". Delete is
as prominent as Sit.

**Survives the architecture?** Yes, and it under-uses it: `exam.id`, `title`,
`year`, `kind`, `source`, `version` are all carried and **none is displayed**.

**Verdict — substantially redesigned.** The data for an assessment library
exists; the row is a flashcard-set row wearing it.

### 2. Library, empty — `03`
*"No practice exams yet. Practice exams are imported, not built in. Paste a
paper's JSON in the Create tab…"* plus a button that goes there.

**Works.** Honest, and it points somewhere. **Verdict — lightly revised**, once
import stops being a Create-tab textarea.

### 3. Section picker — `11`, `22`, `34`
**Consumes** `PAPER.totals({sections:[sec]})` per section.

**Works.** Correct counts per section (10 · 10, 8 · 40, 1 · 20, 1 · 20) and a
live total that updates as you tick. Genuinely useful for practice.

**Confusing.** It is the **first thing** a student sees after choosing a paper,
before any overview. The paper's title, source, year, instructions and total time
never appear anywhere. A student cannot see what they are about to sit.

**Verdict — retain the mechanism, but it is the wrong first screen.** There is no
exam overview screen at all; this is standing in for one.

### 4. Section intro — `12`, `15`, `23`
**Consumes** `sec.name`, `sec.instructions`, `PAPER.totals` per section.

**Works.** Reads like a real paper: *"40 marks. Attempt Questions 11 to 13.
Allow about 70 minutes for this section."* The count is now right after Gate 3C
("8 questions · 40 marks" where the array holds 3).

**Verdict — retain.** Closest thing to a finished screen in Test Mode.

### 5. Question — `13`, `16`, `19`, `21`, `24`, `27`, `35`
**Consumes** `item.display` (authored numbering), `q.marks`,
`PAPER.resourcesFor` (parent + own), `item.parent.instructions`, `answerInput`,
`answerShapeBlock`, `submitRow`.

**Works, and better than expected.**
- Authored numbering reaches the screen: **"Question 11(a) · 2 marks"** (`16`).
- The shared case study appears above **every** part of question 11 — (a), (b),
  (c) all carry it (`16`, `18`, `19`). The parent's instructions ride with it.
- Formats render correctly from the canonical format: choices for MC, a numeric
  input for calculation, a sized textarea for written.
- The progress bar is honest: *"13/20 answered · 19/90 marks"*, and adds
  *"· 1 not marked"* when something was refused (`37`).

**Broken or wrong.**
- **The answer-shape block appears on multiple choice** (`13`): *"What your
  answer has to do — answer it… support it… back the answer with specific
  evidence"* above four radio choices worth 1 mark. It is advice for an essay,
  shown to someone about to click a button.
- **And on calculation** (`19`): *"Worth 4 marks, so the marker is looking for
  about 4 distinct creditworthy points"* — for a question whose answer is `1.5`.
- **The shared stimulus is re-rendered in full on every part.** On the phone the
  case study starts at 315px and the question head at **608px** of an 844px
  viewport (`35`). You scroll past the source to find out what is being asked,
  on every part, four times.
- **There is no navigator and no way back.** On an unanswered question the only
  controls are the back arrow and "Submit for marking" — `#examnext` does not
  exist until you have answered (`39`). You cannot skip, cannot return, cannot
  see where you are beyond "13/20".
- Section name is shown in caps as a breadcrumb; the paper name only in the bar.

**Survives the architecture?** The plumbing does. The screen does not express
what the contract now knows — no part-within-parent context beyond the number, no
sense of "3 of 4 parts of question 11".

**Verdict — substantially redesigned**, and it is five different screens
(MC / calculation / short / extended / report) currently sharing one layout.

### 6. Feedback sheet — `14`, `17`, `20`, `37`
**Consumes** the grading result; `isMarked()` decides arithmetic.

**Works.** Marked results show `1/1 Full marks` with the choice's `why` (`14`).
**The refusal state is excellent** (`37`) and is the strongest screen in Test
Mode: *"Not marked. This response was not marked: no subject package named
"legal_studies" is available… Your answer is still here, and nothing has been
recorded against it, including the 20 marks this question is worth."* The submit
control comes back enabled; the bar reads *"0/1 answered · 0/20 marks · 1 not
marked"*.

**Confusing.** It renders **below** a long question and a long answer-shape
block, so on anything but a short question the mark appears off-screen. "Try
again" and "Continue"/"Finish paper" sit at the bottom of a long scroll.

**Verdict — retain the semantics, redesign the placement.** A mark is the thing
the student is waiting for and it is the least visible element on the page.

### 7. Either/or choice — `26`
**Consumes** `sec.choose`, `q.label`, `q.prompt`.

**Works.** *"20 marks · choose 1 of 2"* with both prompts shown as buttons.
Choosing sequences only that question and counts it once.

**Missing.** The choice is irreversible with no warning, and once made there is
no indication anywhere that an alternative existed.

**Verdict — lightly revised.**

### 8. Results — `29`, `30`, `38`
**Consumes** `answerablesNow()`, `ASSESS.tally` per section.

**Works.** Big score, per-section subtotals, per-question rows with the authored
display number (`11(a). Outline ONE operations…  2/2`). A refused question shows
"not marked" and costs its marks without scoring them.

**Broken.**
- **Parts are a flat list.** Section II shows eight rows — 11(a), 11(b), 11(c),
  11(d), 12(a), 12(b), 12(c), 13 — with **no grouping and no question subtotal**
  (`30`). Question 11 is worth 14 marks and the results page never says so, which
  is the flattening Gate 3C removed from the contract reappearing in the UI.
- Prompts are truncated at 70 characters mid-word.
- There is **no way to review an individual question** — no answer, no feedback,
  no model. The sheet you saw during the paper is gone for good.
- No time taken, no comparison, no next action beyond Retake.

**Verdict — substantially redesigned**, and it needs a second screen behind it
(individual question review) that does not exist at all.

---

## Part 3 — import, which is where the architecture is least visible

The five-state taxonomy Gate 3C built is **almost entirely invisible**. All five
states resolve to one line of grey text beside a button (`05`–`09`).

| paste | what the student sees | verdict |
| --- | --- | --- |
| malformed | *"this section says it is worth 40 and its questions add to 38… (sections[1].marks) — and 3 others."* | the leading finding is not the most useful one, and "3 others" cannot be read |
| **unsupported** | **"The set has no cards array."** | **wrong message entirely — see below** |
| blocked | *"an exam declares the curriculum it belongs to…"* | accurate, and buried |
| thin | *"Imported ✓ — open Test mode to sit it. 2 notes on what this paper does not carry."* | says there are notes, never says what they are |
| publishable | *"Imported ✓ — open Test mode to sit it."* | fine |

### A defect this audit found

**A package declaring an unsupported version never reaches the exam contract.**
`importSet` routes on `data.format === EXAM_FORMAT`, so `marginal-exam@2` fails
that equality, falls through to the flashcard-set validator, and the student is
told **"The set has no cards array."** — a flashcard error for an exam package.
`PACKAGE_VERSION_UNSUPPORTED` exists, is correct, is asserted in `t30`, and is
**unreachable through the UI**.

This is the same shape as the Gate 3C finding about drawing: the contract is
right and the door never asks. It is a routing fix of a line or two, but it is a
product defect and it is recorded here rather than fixed, because this pass
changes nothing.

**Verdict — import needs its own screen, and a validation screen behind it.**
Every finding carries a `state`, a `code`, a `path` and a sentence written for a
person. One line of grey text is the wrong container for that.

---

## Part 4 — persistence

**Leaving a paper loses everything.** Mid-paper at *"1/20 answered · 1/90
marks"*, the back arrow warns *"Your progress on this attempt is not saved"*,
and re-entering starts at Question 1 with *"0/20 answered · 0/90 marks"*
(`31`, `32`). `examStart` resets `EXAM.results`, `EXAM.answers` and
`EXAM.choice`.

The **paper** persists across reload — Gate 3C proves that. The **attempt** does
not persist at all, not even in memory across a tab change.

For a three-hour paper this is the single largest gap in Test Mode. It is a
product decision, not a bug: guided mode was built as one sitting.

---

## Part 5 — the ten questions

These are design questions and the audit answers them as evidence, not as
decisions.

**1. Should 21(a)–(d) show one at a time or together?**
Evidence for *together*: the case study is re-rendered four times and pushes the
question 600px down on a phone; a student answering (c) usually wants (a) and (b)
visible; the paper itself prints them together. Evidence for *one at a time*: the
feedback sheet is per-part and guided mode grades on submit, so four open parts
means four sheets on one screen. **Recommendation: parent together, parts
progressively revealed** — one scroll, source pinned, each part grading in place
as it is submitted. The contract supports either without change.

**2. How should shared stimulus stay visible?**
Today it is duplicated per part. It should be **one element that persists** —
sticky on desktop, collapsible-with-peek on phone. This is the single highest
impact change available.

**3. Business Report vs Extended Response?**
Today they are **visually identical** (`24` vs `27`) — same textarea, same shape
block, same submit. The only difference is the section name. The format is
carried to the marker and shown nowhere. They should share the writing surface
and differ in the *scaffold*: a report's shape block should say report structure,
not "introduction / body / conclusion". Not a separate application.

**4. What should the navigator show?**
There is no navigator. Given parents are real objects, it should show **top-level
numbers with parts nested underneath** — 11 with (a)(b)(c)(d) under it — because
that is the structure of the paper and now of the data.

**5. Either/or once chosen?**
Currently silent and irreversible. It should stay visible that a choice was made
and which one, at least on the results page.

**6. How should `thin` be presented to the student?**
**Mostly not at all.** `thin` is a fact about authoring, not about the student's
work. It belongs on the import/validation screen and on the library row as a
quiet marker. The one place it reaches the student honestly is where a question
will be marked from course criteria alone — and that is better said at the point
of marking than as a banner.

**7. Refused vs failed?**
Refused is already right and should be preserved exactly: named, unscored, answer
retained, marks still counted against the total, submit re-enabled. Failed
(something broke) should be visibly *retryable*, which it currently is not
distinguished as.

**8. How should results group parents and parts?**
Parent as a row with its own subtotal, parts indented beneath. Today it is flat
and question 11's 14 marks are never shown.

**9. Permanent vs drawer?**
Permanent: question number, marks, the answer surface, progress, and the shared
stimulus. Drawer: the answer-shape guidance (currently permanent and enormous),
the model answer, marking detail. The shape block is roughly the same height as
the question it advises.

**10. Phone?**
Source-first layout is the problem: 315px of case study before a 608px question
head. Needs collapsed source with peek, a sticky question header, and the mark
result surfacing at the top of the sheet rather than the bottom of the scroll.

---

## Part 6 — logged defects

### UX-TEST-01 — the active exam does not own the subject chrome

**Confirmed, and the cause is not what it looks like.** While sitting a Business
Studies question the page still reads **"HSC Economics — Distribution of Income &
Wealth"**, and the same header sits above the `legal_studies` refusal panel.

But it is not a leak from the Study-mode picker. `index.html:2830` is a literal:

```html
<div class="unit">HSC Economics<br>Distribution of Income &amp; Wealth</div>
```

Nothing in `app.js` ever writes it — the only `.unit` reference is `C.unit` on a
study card's meta line, a different thing. The `<title>` is hardcoded the same
way. The exam screens replace the nav tabs entirely and this header still
persists, because it sits outside `#app` in the page shell.

So it is not stale state; it is a **single-course assumption baked into the shell**
from when the product only served Economics. The consequence is the one you
identified and it is serious: Gate 3A made the marking authority correct while the
page still tells the student they are inside Economics. The fix is different from
a state fix, though — the chrome has to become derived at all, before it can be
derived from the active paper.

**Recorded as a UX/runtime defect. Not redesigned here.**

### UX-TEST-02 — unsupported exam versions went to the wrong importer — **FIXED**

`importSet` routed on `data.format === EXAM_FORMAT`, an exact match. A package
declaring `marginal-exam@2` failed that equality, fell through to the
flashcard-set validator, and the person holding an exam file was told **"The set
has no cards array."** `PACKAGE_VERSION_UNSUPPORTED` was correct in the contract
and asserted in `t30`, and nothing ever handed it the file.

The door now recognises the schema **family** and lets the exam validator rule on
the version. Recognising the family is not accepting the version:

| pasted `format` | goes to |
| --- | --- |
| `marginal-exam@1` | exam validator → imports |
| `marginal-exam@2` | exam validator → *"is not a package version this release can run. It runs "marginal-exam@1", and does not guess at the difference"* |
| `marginal-exam` | exam validator → same refusal |
| `{name, cards:[...]}` | flashcard importer, unchanged |
| `{format: "something-else"}` | flashcard importer, unchanged |

Guarded by `ui68` (the message a person actually reads, plus the two negative
cases proving flashcard sets are not swallowed), by `t30` (the door does not route
on an exact version match), and by a mutation that restores the old routing.

## Part 7 — the mockup inventory, grouped into page families

Seventeen states, **five families**. The families are the point: MC, calculation,
short answer, extended response and Business Report are one shell with different
response surfaces, not five layouts.

### A. Library and import
| # | state | kind |
| --- | --- | --- |
| 1 | Test Mode home / assessment library | **template** |
| 2 | Library, empty | variant of 1 |
| 3 | Import exam | **template** |

### B. Validation and setup
| # | state | kind |
| --- | --- | --- |
| 4 | Validation / curriculum review — findings by state | **template** |
| 5 | Blocked / unsupported / malformed | variant of 4 (same layout, fatal verdict) |
| 6 | Exam overview / instructions | **template** — missing today |
| 7 | Section picker + section intro | variant of 6 |

### C. The sitting shell
One template. Everything below shares the header, the numbering, the progress,
the stimulus region and the navigator; only the response surface differs.

| # | state | kind |
| --- | --- | --- |
| 8 | **Sitting shell** — the common frame | **template** |
| 9 | Multiple choice | response-surface variant of 8 |
| 10 | Calculation | response-surface variant of 8 |
| 11 | Short answer | response-surface variant of 8 |
| 12 | Extended response | response-surface variant of 8 |
| 13 | Business Report | variant of 12 — differs by scaffold, not by application |
| 14 | Nested parent with parts | **structural variant of 8** — the one that decides one-at-a-time vs grouped |
| 15 | Question navigator | component of 8, mocked on its own because it does not exist |

### D. Feedback and marking
| # | state | kind |
| --- | --- | --- |
| 16 | Feedback sheet — marked, refused, failed | **template** |

### E. Results and review
| # | state | kind |
| --- | --- | --- |
| 17 | Results overview — parents grouped, subtotals restored | **template** |
| 18 | Individual question review | variant of 17 + 16 — missing today |
| 19 | Submit confirmation | variant of 17's shell |

**Nineteen numbered states across five families, six of which are true
templates** (1, 3, 4, 6, 8, 16, 17). That is two more states than the seventeen I
proposed last pass, because grouping them exposed three that were hiding inside
others: the empty library, the fatal-verdict variant, and the sitting shell
itself, which is the thing worth designing first.

**Suggested order.** 8 first — the sitting shell — because nine of the nineteen
are variants of it and every decision about stimulus, numbering, navigation and
progress is made once, there. Then 14 (nested parent), because it is the decision
you deliberately deferred and it stresses the shell hardest. Then 16, 17, and the
response surfaces, which become small once the shell is settled.

**Deferred, not dropped:** an attempt-resume screen. Until the product decides
whether an attempt survives leaving, there is nothing to mock.

## What does not need to change

Gate 3A–3C hold up. The contract answered every question the UI asked of it, and
three things the UI does well it does **because** of them: the library row counts
answerables and not array entries, the question header says 11(a) because the
paper says so, and the refusal names the subject that could not be resolved and
protects the student's answer. No contract or runtime change is required to build
any screen in the inventory above.

One product defect is recorded and not fixed: the unsupported-version routing in
`importSet`.

---

## Found while designing state 11 (short answer)

Both were proven by running against the real fixture, not by reading.

### UX-TEST-03 — every short answer scores full marks, including an empty one — **FIXED**

In Test Mode a short answer is not sent to the marking worker. `app.js:2432`
routes it to `gradePoints`, which grades it locally against the paper's authored
marking points, one point per mark.

`gradePoints` (`app.js:2444`) reads each entry as an **object**:

```js
const need = (Array.isArray(pt.need) && pt.need.length) ? pt.need : [pt.text];
const hit  = need.some(al => a.includes(norm(al)));
```

The contract's own fixture, `tests/fixtures/bus-practice-paper.json`, authors
them as **strings**. So `pt.text` is `undefined`, `norm(undefined)` is `""`, and
`"any answer".includes("")` is `true` for every point. Measured on 11(b), a
3-mark question with three authored points:

```
answer ""                                    -> 3/3   hits 3/3
answer "banana"                              -> 3/3   hits 3/3
answer <a genuine two-point response>        -> 3/3   hits 3/3
rendered point text                          -> "undefined"
```

Every short answer in the paper is affected: 11(a) 2/2, 11(b) 3/3, 12(a) 3/3,
12(b) 4/5. The checklist that is supposed to show what was missed shows three
ticks against the word `undefined`.

**Fixed.** Reading marking points is now a single contract function,
`ASSESS.markingPoints`, which accepts both authored shapes — a string, or
`{ text, need?, hint?, marks? }` — and **refuses** anything else with
`POINTS_MALFORMED`: a non-string non-object, blank text, a negative or
non-numeric mark. A point that cannot be read is not a point that was addressed,
so the response is not marked rather than marked generously.

The matching rule moved with it, into `ASSESS.scorePoints`, where it can be
tested without a browser. The specific mechanism of the fault is now a named
case: **a phrasing that normalises to nothing matches nothing.** Measured after
the fix, on the same question:

```
answer ""                                    -> 0/3   hits 0/3
answer "banana bread"                        -> 0/3   hits 0/3
answer <one authored point, verbatim>        -> 1/3   hits 1/3
answer <two authored points>                 -> 2/3   hits 2/3
rendered point text                          -> the authored text
```

`tests/t31.mjs`, 41 assertions, in `fast` and `checkpoint`.

### UX-TEST-04 — a question whose points cannot reach its marks — **RESOLVED**

12(b) is worth **5 marks** and authors **4 points**, each worth 1 under
`pt.marks || 1`. `score = Math.min(raw, q.marks)` caps at 4, so **no answer can
score 5/5** while points grading is in force. 11(d), 12(c), 13, 14, 15 and 16
have the same shape but are extended responses, which go to the worker instead.

**Resolved, and it turned out to be the deeper of the two.**

The audit answered the question 12(b) raises. `points[]` is authored across this
paper as **key marking points** — the things a marker looks for — and not as an
allocation. The extended responses settle it: they author **four points against
twelve and twenty marks**. Nobody wrote those as four marks. Three of the four
short answers happen to have as many points as marks; one does not; and nothing
anywhere in the contract said the two were related at all.

So the permanent model is:

> **Marking points are guidance. A mark is derived from them only where a paper
> authors per-point marks that sum to the question's marks.**

`weighted` is that declaration, and **nothing implies it**. A question whose
point count happens to equal its mark count has still not said one point is one
mark, and inferring it from the coincidence is the same substitution Gate 3B
removed from formats. `markingPoints({marks:3, points:["a","b","c"]}).weighted`
is `false`, and t31 asserts it.

Where no weighting is authored, the points do not produce a score at all
(`scorePoints(...).score === null`) and the mark comes from the marker, which is
the only thing that can say what the remaining marks were for.

**12(b) was not changed to fit.** Its five marks and four points stay exactly as
authored, and it is now the fixture's canonical unweighted case. The three short
answers that were already one-to-one had that made explicit — `{ text, marks: 1 }`
— which changes no mark value and states what was previously only a coincidence.
