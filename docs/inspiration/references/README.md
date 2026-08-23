# References

Notes taken **from** sources. Never the sources themselves.

The point is to capture the substance a source carries so it can be turned into
original teaching content: what a concept means, how it relates to others, which
terminology matters, where students go wrong, what a worked example looks like
structurally.

These notes are large on purpose. A student never sees one. They sit between the
textbook and the app:

```
textbook  ->  deep reference note  ->  pathway content selection  ->  student surface
```

The downstream layers compress. If a note is trimmed to what one pathway needs,
the next question that needs a different relationship sends someone back to the
textbook, which is the cost this layer exists to remove. 150 to 200 lines is
fine, provided the sections are predictable and reusable.

## The provenance rule

Every claim in a note is one of three things, and which one it is must be
unmistakable. The app must never end up saying "the textbook states" about
reasoning we supplied.

| marker | meaning |
| --- | --- |
| **SOURCE** | the textbook establishes this |
| **DERIVED** | connective reasoning we are supplying, because the source gives the premises and never joins them |
| **USE** | how the relationship could be taught, or what kind of HSC response it supports |

Derived is not a weaker class of claim. It is usually the most valuable material
in the note, because the recurring defect across this textbook is that it defines
concepts accurately and does not connect them. But it has to be labelled, because
its warrant is our reasoning rather than the source's authority.

Where a claim is load-bearing, write it out in all three parts rather than
flattening them into a paragraph:

```
SOURCE  Factoring is selling accounts receivable to a finance company at a discount.
        The source also states that factoring is not a loan.
DERIVED Because it is a sale of an asset rather than a borrowing, it raises liquidity
        without raising gearing, so a business too geared to borrow can still use it.
USE     A causal pathway for fin-01: strategy -> mechanism -> objective, with the
        solvency link as the step that lifts an answer above description.
```

## Required shape

```
---
title:   Processes in the marketing mix
date:    2026-08-19
status:  active
governs: business_studies concepts.processes
source:  Business Studies textbook, marketing chapter (held by Will, not committed)
---

## Concepts (SOURCE)
    what each term means, as the source establishes it

## Explanation (SOURCE)
    the substance of the section, in original wording

## Load-bearing derived claims (DERIVED)
    the two to five connective claims this note exists to add, each written as
    SOURCE / DERIVED / USE

## Relationships and mechanisms (DERIVED unless marked)
    what affects what, and why; the relationship tables

## Trade-offs and conditions (DERIVED unless marked)
    when the effect weakens, reverses, or costs more than it returns

## Terminology (SOURCE)

## Distinctions and confusions
    marked SOURCE where the source states the distinction, DERIVED where we do

## Instructional implications (USE)
    paragraph shape, what earns the marks, candidate pathways

## Adjacent concepts

## Source gaps
    what the source does not give us, and therefore what in this note was
    inferred rather than read
```

Attribute where the substance came from in the `source:` line so the origin is
traceable, then write the note in original wording. If a phrase is genuinely
technical and cannot be reworded, quote it and mark it as a quotation, so nobody
later mistakes it for our prose.

## What these notes are not

They are not the evidence layer. A reference note explains what a student needs
to **understand**. Evidence answers what a student can safely **assert**, and it
lives in `business-content.js` with its own sourcing rules in
`EVIDENCE-SOURCES.md`. Nothing from a textbook case study becomes evidence.
