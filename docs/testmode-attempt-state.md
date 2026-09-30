# Test Mode attempt state: the vocabulary every workflow page shares

Locked before Page 1, because the library, the overview, submit and results all
read it. It is the smallest model the runtime needs for Practice-only desktop v1
(decision 17). No status exists here without a runtime requirement.

## Three statuses

| status | true when | library shows |
| --- | --- | --- |
| **Not started** | the paper has no attempt | Start paper |
| **In progress** | the paper has an attempt that has not been submitted | answered, flagged, marks so far, Resume paper |
| **Completed** | the paper's latest attempt was submitted | mark, date, View results, Try again |

A status is **derived**, never stored: from whether a current attempt exists and
whether the latest attempt carries `completedAt`. So a stored status cannot
disagree with the attempt it describes.

## Counts beside the status, not statuses

Each count is computed from the attempt with functions that already exist.
Nothing new decides what counts.

| fact | computed by | note |
| --- | --- | --- |
| **total** | `PAPER.answerables(paper, choice)` over the selected sections | an either/or counts once; parts count, their parent does not |
| **answered** | `ASSESS.tally(...).done` | Practice: a question is answered once it is **marked**, as the frozen shell and navigator already define it |
| **not marked** | `tally.refused + tally.failed` | submitted, not scored, still costing its marks; shown only when above zero, as the paper bar already does |
| **flagged** | flags on answerables in the selected sections | independent of answered |
| **marks** | `tally.got / tally.max` | Practice only. Exam conditions would drop this slot (decision 3) |
| **selected sections** | the attempt's own list | shown only when it is not the whole paper |
| **where** | the attempt's current item | "Picks up at Question 11(c)": authored numbering, never position |

A written answer that was typed and never submitted is a saved **draft**. It is
not "answered" and not a status. It matters at submission (Slice B), where it
can be listed, and nowhere before.

## The record

Stored beside `state.exams`, in the same local store and in the same backup file:

```
state.attempts["paper:" + paperId] = { current: Attempt | null, last: Attempt | null }

Attempt = {
  sections:    [si, ...],            what the student chose to sit
  answers:     { key: text | index },  saved as typed; key is examKey (si-qi[-pi])
  results:     { key: outcome },     the marked / refused / failed result, as now
  flags:       [key, ...],
  choice:      { si: qi },           the either/or, as now
  at:          key,                  where Resume goes
  startedAt, updatedAt, completedAt?
}
```

- **Submit** moves `current` to `last` and stamps `completedAt`.
- **Try again** starts a new `current` and keeps `last`, so View results still
  works while the new attempt is in progress.
- **Delete paper** removes the paper and both attempts, after a confirmation that
  says so when an attempt is in progress.

`results`, `answers` and `choice` are the three bags `EXAM` already holds.
`sections` is `EXAM.sit`. The new fields are `flags`, `at` and the timestamps.

## Two scopes, never one attempt (decision 19)

A practice session on one question type is its **own attempt**, not a view onto
a paper's. Short-answer practice that includes 11(a) from the synthetic paper
does not mark 11(a) answered in that paper's sitting, and a paper sitting does
not mark anything in a type session.

```
state.attempts["paper:" + paperId]       = { current, last }   a paper sitting
state.attempts["type:" + canonicalFormat] = { current, last }   a question-type session
```

A type session's `Attempt` has the same fields, and its `sections` is replaced
by `items`: the questions it covers, each named by paper and key
(`{ paper: paperId, key: "1-0-0" }`). Its answers, results and flags are keyed
the same way, so two papers' 11(a) never collide.

They share question content, the marking engine, the feedback surfaces, the
navigator, the three statuses, the counts and the persistence code. They share
no attempt state.

A tile's count is **available questions**: every question of that canonical
format in every sittable paper in the library. Parts count, parents do not, and
both options of an either/or count, because each can be practised on its own.
The format is the contract's reading of the question, not the section it sits
in. The synthetic paper's 11(d), 12(c) and 13 are extended responses inside
Section II, so they count under Extended response.

## Not in v1

- Attempt history beyond the latest completed one.
- Cloud sync of attempts. Papers are not synced today either; both travel in the
  backup file.
- Anything Exam conditions needs (decision 17).

## The example attempts

`docs/mockups/attempts.fixture.json` holds one in-progress and one completed
attempt on the synthetic paper: only what a student typed, chose and flagged, and
the marker's reviews for answers only a marker can mark. `docs/mockups/attempt.mjs`
derives every status, count and mark through the shipped contract and
`finalize()`. Every workflow page reads it, so no page can show a number the
answers do not produce.
