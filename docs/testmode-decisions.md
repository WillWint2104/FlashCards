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
UX-TEST-06, a sticky footer that at 390x844 grew to 119px and sat on top of
marked content. (It was first reported as covering the mark itself; re-measured
with the page's own fonts, what it covered on the extended response was the
marker's judgement directly under the mark. The defect and the fix stand; the
first evidence was partly a fallback-font artefact. See UX-TEST-06 in
testmode-ux-audit.md.) A freeze protects a design from churn; it does not protect a
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

## 14. A business report's own words reach its marker, through a door it already reads

The state 13 audit found that nothing saying "report" reached the marker: the
worker never reads `format`, and a report's instructions and marking points were
sent nowhere. Of three routes - design against the pipeline as it is, route the
genre through an existing channel, or a full contract change - the second was
chosen.

`ASSESS.reportGuidance` sends a business report's instructions, then its points,
then whatever it sent before, through `requirements.accomplish`, which both
marking passes print as "what a strong response accomplishes". Nothing is written
for it. Guidance the worker would silently truncate is refused whole, and the
paper validator blocks what the runtime would refuse.

Scoped to business_report. The extended response's request is byte-identical,
measured on the wire against the previous build, so state 12 stays frozen. What
is deliberately NOT done: the response-type line still says "extended response"
and the case study still does not reach the marker, both of which need a worker
change.

## 14a. Amended: what the marker is sent is what the question authored, for every written format

Decision 14 scoped the channel to business reports so that state 12's request
stayed byte-identical. That protected a correctness fault - an extended
response's own marking points reached nothing - so the scope is now the general
rule: authored assessment requirements that bear on marking reach the written
marker, whatever the written format. A business report additionally sends its
own instructions and its case study, and both passes are told its format. A
correctness improvement is allowed to change a frozen state's request; state 12
was re-verified rather than held byte-identical, and no teaching material was
added to any request.

## 15. State 13 answers minimally now; the report doctrine is state 13b

State 13's answering surface is the extended response's, with the contradiction
removed: no essay skeleton for a report, the question's own instructions
rendered, a placeholder that says sections. That shipped in the app, not only in
a mockup, because the skeleton was a live contradiction of the question's own
marking point (UX-TEST-09).

The doctrine in `GUIDED-MODE-PLAN.md` - report sections generated from the task's
own bullets, an executive summary written last, no title page, a report toolbelt
- is **state 13b**. It is recorded here so it is neither lost nor silently
overruled. It belongs with guided writing, and whether it ever reaches a timed
Test Mode paper is its own decision.

## 16. Desktop first. State 13 is frozen for desktop; the five formats are done

Desktop and web are the primary release target for Test Mode v1:

- **Primary acceptance:** a desktop browser, roughly 1280px and wider, at normal
  laptop heights. It covers website navigation and workflow, correct marking and
  data behaviour, and accessibility on the desktop implementation.
- **Secondary acceptance:** tablet, and narrow or mobile responsive optimisation.
  Mobile must not break catastrophically (no overflow, no unusable controls). A
  fold or spacing issue at 390px is not an approval gate in this phase.

State 13 (business report) is **frozen for desktop** as approved. The ~1px
score/footer clearance at 390×844 is UX-TEST-14, logged as a **mobile responsive
follow-up, non-blocking for desktop Test Mode v1**. The footer is not touched again
in this phase.

Multiple choice, calculation, short answer, extended response and business report
are frozen desktop states. They reopen only for a shared implementation defect.
State 13b stays deferred. State 16 stays retired: feedback on a marked question is
inline.

Work stops going format by format. The next objective is the complete desktop
workflow: library, import, validation, overview, sitting, navigator, submit,
results, review. Its acceptance is the synthetic Business Studies paper run end to
end with no source edits. The audit is `docs/desktop-workflow-audit.md`. Mobile
gets one consolidated responsive pass once the desktop workflow is genuinely end
to end.

## 17. Desktop v1 is Practice only

The supported policy is **Practice · marked as you go**. A question is marked as
it is submitted. Submitting the paper closes the attempt and goes to results.

Exam conditions is **post-v1**. The policy pill stays as the architectural slot
(decision 3), and nothing else is built for it: no batch marking, no
marking-in-progress state, no Exam/Practice toggle, and no exam-condition
persistence semantics.

## 18. Six workflow pages, in journey order, delivered in two slices

The remaining pages are designed in the order a student meets them:

1. Test Mode home / library
2. Import and validation
3. Exam overview, Start or Resume
4. Submit paper
5. Results overview
6. Individual-question review

This replaces the dependency order proposed by the desktop audit. The attempt
vocabulary is locked first, in `docs/testmode-attempt-state.md`: three statuses,
and counts beside them.

**Slice A, usable sitting.** Design pages 1 to 3, one full page at a time, each
stopping for approval. Then implement those three with the already-approved
question experience:

- saved attempts, Start and Resume;
- Previous, Next and Flag;
- the navigator and nested part navigation;
- section transitions;
- the five frozen formats, without redesigning them.

**Slice B, completion.** Once Slice A can sit, resume and navigate the synthetic
paper on desktop, design pages 4 to 6, then implement them.

**Priority zero in Slice A:** the Test Mode header resolves from the active
paper's curriculum authority (active paper, then `subjectKey`, then the
registered course), never from Study mode state. There is no Economics
fallback, and no fallback of any kind.

**Import moves into Test Mode.** The combined *"Import a set or a practice exam"*
box in Create stops being the exam workflow. The import page uses the Gate 3C
taxonomy (malformed, unsupported, blocked, valid but thin, publishable) and shows
the resolved subject and course before anything is added. The *"past paper"* and
*"Study map"* copy goes.

## Mockup order — dependency, not numerical

```
(16 Feedback is retired — see decision 10)
8 Sitting shell → 14 Nested multipart → 15 Navigator
  → 11 Short answer → 9 MC → 10 Calculation → 12 Extended → 13 Business report (13b later)
  → 17 Results → 18 Question review → 19 Submit confirmation
  → 6 Overview → 7 Section intro → 1 Library → 3 Import → 4 Validation
  → 5 Blocked → 2 Empty
```

Superseded by decision 18: six pages in journey order (library, import and
validation, overview, submit, results, review), delivered in two slices.

The hardest interaction model first, then propagated outward.
