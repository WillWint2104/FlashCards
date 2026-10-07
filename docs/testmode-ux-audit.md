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

### UX-TEST-05 — `missing_vocabulary` is dead UI

The marking worker sets `r.missing_vocabulary = []` unconditionally in
`finalize`. `app.js` renders chips for it in two places, the study sheet and the
exam sheet. Nothing has ever been in it on this path.

Either it is connected to something real or the two renderers go. Logged while
auditing state 12; not fixed there, because it does not affect any visible state
the extended-response design has to decide.

### UX-TEST-06 — the sitting shell's footer takes 119px of a 390px phone, and the mark sits behind it

Found while recapturing state 12 with the response collapsed. Measured on the
generated page at eight sizes, against the footer's top rather than
`window.innerHeight`, because both bars are sticky and painted over the page:

```
 430x932   footer starts 813 of 932   mark 693-760   clear
 390x844   footer starts 725 of 844   mark 718-786   behind the footer
```

At 390px the footer wraps its three controls and the item counter onto four
lines. It is 63px tall at desktop and **119px at 390px**, which is 14% of the
screen, and it lands exactly where the mark is. The judgement under the mark does
not appear on the first screen at all.

This is not state 12's: the collapsed response is 50px, and the same page at
430x932 clears the mark comfortably. It is the **frozen state 08 shell**, and it
affects every marked question at that width, not only extended responses.

The candidates are shortening the middle label at narrow widths (`Item 20 of 20 ·
Section IV` is what forces the wrap) or letting the footer fall to two rows with
the counter on its own line. Not fixed here, because state 08 is frozen and the
fix is a change to a frozen state rather than to the one under review.

**How it was missed until now:** every earlier fold measurement in this project
compared an element's bottom with `window.innerHeight`, which is not the fold on
a screen with a sticky footer. `tests/ui69.js` now measures against the footer's
top, and the mobile half of it asserts this finding as a finding, so fixing the
shell turns the suite red and brings someone back to this entry.

### UX-TEST-06 — FIXED. The compact footer row, and what it did and did not buy

The shared footer is one row below 640px: `← Previous`, `⚑ Flag`, `Finish →`,
with the item counter hidden and the trailing half of each label dropped through
one `.foot-lbl` class. Measured across ten pages:

```
              before            after
320-360px     131px, 4 rows     63px, 1 row   (and 320px no longer overflows on 9 of 10)
390-600px     119px, wrapped    63px, 1 row
660px+         63px             63px          unchanged, to the pixel
touch target   37px / 35px      44px          for the first time at any width
```

Desktop and tablet are untouched, and that is measured rather than asserted:
every structural box on all ten pages sits at the same coordinates, the rendered
text of every page is identical, and every document height matches.

**What it bought.** At 430x932, 768x1024 and 1280x800 the mark on every one of
the six marked pages is now clear of the footer on arrival. At 390x844 state 12
is clear, which is the collapsed response and the shorter footer together.

**What it did not buy, and this is the open half.** At 390x844 the mark is still
behind the footer on arrival on four pages:

```
  14-calculation-checked-correct     mark text 790-828, footer starts 781
  14-calculation-checked-notquite    mark text 790-828, footer starts 781
  14-worked-solution                 mark text 790-828, footer starts 781
  11-short-answer-keypoints          mark text 820-857, footer starts 781
  11-short-answer                    mark text 876-913  - below the fold, not behind the bar
```

This is no longer the footer's doing. The footer is 63px, the same as desktop;
the mark simply lands at the bottom of the first screen because of what those
states put above it. Scrolling clears it at every width, which `tests/ui69.js`
asserts. Closing it would mean reordering content in two frozen states, which is
a design decision and not a shell one.

### UX-TEST-06 — the record, corrected with the real fonts

Every fold number above was measured with the web fonts blocked, which the test
harness does for speed, and the entries did not say so. The adversarial review of
state 13 caught it. Re-measured with Fredoka and Nunito proven loaded:

```
                                  old footer (119px @725)     new footer (63px @781)
  12 extended response   mark     599-638  clear              599-638  clear
                         judgement 668-909 BEHIND             668-909  below the fold
  14 calculation (x3)    mark     670-708  clear              637-675  clear
  11 short answer        mark     -                           697-735  clear
  11 keypoints           mark     -                           671-710  clear
```

