# Test Mode's lean extended response

Bots Run 2 (21 October 2026) sat Question 15 of the synthetic Business Studies
paper through the live site and the production marker. On production, no
extended response could be marked:

- The app gives a marking request **45 seconds**.
- Every extended response the marker did mark took **63 to 122 seconds**.
  Judgement alone took 52 to 105 seconds.
- A **400-word answer failed upstream** (`upstream 524`) after 145 seconds.
- Real Section IV answers run to 800 to 1,200 words.

Raising the client's limit would not fix this. The marker is writing far more
than Test Mode shows. This note records:

- exactly what state 12 reads from a reply;
- what the full review generates on top of that;
- the contract Test Mode now asks for instead;
- the recommendation on one pass or two.

## What state 12 reads

This was traced from the request to the closed Review: `tmSubmit` →
`gradeWritten` → `markerBody` → `invalidMarkerReply` → `examOnlyMarks` →
`ATT.record`, then `tmResultHTML` in the sitting and in the closed Review
(`tmReviewQ` → `tmRvResult`). Results and Review & submit read only the stored
result's `outcome`, `score`, `max`, `why`, `retry` and `code`.

| Reply field | Use | Shown |
|---|---|---|
| HTTP status, `ok` | a non-OK reply becomes not marked by status, and its body is not read | the reason |
| `error` | must be absent | no |
| `score` | a whole number from 0 to `max`; the mark everywhere | yes |
| `max` | must equal the question's marks; the stored max is the question's own | yes (as marks) |
| `summary` (or `overall.summary`) | the note under "Marked against … criteria" | yes |
| `rubric[].name`, `rubric[].descriptor` | "How this was marked" (since the State 12 fix, the names and order are the paper's own; a descriptor only beside its exact name) | yes |
| `paragraphs[].sentences[].text`, `.unplaced` | the quote under "In your response", or the move to "Across your response" | yes |
| `paragraphs[].sentences[].issues[].head`, `.why` | each observation | yes |
| `checks.sentences`, `checks.grounded` | one console warning before storage | no |

The result is stored as `{outcome, score, max, kind: "llm", fb}`, where `fb` is
the whole reply.

Never read after storage:

- `focus` and `credited`;
- `paragraphs[].name`, `.score`, `.max` and `.reasons`;
- `sentences[].link` and `.missing_label`;
- `issues[].kind`, `.severity` and `.ladder`;
- `rubric[].score`, `.max` and `.bands`;
- the legacy `criteria`, `next_steps` and `missing_vocabulary`;
- `diagnosis`, `total`, and every other `checks` field.

## What the full review generates on top

These estimates come from the schema; the worker never logged `usage`. For a
typical 200-word extended response, the judgement pass writes roughly 4,000 to
5,000 tokens:

| Field | Share | Shown in Test Mode |
|---|---|---|
| three model sentences per fault (`issues[].ladder`, "Clear, Better, Band 6") | 35 to 45% | no |
| each fault's head and why | 20 to 28% | yes |
| criterion descriptors and twelve band texts (`rubric[].bands`) | 14 to 17% | descriptors only |
| every sentence of the response copied back (`sentences[].text`) | about 9%, growing with length | only quoted ones |
| paragraph reasons, focus, summary | about 10% | summary only |

The judging instructions also ask for band language ("lifts the band", "Band 6")
and glossary markup, which state 12 must not show.

Before the judgement there is a diagnosis pass on the fast model. It is capped at
20 seconds and, when it stops there, the review goes ahead without it, silently.
That happened in 8 of 17 replies in Run 2.

## The lean contract

### Request

A Test Mode extended response adds one field:

```
contract: "testmode-extended-1"
```

It is sent only for `format: "extended_response"` in Test Mode (`gradeWritten`
with `noDemo`). These all keep the full review, unchanged:

- Study and Essay practice;
- a business report;
- a short answer;
- any older client;
- any request without the field.

A worker that does not know the contract ignores it and marks as before.
`passes: 2` runs the diagnosis first. It exists only to measure the difference,
and the app never sends it.

### What the model is asked for

The model gets one pass, on the same model as the full review's judgement, with
`max_tokens` set to 1,500. It returns `submit_test_mark`:

```
mark          integer, 0 to the marks available, for the whole response
judgement     one or two sentences on the response as a whole
criteria      one entry per marking criterion, in order, exact names:
              { name, rewards }   one short line on what it rewards
observations  at most 6, most important first:
              { head, why, quote }
              head   at most eight words
              why    one or two sentences
              quote  the student's own words copied exactly, or "" when the
                     observation is about the whole response or something missing
```

The judging instructions are the full review's own:

- mark honestly;
- credit a different valid path;
- never infer understanding the words do not show;
- point every comment at this student's words.

Only the output changes. The instructions also say that none of these may be
written anywhere:

- a band;
- a criterion or paragraph mark;
- copyable prose;
- markup;
- an em dash.

The band expectations are still sent, labelled as the basis for the mark and
never something to write about.

### What the worker returns

The worker returns the shape state 12 already reads, and nothing else:

```
contract, score, total, max            the model's mark, checked
summary, overall.summary               the judgement, cleaned
rubric[{ name, descriptor }]           the request's four criteria, in its order;
                                       a descriptor where the model gave one
paragraphs[{ name, score, max, reasons: [],
  sentences[{ text, unplaced, issues[{ kind, severity, head, why }] }] }]
criteria: [], next_steps: [], missing_vocabulary: []
checks { contract, passes, sentences, sentencesVerified, sentencesUnplaced,
         wholeResponse, grounded, diagnosis, diagnosisState, ms{diagnosis, judgement},
         model, usage{input, output, cacheRead} }
```

None of these fields are generated any more:

- improvement ladders;
- replacement or model prose;
- band descriptors or band commentary;
- criterion or paragraph marks of the model's own;
- the sentence-by-sentence echo;
- paragraph reasons;
- the focus;
- credited arguments;
- the diagnosis payload;
- anything belonging to Essay practice.

### What is checked in code

These checks run in the worker (`tmFinalize`), whatever the model returned.

- **The mark.** A mark is a whole number from 0 to the marks available. Anything
  else, a cut-off reply or an upstream failure comes back `502`, retryable, with
  no mark in it. The app then shows "Not marked yet", never a zero.
- **Quotes.** A quote is the student's only if it is found in the response:
  - it is located with the same tolerance as the full review (`quoteSpan`) and
    replaced with their exact characters;
  - a quote that runs across two paragraphs is not one run of their words;
  - any other observation goes to "Across your response".
- **Criteria.** They are the request's four, in its order, whatever names came
  back.
- **Prose.** All prose is cleaned: a glossary term becomes its own words, a
  sentence naming a band is left out, and dashes are swept. The app does the
  same independently (`tmMarkerText`), so neither side trusts the other.

`tests/t42.mjs` holds the contract and `tests/ui70.js` holds that the app asks
for it. Eight mutations in `tools/mutations.js` cover both.

## One pass or two

**Recommendation: one pass, with the grounding above.** The reasons:

1. **The diagnosis did not visibly improve the marks.** In Run 2 the diagnosis
   ran for 9 of the 17 marked replies and was cut off for 8. Against the
   independent evaluator's fair marks:
   - with it, the mean absolute difference was 1.7 marks over 6 profiles;
   - without it, it was 1.2 over 5.
   The two biggest errors (+5 on the middle answer, +3 on the unfinished strong
   one) both came with the diagnosis. The sample is small, but it gives no reason
   to pay 10 to 20 seconds and a second model call for it.
2. **Its job is now done in code.** The diagnosis exists so the judgement works
   from verified quotes. The lean contract asks for few, short quotes and
   verifies every one after the fact, which is cheaper and cannot be skipped.
3. **It removes the silent state.** A two-pass request whose diagnosis times out
   is marked differently from one whose diagnosis finishes, and nothing tells the
   student. One pass has no such state. If two passes are ever kept, a skipped
   diagnosis should fail the mark or be an explicit, logged worker state, never a
   quiet fallback.

`passes: 2` stays available for the measurement, so one and two passes can be
compared on the same deployment, the frozen corpus and the same answers. On that
path the reply states `checks.diagnosisState`: `used`, or `skipped` when the
diagnosis failed or ran past its 20 seconds. One pass says `not run`.

## Not changed here

- **Marking calibration.** Run 2 found the top of the scale compressed, middle
  answers over-credited and evidence-backed strong answers under-credited. The
  lean prompt keeps the full review's judging instructions word for word where
  they apply, so that a change in marks after this contract can be measured
  against the frozen benchmark rather than confused with a calibration change.
- **Business Report (state 13).** It keeps the full review until the extended
  response has been measured.
- **Asynchronous marking.** Submit, job id and poll are not built. The plan is to
  measure the lean pass first, and move to them only if it cannot meet the target.

## Measuring it

The target is that **95% of usable marks for realistic responses arrive within
40 seconds**. It is measured on the benchmark's three timing answers, of about
400, 800 and 1,200 words, in `tests/bots/testmode/corpus.v3.json`.

The run is serial, and records for every request:

- status;
- total time;
- time per pass;
- model;
- input and output tokens.

It covers one pass and two. The worker must be deployed to run it, and the
current production worker does not have this contract. If the lean pass cannot
meet the target reliably, the next step is submit, job id and poll with durable
server-side state. A longer browser timeout is not that step.
