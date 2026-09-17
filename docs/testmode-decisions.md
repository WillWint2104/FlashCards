# Test Mode — product decisions taken before mockups

Recorded so the mockups are designed against decided behaviour rather than
against what the current build happens to do. Numbered as approved.

The framing that produced them: the contract now represents a real examination
paper, and Test Mode still behaves like a linear quiz. These nine decisions close
that gap. None of them asks for a bigger interface — several make it smaller.

## 1. Attempts persist

A student may reload, leave Test Mode, close the browser and come back, and
continue the same attempt. Today `examStart` resets `EXAM.results`,
`EXAM.answers` and `EXAM.choice`, and leaving mid-paper at *"1/20 answered"*
returns you to *"0/20 answered"* at Question 1.

The library gains an in-progress state — *"In progress · 11/20 answered ·
Resume"* — and a completed paper reads differently from an untouched one. These
are **variants of the Library/Overview family, not a twentieth screen**.

## 2. Free navigation, and incomplete submission

Answering is not a precondition for moving on. Today it is: on an unanswered
question the only controls are the back arrow and "Submit for marking", so a
student cannot leave 11(b) blank, answer 11(c) and return.

The Sitting Shell carries Previous, Next, a navigator, and per-question status —
unanswered, answered, and ideally flagged for revisit — with section boundaries
and parent/part hierarchy visible in the navigator. Submission then becomes able
to say what is missing:

```
3 questions unanswered
11(b) · 2 marks
14    · 5 marks
26(b) · 8 marks
```

## 3. Answering is not structurally bound to marking

The current flow is answer → submit → feedback → next. That is good practice and
it is not exam conditions. Marginal should support both as one shell with a
**sitting policy**:

| policy | behaviour |
| --- | --- |
| **Practice** | a question is marked on submit; feedback appears in place; revise and continue |
| **Exam conditions** | answers are saved and not marked; navigate freely; submit the whole paper; marking and results follow submission |

Not two applications. The first visual round focuses on Practice because it is
closest to what exists, but the shell must not make immediate feedback
inseparable from answering.

## 4. The active exam owns Test Mode chrome

`index.html` carries `HSC Economics / Distribution of Income & Wealth` as a
literal outside `#app`, written by nothing and changed by nothing. While an exam
is active, chrome comes from the active exam — for the synthetic paper, simply
*Marginal · Business Studies*. The active Study topic does not belong inside Test
Mode at all.

## 5. Question help is format-aware and optional

The answer-shape block is currently unconditional, so a 1-mark multiple choice is
told to *"back the answer with specific evidence"* and a calculation whose answer
is `1.5` is told the marker wants *"about 4 distinct creditworthy points"*.

Help becomes a region whose contents depend on the format and on what is actually
authored:

| format | help |
| --- | --- |
| multiple choice | probably nothing beyond the question |
| calculation | formula or working expectations, where legitimately authored |
| short answer | directive-aware and mark-aware guidance |
| extended response / business report | structure and marking expectations |

**Where nothing appropriate is authored, the region is withheld** rather than
filled with something generic.

## 6. Shared stimulus gets its own interaction

A parent's case study is currently re-rendered in full above every child. On a
phone that puts the source at 315px and the question at 608px of an 844px
viewport, four times over.

Direction, to be tested in mockups rather than fixed now: on desktop a persistent
or collapsible side panel beside the writing area; on mobile a compact sticky
control — *📄 Kerbside Coffee case study* — opening a bottom sheet. The source
stays reachable while answering every child of question 11 without being scrolled
past each time.

## 7. Results preserve the hierarchy

Instead of a flat list, the parent and its total:

```
Question 11 — Kerbside Coffee            10 / 14
  11(a)                                    2 / 2
  11(b)                                    3 / 3
  11(c)                                    4 / 4
  11(d)                                    1 / 5
```

This is what the nested model was built for.

## 8. Nineteen states, five families, seven templates — frozen

