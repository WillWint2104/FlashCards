# Gate 3 audit: the exam path as it stands

Read-only reconnaissance carried out on `main` at `6bfb666`, before any Gate 3
implementation. Nothing in the working tree was modified while it ran.

This file is in two halves and they are kept apart on purpose.

**Part 1 is observation.** Every claim in it is a fact about the code at
`6bfb666`, with the file and line that carries it, or a transcript of a run that
produced it. It stays true regardless of what gets built next, and it should be
corrected only if it turns out to be wrong about that commit.

**Part 2 is proposal.** It was written before the plan was settled and it is
kept because the reasoning that led to the plan is worth having. It has since
been superseded: the approved sequence is Gate 3A (curriculum identity and
evaluation safety), then 3B (assessment formats), then 3C (the whole-exam
contract), then a UI design gate. Where Part 2 and the approved plan disagree,
the approved plan wins.

---

# Part 1 — observed

## 1.1 The formats, and how many engines there really are

Nine card types ship in `content.js`: short 75, calc 38, check 34, mc 28,
define 28, essay 24, lorenz 8, scenario 8, incomeSource 4. There is no report
type. `validateExam()` admits five of them: `mc`, `calc`, `short`, `define`,
`essay`.

Every written type collapses to one of two strings before it reaches the marker:

```js
function responseTypeOf(card, opts) {
  if (opts && opts.responseType) return opts.responseType;
  return (card && card.type === "essay") ? "extended" : "short";
}                                                          // app.js:450
```

So Short Answer and Long Answer are not two assessment systems. They are one
written-response architecture with a binary parameter. What a student sees
differ by: textarea height (14 rows against 5), the submit button's wording, the
note under the answer shape, and whether marking-points feedback is offered.

| format | data model | renderer | submission | evaluator | feedback | persistence | tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Multiple choice | `type: mc`, `choices[{t, ok, why}]` | `answerInput` | click, no submit row | `gradeMC` | `kind: mc` | `state.cards` / `EXAM.results` | ui5, ui8 |
| Calculation | `type: calc`, `expected` | `answerInput` | `#check` | `gradeCalc` | `kind: calc` | same | ui8 |
| Define / short | `type: define\|short`, `model`, `vocab`, `points[]` | `answerInput` (5 rows) | `#check` | `gradePoints` in Test mode, `gradeLocal` everywhere else | `kind: points\|local` | same | ui7, ui8 |
| Extended response | `type: essay`, `marks`, `model`, `scaffold` | `answerInput` (14 rows) | `#check` | `gradeWritten`, else `demoEssay` | `kind: llm\|demo` | same, plus review overlay | ui8 |
| Business report | `type: essay`, `command: "Report"` | identical to extended | identical | identical | identical | identical | none |
| Essay Suite draft | `ES.draft`, `paragraphs[]`, blocks | its own composer | `esSubmit` | `gradeWritten(esMarkCard(d))` | `esRenderMarked` | `marginal.essay.v1` | ui53, ui54, ui67, bots |

## 1.2 The runtime route

Test mode:

```
examStartById → examPick → examStart → examRender
  ├ kind "section" → examRenderSection    name, instructions, source, choose
  └ kind "q"       → examRenderQuestion   answerInput + answerShapeBlock + submitRow
                     → examWireAnswer                            app.js:2124
                        mc    → gradeMC
                        calc  → gradeCalc
                        essay → await gradeWritten
                        else  → points[] ? gradePoints : gradeLocal
                     → EXAM.results[key] = g                     app.js:2145
                     → examSheet → examSheetHTML
  └ kind "end"     → examResults
```

Study mode:

```
renderCard → answerInput + answerShapeBlock + submitRow
  → wireAnswer                                                   app.js:1734
     mc → gradeMC   calc → gradeCalc   essay → await gradeWritten
     else → gradeLocal                     (no gradePoints on this path)
  → finishCard → applyResult(card, g.score, g.max) → sheetHTML
```

`answerInput`, `answerShapeBlock` and `submitRow` are the same three functions
on both paths. The branching inside them is on `card.type` alone. That is the
whole of the format-specific rendering.

Genuine branches, as against apparent ones:

- **Grader selection.** Four graders chosen by `type`. Genuine.
- **Marking-points rubrics.** `gradePoints` has exactly one caller,
  `app.js:2144`. A `short` card carrying a `points` rubric inside a custom set is
  graded by `gradeLocal` and its rubric is silently ignored. Genuine, and
  probably unintended.
- **Result handling.** Study mode schedules the card; Test mode does not.
  Genuine.
- **Feedback rendering.** `sheetHTML` and `examSheetHTML` are near-duplicates
  with different mood labels; only the second understands `kind: "points"`.
  Duplication, not a branch.

