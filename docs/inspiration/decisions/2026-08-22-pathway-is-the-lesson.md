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

## Know, See, Try are depths, not stages

Nothing is gated behind them. **The way back into the paragraph is at the top of
the surface, above everything, before the student has read a word.** A student
who understands the option already presses *Start writing* and never sees any of
it — that is the default, not an escape hatch.

| depth | what it is |
| --- | --- |
| **Know** | the two or three sentences that let them continue |
| **See** | the causal chain, revealed a step at a time, and the contrast most easily confused |
| **Try** | one micro-decision that requires *using* the idea |
| **Explore** | the fuller resource, opened beside the lesson so their place is kept |

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

## Every route ends in the paragraph

Not *Close*. The top button, the button after a right answer, and *Back* all land
on the writing line with the work intact.

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

## The contract this joins

`tools/coverage.js` now counts pathway lessons, and **Learn & Build readiness
requires one on every pathway**. Today: 3 of 28. A question runs in the mode it
is ready for and is never described as ready for one it is not.