Recorded as states, not as nineteen unique page layouts. These are **variants**
and do not become screens of their own: untouched / in-progress / completed
paper; answered / unanswered / flagged question; Practice vs Exam policy;
desktop vs mobile stimulus treatment; valid-but-thin.

## 9. UX-TEST-02 is fixed; nothing else is patched ahead of design

The version-routing fix is in. The remaining findings stay design inputs:
format-inappropriate guidance, repeated stimulus, flat multipart results, absent
persistence, absent navigator, absent skip.


## 10. There is no generic Feedback Sheet. Feedback is inline.

State 16 is **retired**, not deferred. Three formats have now been designed and
all three review in place:

| format | what marking looks like | where it renders |
| --- | --- | --- |
| calculation | deterministic check against an authored expected value | in the question card |
| short answer | authored marking points, weighted or as guidance | in the question card |
| extended response | overall mark, four authored criteria, response-level observations | in the question card |

The argument for a dedicated sheet was that a 20-mark review is long. It is, but
a separate screen would hold the same content in the same order and still be
long, so the length was never the problem. The problem was that a full submitted
essay sat at the top of the page, and that is solved where it occurs: once
marked, the response collapses to `Your submitted response · 176 words` with the
mark and the judgement immediately under it.

If the business report later shows a genuinely different interaction need, that
need gets designed. An abstract feedback screen is not kept alive on the state
list in case something wants it.

## 11. Test Mode has one accessibility baseline, in shared tokens

A contrast audit found **9 of 9 mockups failing WCAG AA**, 17 to 28 selectors
each, with the worst offenders in the frozen State 8 shell: the authored question
identity at 2.00:1 and the primary green button at 2.27:1. Seven shared token
values are corrected in `docs/testmode-tokens.md` and that is the baseline. The
measured result on the state that uses them is **zero AA failures**.

`--green` is unchanged. It remains the brand accent on surfaces that carry no
text, and stops being a background for white text.

These are **shared Test Mode tokens, not per-state colours.** Nine files are not
recoloured independently.

---

## 12. State 12 is frozen, and the collapsed response is the pattern

Extended response is frozen on the generated pages, with the submitted response
collapsed behind a native disclosure once the paper is marked. The order is
unchanged: the response still comes first, compressed rather than moved. What
the student sees is the mark, the marker's judgement, the four authored criteria
described honestly, and observations at response level with their own words
quoted only where the pipeline located them verbatim. No rubric mini-scores, no
bands, no generated replacement sentences, no route into the rewrite workspace.

Verification accepted: 99 suites, 4453 assertions, 477.2s of an 800s budget, on
a clean tree, plus `tests/t32.mjs` and eight mutations retained, `tests/t33.mjs`
on the generated pages, and `tests/ui69.js` as the rendered-state regression.

## 13. A shared-shell defect outranks a freeze

The sitting shell was frozen at decision 8. It was reopened for one thing:
UX-TEST-06, a sticky footer that at 390x844 grew to 119px and sat on top of the
marked result. A freeze protects a design from churn; it does not protect a
defect that reaches every marked format at a common phone width, and the cost of
leaving it was a student finishing a paper and not being able to see the mark.

What was reopened is the narrow-mobile footer only. Below 640px - measured, that
is where the row stopped wrapping - the footer is one compact row of Previous,
Flag and Finish, without the item counter and without the trailing half of each
label. Above 640px nothing changed: every structural box on all ten pages is in
the same place to the pixel, the rendered text is identical, and the document
heights match.

The rule that follows from this: **a frozen state is reopened for a measured
defect, not for a preference, and the reopening is scoped to the defect.**

## Mockup order — dependency, not numerical

```
(16 Feedback is retired — see decision 10)
8 Sitting shell → 14 Nested multipart → 15 Navigator
  → 11 Short answer → 9 MC → 10 Calculation → 12 Extended → 13 Business report
  → 17 Results → 18 Question review → 19 Submit confirmation
  → 6 Overview → 7 Section intro → 1 Library → 3 Import → 4 Validation
  → 5 Blocked → 2 Empty
```

The hardest interaction model first, then propagated outward.
