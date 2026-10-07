# State 13 — Business report: what exists before anything is drawn

The State 12 audit asked what the marker returns. This one asks a narrower and
more awkward question: **what makes a business report a business report in this
codebase?** The answer decides what a screen is allowed to say, and it is not
what the roadmap assumed.

Method: six claims were put to independent agents whose instructions were to
refute them, and three lenses swept for what the claims missed. Everything below
was proven by reading the tracked source or by executing it, and the five most
decision-shaping findings were then re-verified by hand. Two of the six claims
were wrong and are corrected here rather than quietly dropped.

## The short answer

A business report is an extended response with a different word in a field
nothing reads.

```
tools/contract/assessment.js:252   business_report: "extended"
```

That one line is the whole of it at runtime. Everything else follows.

## 1. What reaches the marker: nothing that says "report"

Proven by executing the real pipeline against the repository's own business
report question and reading the prompts that came out.

| channel | what happens |
| --- | --- |
| `format: "business_report"` | sent by `app.js:584`, and **discarded before any prompt is built** |
| `responseType` | `"extended"`, because of the mapping above |
| `points` (5 authored) | **never sent**, under that or any other name |
| `instructions` (2 sentences) | **never sent** |
| `stimulus` | sent as `!!card.stimulus`; the extended prompt never reads it |
| `model_answer` | q14 authors none, so it arrives empty |

**The mechanism is not the allowlist.** `PASS2_FIELDS` (`worker.js:1269`) does
lack `format`, but that is not what drops it: the worker contains **zero
occurrences of the identifier `format`** in 1760 lines. The body is destructured
at `worker.js:833` without it, `markingInput` (`worker.js:1571`) builds a fresh
object without it, and the pass-2 bag at `worker.js:873-881` is an explicit
literal with no `format` key. **Adding `format` to `PASS2_FIELDS` would change
nothing**, which matters because that is the first fix anyone would reach for.

**The report is not unlabelled. It is mislabelled.** Three places tell the model
it is marking an essay:

```
worker.js:250    SYSTEM  "...a paragraph-by-paragraph review that teaches a
                          student to improve their extended response"
worker.js:1202   pass 1  "RESPONSE TYPE: ... extended response"
worker.js:1279   pass 2  "RESPONSE TYPE: extended response, worth 20 marks"
```

**The stimulus flag is dead on this path.** Executed: the extended pass-2 message
is byte-identical with `stimulus` true and false, and mentions neither
"stimulus", "case study" nor "source". The flag's only prompt-bearing use is
inside the short-answer branch (`worker.js:1286`), where the model is asked to
judge whether a response uses a stimulus it has never been given.

**One seam is open, and it is how any fix will work.** `prompt`, `rubric`,
`scaffold`, `requirements` and `reference` are all forwarded verbatim into the
prompt. A question whose *stem* says "business report" does tell the marker. For
the authored question the genre lives only in `instructions` and `points`, and
both are dropped.

## 2. What reaches the student: an essay skeleton

This is the half the roadmap did not anticipate, and it is worse than the marking
gap because the student acts on it.

```
app.js:1852   const extended = ASSESS.writtenModeOf(fx.format) === "extended";
app.js:1854   let rows = extended ? shapes.extended : (...);
```

`shapes.extended` is three rows (`essay-content.js:1764-1768`):

```
  introduction          state the overall line of argument and signpost...
  each body paragraph   make one argument, explain how it works...
  conclusion            answer the question outright and weigh it...
```

with the note "Worth 20 marks, so the marker is reading for a sustained argument,
**not a list of points**."

The question's own first marking point says:

> "Uses a report structure with headings rather than continuous prose"

**The app tells the student to write body paragraphs while the question credits
headings.** The comment directly above that code (`app.js:1850`) says the shape
is derived from the same words the marker was told "so this cannot disagree with
what the marker was told". It cannot disagree with the marker. It disagrees with
the author.

Note also `app.js:1855`: the stimulus row is added only when `!extended`, so a
report built on a case study never gets the row about using its source either.

The rest of the answering surface is the essay's: the same 14-row textarea with
the placeholder "Write your full response here, using blank lines between
paragraphs" (`app.js:1826`), the same "Submit for marking" button
(`app.js:1879`).

**The word "report" reaches the student exactly once, on a screen they leave.**
Section III's instructions render on the section intro (`app.js:2365`) and say
"Present your answer in the form of a business report." One click advances the
position and re-renders, and the sentence is gone. The question's *own*
instructions sentence renders **nowhere at all**: `app.js:2393` draws
instructions only for a *parent* question's parts, and q14 is a leaf
(`PAPER.isParent(q14) === false`, executed). So the one question-attached
statement that this is a report is invisible in both directions.

**After marking, the report shows less than its neighbours.** The result sheet
ends with a model answer when one is authored (`app.js:2523`). Both other 20-mark
questions carry one; the report does not:

```
  q14  business_report     model: NONE      points: 5
  q15  extended_response   model: 251 chars points: 4
  q16  extended_response   model: 251 chars points: 4
```

