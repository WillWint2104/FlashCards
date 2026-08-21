---
title:   The working answer states intent, and says so
date:    2026-08-21
status:  active
governs: the working answer, the drift card, judgement positions, required coverage
extends: 2026-08-20-progressive-construction.md
---

## The mistake this closes

The working answer is derived from the pathways a student has **selected**. It is
not derived from anything they have written. Nothing in the app reads a
paragraph. So a student can select

> training → productivity

and then write four sentences that establish nothing of the kind, and the system
is still assembling a sentence that says training raises productivity.

The previous pass labelled that sentence **"your paragraphs now argue"**. That is
a claim about prose, made by a component that has never looked at the prose. It
quietly collapsed the distinction the whole architecture is built on:

```
plan     = what the student intends to establish
writing  = what the student has actually established
```

## The rule

**Every label on the working answer names the choice, never the achievement.**

| context | wording |
| --- | --- |
| start surface | Your answer so far · from 3 arguments you have chosen, 1 written |
| response map | What the arguments you have chosen add up to |
| drift card | based on the arguments you have chosen |
| drift card, in full | this comes from the arguments you picked, not from reading your paragraphs |

`esWorkingParts` still records `written`, and it still means only **there is
prose in this paragraph**. It never means the argument landed.

## When this may be upgraded

When P2 introduces paragraph diagnosis, each part gains a second, better source
of truth: what the diagnosis found the paragraph actually established. At that
point, and only then, the wording may claim the response argues something, and
the working answer can respond to writing rather than to selection.

Until then, a plausible-sounding generated sentence is not evidence that anything
was established. Do not let the fluency of the output talk the wording back up.

## Three companion rules settled in the same pass

**A judgement is an orientation, never an entry requirement.** `I will decide as
I go` is a first-class answer that closes the panel. A student who cannot yet
evaluate the question may start body 1, learn something, build an argument and
form the position afterwards.

**Required coverage is checked hard at review and never blocks writing.** The
review names what is missing, states the cost in plain words, and offers a route
to each one. Submitting an incomplete response stays available, because a student
may deliberately want an incomplete answer marked.

**A judgement that stops fitting its arguments is questioned, not overruled.**
Evaluation is not arithmetic. Three limitations do not make "highly effective"
wrong. The app asks one question, once, reading the authored `lean` on the
position rather than guessing from its label, and the student answers it. Nothing
downgrades, reorders or rewrites a judgement.

## What holds this in place

- `checkWorkingAnswers()` in `build.js` refuses the build unless every `adds` is
  a complement phrase of the kind the question's `lead` demands, every pathway
  contributes one, and every judgement position carries a `lean`.
- `tests/t12.mjs` renders **3001 combinations** of chosen arguments through the
  shipped assembler and reads each result for mechanical faults.
- `tests/ui25.js` asserts the wording, the deferral, the coverage warning and the
  judgement question in the real interface.
