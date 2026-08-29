---
title:   The app checks the direction of an argument, not its membership of a list
date:    2026-08-22
status:  active
governs: own arguments, paragraph points, question authoring, the support contract
---

## What the bots found

On a judgement question the app could already notice a student whose arguments
undercut their own position. On a causal question it noticed nothing, so a
**deliberate wrong turn produced exactly the journey ignorance produced**. The
simulated students proved it: identical signatures for the wrong-turn learner and
the zero-knowledge learner on `mkt-01`.

## Three cases, and only one of them may speak

```
knows nothing        names neither end of the relationship          SILENT
misconception        names both, running the wrong way              ASKS
valid alternative    names both, the right way, nobody authored it  SILENT
```

The third is why this can never be an authored-answer matcher. The check reads
the question's own vocabulary for each end of its relationship, and the order and
verb between them. **Nothing in it compares against a pathway id**, so an argument
nobody thought of passes exactly as quietly as one that was.

It is deliberately low-recall. A prompt that fires on a legitimate sentence is
worse than one that misses, so a buried subject, a subordinate clause, or a
sentence with no directional verb all produce silence.

## Directive shapes

| directive | shape checked |
| --- | --- |
| causal (`Explain`, `Analyse`) | cause → mechanism → effect |
| judgement (`Evaluate`, `Assess`) | the causal shape, **and** whether the point reaches a degree |

A judgement question that stops at "this helps" has not answered the directive,
so it gets one quiet line asking how far. A causal question never does.

## Acknowledgement belongs to the claim

Generalised from the drift and judgement fixes: **an acknowledgement is tied to
the condition acknowledged, never to the press that dismissed it.** `p.dirSeen`
holds the exact claim that was kept, so re-typing it anywhere stays quiet and
changing it is a new question. The same rule now governs thesis drift
(`thesisSeenText`), the judgement check (`posSeenShape`) and duplicate arguments
(`twinOk` keyed by paragraph and argument).

## The support contract

`tools/coverage.js` measures, per question, what a student can actually be given,
and `build.js` writes it to `docs/support-coverage.md` on every build. A concept
counts as **explained** only where an explaining field mentions it: a label that
prints `servicescape` does not teach it.

| readiness | requires |
| --- | --- |
| Independent practice | the question and its marking |
| Guided practice | every pathway carries its own meaning |
| Learn & Build | every named concept explained, a full ladder on every pathway, sourced evidence on every pathway, and wrong-turn recovery |

A question may run in a mode it is ready for and must never be described as
ready for one it is not. The bots report `UNSUPPORTED_DEMAND` every time the app
asks a student to understand something it cannot teach; for a genuinely
Learn & Build ready question that count is **0**.
