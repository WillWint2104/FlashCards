---
title:   The pathway is the lesson
date:    2026-08-22
status:  active, proven on three pathways
governs: the Learn surface, pathway cards, the authoring schema
implements: briefs/2026-08-22-pathway-learning.md
---

## The rule

A student who has chosen **convenience → processes** meets one surface about that
one argument. Not a definition drawer, then a relationship drawer, then a
misconception drawer, then an example drawer, then a quiz. That sequence is the
*authoring* architecture, and putting it in front of a student is what makes
learning feel like leaving the essay.

Underneath, everything stays modular and reusable. On screen it is one thing.

## Two fields, two jobs

`choiceMeaning` carries only what tells this option from the others. `learning`
carries the teaching. Without the split, `meaning` grows until it serves neither:

> **Processes — convenience**
> Customers wanting an easier buying experience can lead a business to simplify
> ordering, payment or collection.

That is the whole choice surface. No formal definition, no `servicescape`, no
evidence, no terminology list. The student only has to answer *is this roughly
the argument I want*.

The build refuses a `choiceMeaning` over 170 characters or of more than one
sentence, and refuses a `learning` block with no `choiceMeaning` beside it.

## The paragraph never leaves

The lesson is full width, because a causal chain compressed into a narrow drawer
stops being a relationship and becomes a list. What keeps it from feeling like
leaving the essay is not width but **orientation**: a strip at the top holds the
paragraph, the part of the question, the argument chosen, the last sentence they
wrote, and the way back, named for the component they were on.

> **Body 3 · processes** — Wanting less effort → faster, more flexible ordering
> *you were writing: "Customers who want less effort push McDonald's to take steps out of ordering."*
> **← Return to my topic sentence**

## Know, See, Try are depths, not stages

Nothing is gated behind them. **The way back into the paragraph is at the top of
the surface, above everything, before the student has read a word.** A student
who understands the option already presses *Start writing* and never sees any of
it — that is the default, not an escape hatch.

| depth | what it is | where |
| --- | --- | --- |
| the explanation | the two or three sentences that let them continue | first, and short |
| the relationship | the causal chain, revealed a step at a time | **the centrepiece** |
| the check | one micro-decision that requires *using* the idea | **79 words in** |
| the rest | the contrast, the worked example, the fuller resource | behind *Still not clear?* |

**Those four words are never shown to the student.** They are how the parts are
authored, not headings to navigate. What is on screen is one flow, and the number
that matters is not how long the lesson is but **how far the student reads before
there is something to do with it**: 79 words, not 214.

A student coming back does not reread it. Three shortcuts — *the concept*, *the
connection*, *an example* — point into the same page.

## Try tests application, and a wrong answer is repaired

The build refuses a `try` prompt that asks for a definition. It requires exactly
one right option, a `repair` on every wrong one, and an `onRight` that says *why*
it was right.

> Customers say ordering takes too long. Which change most directly addresses
> that?
>
> *Run a new advertising campaign* → Advertising changes promotion, not what a
> customer has to do to buy. Look again at ordering, payment or collection.

A repair is one line aimed at **that** mistake, capped at 220 characters, with a
retry. Never *read the lesson again*.

## Every route ends in the component they came from

Not *Close*, and not *the paragraph*. The strip says **Return to my topic
sentence**; success says **Use this in my topic sentence**. If they left from the
explanation they are handed back to the explanation. That connection between
learning something and immediately producing with it is the whole point of
attaching the lesson to a chosen argument.

## What the three learners did

Measured on `mkt-01`, all three through the same Processes pathway:

| | opened | words read | try | learning : writing |
| --- | --- | --- | --- | --- |
| zero knowledge | 1 | 273 | 2 attempts, 1 repaired, then right | 0.43 to 1 |
| partial knowledge | 1 | 178 | did not stop to be tested | 0.16 to 1 |
| strong independent | 0 | 0 | — | 0 |

Rhythm, per paragraph: the zero-knowledge student wrote two paragraphs with no
support at all and read for the third. **Support is not a toll on every
paragraph**, and if all three were ever put through the same surface the design
would be wrong.

## Where the knowledge came from

A paragraph written with no lesson is only good news if the environment taught
what it used. Every concept the zero-knowledge student wrote with is now traced:

```
Body 1  digital, marketing        argument meanings
Body 2  service                   Learn
Body 3  effort, faster, flexible  the pathway lesson
        ordering                  Learn
        wanting                   argument meanings
```

Nothing is used unaccounted for, and the audit separates two kinds of gap that
look identical from outside: concepts **nothing** explains (`engagement`,
`expecting`) and concepts the app **can** explain but did not surface where the
student was (`personal`, `training`, `standards`). The second kind is the sharper
number, because it is a routing failure rather than missing content.

## Transfer

The relationship, restated somewhere the app never mentioned, using only what the
lesson showed, and judged by the app's own reasoning checker:

> At a cinema, customers value convenience, so the business simplifies ordering.

Coherent, and stated without reopening the lesson.

## The contract this joins

`tools/coverage.js` now counts pathway lessons, and **Learn & Build readiness
requires one on every pathway**. Today: 3 of 28. A question runs in the mode it
is ready for and is never described as ready for one it is not.
