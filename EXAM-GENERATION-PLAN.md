# Business Studies: exam generation + essay support — plan

Captured from a working session so it survives between sittings. Nothing here is
built yet apart from the Practice Exam mode itself (PR #41). Source material
supplied: 2023, 2024 and 2025 HSC Business Studies papers, and the Business
Studies Stage 6 syllabus.

## 1. The paper pattern (verified across 2023, 2024, 2025)

The HSC paper shape is stable, which is what makes generation safe:

| Section | Marks | Shape |
|---|---|---|
| I | 20 | 20 multiple choice, 1 mark each, spread across the four topics |
| II | 40 | Four questions (Q21 to Q24), each 9 to 11 marks, broken into parts of 2 to 4 marks, most carrying a short stimulus |
| III | 20 | One business report on a hypothetical business, with a stimulus (chart, table or financial data) and three bullet tasks |
| IV | 20 | Attempt EITHER Q26 OR Q27, both 20-mark extended responses |

HSC course weighting from the syllabus: Operations, Marketing, Finance and Human
Resources at 25% each (30 indicative hours each). A generated paper should
respect that balance.

Section IV questions across the three years are all the same underlying form, a
SYLLABUS RELATIONSHIP:

- 2023: "To what extent do influences on marketing affect business success?" / "...influences on operations..."
- 2024: "How can financial strategies affect the objectives of financial management?" / "How can operations strategies affect corporate social responsibility?"
- 2025: "Explain how target markets affect e-marketing, people, processes and physical evidence." / "Explain how financial strategies can achieve liquidity and profitability objectives."

So a generator picks Term 1 and Term 2 from the syllabus, then picks a directive
verb, rather than inventing free-form questions. Question types to vary:

- Type A relationship: "How can X affect Y?" (cause and effect)
- Type B judgement: "Assess / Evaluate / To what extent...?" (requires a verdict)
- Type C multi-element: "Explain how X affects A, B, C and D" (mandatory targets)

## 2. Generating new papers

Build a generator that takes the syllabus (topics, "students learn about" dot
points) plus the pattern above and emits a `marginal-exam@1` paper:

- Sample Section I across the four topics evenly, varying the stem style seen in
  real papers: definition recall, scenario classification, sequence ordering,
  data interpretation (a table or graph), and ratio or calculation reading.
- Build Section II from dot points, each question anchored to one topic with a
  short stimulus business, parts escalating Outline to Explain to Discuss.
- Build Section III as a hypothetical business plus a generated stimulus
  (Gantt chart, cash flow table, ratio table) and three bullet tasks.
- Build Section IV as two relationship questions from different topics.
- Every short-answer part must ship a marking-points rubric, and every paper must
  pass the validator (see section 5).

## 3. Essay support (the hint widget)

For the essay/extended-response component:

- A floating **hint widget** the student can open at any time, showing what they
  should know for this question: the syllabus terms in play, the relationship
  being tested, and options for starting the response.
- **Locked-in selections.** The student chooses their angle once (for example
  which strategies or influences they will argue, and their case study), and the
  choice LOCKS so the essay stays consistent as they move through sections. The
  widget then reflects the locked choices rather than offering everything.
- This is the same idea as the syllabus relationship planner already agreed as
  Stage 2 of the Business Studies essay work: plan first, lock the plan, then
  write against it.

## 4. Case study: McDonald's

The student's case study is McDonald's, so evidence support must be built in:

- A per-topic bank of McDonald's evidence (operations, marketing, finance, HR)
  the student can pull into a paragraph as supporting detail.
- A hint that surfaces the relevant evidence for the current relationship, since
  NESA rewards integrated case study application.
- Evidence should be reviewable and editable, because a student must be able to
  correct or extend their own case study material.

## 5. Learn as you go (the critical requirement)

"If I don't know the content I need someway of learning or having the core
information to learn as I go otherwise this won't work as practice."

Practice alone fails when the content is not yet known. So every question needs a
route back into the content:

- From any question, a "learn this" path into the underlying concept, reusing the
  teaching-lesson pathway already built (definition, meaning, worked example, a
  restatement, and a quick check).
- The core information per syllabus dot point, so the student can read the
  concept, then return to the question.
- After a missed marking point, the hint should link to the concept that mark
  depends on, not merely restate what was missed.

This effectively means a Business Studies content layer keyed to syllabus dot
points, which the exam, the essay hints and the case study evidence all read
from. Build the content layer once and all three features draw on it.

## 6. Validation (already built, keep using it)

Generated content must pass the checks used for the 2025 paper:

- Every model answer scores full marks against its own marking rubric.
- No marking stem echoes its own question (that awards a free mark).
- No marking stem hides inside another word a student would write ("fine" inside
  "defined", "train" inside "constraint").
- Exactly one correct multiple-choice option, and every option carries a reason.
- No em-dashes in student-facing text.
- Multiple-choice answers independently re-derived by a second marker.

## 7. Distribution note

Generated and converted papers are delivered as files for personal study use and
are deliberately NOT committed to this repository, which is public and published
via GitHub Pages. Papers built from real HSC questions stay local. Original
generated papers can be committed if wanted, but real past-paper text and
rendered images should not be.
