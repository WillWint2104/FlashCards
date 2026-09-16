# State 11 — Short answer: reading key

Companion to two canonical screens. Nothing in this file appears on the
student's screen.

| screen | file |
| --- | --- |
| weighted points — 11(b), marked 2 of 3 | `11-short-answer.html` |
| key points only — 12(b), marked 3 of 5 | `11-short-answer-keypoints.html` |

Both are desktop, **Practice**, inside the frozen shell. The unanswered and
answering states are already approved as state 8; this state is the marked one.

## What the runtime actually does, checked before anything was drawn

| | |
| --- | --- |
| route | `app.js` — a short answer is **not** sent to the marking worker by default |
| grader | local and immediate, against the marking points the paper authors |
| worker | reached where the points cannot account for the marks, or on request |
| source | parent-owned; 11 has one, **12 has two** — a table and a note |
| retry | re-opens the question with the answer restored |
| navigation | the multipart rail and the paper footer, unchanged |

A short answer is therefore **closer to the calculation than to an essay**: the
default judgement is deterministic and offline. That single fact drove this
design more than anything visual.

## Marking points are guidance; marks are only sometimes theirs

The first draft of this screen said *"One mark for each point addressed"* under
every checklist. That was wrong. **12(b) authors four points against five
marks**, and every extended response in the paper authors four against twelve or
twenty. `points[]` is a list of the things a marker looks for. It is not an
allocation, and nothing in the contract had ever said it was.

The contract now says so explicitly rather than by inference:

> A mark is derived from marking points **only** where a paper authors per-point
> marks that sum to the question's marks.

`weighted` is that declaration and **nothing implies it**. A question whose point
count happens to equal its mark count has still not said one point is one mark;
inferring it from the coincidence is the substitution Gate 3B removed from
formats. `t31` asserts the coincidence is refused.

**So the screen has two shapes, and both are drawn.**

| | 11(b) — weighted | 12(b) — key points |
| --- | --- | --- |
| authored | 3 points, each `marks: 1`, summing to 3 | 4 points, no weighting, 5 marks |
| result | **Marks 2 of 3** | **Marks 3 of 5**, from the marker |
| checklist count | 2 of 3 key points addressed | 2 of 4 key points addressed |
| the line beneath | *One mark for each point addressed. 3 points, 3 marks.* | *These are the key points considered in marking. They are not one mark each.* |
| where the mark came from | the checklist | the marker, said so on screen |

The count is always **key points**, never marks, so the two are never silently
equated. On 12(b) they are deliberately different numbers — 3 of 5 marks beside
2 of 4 points — because the screen has to survive a reader checking whether they
match.

Where the mark did not come from the checklist, the screen says where it did: a
short attributed comment under the result, headed *Marked against Business
Studies criteria*. That slot is **absent on 11(b)**, where the points produced
the mark themselves and a comment would be furniture.

## The two defects are fixed, not deferred

Written up in full in `testmode-ux-audit.md`.

**UX-TEST-03 — an empty answer scored full marks.** The grader read every point
as an object while papers author strings; `norm(undefined)` is `""`, every
answer contains `""`, so every point "hit". Reading and matching are now one
contract function each — `ASSESS.markingPoints` and `ASSESS.scorePoints` — which
accept both authored shapes and refuse anything else with `POINTS_MALFORMED`. A
point that cannot be read is not a point that was addressed. Measured after the
fix: empty scores 0 of 3, unrelated scores 0 of 3, one authored point scores 1,
two score 2, and the rendered text is the authored text.

**UX-TEST-04 — 12(b) cannot reach five marks from four points.** Resolved by the
model above. **12(b) was not changed to fit**; it is now the fixture's canonical
unweighted case. The three short answers that were already one-to-one had that
made explicit with `marks: 1`, which changes no mark value and states what was
previously only a coincidence.

`tests/t31.mjs` — 41 assertions, in `fast` and `checkpoint`. Gates after the
change: fast **30.1s** of 40, checkpoint **52.2s** of 60, both green.

