# State 15 — Navigator: reading key

Companion to `15-navigator.html`, which is the canonical reference. Nothing in
this file appears on the student's screen.

Shown: desktop, **Practice** policy, the navigator open over the state 14 screen.
It opens from the **Questions** button in the paper bar, which is drawn held
open, so the route into it is visible rather than assumed. There is no second
entry point.

## The thing this state had to settle: three different numbers

The state 14 screenshot put two counters on one screen that looked like rivals.
They are not. There are **three** distinct concepts in Test Mode and each now has
its own vocabulary, fixed here and propagated back through the shell.

| concept | wording | example | where it appears |
| --- | --- | --- | --- |
| **completion** | *n* of *N* **answered** | `12 of 20 answered` | paper bar, navigator stats |
| **sequence position** | **Item** *n* of *N* | `Item 13 of 20` | sitting footer, navigator stat pill |
| **authored numbering** | **Question** *n*, *n*(x) | `Question 11(c)` | question head, navigator chips and parent blocks |

Two rules follow, and the navigator obeys both:

1. **The footer is never labelled "Question 13 of 20."** The question on screen
   is Question 11(c). Position is not identity, which is the same substitution
   Gate 3C removed from the contract.
2. **A navigator chip never shows a bare number.** `Q13` is Question 13, which is
   item 18. Rendered as `13` it would have sat two inches below the words *"item
   13 of 20"* meaning something else entirely. The `Q` prefix makes every chip
   unambiguously authored numbering.

The dark pill in the stats row does the binding explicitly, in one line:

```
You are on item 13 of 20 · Question 11(c) · Section II
```

That is the only place the three vocabularies touch, and it is deliberately a
sentence rather than three numbers in a row.

## Structure mirrors the authored paper, not a flat list

| authored shape | how it renders |
| --- | --- |
| leaf question | one chip carrying its authored number: `Q13`, `Q14` |
| parent question | its own block: identity, title, aggregate marks, part rail |
| section | a heading with its own answered count and marks |
| either/or | two chips sharing one item, with `or` between them |

Section I is ten chips in a row; Section II is two parent blocks followed by a
single leaf chip. The navigator does not flatten Question 11 into four anonymous
entries, and it does not promote Question 13 into a block it has no children to
fill.

## The five facts, represented independently

Each is carried by its own mechanism, so none can be inferred from another:

| fact | mechanism |
| --- | --- |
| authored numbering | the chip label (`Q7`, `a`) and the parent block heading |
| current position | exactly one `here` chip, plus the item pill in the stats row |
| answered / unanswered | tick and green-soft fill vs dashed outline |
| flagged / unflagged | the `⚑` glyph, composed with `✓` where both are true |
| multipart grouping | the parent block: inset panel, left rule, its own heading |

**Parent completion is not derived from current position.** Question 11 reads
*2 of 4 parts answered* while the student is standing inside it on 11(c) — the
current part is not counted, because it has no response yet. Question 12 reads
*0 of 3 parts answered* with no current part anywhere near it. The two
quantities are independent and the screen shows both cases at once.

The section counts are likewise answered counts, not position: Section II reads
*2 of 8 answered* even though the student is in it.

## One chip vocabulary, two places

The chips in the navigator and the part rail in the question card are the same
component in the same four states, plus the one composition:

| chip | state | cue |
| --- | --- | --- |
| `✓ Q1` | answered | tick, green-soft fill |
| `✓ ⚑ Q7` | answered and flagged | both glyphs, green-soft fill, gold border |
| `c` | current | filled dark with a ring |
| `d` | not answered yet | dashed outline |

Nothing is expressed by colour alone. The legend at the foot samples real items
from the screen above it — `Q1` and `Q7` are genuinely answered and genuinely
flagged — rather than inventing exemplars.

## Section IV, which the fixture forced

The synthetic paper's last section carries `choose: 1`: *attempt either Question
15 or Question 16*. This is why the paper is 20 items and 90 marks while its
questions sum to 110. A flat navigator would have had to either list both and
overstate the paper, or hide one and misrepresent it.

Rendered as two chips sharing one item slot, with the section note in words and
*"Not chosen yet"* beside them. Choosing is not designed here; representing the
choice honestly is, because the contract has modelled it since Gate 3C
(`answerables(paper, choices)`).

## Deliberately left out

- **Filters and a "go to first not answered" jump.** Twenty items fit on one
  screen with room to spare, and the first unanswered item is currently the one
  the student is standing on, which would have made the control read as broken.
  Worth revisiting only for a paper long enough to scroll.
- **Anything to do with submission.** The unanswered list that decision 2
  sketches belongs to state 19, not here. The navigator navigates.
- **Marks earned per question.** The paper bar already carries the live score as
  a policy slot; repeating it per chip would harden a Practice-only fact into the
  shared shell.

## Two corrections propagated back into the frozen shell

Both are shell-level and now identical in states 8, 14 and 15.

**1. Terminology.** The sitting footer reads `Item 12 of 20 · Section II` in
state 8 and `Item 13 of 20 · Section II` in states 14 and 15. One word.

**2. The sticky footer had nothing to stick to.** Measured, not assumed:

```
before   state 14   1280x700   content 605px   footer bottom 605   gap  95px
                    1280x900                                       gap 295px
                    1512x982                                       gap 377px
         state 8    1280x800   content 825px                       pinned
                    1280x900                                       gap  75px
after    all three, at every size above                            PINNED
         and still sticky where the document overflows (1280x420, scrolled)
```

`position:sticky; bottom:0` pins an element only within a scroll range. Where
the document does not overflow there is no range, so the footer landed at its
natural flow position mid-screen. The fault was in state 8 all along; state 14
is shorter — help withheld, a one-line calculation field — and exposed it. The
fix is two declarations, `body{min-height:100vh;display:flex;flex-direction:column}`
and `main{flex:1 0 auto;width:100%}`. No token, component, spacing or colour
changed, and state 14's content was not padded to fill the space.

## Deliberately not decided here

- **Mobile.** The navigator is already a centred sheet with a scrolling body,
  which is close to the mobile form; the parent blocks stack without change. Not
  designed, not foreclosed.
- **Choosing between Question 15 and Question 16**, which is a question-screen
  interaction, not a navigator one.
- **Exam-conditions wording**, which belongs to that variant.
