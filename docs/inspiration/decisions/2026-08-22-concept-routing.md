---
title:   Declaring a concept makes it eligible, not shown
date:    2026-08-22
status:  active
governs: the concept store, pathway authoring, the support report, the bot audit
extends: 2026-08-22-pathway-is-the-lesson.md
---

## The failure this closes

The provenance audit found three concepts a student needed and never got:
`personal`, `training`, `standards`. They were not missing from the pack. They
existed, and the People pathway had no way to reach them.

That is a third kind of failure, and it had been collapsed into "missing
content":

| | |
| --- | --- |
| **authored** | does the concept exist in the pack at all |
| **declared** | does this pathway say it depends on it |
| **reachable** | both, so a student on this pathway can be given it |

## Three states, so "not yet looked at" is not mistaken for "needs nothing"

Every pathway ends in one of three states. Without this, a pathway nobody has
reviewed and a pathway genuinely needing no extra concepts are indistinguishable,
which at a hundred pathways is dangerous.

```
learning: { status: "authored", concepts: { primary: [...], ... } }
learning: { status: "none-required", reason: "..." }
learning: { status: "unreviewed" }
```

`unreviewed` is a **state, not a claim**. It shows a student nothing, and it puts
the pathway in an authoring queue rather than quietly passing.

An ordinary build says this once:

```
note: learning coverage 4/28 reviewed; 24 pathways unreviewed
      (listed in docs/support-coverage.md)
```

Twenty-four warnings a build is how developers learn to ignore warnings. The ids
live in the report, where they are a queue. `node build.js --strict-learning`
turns the queue into a failure, for content validation rather than for every
local build.

## The contract

A pathway declares its dependencies. Declaring one does **not** show it: it makes
it **eligible here**.

```
learning:
  concepts:
    primary:    [people, training]      shown on the surface
    supporting: [serviceStandards]      behind "Still not clear?"
    optional:   [servicescape]          never shown unasked
```

`build.js` refuses a build where a declared concept is not authored, where a
`primary` concept is not a domain concept, or where a lesson declares nothing at
all. It warns where a concept that requires teaching is authored and **no pathway
declares it**, because that concept can reach no student.

## Not every unexplained word is a teaching dependency

A lexical audit cannot tell `servicescape` from `expecting`. One is subject
knowledge; the other is ordinary English inside an argument. Classification is
authored, not inferred:

| kind | means | example |
| --- | --- | --- |
| `domain` | must be teachable, and reachable from any pathway that depends on it | `processes`, `people`, `training` |
| `supporting` | worth a line where it is used, not a lesson of its own | `serviceStandards`, `servicescape` |
| ordinary | never enters the learning system | `expecting`, `wanting`, `faster` |

Ordinary language lives in `vocabulary.ordinary`. The lexical audit stays, as a
**warning** about words that look instructional and are unclassified, for a human
to triage. It never decides that something needs a lesson.

The target is **0 unsupported instructional dependencies**, not 0 unexplained
words. Applying the classification took the "named and explained nowhere" count
from **19 to 6**, and the six that remain are arguable teaching dependencies
rather than tokens.

## What the port proved

The People pathway was ported using concepts authored once. It is the test that
the lesson architecture is not Processes-shaped:

```
zero     Body 1: nothing declared
zero     Body 2: people ← the pathway lesson, training ← the pathway lesson
zero     Body 3: processes ← the pathway lesson
strong   Body 2: nothing declared, and nothing given
```

`training` is reached from the People pathway and is not written for it.
`servicescape` is declared `optional` by a Processes pathway and never appears on
it. A student who pressed *Start writing* is given none of it.

## Readiness controls what is offered, never what a student is told

The report complains to the author. A student on an unreviewed pathway is never
shown "learning support incomplete": they are shown a pathway with no lesson,
which is what the app looked like before any of this existed. Readiness gates
which **modes** a question can be published in, and nothing else.

## The maturity chain

| stage | question | measured by |
| --- | --- | --- |
| **declared** | do we know what this pathway depends on | the build |
| **authored** | is there material that teaches it | the build |
| **reachable** | can this pathway surface that material | the build |
| **delivered** | did the canonical novice journey actually get it | the bots |
| **applied** | did the learner then use it | the bots, the transfer probe |

`reachable` is not `delivered`. A pathway can declare `training`, have it
authored and be able to render it, and a student can still reach the writing line
without it.

## A primary dependency has to earn its place

Five or six primary concepts on one pathway is an authoring smell: either the
argument is too big or some of it belongs in `supporting`. The report flags a
count of five or more for a human to look at rather than refusing it, because the
judgement is editorial.

## The three questions the report now answers separately

- **authored coverage** — does the content exist
- **pathway reachability** — can this pathway deliver it
- **canonical novice coverage** — does a zero-knowledge learner actually get it

Today: **4 of 28 pathways declare what they depend on.** The other 24 cannot be
audited, and that is the finding rather than a pass.