Two corrections follow. First, what the old footer covered on the extended
response was the **marker's judgement**, the paragraph directly under the mark -
not the mark, as this entry and the decision to reopen the shell said. The defect
was real: a 119px, four-line footer over content on every marked page. The
evidence cited for it was half an artefact. Second, the claim above that "at
390x844 the mark is still behind the footer on arrival on four pages" is
**withdrawn**: with real fonts every calculation and short-answer mark clears the
new footer at 390x844. The one page where the mark is behind the footer is state
13's business report (UX-TEST-14).

The footer claims themselves hold with real fonts: 119px wrapped to four lines
before, 63px at every width after, 44px actions at the narrow breakpoint.

### UX-TEST-07 — `11-short-answer` overflows horizontally at 320px

Found by the same sweep. Nine of the ten mockups have no horizontal overflow at
any width from 320 to 1280. `11-short-answer.html` has `scrollWidth` 342 against
a 320px viewport, and the overflow is the `.qcard` / `.srcpanel` grid, not the
footer: both render 326px wide inside a 320px page. 320px is narrower than any
device in the target list, and the fix is in the source-panel layout rather than
in the shell, so it is logged rather than taken with the footer.

### UX-TEST-08 — the shared tokens fix contrast and flatten the grey hierarchy

Applying the approved tokens to Calculation and Short Answer took both from
29-39 AA failures to zero, with **zero layout change**: every text node in all
five files is at the same coordinate and every document height is identical.

But the two greys that carried the secondary and tertiary tiers have collapsed
into each other. Measured as relative luminance on the rendered page:

```
                 before              after
  --ink          0.064  (9.1:1)      0.064  unchanged
  --ink-2        0.241  (3.61:1)     0.130  (5.84:1)
  --ink-3        0.476  (2.00:1)     0.148  (5.31:1)
  ink-2 vs ink-3  1.81:1              1.10:1
```

`--ink-3` was nearly twice the luminance of `--ink-2`, which is what made
metadata recede. They are now within 1.10:1 of each other, and `--ink-3` has
landed between `--green-dk` (0.146) and `--gold-dk` (0.152), so the tertiary grey
now reads at the same weight as the accent text. Everything that is not `--ink`
sits in a band from 0.088 to 0.152 where it used to span 0.223 to 0.476.

Some compression is unavoidable: a tier at 2.00:1 was unreadable, and "recedes"
and "passes AA" cannot both be satisfied by a 2:1 grey. The distribution can
still be fixed, because the space between `--ink` at 9.1:1 and the AA floor is
being used unevenly. `--ink-3` is already at the floor (5.31 on white, 4.75 on
its worst surface) and cannot move. `--ink-2` can:

```
  --ink-2 now      #596866   white 5.84   worst 5.22   vs ink-3  1.10
  candidate        #4C5B58   white 7.13   worst 6.38   vs ink-3  1.34
  candidate        #485755   white 7.58   worst 6.78   vs ink-3  1.43
```

That would make the three steps 9.1 → 7.1 → 5.3 rather than 9.1 → 5.8 → 5.3.
**Not applied.** The tokens were approved as a baseline in the previous round and
changing one of them is a change to that baseline, not an implementation detail.

### UX-TEST-09 — the app shows a business report writer an essay skeleton, contradicting the question's own marking point

Found by the state 13 audit, and it is a defect today rather than a design gap.

`answerShapeFor` branches on written mode (`app.js:1852`), and `business_report`
maps to `"extended"` (`assessment.js:252`), so a report writer is given
`ESSAY.answerShapes.extended` — introduction, each body paragraph, conclusion —
under the note "the marker is reading for a sustained argument, **not a list of
points**" (`app.js:1858`).

The question's own first marking point says the opposite:

> "Uses a report structure with headings rather than continuous prose"
> `tests/fixtures/bus-practice-paper.json:504`

The comment above that code says the shape comes from the same words the marker
was told, "so this cannot disagree with what the marker was told". It does not
disagree with the marker. It disagrees with the author, and the student is the
one who acts on it.

