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

---

# Part 2 — the band trace, and every field classified

## The band trace, end to end

```
markingContext (app.js)
  bands      = question.criteria.bands
            || subjectPackage.bandExpectations.bands
            || ESSAY.bandExpectations.bands
  bandsSource= the matching .source of whichever won
        │
        ▼  sent in the marking request
worker pass2Message
  "BAND EXPECTATIONS (<bandsSource>):  <range>: <text>  ..."   ← prompt guidance only
        │
        ▼  model returns rubric[].bands, up to 3 per criterion
reconcileRubric
  bands = model's own, sliced to 3, exactly one `here`
        │
        ▼  what the student would see
```

**On this Business Studies paper, every fallback above fires.** Measured in the
running build:

| link | value |
| --- | --- |
| any question authoring `criteria.bands` | **no** — no question in the fixture has a `criteria` key |
| `business_studies.bandExpectations` | **absent** |
| `economics`, `ancient_history` | **absent** — no registered subject authors bands |
| what is used | `ESSAY.bandExpectations` |
| `bandsSource` | **`"general HSC band expectations"`** |
| how many | 6, Band 6 down to Band 1 |
| what they say | *"…holds one judgement from the first paragraph to the last… Subject terms carry the reasoning instead of decorating it…"* |

### The five questions, answered

1. **Where do the descriptors originate?** Two different places, and they are not
   the same descriptors. The six that go **in** are Marginal's own general set.
   The ones that come **back** — the ones a student would read — are **written by
   the model at request time**, per criterion, up to three, one marked `here`.
   The generic six are never echoed back.
2. **Are they authored Business Studies criteria?** **No.** They are
   subject-agnostic and say so: they talk about "subject terms" and "a line of
   argument", never about business. Nothing anywhere authors band descriptors for
   Business Studies.
3. **What is `bandsSource` on this paper?** The literal string
   `"general HSC band expectations"`.
4. **Do they determine the mark?** No. The chain is the other way around, and it
   is worth stating exactly:

   ```
   model returns a score and max PER PARAGRAPH
     → reconcileParagraphs: maxes shared out to sum to the question's marks,
       scores rescaled by ratio, and r.total = THE SUM OF THE PARAGRAPH SCORES
     → reconcileRubric: criterion maxes shared out to the same marks,
       criterion scores fitted to hit that same total
   ```

   So the mark **originates at the paragraph level**. The criterion scores are a
   *second, independent apportionment of a total that was already decided
   elsewhere* — doubly derived. Bands are explanatory output generated alongside,
   not an input to any arithmetic.
5. **Can the student-facing use be called Business Studies-specific?** **No.**

**Conclusion: no band labels or descriptors in state 12.** A "Band 5" chip beside
a Business Studies criterion would be model prose against a generic scale,
wearing the authority of a syllabus. That is the criterion-score problem again,
one level up.

## Every returned field, classified

**A — overall judgement** (valid at whole-response level)

| field | note |
| --- | --- |
| `score` / `total` | real, and the one number to show. Sum of the model's paragraph scores, capped to the question's marks |
| `overall.summary` (`summary`) | prose about the whole response. Embedded quotes already verified or de-quoted by `groundProse` |

**B — criterion judgement** (valid for one authored Business Studies criterion)

| field | note |
| --- | --- |
| `rubric[].name` | **the strongest grounding in the payload.** The subject package's own four criteria, sent to the marker and required back verbatim, in order |
| `rubric[].descriptor` | one line on what the criterion rewards. Model prose at criterion level — legitimate as narrative, not as measurement |
| `criteria[].status` | `met` / `partial` / `missing`, derived **from the apportioned score**. Inherits the apportionment; it is a restatement of a share, not a judgement |

**C — sentence-grounded evidence** (valid only when verified against exact text)

| field | verified by | note |
| --- | --- | --- |
| `paragraphs[].sentences[].text` | `snapSentences` | replaced with the student's **exact** words on a hit; `sn.unplaced = true` on a miss |
| `sentences[].issues[].head` / `.why` | `groundProse` | quotes inside verify or lose their quotation marks |
| `focus.quote` / `.why` | `checks.focusQuoted` | the single place to go back to |
| `credited[].quote` | second pass, `checks.diagnosis` | an argument the student made that the materials did not anticipate |

**D — apportionment, not measurement** (present, and must not be shown as marks)

| field | why |
| --- | --- |
| `rubric[].score` / `.max` | `shareOut` + `fitScores` force them to sum; doubly derived |
| `paragraphs[].score` / `.max` | `reconcileParagraphs` reshapes them whenever they do not sum |
| `rubric[].bands[]` | model-written, generic scale, one marked `here` |

**E — internal, diagnostic, or dead** (keep out of the student UI entirely)

| field | why |
| --- | --- |
| `checks.*` | the renderer's gate, never a number on screen |
| `diagnosis` | pass-1 reader output; already folded into everything above |
| `issues[].ladder` | **three model-written replacement sentences — "Clear, Better, Band 6".** Mandatory in the schema, so it always arrives. This is Essay Practice's revision material and is exactly the generated replacement prose Test Mode must not show. **The renderer drops it.** |
| `paragraphs[].reasons[]`, `.note` | per-paragraph coaching commentary against the bands |
| `missing_vocabulary` | **UX-TEST-05** — unconditionally `[]` from the worker, rendered as chips in two places in `app.js`. Dead UI |
| `next_steps[]` | derived from `issues[].head`; usable, but it arrives **stripped of its sentence**, so it must be treated as class A unless re-paired with a verified sentence |

## The grounding gate, as a rule the renderer follows

No percentage on screen. The distinction the worker already computed becomes a
presentation decision:

| what the worker proved | what the screen may say |
| --- | --- |
| the sentence located verbatim | **In your response** — "…the student's exact words…" |
| `sn.unplaced === true` | **Across your response** — the judgement without a sentence attached |
| a quote inside prose that verified | render it quoted |
| a quote that did not verify | it has already lost its quotation marks; render it as the marker's own words |
| `focusQuoted` false | no focus anchor at all |

Low grounding therefore **reduces the specificity of the claim** rather than
producing a confidence meter. The student never learns there is a number; they
learn that the feedback is either pointed at their sentence or it is not.

## What this leaves for the design

```
overall mark  →  overall judgement  →  the four criteria, narratively  →  grounded evidence  →  retry
```

and specifically **not** Short Answer's `mark → marking points`, because no
discrete authored unit exists at this level.

Open: whether a 20-mark response's four criteria plus their evidence still fit
in place, or whether that is finally the case for state 16.
