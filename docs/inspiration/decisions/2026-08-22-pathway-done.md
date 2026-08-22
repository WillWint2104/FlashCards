---
title:   What "authored" has to mean before a pathway claims it
date:    2026-08-22
status:  active
governs: content production, the authoring queue, readiness
---

## The queue

24 of 28 pathways are `unreviewed`. That is a queue, not a defect list: nobody
has yet decided what those arguments depend on. This is the bar each one has to
clear to move to `authored`.

## Definition of done, per pathway

1. **`choiceMeaning`** — one sentence, enough to tell this option from the others
   and no more.
2. **Dependency declaration** — `primary`, `supporting`, `optional`.
3. **Every primary dependency authored and reachable** — the concept exists in
   the pack and this pathway declares it.
4. **A coherent lesson** — the explanation, the causal chain, and the pathway's
   own bridge between them. Not a stack of drawers.
5. **An application check with a repair** — one micro-decision that requires
   using the idea, exactly one right option, and a repair aimed at each wrong one.
6. **Pathway-specific guidance** — the per-component guides that make the writing
   ladder about this argument.
7. **A full ladder**, where the question is meant to be Learn & Build ready.
8. **Verified evidence**, where case-study evidence is expected. A source that was
   never recorded is never offered.
9. **The zero-knowledge bot completes it with no `UNSUPPORTED_DEMAND`.**
10. **The strong learner bypasses the learning surface entirely** and is never
    made to stop.

Items 1 to 8 are checked by `build.js` and reported by `tools/coverage.js`.
Items 9 and 10 are checked by `tests/bots`, because they are about what a student
was actually given rather than about what exists.

## `none-required` stays rare

It currently has no instances, and that is the right number. Making an author
justify

> this pathway requires no additional teaching

is much safer than letting missing content pass as intentional simplicity. It
requires a written `reason`, and the build refuses it without one.

## Before the content pass: fix the lexical audit

The audit extracts single words, so it surfaces `sensitivity` rather than
`price sensitivity`, `retention` rather than `employee retention`, `arrangements`
rather than `flexible working arrangements`. Bare `arrangements` is ordinary
English; the phrase is a real HR concept. Classifying single tokens would produce
the wrong answer in both directions.

Move to concept-phrase detection first, then have a human classify each phrase as
`domain`, `supporting` or ordinary. That happens **before** the textbook pass, not
during it.