## Information hierarchy

```
1  parent + question identity        frozen shell
2  the prompt
3  YOUR ANSWER                       what you wrote, still in the field
4  THE RESULT                        the mark, and where it came from
5  actions                           Try again, and one optional door to the marker
6  HOW THIS WAS MARKED               a section, then one surface of key points
```

**The result comes before the explanation.** A student wants the mark first;
withholding it above a wall of commentary is a worse experience, not a more
educational one.

**The actions come before the marking detail, not after it.** `Try again` is the
recovery action and should not sit at the bottom of a list the student must
scroll past. The marking section is reference material for the retry, so it sits
under the thing it informs.

**The answer stays in its field.** The same move the calculation makes with
`1.3`: the field keeps the text with a tinted border rather than becoming a
second read-only quotation of the same words, and `Try again` puts the cursor
back in it. One representation, not two.

## The marking section

The containment language the worked solution settled on, carrying different
content:

```
question card         white
└ marking SECTION     a rule, a heading, and the count at its right
  └ points surface    #F4F9F8, r9px, one inset panel
```

No nested cards. The markers reuse the part rail's vocabulary — a tick in a
filled ring, or an **empty dashed ring** — so state reads without colour, and an
unaddressed point additionally carries the words *not addressed*. It is a ring
rather than a cross because it is a point the answer did not reach, not an error
the student made; the shipped `.exam-pt.miss` marker was changed to match.

Every point is shown, addressed or not. A student cannot tell what a mark was
for by seeing only what they lost.

## `What would make this stronger →`

Present on 11(b), absent on 12(b), and the difference is the rule:

- where **unaddressed points remain**, they are the answer, and the action
  opens the marker only to say what the points cannot;
- where the mark already came from the marker — 12(b) — the comment is on
  screen and the action would be asking the same question twice;
- it appears only when an endpoint is connected, because without one the code
  substitutes a demo grade, and a demo grade presented as marking is the fault
  Gate 3B exists to prevent;
- **it never opens Paragraph Review.** In the current build `examDeepReview`
  does, whenever the worker returns `paragraphs[]`. In Test Mode a short answer
  must not: this is retrospective assessment feedback about a submitted
  response, not guided composition of one.

None of Essay Practice comes across — no TEEEC tabs, no rewrite box, no More
Help, no sentence shapes, no coaching loop.

## The authoring cases

Each optional element is a section that is either present or absent, never an
empty frame:

| case | what renders |
| --- | --- |
| **weighted points, no model** — 11(b) | result, points surface, the weighting stated |
| **key points only** — 12(b) | result and where it came from, points surface, points described rather than weighted |
| **points and a model** | either of the above, plus a collapsed *Model answer* below the surface |
| **model or vocabulary but no points** | result, matched and missing terms, the model; no count line, because there is no per-point mark to state |
| **worker feedback only** | result, then the comment; the points surface does not render |
| **thin but assessable** | the result alone; the marking section does not render at all |

Two are drawn, because they are the two the fixture genuinely has. **A model
answer is not assumed:** none is authored for either question, so none is shown,
and the absence leaves no gap on either screen.

## Verified

- grid guard on both screens: two children, side by side, 666/416, the source
  not nested in the question card
- surface chain from a marking point outward: `pts r9px` → `mark r0px` →
  `qcard r18px` — two surfaces, not four
- the whole marking section clears the sticky footer by 115px at 1280x900, on
  both
- 12(b)'s two authored sources both render, each keeping its authored caption
- no page errors, no horizontal overflow
- no *Model answer* string anywhere in either rendered page

## Not decided here

- **Extended response and business report** (states 12 and 13), which do go to
  the worker by default and will need the criteria and next-steps treatment
  these screens only gesture at.
- **State 16.** Marking renders in place for calculation and short answer alike,
  so a universal feedback sheet looks unnecessary. Kept as an open question
  rather than deleted: extended response and business report may still want a
  dedicated full-response review, and that is decidable only once they are
  designed.
