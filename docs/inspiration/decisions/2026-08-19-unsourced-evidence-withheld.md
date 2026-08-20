---
title:   Unsourced evidence is withheld, not warned about
date:    2026-08-19
status:  active
governs: the evidence bank, the plan chips, the setup picker, the Evidence drawer
---

## The decision

Evidence with no recorded source is a candidate. It stays in the bank and is
never offered to a student.

## Why

A student has to be able to trust that anything in the picker is safe to put in
an answer they will be marked on. A warning still puts an unchecked claim in
front of someone about to be marked on it.

## What was rejected

Showing the item with "source unavailable" beside it.

## Where it is enforced

`esEvidenceUsable` in `app.js`, on every route into the picker. `build.js`
refuses to produce a build containing preview provenance. `tests/ui18.js` covers
both states.

## Consequence, accepted

All 58 bank items are unsourced, so the Evidence layer is dark until sources
arrive. `tests/out/marginal-walkthrough-evidence-preview.html` exists so the
layer can still be walked, banner-marked and impossible to ship.