## 1.3 Business Report

`type: "essay"`, `marks: 20`, `command: "Report"` — structurally identical to
the Section IV extended responses that follow it. The word "report" appears
nowhere in `app.js` as a type, a branch, a renderer or an evaluator.

`Report` is not in the directive registry:

```
known: account for, analyse, assess, compare, critically, demonstrate, describe,
discuss, distinguish, evaluate, examine, explain, how can, how do, how does,
identify, justify, list, outline, propose, recommend, to what extent

report    known: false   row: none
evaluate  known: true    row: {"family":"judgement","supported":true}
```

So it assigns no directive family, which means no sentence shapes and no
family-selected guidance. It also has no entry in `ESSAY.answerShapes.commands`,
so it falls to `shapes.extended` — the same rows an Evaluate gets. What carries
the report-ness today is prose nothing reads structurally: the section's
`instructions` string and the question's `model` answer.

## 1.4 What `marginal-exam@1` already represents

| level | represented | read by |
| --- | --- | --- |
| Paper | `name`, `subject`, `time`, `instructions`, `sections[]` | `name` everywhere; `subject` on the list row and in `markingContext`; `time` as a text chip only; `instructions` **never rendered** |
| Section | `name`, `instructions`, `source`, `choose`, `questions[]` | all four render on the section intro |
| Question | `type`, `prompt`, `marks`, `label`, `command`, `stimulus`, `choices[]`, `expected`, `model`, `points[]`, `vocab`, `scaffold` | `label` renders **only** on either/or choice buttons |
| Stimulus | string, or `{caption, text, img, charts[]}` | renders at section or question level, with a lightbox |

Not representable:

- **Subject identity anything reads by key.** `importExamFromBox` copies exactly
  five paper-level fields (`name`, `subject`, `time`, `instructions`,
  `sections`); a `subjectKey` or `markingCriteria` written beside them is
  discarded at import.
- **Per-section subject.** Sections carry no identity, so a multi-subject paper
  is not expressible.
- **Subquestions.** No parts structure. The seeded paper flattens three lettered
  parts into one `prompt` string with bullet characters and one mark total.
- **Authentic question numbering.** The number on screen is a running count of
  sequenced questions. Fourteen of the seeded paper's prompts restate their own
  number in prose, which is the workaround.
- **Choose more than one.** `EXAM.choice[si]` is a single index.
- **A timer.** `time` is a display string.
- **Provenance.** No year, authority, review state or publication flag.
- **Band descriptors.** No paper-level marking guidance survives import.

The `choose: 2` arithmetic, run against the real functions:

```
listed on the Test-mode row: {"qs":2,"mk":40}
before the student chooses: {"total":2,"maxMarks":40}
after one choice is stored: {"total":1,"maxMarks":20}
```

## 1.5 Where subject identity is inferred rather than owned

```
paper.subject      free-text label, optional, survives import
paper.subjectKey   read by nothing
section            carries no subject
question.subject      → declaredLabel  (falls back to paper.subject)
question.subjectKey   → declaredKey
question.markingCriteria

markingContext(card)                                          app.js:356
  sub      = esSubjectContent(declaredKey)
             || essaySubjectByLabel(declaredLabel)            ← inference by string
  label    = declaredLabel || sub.label
             || (declares ? "" : C.subject)                   ← inference by global state
  criteria = card.markingCriteria || paper.markingCriteria || sub.markingCriteria
  if (declares && !criteria)  → unresolved, refuse
  if (!declares && !criteria) → C.markingCriteria             ← Economics

gradeWritten → payload { subject: label, criteria }
```

Four places identity is not owned:

1. **Identity by display label.** `essaySubjectByLabel` lowercases, trims and
   compares against package labels. The comment above it records that this match
   has already been seen to miss on authored whitespace. A key route exists for
   questions and does not exist for papers.
2. **Identity from global picker state.** `C` is `window.CONTENT`, the flashcard
   package currently selected — Economics by default. The comment at
   `app.js:362` justifies the branch on the grounds that a card declaring
   nothing is flashcard content by definition. An imported past paper is not
   flashcard content, and it lands in exactly that branch.
3. **Label and criteria computed independently.** Nothing checks that the
   subject named to the marker is the subject whose criteria were sent.
4. **The Essay Suite's own fallback.** `esAttemptSubject(d)` returns
   `d.subject || ES.subject` — the draft's subject, else the picker's.

## 1.6 What a JSON exam must declare, measured

Eight papers, identical but for where the subject is declared, each sat through
Test mode with the outgoing marking request captured.

