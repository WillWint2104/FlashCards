# State 12 — Extended response: what the marker actually returns

Written before any design, to answer one question: **what does the
extended-response marker return today, and at what level can each judgement
genuinely be grounded?** Everything below was read out of the running build or
the worker source, not inferred.

## The route

| | |
| --- | --- |
| router | `app.js` — `writtenModeOf(format) === "extended"` goes to `gradeWritten` |
| formats | `extended_response` **and** `business_report` share it; the report says separately that it is one |
| before anything is sent | the subject authority is resolved, and an unresolved subject **refuses rather than marks** |
| without an endpoint | a demo grade, labelled as one |
| the synthetic paper | 5 extended answerables: 11(d) 5m, 12(c) 6m, 13 12m, 14 20m (report), 15-or-16 20m |

## The criteria are real, and they are the paper's

`business_studies` resolves from the subject package with four authored
criteria, in this order:

```
1  knowledge and understanding of course content
2  application of business case studies and contemporary business issues
3  business terminology and concepts
4  sustained, logical and cohesive response
```

These are sent to the marker, which is instructed to return **one rubric row per
criterion, in this order, using these exact names**. So the criterion names on
screen are the subject's, not the model's. That is the strongest grounding
anything in the response has.

**A criterion's mark is not.** `reconcileRubric` takes whatever the model
proposed, then `shareOut` forces the row maxima to sum to the question's marks
and `fitScores` forces the row scores to sum to the total. A per-criterion mark
is therefore **a share of a total, reconciled after the fact** — not an
independently justified number. Any design that invites a student to interrogate
"why 3 of 5 on terminology" is inviting them to interrogate an apportionment.

## What comes back

| field | what it is |
| --- | --- |
| `score` / `total` | the mark, capped to the question's marks by the app |
| `summary` → `overall.summary` | prose about the whole response |
| `rubric[]` | `{name, score, max, descriptor, bands[{range, text, here}]}` — exactly one band carries `here` |
| `criteria[]` | derived from `rubric`: `{name, status: met/partial/missing, comment: descriptor}` |
| `paragraphs[]` | `{sentences[{text, issues[{head, why, severity}]}], reasons[]}` |
| `next_steps[]` | the top **three** non-optional issue heads, by severity, pulled out of `paragraphs` |
| `focus` | one place to go back to: `{quote, why, targetBlockId}` |
| `credited[]` | valid arguments the student made that were not on a known pathway |
| `checks` | the grounding numbers, below |
| `missing_vocabulary` | **always `[]`** |

**`missing_vocabulary` is dead.** The worker sets it to `[]` unconditionally, and
`app.js` renders chips for it in two places. Nothing has ever been in it on this
path. Recorded as **UX-TEST-05**; not fixed here.

## The grounding, which the worker already measures

This is the part that should decide the design. The worker does not just return
judgements — it reports how much of what it said it could find in the student's
own words.

| judgement | grounded at | how it is verified |
| --- | --- | --- |
| a sentence-level issue | **the sentence** | `snapSentences` locates each sentence verbatim in the answer and **replaces it with the student's exact text**; one it cannot find is marked `unplaced` |
| a quote inside prose | **the quoted run** | `groundProse` verifies each quoted span; one that does not verify has its quotation marks **stripped**, so the review cannot appear to quote something the student never wrote |
| the focus | one sentence or block | `checks.focusQuoted`, `checks.focusBlock` |
| a credited argument | paragraph + quote | second pass, `checks.diagnosis` |
| a criterion descriptor | the whole response | not verifiable — prose about the response as a whole |
| a criterion mark | the whole response | an apportionment of the total, as above |
| the total | the whole response | a model judgement, bounded by the paper's marks |

```
checks = { passes, sentences, sentencesVerified, sentencesUnplaced,
           grounded,           // verified / total, 0..1
           focusQuoted, focusBlock, prose: {quoted, unquoted}, diagnosis }
```

`app.js` already warns to the console when `grounded < 0.6` and shows the student
nothing. **A number the application computes about the trustworthiness of its own
marking, and hides, is the single most interesting thing in this audit.**

## What that means for the design

Three consequences, stated before drawing so they can be argued with:

1. **The judgements are not all equal, and the screen should not flatten them.**
   A sentence-level issue is anchored in the student's own words and can be
   pointed at. A criterion descriptor is prose about the whole response. A
   criterion mark is a share of a total. Presenting all three as rows of the same
   table would claim a precision only the first has.

2. **Extended response cannot borrow short answer's central device.** Short
   answer says *these specific key points were or were not addressed*, because a
   point is a discrete, authored, checkable thing. There is no equivalent unit
   here: the four criteria are qualities of a whole response, and the paper's
   `points[]` on an extended question are guidance for the marker, not a
   checklist the student earns.

3. **Sentence-level issues are exactly where Essay Practice lives, and Test Mode
   must not go there.** The data supports pointing at a sentence. It does not
   follow that Test Mode should open a rewriting workspace around it. The
   question the design has to answer is how much of the sentence-level evidence
   to surface as *evidence for the mark* without becoming a coaching loop.

## Open before drawing

- **Bands.** `markingContext` sends `bands` and `bandsSource`, and the worker
  returns band descriptors per criterion with exactly one marked `here`. The
  Business Studies package carries no `bands` key of its own, so where the band
  expectations come from on this paper still needs tracing.
- **Whether `checks.grounded` belongs on screen**, and in whose words.
- **Business report** (state 13) shares this plumbing and adds a structural
  expectation that nothing currently authors.
