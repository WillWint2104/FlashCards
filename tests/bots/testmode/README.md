# Test Mode student bots

Fixed student answers, written once and kept, driven through the real Test Mode
UI by `tests/ui76.js`. The same words go in every run, so when something that
comes back changes, Marginal changed, not the student.

## The corpus

`corpus.v1.json` holds 31 original answers on the synthetic Business Studies
paper (`tests/fixtures/bus-practice-paper.json`): multiple choice, calculation,
short answer (one question marked from authored phrasings, one by the marker),
extended response and business report. Written answers cover blank, irrelevant,
partial, unusual wording, strong, misconception, verbose, unfinished, and a
business report written as a report and as an essay with the same content.

Each answer carries:

- `expect`: what is asserted offline. Exact marks only where the paper's own key
  decides (multiple choice, calculation, locally matched points).
- `stub`: the marker's reply used offline, fed to the real worker code in place
  of the model. A stand-in, not a claim about marking quality.
- `live`: what live mode asserts against the real marker: a range, never one
  exact number. `liveOrder` on an item says which answers must not score below
  which.
- `observe`: a known characteristic the run reports rather than fails, such as
  local matching under-crediting unusual wording.

**Versioning.** Never edit an answer's text in place: a benchmark is only useful
if the same words go in every time. To change answers, add `corpus.v2.json` and
point the suite at it, so results across versions are never compared as if
they were the same run.

## Running it

```
node tests/ui76.js                       # offline: the Full tier runs this
MARGINAL_LIVE=1 node tests/ui76.js       # live: the real marker, ranges and orderings
MARGINAL_LIVE=1 MARGINAL_SITE=https://willwint2104.github.io/FlashCards/ node tests/ui76.js
                                         # live, against the deployed site
MARGINAL_BOTS_ONLY=sa11b-strong,er15-middle node tests/ui76.js
```

Offline, the app's marking requests are answered by the shipped worker
(`proxy/worker.js`) running in the test process, with only the call to the model
stubbed. Grounding, reconciliation, refusal and what the worker tells the model
about the response's format all run for real.

Live mode needs network access to the worker (and, with `MARGINAL_SITE`, to the
site and its CDN). The worker allows 20 marking requests per address in ten
minutes; the suite paces itself, so a full live run takes a while and spends
real marking credits.

The report is written to `tests/out/bots/testmode-report.md`, one row per
answer, with a screenshot beside it for every failed check.

## What every run asserts

- a blank answer is never sent and never scores;
- an unreachable marker leaves the answer not marked, never a zero or a demo
  grade, and *Try marking again* marks it once the marker is back;
- every quotation shown as *In your response* is in the version that was graded,
  and a sentence the student never wrote is never shown as theirs;
- the mark shown is the mark stored, for exactly the words submitted;
- typing, editing mid-sentence, navigating away and reloading lose nothing, and
  the caret stays where the student put it;
- question-type practice never touches the paper attempt;
- a finished session's result is not rewritten while a new one is in progress;
- a business report reaches the marker as a report, with its instructions, and
  an extended response as an extended response;
- Results agree with the closed attempt, and Review changes nothing.
