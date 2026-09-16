# State 11 — Short answer: reading key

Companion to `11-short-answer.html`, which is the canonical reference. Nothing in
this file appears on the student's screen.

Shown: desktop, **Practice**, question **11(b)** of the synthetic Business
Studies paper — a 3-mark short answer with the directive *explain*, three
authored marking points and **no model answer**, marked **2 of 3**. The
unanswered and answering states are already approved as state 8; this state is
the marked one.

## What the runtime actually does, checked before anything was drawn

| | |
| --- | --- |
| route | `app.js:2432` — a short answer is **not** sent to the marking worker |
| grader | `gradePoints`, local and immediate, one authored point per mark |
| worker | reached only on request, and only when an endpoint is connected |
| 11(b) data | 3 marks, directive `explain`, 3 points, **no `model`**, no `vocab` |
| source | parent-owned Kerbside Coffee, identical to 11(c) |
| retry | `examretry` re-opens the question with the answer restored |
| navigation | the multipart rail and the paper footer, unchanged |

So a short answer is **closer to the calculation than to an essay**: the default
judgement is deterministic and offline. That single fact drove this design more
than anything visual.

**The points are not a supplement to the mark. They are the mark.** One point,
one mark, so *2 of 3* can be explained exactly, with nothing invented and no
rubric fabricated. This is what makes the design objective reachable:

| the student's question | what answers it |
| --- | --- |
| what did my answer establish? | the two ticked points |
| what is missing? | the third point, marked *not addressed* |
| what would make it stronger? | the third point is the answer in most cases; where it is not, one secondary action asks the marker |

## Two defects found while checking, both proven by running

Recorded in full in `testmode-ux-audit.md` as **UX-TEST-03** and **UX-TEST-04**,
and **not fixed**, per the standing rule about patching ahead of approved design.

1. `gradePoints` reads each point as an object (`pt.text`, `pt.need`); the
   contract's own fixture authors them as strings. `norm(undefined)` is `""`, so
   every point "hits". **An empty answer scores 3 of 3**, and the checklist
   renders three ticks against the word `undefined`.
2. 12(b) is worth 5 marks and authors 4 points, so no answer can reach 5 of 5
   while points grading is in force.

This screen is drawn as the fixed behaviour would render: the answer shown
addresses two of the three points and earns two marks. Defect 1 is a data-shape
mismatch and does not change the design; defect 2 does, and is handled below.

## Information hierarchy

Top to bottom, and deliberately in this order:

```
1  parent + question identity        frozen shell
2  the prompt
3  YOUR ANSWER                       what you wrote, still in the field
4  THE RESULT                        Most of it · Marks 2 of 3
5  actions                           Try again · What would make this stronger
6  HOW THIS WAS MARKED               a section, then one surface of points
```

**The result comes before the explanation.** A student wants the mark first;
withholding it above a wall of commentary is a worse experience, not a more
educational one.

**The actions come before the marking detail, not after it.** `Try again` is the
recovery action and it should not be at the bottom of a list the student has to
scroll past. The marking section is reference material for the retry, so it sits
under the thing it informs.

**The answer stays in its field.** Same move the calculation makes with `1.3`:
the field keeps the text with a tinted border rather than becoming a second
read-only quotation of the same words, and `Try again` puts the cursor back in
it. One representation, not two.

## The marking section

The same containment language the worked solution settled on, carrying different
content:

```
question card         white
└ marking SECTION     a rule, a heading, and the count at its right
  └ points surface    #F4F9F8, r9px, one inset panel
```

No nested cards. The marker rings reuse the part rail's vocabulary — a tick in a
filled ring, or an **empty dashed ring** — so state reads without colour, and the
missed point additionally carries the words *not addressed*. Every point is
shown, earned or not: a student cannot tell what a mark was for by seeing only
what they lost.

Under the list, one line states the arithmetic: **"One mark for each point
addressed. Three points, three marks."** That is the whole rubric for this
question, said plainly, and it is what makes *2 of 3* informative rather than a
verdict.

**Where the points cannot account for the marks** (UX-TEST-04, 12(b): four
points, five marks) that line is the release valve. It reads *"One mark for each
point addressed. Four points account for four of the five marks."* The interface
stops claiming the points are the whole rubric instead of implying a fifth mark
the data cannot explain.

## What this deliberately is not

It is **not Essay Practice**. No TEEEC tabs, no rewrite box, no More Help, no
sentence shapes, no Paragraph Review, no coaching loop. In the current build
`examDeepReview` opens Paragraph Review whenever the worker returns
`paragraphs[]`; **in Test Mode a short answer must not open it.** This is
retrospective assessment feedback about a response that has been submitted, not
guided composition of one that has not.

`What would make this stronger →` is the one door to the marking worker. It
returns an overall summary, criteria judgements and next steps, and those render
**into this same section** as more of the same material — not into a review
workspace. It appears only when an endpoint is connected, because without one
the current code substitutes a demo grade, and a demo grade presented as marking
is the fault Gate 3B exists to prevent.

## The four authoring cases

The design has to hold whatever a paper authors. None of these makes the page
look broken, because each optional element is a section that is either present
or absent, never an empty frame:

| case | what renders |
| --- | --- |
| **points, no model** — 11(b), and every short answer in this paper | the result, the points surface, the arithmetic line |
| **points and a model** | the same, plus a collapsed *Model answer* disclosure below the surface |
| **model or vocabulary but no points** | the result, the matched and missing terms, the model; the arithmetic line is withheld because there is no per-point mark to state |
| **worker feedback only** | the result, then the summary, criteria and next steps in the marking section; no points surface |
| **thin but assessable** | the result alone, and the marking section does not render at all |

11(b) is the third-hardest of these and the one the fixture actually has, which
is why it was drawn first. A model answer is **not** assumed: none is authored
here, so none is shown, and the absence leaves no gap.

## Verified

- grid guard on this screen as on the others: two children, side by side,
  666/416, the source not nested in the question card
- surface chain from a marking point outward: `pts r9px` → `mark r0px` →
  `qcard r18px` — two surfaces, not four
- the whole marking section clears the sticky footer by 115px at 1280x900
- no page errors, no horizontal overflow
- no *Model answer* string anywhere in the rendered page

## Not decided here

- **Extended response and business report** (states 12 and 13), which do go to
  the worker by default and will need the criteria and next-steps treatment this
  screen only gestures at.
- **The feedback sheet** as a separate surface (state 16). On this evidence it
  may not need to exist: marking renders in place for both calculation and short
  answer, and a sheet would reintroduce the overlay both have now removed.
- **Fixing UX-TEST-03 and UX-TEST-04.**
