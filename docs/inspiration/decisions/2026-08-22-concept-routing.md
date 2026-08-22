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

## The three questions the report now answers separately

- **authored coverage** — does the content exist
- **pathway reachability** — can this pathway deliver it
- **canonical novice coverage** — does a zero-knowledge learner actually get it

Today: **4 of 28 pathways declare what they depend on.** The other 24 cannot be
audited, and that is the finding rather than a pass.