And the criteria named on that sheet are, verbatim (`essay-content.js:199-204`),
introduced in their own source comment as "the four dimensions an HSC Business
Studies **extended response** is assessed on":

```
  knowledge and understanding of course content
  application of business case studies and contemporary business issues
  business terminology and concepts
  sustained, logical and cohesive response
```

None mentions structure, audience or recommendation. The band ladder they fall
through to is the generic one and is written entirely in essay vocabulary.

## 3. What is authored: more than expected, in the wrong place

**The premise that nothing report-specific is authored is false.**
`GUIDED-MODE-PLAN.md` carries a written, reviewed position on what a business
report is, and no code reads it:

- the report's sections are **generated from the task's own bullets**, never a
  fixed Issue 1 / Issue 2 / Issue 3;
- it opens with a task-analysis stage, not a sentence input;
- the **executive summary is written last** and identifies the issues, the
  strategies and the intended outcomes;
- the conclusion reviews and introduces nothing new;
- **no title page and no reference list** in an exam-writing interface;
- the report mode's toolbelt is Understand, **Task**, Evidence, Structure,
  Vocabulary, against the extended response's Understand, Ideas, Evidence,
  Structure, Vocabulary.

That is a specification. State 13 should implement it or explicitly overrule it,
but it must not be designed as though the repository were silent.

At the question level, by contrast, the complete report-specific authoring is
**seven sentences**: five marking points, of which exactly one describes report
form, and two instruction sentences, of which one renders on a screen the student
leaves and the other renders nowhere.

## 4. What the contracts cannot yet say

- `docs/contract/question-package.schema.json` gives a question thirteen
  properties and **none is `format`**. Its directive enum holds fourteen verbs
  and does not include `recommend`. A business report cannot be authored in the
  question-package contract at all.
- `docs/contract/directive-registry.json` lists `recommend` with
  `supportedInGuidedWriting: false` and the authored note "Ends in a decision the
  student makes, which none of the current slot sets asks for." **The repository
  says in data that the report's directive is deliberately unsupported.**
  "report" is not a directive in the registry at all.
- `docs/contract/shared-libraries.json` declares seven libraries and **none is a
  rubric or criteria library**. The one `rubricRef` in the repository dangles.
- `"report"` is a reserved word by accident: `assessment.js:308` is
  `directive === "report"`, whole-string equality. "Report on the issues facing…"
  is an ordinary extended response; the bare word "Report" turns an essay into a
  business report **and nulls its directive** (`assessment.js:363`), so such a
  question reaches the marker with no command at all.
- `PAPER.examine()` on the fixture returns **sittable, publishable, zero
  findings**, executed. A report question with no model answer, no report
  criteria, an instructions string that renders nowhere and points that reach
  nothing is silently valid.

## 5. What this means for state 13

The State 12 constraint was that no field associates an issue with a criterion,
so evidence could not be filed under criteria. The State 13 constraint is
sharper:

> **Nothing the marker returns is report-aware, because nothing report-aware
> reaches it. A screen that reports on report structure would be inventing the
> judgement it displays.**

So the same two-layer shape State 12 settled on still applies, and the marked
state can change very little. What is different, and what state 13 has to decide,
is the **answering** side, because that is where the product is currently telling
the student the wrong thing:

1. **The essay skeleton has to stop being shown for a report.** This is a defect
   today, independent of any new screen: the app contradicts the question's own
   marking point. It is the cheapest fix on the board and it needs no contract
   change.
2. **The question's instructions should render.** One expression at
   `app.js:2393`. The sentence is authored, it names the genre, and nothing shows
   it.
3. Whether the genre reaches the marker at all is a **contract change** —
   `format` into the prompt, or `points`/`instructions` into an existing
   forwarded channel such as `requirements.accomplish` or `scaffold`, which both
   already print into the pass-2 message.
4. Whether a report is marked against report criteria is a **content change**:
   the four criteria on screen are the extended-response dimensions, and no
   rubric library exists to hold anything else.

## 6. Corrections to this audit's own claims

Two of the six claims put up for refutation did not survive as stated.

- **"Exactly one authored business_report question exists" — REFUTED.** q14 is
  the only one in a tracked *paper*, but `tests/ui68.js:539` and
  `tests/t30.mjs:73` each author one as a test fixture. What survives, proven by
  normalising all 234 typed objects in the three content files: **nothing in the
  shipped content packages authors a business report.**
- **"The points are unweighted so they produce no score" — right outcome, wrong
  reason, and understated.** `weighted` is false because *no* point carries marks
  at all, not because per-point marks fail to sum. And the points do not merely
  go unscored: `ASSESS.scorePoints` is reached only from `gradeShort`
  (`app.js:2465`), while `business_report` routes to `gradeWritten`
  (`app.js:2431`). **Nothing reads them at runtime** — not the marker, not the
  checker, not the renderer.
- **"Nothing report-specific anywhere in the pipeline" — partly true.** The
  client end does compute report identity and send it. The report-specific
  material is inert at the worker, not absent from the pipeline.
