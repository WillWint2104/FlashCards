# State 14 — Nested multipart question: reading key

Companion to `14-nested-multipart.html`, which is the canonical reference and
contains the clean screen only. Nothing in this file appears on the student's
screen.

Shown: desktop, **Practice** policy, **question 11(c)** of the synthetic
Business Studies paper. State 8's sitting shell is reused without modification.
This state decides one thing only: how a parent question with children is
presented.

## The model

One active part at a time. The parent is persistent context; the student moves
through its children inside it.

```
Question 11  →  11(a)  →  11(b)  →  11(c)  →  11(d)  →  Question 12
             └──────── parent strip stays put ────────┘
```

The alternative — four stacked response boxes under one heading — was rejected
because it makes the source panel, the marking action and the help region
ambiguous about which part they belong to, and because it has no answer for a
12-part question.

## What is on screen, and why it is on screen

| the question it answers | where it lands |
| --- | --- |
| **does 11(c) read as part of a 14-mark Question 11?** | the parent strip above the dashed rule: *Question 11 · Kerbside Coffee · 14 marks*, always present, with *Question 11(c) · 4 marks* directly beneath it. The student is never asked to infer the parent. |
| **can they jump straight between a/b/c/d?** | the rail chips are buttons, not badges. Any part opens directly, in any order, answered or not. Each chip carries its own title: *"11(b) · 3 marks · answered · flagged for revisit"*. |
| **does jumping autosave?** | *"Saved. Moving to another part keeps this answer."* under the field. That is decision 1 made local: nothing is submitted, marked or lost by moving. |
| **does the shared source stay the same object?** | the panel is unchanged from state 8, headed *"Shared source · Question 11"*. It is owned by the parent, rendered once, and does not reload between children. |
| **how does a flagged part look?** | chip `b` carries **both** glyphs — `✓ ⚑ b` — because answered and flagged are two independent facts. |
| **how does partial parent completion read?** | *"2 of 4 parts answered"*, in the parent line that already exists. No second progress bar, no ring, no separate parent summary panel. |
| **what does Next become at the last child?** | see the navigation table below. |

## Two scales of navigation, kept separate

They are genuinely different journeys and they are in different places.

| | parent-local | whole paper |
| --- | --- | --- |
| control | the `a b c d` rail, in the question card | Previous / Next, in the frozen footer |
| what it moves between | the children of Question 11 | every answerable in authored order |
| addressing | authored labels | answerable position |

The footer follows answerable order, so from 11(c) it reads **Previous ·
11(b)** and **Next · 11(d)**, and the position reads **13 of 20**. At the last
child it crosses the parent boundary:

| where the student is | Previous | Next |
| --- | --- | --- |
| 11(a) — first child | 10 | 11(b) |
| 11(c) — shown here | 11(b) | 11(d) |
| 11(d) — last child | 11(c) | **12** |

Next does not become "finish Question 11". There is no such step: a parent is
complete when its children are, and the rail already says how many are. Adding a
per-parent completion action would create a second submission concept competing
with the paper's own.

## Format independence, proved rather than asserted

11(c) is an authored **calculation** — the fixture's own `format: "calculation"`,
4 marks, `expected: 1.5`. Nothing was invented to make this screen interesting;
the part shown is simply the one that stresses the container hardest.

Two consequences visible on the screen:

1. **The response field is short and the container is unchanged.** A calculation
   takes a single-line field where 11(b) took a seven-row textarea. The parent
   strip, the rail, the source panel, the marking action and the footer are
   identical either way. The parent container does not care what its child's
   format is. The full calculation treatment — whether working is captured
   alongside the answer — is **state 10** and is deliberately not decided here.
2. **The help region is withheld entirely.** Decision 5 says a calculation gets
   formula or working expectations *where legitimately authored*. This part
   authors neither: it has no `points`, and its `model` field is the worked
   solution, which cannot be shown before marking. So the region is absent, not
   filled with something generic. State 8 rendered it; state 14 does not; the
   layout does not sag around the hole.

Note also that 11(c) supplies its own figures and does not need the case study.
The panel stays anyway, because it belongs to the parent, not to whichever child
happens to be open. That is the point of owning it at the parent.

## The rail, in detail

Four states, each legible without colour, exactly as frozen in state 8:

| chip | state | cue |
| --- | --- | --- |
| `✓ a` | answered | tick, green-soft fill |
| `✓ ⚑ b` | answered and flagged | both glyphs, green-soft fill, gold border |
| `c` | current | filled dark with a ring |
| `d` | not answered yet | dashed outline |

`✓ ⚑` is the one addition state 14 makes to state 8's vocabulary. State 8's four
states render identically; this is a composition, not a replacement. It exists
because the realistic mixture demanded it: had `⚑` replaced `✓`, the rail would
have claimed b was unanswered and the *"2 of 4 parts answered"* count would have
contradicted it.

**More than four parts.** The rail is a wrapping flex row of fixed-size chips, so
eight parts wrap to a second line rather than scrolling or truncating. At the
point where wrapping becomes unreadable the navigator (state 15) is the right
surface, and the rail can fall back to it. Nothing here forecloses that. The
synthetic paper's other parent, Question 12, has three parts and uses the same
rail unchanged.

## What Practice adds, and where exam conditions differ

The screen is Practice, so **Submit for marking** is present and primary. What
follows a submission — feedback in place — is **state 16** and is not drawn here.

The parent-level consequence is the only part that belongs to state 14: marking
a child changes that child's chip to answered and advances the *"n of 4 parts
answered"* count. It does not gate the other children, and it does not advance
the student automatically. Under exam conditions the same rail counts saved
answers instead of marked ones, and the marking action is replaced exactly as
the state 8 policy table describes. The rail itself does not change.

## Carried forward, not changed

The paper bar counts **answered** (12 of 20) while the footer states
**position** (13 of 20). Two counters, one denominator, one apart. This is
inherited from the approved state 8 shell, not introduced here, and state 14
does not expose a structural conflict that would justify reopening it — but it
is worth a deliberate look when the navigator lands, since the navigator shows
both facts at once for every question.

## Deliberately not decided here

- **Mobile.** Not designed. Not foreclosed either: the parent strip is a single
  horizontal row that becomes a sticky sub-bar under the paper bar, the rail
  survives as-is at phone width, and the source panel becomes the sheet already
  sketched in decision 6. Nothing in this layout depends on the two columns.
- **The navigator** (state 15), including how it renders parent/part hierarchy
  and section boundaries.
- **The calculation response shape** (state 10).
- **The feedback sheet** (state 16) and hierarchical results (state 17).
