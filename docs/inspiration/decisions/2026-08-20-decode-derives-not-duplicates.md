---
title:   Decode derives coverage from requirements and authors only interpretation
date:    2026-08-20
status:  active
governs: question decoding, essay-content question schema, build validation
---

## The decision

`requirements` stays the single source of truth for what a response must cover
and accomplish. `decode` carries only the student-facing interpretation that
cannot safely be derived.

| Derived from `requirements` | Authored in `decode` |
| --- | --- |
| the required areas | which words in the stem are pressable (`highlights[].anchor`) |
| the causal relationship | what each of those words means for this question |
| what a successful response accomplishes | `verbMeaning` |
| the syllabus note | `plainEnglish` |
| | `coreRelationship` |

The first column is marking metadata. The second is pedagogy. Keeping them apart
means a change to what the question demands moves the teaching with it, and there
is never a second copy to drift.

## Highlights are anchors, not offsets

```
{ anchor: "processes", kind: "requiredArea", note: "…" }
```

Anchor strings survive a reworded stem where character offsets would not, and
they avoid inferring which words matter, which would eventually pick the wrong
ones on some other question.

The cost is that a reworded stem can orphan an anchor or make it ambiguous, so
**the build checks it**: every authored anchor must occur exactly once in the
question's own text. `build.js` refuses to produce output otherwise. Verified
against both failure modes: an anchor that occurs zero times, and one that occurs
twelve.

## Decode is support, not a gate

It opens from the question itself on every screen, including while writing, and
it is never a stage the student has to pass. Panels are rendered once and revealed
by flipping `hidden`, so opening it mid-sentence does not rebuild the composer or
take the cursor. Pressing the same thing again closes it.

A question with no authored `decode` shows no highlights and no chips, rather
than inferring some.