| declared | payload `subject` | criteria sent | correct? |
| --- | --- | --- | --- |
| `paper.subject: "Business Studies"` | Business Studies | 4 · Business Studies | yes |
| `paper.subjectKey: "business_studies"` | Economics | 4 · **Economics** | cross-subject |
| `paper.markingCriteria` + unknown subject | Underwater Basket Weaving | 1 · the paper's own | yes |
| `question.subjectKey`, paper subject unknown | Underwater Basket Weaving | 4 · Business Studies | label ≠ criteria |
| `question.markingCriteria` | Underwater Basket Weaving | 1 · the question's own | yes |
| nothing at all | Economics | 4 · **Economics** | cross-subject |
| `paper.subject` nothing registers | refused before sending | — | fails closed |
| `question.subject` nothing registers | refused before sending | — | fails closed |

There is exactly one declaration today that gets Business Studies its own
criteria and Economics its own: a paper-level `subject` string matching a
registered package's display `label` after lowercasing and trimming. There is no
key-based route at paper level, no declaration is required, and omitting one
silently selects Economics.

## 1.7 Defect A — a refusal to mark is consumed as a mark

The refusal carries `error`, `subject` and `note`, and no `score` or `max`
(`app.js:462`). It is stored unconditionally at `app.js:2145` and summed at
`app.js:2027`.

Reproduced in Test mode with a paper declaring an unregistered subject, one
short answer and one extended response:

```
Q1 sheet score: 2/2
Q2 after pressing Check:
  sheet score element: "undefined/undefined"
  mood heading:        "Not yet"
  check button:        "Checking…"
  sheet text:          "undefined/undefinedNot yetTry againFinish paper"
  page errors:         []

Results screen:
  total:    "NaN/22"
  sections: ["Section I NaN/22"]
  rows:     ["State one feature of a reed.2/2",
             "Evaluate the effectiveness of two weaving strategies.undefined/20"]
```

It is not recorded as a zero here. It is recorded as `undefined`, which poisons
both the section total and the paper total to `NaN`. Nothing throws, so nothing
surfaces in the console. The refusal's `note`, which explains in plain words why
the response was not marked, is never rendered; the student is shown
`undefined/undefined` and the words "Not yet", with the check button still
reading "Checking…".

The zero is real on the study path. The same refusal reaches
`finishCard → applyResult(card, undefined, undefined)`:

```
state.cards['repro-essay-1'] = {"box":1,"seen":1,"correct":0,"lastScore":0}
state.log                    = [{"id":"repro-essay-1","r":0}]
```

A response the application deliberately declined to mark is written to the
spaced-repetition scheduler as a total failure, and the card is demoted to box 1.

Both routes are reachable through shipped controls. Pasted into the Create tab's
own import box, neither import path checks that a declared subject resolves:

```
sets:  [{"name":"Route A set","subjects":["Underwater Basket Weaving"]}]
exams: [{"name":"Route B paper","subject":"Underwater Basket Weaving"}]
```

The four consumers:

| site | path | consequence | status |
| --- | --- | --- | --- |
| `app.js:1755` | study mode → `finishCard` | recorded as zero, card demoted | reproduced |
| `app.js:2143` | Test mode → `EXAM.results` | `NaN` section and paper totals | reproduced |
| `app.js:1781` | study mode → "Mark this properly" | falls to the toast; no false mark | unguarded, benign today |
| `app.js:11017` | Essay Suite → `d.mark` | would persist `{score: undefined}` | unguarded, not reachable |

The Essay Suite site is unreachable at `6bfb666` for a specific reason worth
recording: all three registered subjects carry four marking criteria each, and a
draft with no subject at all makes `declares` false. It becomes reachable the
moment a fourth subject ships without criteria.

## 1.8 Defect B — `SUBJECT_KEY` reads prose as identity

`VocabularyRecord.subject` is contracted at `fields.js:600` as
`studentProse: true` — "what it means in this course". In the library manifest
the same field name means the owning subject key (`libraries.js:136`). The regex
at `validate.js:373` is the heuristic that tries to tell those two apart by
shape.

Run end to end through the real validator:

```
--- A one-word course meaning
    subject prose: "training"
    verdict: rejected  wouldImport: false  findings: 1
    SUBJECT_CROSS_WIRED: 1
      error provides.vocabulary.…subject :: "training" is not the subject
      this question declares (business_studies)

--- C the authored good example (a full sentence)
    subject prose: "learning the job by doing it under supervision in the workplace"
    verdict: accepted  wouldImport: true  findings: 0

--- D an actual cross-wired subject key
    subject prose: "economics"
    verdict: rejected  wouldImport: false  findings: 1
    SUBJECT_CROSS_WIRED: 1
```

Cases A and D are indistinguishable in the report: same code, same severity,
same path, same verdict. A reviewer cannot tell a terse definition from a
genuine cross-wire, and the package does not import either way. The escape is
accidental — a meaning survives only if it happens to contain a space.

