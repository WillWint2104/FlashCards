---
title:   Simulated students are knowledge states, not click scripts
date:    2026-08-21
status:  active
governs: the test harness, how new guided-mode work is accepted
---

## Why this exists

Progressive construction was designed from intuition and reviewed from
screenshots. Both are worth having and neither can answer the question the
architecture actually rests on: **does a student who knows nothing get carried,
and does a student who knows everything get left alone?**

## The rule

A simulated student is a **knowledge state** plus a **policy**. It may never name
a button that another profile does not also have available. Where two journeys
differ, the difference has to come from what the students know and what they are
willing to do about not knowing it.

The ledger only grows from a surface the app actually showed them. So what a
simulated student ends up able to write is an audit of what the product taught,
not a script the test wrote in advance.

## Explained, not merely printed

A concept counts as teachable only where some **explaining** field mentions it: a
pathway's `meaning`, an area guide, a help rung, a concept resource. A label that
prints the word does not teach it. Two failures that look identical from the
outside are therefore kept apart:

- **wrote without a concept it needed** — the app explains it somewhere and did
  not surface it here. An app problem.
- **concepts the app never explains** — there is no explanation anywhere. A
  content gap, and the honest thing to report rather than to blame the app for.

## The acceptance condition

The three journeys must be **distinguishable**. The run prints a signature per
student per question, and fails if they collapse. A harness that cannot tell a
zero-knowledge learner from a strong one will happily generate thousands of
beautifully formatted runs that mean nothing.

## What it must never do

It must never assert a content gap away. Where the app has nothing authored, the
run reports the number and carries on. Making the bots pass by lowering what they
ask for would destroy the only thing they are for.
