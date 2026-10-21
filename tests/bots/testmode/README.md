# Test Mode student bots

Fixed student answers, written once and kept, driven through the real Test Mode
UI by `tests/ui76.js`. The same words go in every run, so when something that
comes back changes, Marginal changed, not the student.

## The corpus

`corpus.v2.json` is the corpus the suite runs: 32 original answers on the
synthetic Business Studies paper (`tests/fixtures/bus-practice-paper.json`):
multiple choice, calculation, short answer, extended response and business
report. Written answers cover blank, irrelevant, partial, unusual wording,
strong, misconception, verbose, unfinished, and a business report written as a
report and as an essay with the same content.

One short answer is marked here from authored phrasings, the rest by the marker.
The phrase-matched one is a derived, genuinely closed question that declares
`"marking": { "mode": "phrase_match" }` (decision 27): "Identify the operations
performance objective ... and the period when demand at the vans peaks." Its
answers include the matcher's known limits on purpose, recorded as observations:
a correct answer in other words earns nothing, a list of every candidate earns
full marks, and a negation earns full marks. Phrasings alone no longer score
anything, so the open "outline" 11(a) that version 1 grafted phrasings onto is
gone from the run.

`corpus.v3.json` is version 2 word for word plus the Extended Response benchmark
from Run 2 (below). `ui76` still runs version 2; `er-benchmark.js` runs the
benchmark in version 3.

`corpus.v1.json` is frozen as it was for Run 1 and is not run. `t31` still reads
two of its answers to check that the published 11(a) sends them to the marker.
`golden.v2.json` is the live diagnostic set; it swaps v1's keyword list for the
closed question's shotgun list.

Each answer carries:

- `expect`: what is asserted offline. Exact marks only where the paper's own key
  decides (multiple choice, calculation, the phrase-matched closed question).
- `stub`: the marker's reply used offline, fed to the real worker code in place
  of the model. A stand-in, not a claim about marking quality.
- `live`: what live mode asserts against the real marker: a range, never one
  exact number. `liveOrder` on an item says which answers must not score below
  which.
- `observe`: a known characteristic the run reports rather than fails, such as
  phrase matching earning full marks for a list of every candidate.

**Versioning.** Never edit an answer's text in place: a benchmark is only useful
if the same words go in every time. To change answers, add the next version
(`corpus.v3.json`) and point the suite at it, so results across versions are
never compared as if they were the same run.

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

## The Extended Response benchmark (Run 2)

`benchmarks.er15` in `corpus.v3.json` is what bots Run 2 measured on Question 15
(evaluate, 20 marks) on 21 October 2026, frozen so that a later marker can be
compared with this one on the same words:

- twelve answers, one per profile: very weak, mostly descriptive, middle,
  strong, no case study, strong knowledge with the case only name-dropped, case
  study retold without an argument, verbose, a two-sentence stub, a misconception,
  the strong answer in plainly different wording, and the strong answer stopped
  before its weighing and judgement. Five are version 2's; seven were written for
  Run 2. Three judges classified the first eleven blind and placed every one in
  its intended profile; three more checked the revised and added texts.
- three timing answers of about 400, 800 and 1,200 words, which assert nothing
  about marks;
- the sha256 of every text, and `tests/t41.mjs` holds them;
- the expectations set down before any live marking: each answer's panel median
  and range, eight hard comparisons (strong never below weak, analysis above
  description, application above name-dropping, complete above its unfinished
  equivalent, the reworded answer within two marks of the original) and the
  panel's softer ones;
- the latency target: 95% of usable marks for realistic responses in under
  40 seconds.

`er-benchmark.js` drives each answer through the whole journey (typed with an
edit, left, resumed, reloaded, submitted, Results, closed Review), then four
probes: a later edit never takes an earlier mark, and a late reply never touches
a later session, another question, or a session closed with the answer left
unmarked. `er-analyze.js` turns a run into marks, comparisons, what the student
was shown (empty quotes, quotes the student never wrote, glossary markup, band
language, mini-marks, criteria other than the subject's own) and timings, and compares it with
`er15-baseline.run2.json`, Run 2's own analysis without request bodies, replies
or account details.

```
npm run er-benchmark          # offline: shipped worker, stubbed model, no credits
npm run er-benchmark:live     # the real grader; spends about 18 marking requests
npm run er-benchmark:timing   # the real grader, the three timing answers only
MARGINAL_SITE=https://willwint2104.github.io/FlashCards/ MARGINAL_LIVE=1 node tests/bots/testmode/er-benchmark.js
node tests/bots/testmode/er-analyze.js tests/out/bots/er15/<run>/run.json
```

It is a quality command, run on purpose, never part of the Fast or Checkpoint
gates. On a deployed site it signs in through a stand-in Supabase client (a
sample student); marking sees exactly what a signed-in student sends.
`MARGINAL_CLIENT_MS` raises the app's 45 second marking limit in the test browser
only, and only when the served `app.js` is byte-identical to the checkout's. Run 2
needed it to see what the production grader marks at all. It is a measuring
aid, not a fix.

What Run 2 found, in short: on production no extended response can be marked,
because the grader took 63 to 122 seconds against the app's 45 and a 400-word
answer failed upstream; with the limit lifted, the marker separates analytical
from non-analytical answers (all eight comparisons pass) but compresses and
misorders the top, and every marked result showed the student glossary markup,
and most an empty quotation or band language.

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
