# Simulated students

Three students walk the real app. They are not click scripts: each is a
**knowledge state** plus a **policy**, and the journeys diverge because the
students differ, not because the harness tells them to press different buttons.

```
node tests/bots/run.js          # or: node tests/run.js bots
```

Writes every trajectory to `tests/out/bot-journeys.txt`.

## The model

A student holds a **ledger** of concepts it can legitimately use in prose. The
concepts a paragraph needs are taken from the chosen pathway's own `short` field,
so nothing is invented for the test.

- **zero knowledge** starts with an empty ledger. It can only fill it from a
  surface the app actually showed it: the meanings under each argument, the Learn
  drawer, a rung of the help ladder. What it ends up able to write is therefore an
  audit of what the product taught it.
- **strong independent** starts with a full ledger, so it never needs to open
  anything. What it measures is how much the app makes it stop anyway.
- **plausible wrong turn** knows half the content, takes a confident position and
  then chooses arguments that pull against it. What it measures is whether the app
  can get a student out of that without blocking them and without overruling them.

## Explained, not merely printed

A concept counts as **teachable** only if some explaining field in the authored
content mentions it: a pathway's `meaning`, an area guide, a help rung, a concept
resource. A pathway label that prints `servicescape` while nothing in the app says
what a servicescape is does not count. The distinction keeps two very different
failures apart:

| reported as | means |
| --- | --- |
| wrote without a concept it needed | the app explains it somewhere but did not surface it here |
| concepts the app never explains | there is no explanation anywhere; a content gap |

## What the run asserts

Not click counts. It asserts that nobody was ever refused, that the zero-knowledge
student had to learn something and did, that the strong student was left alone,
that the wrong turn was noticed and never overruled, and that the three journeys
are **distinguishable** on both a causal and a judgement question. If the three
signatures ever collapse into one, the bots have stopped modelling different
students and nothing they report can be trusted.

It also reports, rather than asserts away, how much of the app is authored: how
many paragraphs offered a help ladder, and which concepts are named but never
explained.
