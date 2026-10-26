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
(the latest is `corpus.v3.json`, so `corpus.v4.json`) and point the suite at it,
so results across versions are never compared as if they were the same run.

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
- the sha256 of every text. `tests/t41.mjs` pins them as literals, together with
  digests of corpus v2's items, of the expectations below and of the Run 2
  baseline file, so a text cannot be edited together with its own hash, nor an
  expectation together with the baseline;
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
unmarked. A probe passes only if the late reply really arrived as a mark; a
request the app aborted at its own limit tested nothing.

`er-analyze.js` turns a run into marks, comparisons, what the student was shown
and timings, and compares it with `er15-baseline.run2.json`, Run 2's own analysis
without request bodies, replies or account details. What the student was shown is
judged by the rules the app applies since PR #74:
- empty quotes, and quotes the student never wrote;
- glossary markup, closed or not;
- band language in any form, but not the subjects' own "age band" or "target
  band";
- a mark for part of the response;
- criteria other than the subject's own.

On Run 2's raw record these give exactly the baseline's counts. A result counts as
a mark only if the app marked it, and a reply counts as a usable mark only if the
app would accept it: one rule (`usableMark`), shared with `er-latency.js`. For the
latency target, a timing answer with no usable mark counts as never arriving.

```
npm run er-benchmark          # offline: shipped worker, stubbed model, no credits
npm run er-benchmark:live     # the real grader; spends about 18 marking requests
npm run er-benchmark:timing   # the real grader, the three timing answers only
MARGINAL_SITE=https://willwint2104.github.io/FlashCards/ MARGINAL_LIVE=1 node tests/bots/testmode/er-benchmark.js
node tests/bots/testmode/er-analyze.js tests/out/bots/er15/<run>/run.json
```

`er-latency.js` measures the marker alone. It sends the three timing answers
straight to a worker, one request at a time. The bodies are the ones this
checkout's app sent in an offline `--timing` run. For every request it records:

- the status;
- the total time and the time per pass;
- the model;
- the input and output tokens.

Per length, it reports:
- the usable marks;
- the worst and next-worst time;
- judgement time and tokens;
- whether the length is within the practical gate (every request usable, the
  worst under 40 s);
- the 95th percentile against the target.

A request that never gave a usable mark counts as never arriving. The variants
are:
- `lean1`: the lean Test Mode contract, one pass;
- `lean2`: the same with the diagnosis first;
- `full`: the full review;
- `asis`: the body exactly as the app sent it.

A lean sample counts only if the worker says it marked under the lean contract
with that many passes. If a variant's first request cannot reach the worker, is
refused by it before marking (a 4xx: a bad body, the class code, the method or
its rate limit), or is not marked under that contract, the run stops: nothing
has been measured. A timeout or an upstream failure (5xx) is the marker failing,
so it is measured as a failed sample.

```
MARGINAL_WORKER=https://<worker> MARGINAL_VARIANTS=lean1 MARGINAL_REPEAT=5 npm run er-latency
MARGINAL_WORKER=https://<worker> MARGINAL_VARIANTS=lean1,lean2,full MARGINAL_REPEAT=5 node tests/bots/testmode/er-latency.js
```

It is a quality command, run on purpose, never part of the Fast or Checkpoint
gates. On a deployed site it signs in through a stand-in Supabase client (a
sample student); marking sees exactly what a signed-in student sends.
`MARGINAL_CLIENT_MS` raises the app's 45 second marking limit in the test browser
only, and only when the served `app.js` is byte-identical to the checkout's. A run
that asked for it and could not apply it stops. Run 2
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
