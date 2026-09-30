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
state.attempts[paperId] = { current: Attempt | null, last: Attempt | null }

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