A first attempt at this reproduction printed "issue count: 0". That was an error
in the probe, not a result: `validate()` returns findings under `findings`, and
the probe read `issues`. The run above reads the correct key.

## 1.9 The two JSON systems

|  | `marginal-exam@1` | `marginal.question-package` |
| --- | --- | --- |
| Unit | a whole paper | a single question |
| Definition | 15 lines in `validateExam()` | 99 fields in `fields.js`, generating the schema, guide and validator |
| Ingestion | pasted at runtime into localStorage | validated, admitted, published, inlined at build time |
| Severity | first error wins, import stops | error / blocked / shortfall / warning, all checks run |
| Subject | free-text label, optional | `question.subject`, required, pattern-validated |
| Directive | free-text `command`, unchecked | registry-checked, family-assigning |
| Provenance | none | `origin`, `provenance.reviewState`, `provenance.publication` |
| Response format | five types, choices, expected, points | none — extended writing only |
| Container above the question | paper and section | none |

Each holds what the other lacks. The contract owns identity, provenance,
directive discipline and marking-source honesty, and has nothing above a
question. The exam format owns ordering, sections, choice, stimulus and response
formats, and owns no identity at all.

## 1.10 Existing test coverage of the exam path

`ui5` (7 assertions), `ui7` (18) and `ui8` (13) — 38 in total. None of the three
appears in `fast`, `checkpoint` or `journeys`; all are full-only. All three
abort `workers.dev`, so no suite has exercised a marked response inside a paper,
and none can reach the refusal branch: their fixture paper resolves cleanly.

`ui61` §5 asserts that the refusal exists, by reading source text
(`/subject-unresolved/.test(app)`). It asserts nothing about what any caller
does with it. The fail-closed is tested at the point of refusal and not at the
point of consumption, which is why Defect A survived it.

Profile of the three suites named in the brief, measured on this branch:

| suite | seconds | assertions | result | share of the 800s full budget |
| --- | --- | --- | --- | --- |
| bots | 131.9 | 64 | 0 failed | 16.5% |
| ui67 | 98.4 | 180 | 0 failed | 12.3% |
| ui54 | 78.7 | 18 | 0 failed | 9.8% |
| **total** | **309.0** | **262** |  | **38.6%** |

---

# Part 2 — proposal, as written before the plan was settled

Superseded by the approved Gate 3A/3B/3C sequence. Kept for the reasoning.

## 2.1 On the container question

A paper is an ordering plus instructions over questions that already have
owners, so the smaller change is a paper container that references question
packages by id, rather than a paper format that re-describes questions. The
contract's response-format gap then has a natural home: the format belongs to
the question, beside `question.directive`, not to the container.

The one thing that must not be carried over is `marginal-exam@1`'s optional
subject. Whatever the container is, its subject has to be required and read by
key.

## 2.2 Proposed sequence

1. Give a refusal one shape and make every consumer branch on it. Smallest
   change with the widest reach; everything below depends on being able to fail
   closed without corrupting a mark.
2. Give a paper an owned subject, read by key, with the exam path never reaching
   `C.markingCriteria`. Reconcile `label` and `criteria`.
3. Separate the two meanings of `subject` in the contract, retiring
   `SUBJECT_KEY` rather than tightening it.
4. Decide the container question once, in writing.
5. Then the representational gaps: numbering, subquestions, `choose` beyond one,
   paper instructions on screen, backward navigation, submission confirmation.
6. Then content volume. Authoring papers before step 4 means authoring them
   twice.

## 2.3 UI states, identified only

| state | status at `6bfb666` |
| --- | --- |
| Test mode home | exists — `examHome` |
| Paper setup | thin — folded into the section picker |
| Exam picker | exists — `examPick` |
| Instructions / start | thin — section-level only; paper `instructions` never shown |
| Multiple choice | exists — grades on click, no submit step |
| Short answer | exists |
| Extended response | exists |
| Business report | absent |
| Navigator | absent |
| Progress | thin — one bar, refreshes only on navigation |
| Back to a question | absent — `EXAM.pos--` appears nowhere |
| Submission confirmation | absent |
| Results overview | exists — `examResults` |
| Per-question feedback | exists — five variants by `kind`, none for a refusal |
| Unmarked response | absent |
| Timer | absent |

## 2.4 Proposed test boundaries

- A refusal is not a mark. No existing suite could make this assertion.
- Identity crosses the paper boundary intact — the §1.6 matrix as a suite.
- Prose is not a key. Node-only, no browser.
- Totals survive every result kind: no combination of graders produces `NaN`.

Two of the four need no browser and belong in `fast`. The two that do are
single-question papers with no writing loop, so `checkpoint` is plausible and
`full` is certain. No budget change was proposed.