Two smaller faults sit beside it. The stimulus row is added only when
`!extended` (`app.js:1855`), so a report built on a case study never gets the row
about using its source. And the answering surface is otherwise the essay's,
including the placeholder "using blank lines between paragraphs"
(`app.js:1826`).

Not fixed here: it belongs with state 13, where what a report writer should be
shown instead is the question being designed. Logged so it is not mistaken for a
design gap when it is a live contradiction.

### UX-TEST-10 — a leaf question's `instructions` renders nowhere

`app.js:2393` draws question-level instructions only for a **parent** question,
above its parts. The one authored business report is a leaf — `PAPER.isParent`
returns false for it, executed — so its instructions sentence, "Use the case
study below. Present your answer as a business report with a clear structure."
(`bus-practice-paper.json:496`), is never rendered to anybody. It is not sent to
the marker either, so the only question-attached statement that this response is
a report is invisible in both directions.

The word reaches the student exactly once, from the section intro
(`app.js:2365`), on a screen they leave by pressing the only button on it.

One expression fixes the rendering half. Logged rather than taken, because what a
report question shows above the answer box is state 13's to decide.

### UX-TEST-09 and UX-TEST-10 — FIXED in the app, with state 13

A report writer is no longer handed the essay skeleton: `answerShapeFor` returns
no shape for a business report, because nothing per question describes a
report's shape except its own instructions, and those now render. The
placeholder says "blank lines between sections". A leaf question's own
`instructions` render under its heading and above its case study. Measured on the
wire against the previous build, the extended response's answering surface and
request are unchanged. Held by `tests/ui70.js` and three mutations.

### UX-TEST-11 — the marker is now told to use a case study it is never sent

A consequence of decision 14, and the first thing to fix before this marking can
judge the report's last point. Routing the report's own words means the marker
now reads "Use the case study below" and "Justifies the recommendations against
the evidence in the case study". The case study itself still travels as
`stimulus: true` (`app.js`), the extended prompt never reads even that, and its
text never leaves the page. So the marker is asked to judge use of evidence it
cannot see.

Before decision 14 the marker was not told the case study mattered. Now it is
told, and still cannot look. That is more honest about the task and no more able
to mark it. Sending the case study's text is a worker change: there is no
existing channel whose meaning fits it. The state 13 fixture is written so the
marker cites nothing the student did not write, and `tests/t36.mjs` fails the
page if it does, but that is a constraint on the mockup, not on a real marker.

### UX-TEST-12 — an extended response's marking points reach nothing, and the validator counts them as support

`business_report` now routes its points to the marker. `extended_response` does
not: it is state 12's frozen format, and decision 14 was scoped so its request
stays byte-identical. So q15 and q16 each author four marking points that nothing
at runtime reads - not the marker, and not `scorePoints`, which only short-mode
formats reach.

The paper validator does not know this. `MARKING_SUPPORT_ABSENT` treats "no model
answer and no marking points" as thin, so an extended response with points and no
model answer is reported as supported, when its points go nowhere. Routing them is
the same one-line change to `reportGuidance`'s scope, and a change to what state
12's marker is told, so it is its own decision.

### UX-TEST-13 — every earlier mockup puts an em dash in front of the student

Measured in rendered text across all twelve mockups. The ten before state 13
render the section name with an em dash - "Section II — Short answer" - in the
paper bar, and `15-navigator` does it five times. All ten page titles carry
one too. The authored data they depict uses a hyphen ("Section II - Short
answer"), and the app renders the data, so the mockups are also unfaithful to it.
State 13 renders the authored name and carries none; `tests/t36.mjs` enforces
that for its pages. The ten are frozen, so this is logged rather than swept.

Separately, `12-extended-response-answering.html` is titled "Extended response
marked": the state 12 generator writes one title for both pages.

### UX-TEST-14 — on a 390px phone the report's mark sits behind the footer

**Corrected.** This entry first said the mark was "below the first screen, not
behind the footer", from a measurement taken with the web fonts blocked. With
Fredoka and Nunito loaded, as a student's browser loads them, the mark's text spans
756 to 795 against a footer starting at 781: it is behind the footer, the
UX-TEST-06 fault class, on the one marked page the shell fix does not reach. At
430x932 and every wider size it clears.

What sits above it is the question itself - its instruction, the collapsed
case-study line and a five-line prompt - so state 12's principle of collapsing what
the student has already read has nothing left to collapse. Every fix reopens
something locked: moving the result above the response inverts the order state 12
fixed; collapsing the question's own text once marked is a new pattern that would
have to apply to every format; tightening spacing only moves the line for this
prompt's length. It needs a decision.

**Status after decision 16:** a mobile responsive follow-up, **non-blocking for
desktop Test Mode v1**. The 48px footer left the mark's text about 1px clear at
390×844 (794.94 against 796). That margin is thin. It is not reopened in this
phase; it belongs to the consolidated mobile pass.

### UX-TEST-15 — the demo-grade path still coaches paragraphs, under em dashes

Found by the state 13 review, and older than it. When the marking endpoint cannot
be reached, `demoEssay` grades every written response - a business report
included - on "Development (length & paragraphs)" and tells the student to "aim for
roughly 700+ words across 4–5 paragraphs". Its summary opens "Couldn't reach your
grading endpoint (...) — showing a demo grade instead", and two more student-facing
strings on the same path carry em dashes ("Demo grade — connect a grading
endpoint..." and the next step "This is a structural check only — ..."). State 13
removed the paragraph default from a report's placeholder and shape; this path still
has it. Logged rather than fixed with state 13, because it is every format's fallback
and not the report's.

### State 13 correctness pass — UX-TEST-11, -12, -14 and -15 FIXED, and the report's format carried through

**UX-TEST-11, fixed.** The source material the student was given now reaches the
marker, in both passes, as `stimulusContext`. It is built by
`PAPER.sourceContext` from what was authored and nothing else: text and captions
verbatim; an SVG bar chart as its title and one value per bar, read by a strict
reader that accepts only a fully labelled axis and bars that read to whole values,
with a sentence saying how the values were read; anything else declared to the
marker in words as shown-but-not-included, and reported to the author by the
validator as `SOURCE_NOT_REPRESENTED`. The budget is the worker's own 4000
characters, refused whole rather than cut. A part is sent its parent's source; a
section's source is included first. The student-facing caveat that the case study
was not sent is gone.

**The format, fixed.** The worker kept `format` nowhere. It now accepts the three
written formats, and both passes say "business report" for one, with the directive
- recommend - travelling separately in the question line. No "report" directive
exists or was created. Where the shared system prompts still speak of an extended
response, it is a rule about the extended marking behaviour and now names the
business report beside it.

**UX-TEST-12, fixed.** Authored marking points reach the written marker for every
written format, as text, without mark values. A business report additionally sends
its own instructions, first. State 12 was re-verified rather than held
byte-identical: its request gained exactly one field, `requirements`, carrying its
four points (3140 to 3506 bytes), and nothing else moved. Its generated pages are
unchanged, because the worker's post-processing is untouched.

**UX-TEST-14, fixed.** The narrow sticky footer is 48px: 1.5px above and below the
44px targets. At 390x844, with the real fonts, the business report's score now ends
at 794.94 against a footer at 796. Every marked page clears. `tests/ui71.js` holds
this with Fredoka and Nunito served from a local cache and proven loaded, and
fails if they are not.

**UX-TEST-15, fixed.** The degraded demo grade counts a business report in
sections and never tells it to write paragraphs; an extended response keeps its
paragraph language. The three em dashes on that path are gone.

### UX-TEST-16 — the request already carries teaching material

Found while establishing the general rule for UX-TEST-12. Every written marking
request already sends `vocab` (printed as REQUIRED METALANGUAGE), `scaffold`
(printed as a shape the answer can follow) and, where no requirements are
authored, the scaffold again as `requirements.accomplish`. For exam questions these
are empty in every authored paper; for study cards and Essay Practice they are
populated. By the rule that teaching scaffolds and vocabulary assistance should not
reach the marker, they should not be there. They predate state 13 and nothing of
that kind was added; removing them changes Essay Practice marking, which is its own
decision.

### UX-TEST-17 — should state 12 show "What your marker was told to look for"?

State 13 shows the question's own guidance beside its result because it is sent to
the marker. Since UX-TEST-12 an extended response's points are sent too, so the
same section would be true on state 12's marked page. State 12 is frozen; this is
logged for the consistency sweep.

## Found while deriving the library's attempts (Slice A)

Deriving the example attempts through the shipped code, rather than typing their
marks, exposed three marking and content defects and one fault in the frozen
mockups. The first two are marking-correctness defects, and desktop v1 accepts
on correct marking.

### UX-TEST-18: a correct short answer scores 0 when its points are weighted

`ASSESS.scorePoints` credits a point when the answer contains one of its `need`
phrasings, or the point's own `text` when none is authored. None of the synthetic
paper's weighted points authors `need`, so each is matched against its own
description:

| question | full, correct answer | scored |
| --- | --- | --- |
| 11(a) | *"Speed. Customers at the vans wait too long in the 7am to 9am morning peak…"* | 0/2 |
| 11(b) | no guaranteed hours or leave, insecurity leads to leaving, replacement cost | 0/3 |
| 12(a) | *"The gross profit ratio has gone down from 40% in 2024 to about 37%…"* | 0/3 |

A student would have to write *"Names speed, or dependability, as the
objective"* to score. The validator calls the paper publishable, so the contract
and the runtime disagree about whether these points can be marked. The fix is a
decision and is not made here. Two routes:

- a weighted point with no `need` goes to the marker, which awards against the
  points and their weights;
- a weighted point with no `need` becomes a validator finding.

### UX-TEST-19: the calculation parser reads every digit in the answer as one number

`gradeCalc` strips everything except digits, `.` and `-`, then parses:

| answer | parsed | against 1.5 ± 0.05 |
| --- | --- | --- |
| `1.5` | 1.5 | correct |
| `1.5 : 1` (the frozen state's own example) | 1.51 | correct **by accident** |
| `60 000 / 40 000 = 1.5` | 60000400001.5 | wrong |
| `3:2` | 32 | wrong |

A tighter tolerance would fail `1.5 : 1`. This is a Slice A item when the frozen
calculation state is built.

### UX-TEST-20: every multiple-choice answer in the synthetic paper is option 1

All ten keys are the first choice, and the app does not shuffle. Clicking the
first option scores 10/10, as the desktop walk did. This is fixture content (the
paper is ours), and it undermines any end-to-end check that uses it. Whether
choices are shuffled at sitting time is a product decision, recorded here and not
taken.

### UX-TEST-21: the frozen shell and navigator show impossible progress

State 15 reads *"12 of 20 answered · 21/90 marks"* with Q1 to Q10, 11(a) and
11(b) answered, which are worth 15 at most. State 8 reads *"11 of 20 · 19/90"*,
where at most 12 is available. The numbers were typed. The pages are frozen and
are not edited for this. The built shell derives its bar from `tally()`, and the
library's example attempt shows the derived *"12 of 20 answered · 8/90"* for the
same answers.

## UX-TEST-18, -19 and -20 fixed; -21 closed by rule (decision 19)

**UX-TEST-18, fixed with option A.**

- `scorePoints` matches a point only against the phrasings its author wrote
  (`need`), and returns `local: true` only when every point has them and the
  question is weighted.
- A point without phrasings carries `hit: null`, not a miss.
- `gradeShort` scores locally only when `local` is true. Everything else goes to
  the marker, with each weighted point sent as a requirement carrying its weight
  (*"Names speed, or dependability, as the objective (1 mark)"*).
- The marker is asked with `noDemo`. If it is unreachable the answer is failed
  (`MARKER_UNREACHABLE`), and if none is connected it is refused
  (`MARKER_NOT_CONNECTED`). Both are unmarked, with the answer kept, and no demo
  grade or zero stands in.
- No checklist tick or miss is shown unless every point was matchable.
- Guarded by:
  - t31: the matching rule, the weights and the app's route;
  - ui70: 11(a) reaches the marker with its weights and is marked 2/2, and when
    the marker is unreachable it stays unmarked;
  - ui7: the short answer is marked by the marker on first submit, with no
    second request;
  - mutations `points-matched-on-description`, `guidance-drops-point-weights`
    and `marker-points-demo-graded`, all killed by their intended assertions.
- Consequences:
  - no question in the synthetic paper authors phrasings, so all its short
    answers now go to the marker;
  - the "What would make this stronger" door remains for locally scored answers
    only;
  - State 11's local-checklist variant now applies only to a paper that authors
    phrasings. That is a note for when State 11 is built in Slice A, not a
    redesign.

**Still open, and larger than this item:** extended responses and business
reports keep the demo fallback when the marker is unreachable (UX-TEST-15
wording), so a failure still becomes a number there. This is logged as
**UX-TEST-22**, below, for a decision.

**UX-TEST-19, fixed.**

- `ASSESS.readCalcAnswer` reads, in order: the value after the last `=`, then a
  ratio `a : b` as a / b, then a single number with units. Anything else is
  refused as `CALC_UNREADABLE` and left unmarked.
- `1.5`, `1.5 : 1` and `3 : 2` all read as 1.5. `60 000 / 40 000 = 1.5` reads
  as 1.5. `60000/40000`, `1,5` and `1.5 or 2` are refused.
- `gradeCalc`, the guided lessons' own parser and the mockup attempts all read
  through it, and no digit-stripping parser remains in app.js.
- Guarded by t31 and by four mutations, all killed.

**UX-TEST-20, fixed in the fixture.**

- The ten keys now sit at B, D, A, C, D, B, C, A, B, D.
- t30 asserts that no position holds more than half and at least three are
  used. It fails on the old fixture with `{"0":10}`.
- No shuffling was added.

**UX-TEST-21, closed by rule.** The frozen figures stay as drawn. Built counts
derive from attempt data, as the library already does.

### UX-TEST-22: in Test Mode, an unreachable marker still becomes a demo mark for long responses

`gradeWritten` without `noDemo` answers a fetch failure with `demoEssay`. That is
a structural estimate, and `ASSESS.tally` counts it as a mark. Short answers no
longer take this path (UX-TEST-18). Extended responses and business reports
still do, inside a paper, where the estimate is added to the paper total.
Decision 19's rule, that a failure leaves the response unmarked, reads as
applying here too. It was not applied, because UX-TEST-15 approved the demo
path's wording for these formats. Recommendation: in Test Mode, use `noDemo`
for every written format, and keep the demo grade for Study mode.


## Found while designing Page 2 (import and validation)

### UX-TEST-23: a paper for a subject Marginal cannot mark passes validation as publishable

`PAPER.examine()` checks that `curriculum.subjectKey` is well formed, but not that
a registered subject package exists for it. The package check happens only at
marking time, in `ASSESS.resolveAuthority`. The synthetic paper re-declared as
`legal_studies` examines as **publishable, sittable**. Every written answer in it
would then be refused at marking with *"no subject package named
"legal_studies" is available"*.

Page 2 has to resolve the subject anyway, because showing *Business Studies ·
Stage 6* as resolved is the proof the page exists to give. It calls
`resolveAuthority` against the registered packages, the same call
`markingContext` makes. A failed resolution makes the page's verdict **Needs
something resolved**. The mockup demonstrates this with the real function
(`02-import-resolve.html`).

For Slice A, the import has to use both checks: `examine()`, then resolution
against the packages the app actually registers. Whether a paper with no
marker-dependent questions (multiple choice and calculation only) should still
be blocked by an unregistered subject is left open. It could be sat and marked
without one.

**Fixed (decision 21), at the assessment path.** `examine(paper, { packages })`
now asks whether every question has a way to be marked, not only whether the
subject exists. `PAPER.markerDependent` lists the written questions that need
the subject's marker: those without a complete local answer key under
UX-TEST-18 Option A.
- None need it: the paper is **Ready with limited support**
  (`SUBJECT_MARKING_UNAVAILABLE`).
- Any need it: **Needs something resolved** (`SUBJECT_UNREGISTERED` or
  `CRITERIA_ABSENT`), with the count.

The app's import door passes its registered packages (`examineExam`; since Slice A,
`IR.read(..., tmPackages())` on Test mode's import page). Covered by
`tests/t30.mjs` (contract, both cases) and `tests/ui68.js` (the door; since Slice A,
`tests/ui73.js`). Four
mutations are each killed by their intended assertion.

## UX-TEST-22 fixed: no demo grades in Test Mode (decision 20)

Mapped first by four independent readers and a completeness critic. Every route
by which a sitting could get a number the marker never gave is closed, in Test
Mode only; Study keeps its demo grade.

| route | was | now |
| --- | --- | --- |
| extended response and business report, marker unreachable or not connected | demo grade, counted | unmarked (`noDemo`) |
| any 200 that is not a mark: `{}`, an error body, a non-numeric, negative or out-of-range score, a reply on another mark scale | a marked 0, or full marks after clamping | `MARKER_INVALID_REPLY`, unmarked, retryable |
| a reply body that stalls after its headers | "Checking…" for ever | bounded at 15s, unmarked |
| 429 and 5xx | "could not be reached" | `MARKER_BUSY` or `MARKER_FAILED`, retryable |
| 400 and 403 | "could not be reached", retry offered | `MARKER_REFUSED_REQUEST` or `MARKER_ACCESS_DENIED`, no retry offered |
| a short answer with no marking points | a keyword estimate (`gradeLocal`) | the marker |
| "What would make this stronger" with the marker unreachable | a demo grade replaced the answer-key mark | the mark stays and the reason is shown |
| a reply arriving after the student left, or after the answer changed | stored against the same position in whatever sitting was open | dropped |
| the worker: a truncated review of a one-block answer | returned as a mark | a retryable 502 |
| the worker: a paragraph with no numeric score or max | read as 0 | a retryable 502 |

- **What the student sees.** *Not marked yet* with the reason, the answer still
  in its box, and **Try marking again** wherever another attempt can succeed.
  A refused request says *Not marked* and offers no retry. The worker's own
  error text is never shown: two of its strings carry em dashes.
- **Counting.** An unmarked answer is not answered and adds nothing, and its
  marks stay in what the paper is out of, as `tally` has always done. The
  results page now says so.
- **"Saved".** The copy does not say *saved*. Attempts are not persisted until
  Slice A, so *Your answer is still here* is what is true today.
- **Tests.**
  - `tests/ui72.js` (browser, 113 assertions) and `tests/t37.mjs` (worker, 9)
    are both full tier only.
  - Nine mutations. The demo-wording mutation now belongs to ui72's Study
    section, because no sitting shows a demo grade any more.
  - ui70 and ui7 stubs now reply on the question's own mark scale, as the real
    worker does. Their old replies, out of 20 and out of 4 for 2-mark
    questions, are now correctly refused.

### UX-TEST-24: logged by the same map, outside this rule

- **A calculation with no authored `tolerance` marks every answer wrong.**
  `<= undefined` is false. The validator checks `expected` only. This is an
  answer-key gap, not the marker's, so it belongs with import validation
  (Page 2 and Slice A) as a finding. Do not compare with `Number.isFinite`
  alone: a stored tolerance of `"0.05"` works today.
  - **Fixed (decision 21).** At import, a missing, blank, non-numeric or
    negative tolerance is an invalid file (`CALC_TOLERANCE_MISSING`), as
    strict as `expected` already was. A tolerance of 0 is valid and means an
    exact answer.
  - A paper stored before the rule is not re-examined. So `gradeCalc` refuses
    to mark when the key is incomplete (`CALC_KEY_INCOMPLETE`). The answer is
    then *Not marked yet*, not wrong.
  - The runtime still reads a stored numeric string such as `"0.05"`, so
    nothing that marks today stops marking.
  - Covered by `tests/t30.mjs` and `tests/ui72.js` section 12 (missing, null
    and blank).
- **Papers restored from a backup or synced are sat without `PAPER.examine`.**
  A stored paper can reach any runtime route a validator would have refused.
- **The worker rebuilds a missing rubric against the criterion names.** In an
  extended response that produces criterion statuses the model never gave.
  The mark itself comes from the paragraphs, which are now validated. The
  rubric is left open.

### UX-TEST-22: corrections from the adversarial review

A three-lens review of the change, each finding checked by a skeptic, confirmed
defects in it, and all are fixed:

- **Blocker: a reply followed the student out of the paper.** Leaving changed
  nothing the guards compared. A late reply then drew itself into the Test mode
  home (a TypeError) or into a Study card. There, *Try marking again* would mark
  Study text against the exam's question.
  - A sitting now has a generation. Starting a paper and leaving to Test mode
    home both move it on.
  - A reply is drawn only onto the sheet it was asked from, and only while that
    sheet is still on screen.
  - Note for Slice A: once attempts persist, a reply for an answer the student
    submitted should land in that saved attempt, by attempt, not be dropped.
- **Refusals said "Not marked".** Decision 20 says every unmarked answer in a
  sitting is *not marked yet*, and the results page already said so. Now only
  the *Try marking again* button depends on whether a retry can help.
- **The worker refused a paragraph worth nothing.** A heading on its own line is
  a real reply, and `reconcileParagraphs` was written to absorb it. The worker
  now refuses only negative or non-numeric marks, or a review whose every
  paragraph is worth nothing.
- **A fractional score was accepted.** The worker only sends whole marks. A
  question worth a fractional number of marks is now refused before it is sent,
  rather than shown on a scale the marker did not use.
- **A failed second opinion said "This response was not marked"** beside a
  mark on screen. It now says *Your mark stands. The marker could not give a
  second opinion just now.*
- **The Settings and home copy overstated the rule.** Answer-key short answers
  are marked without the marker. The copy now says *answers that need the
  marker*.
- **Untested paths.** Timeouts, stalled bodies and the second opinion's late
  reply had no test. ui72 now covers them:
  - the timeout and the stalled body run under the page's fake clock;
  - leaving mid-marking is tested for Study and for the home;
  - the second-opinion scenario now asserts that the request was sent.

  Six mutations were added for these guards.

## Slice A: adversarial review before reporting (18 fixed, 3 refuted)

A four-dimension review (marking invariants, persistence and versions, import
and library, copy and controls), each finding checked by a verifier that tried
to refute it. Fixed:

- **Late replies** are drawn only when their question is on screen now
  (`tmShowing`), read from the page rather than a counter. A reply no longer
  redraws the sitting over Study or Create, and one that lands after the student
  left and resumed the same question shows its result instead of "Checking…".
- **Try marking again** marks what is in the box, so an edit made beside an
  unmarked answer is what gets marked.
- **A second opinion** never lands over a newer mark, a resubmission or a
  rewrite in progress, and Try again is disabled while it is asked.
- **Finish** waits while an answer is being marked.
- **A rewrite after Try again** reopens in its box on resume.
- **An unchosen either/or of parent questions** counts as `PAPER.totals` counts
  it (`ATT.weightOf`), so the overview and the sitting agree.
- **Picks up at** names an unchosen either/or slot ("Question 15 or 16").
- **Delete paper** says which practice sessions are deleted with it; Start again
  on a practice session counts drafts.
- **The weighted mark rule** says "One mark for each point" only when every
  point is worth one mark.
- **Backup restore** goes through the import's version rule
  (`ATT.restorePapers`), so two versions of one paper never both show.
- **The import page:** a duplicate or older file no longer says what it adds;
  versionless replace copy reads properly; a file holding `null`, a Marginal
  backup, or a bare list of cards is named for what it is.
- **Create** says papers are imported in Test mode and carries the pasted paper
  there.

Covered by `tests/ui72.js` section 13, `tests/t38.mjs` and `tests/t39.mjs`, and
seven mutations, each killed by its intended assertion.

Refuted: a completed practice session lacking "Start new attempt" (type sessions
start afresh from setup by design); a parent header showing the whole question's
marks in the sitting (it is the authored question's heading); "Those results stay
available" (true of the stored last attempt, whose screen is Slice B).

Four mutants from the earlier catalogue survived the first Slice A run because
the code they mutated had been retired: Study's unmarked sheet, a dead
`examineExam`, Study's instruction line and Create's import note. Each now
targets the code that does that job in Test mode, and the dead code is removed.
