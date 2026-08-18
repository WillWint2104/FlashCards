# Marking rebuild — reviewer guide

Task 1 of the guided-composition work. Marking is now **two passes**, the payload
carries what the question actually requires, and the feedback ends with one place
to go back and rewrite rather than a mark and a full stop.

Nothing here is deployed and no promotion switch is flipped. `CONFIG.essayMarking`
is `false` on main; the walkthrough runs on the preview build.

---

## The complaint this answers

> the existing AI marking feels too formulaic and sometimes seems to give feedback
> that could apply to almost any response

The audit found why. The marker received the question, a reference answer, a
metalanguage list, a scaffold, anticipated faults and the student's text, then had
to do everything in one pass: read, diagnose, weigh, mark and write. With a
reference answer in front of it and no separate step for reading, the cheapest
route to a valid-looking review was to compare the response against the reference
and describe the difference. That produces feedback that fits any response,
because it is really feedback about the reference.

---

## Pass 1 diagnoses. Pass 2 judges.

**Pass 1 (`submit_diagnosis`, `DIAG_MODEL`)** describes what is on the page.
Coverage of what the question asks, the argument each paragraph actually makes,
where the writing explains and where it only describes, evidence used versus
merely mentioned, terminology, repetition, what is never done, and whether the
student's plan was actually carried out.

It cannot mark. `submit_diagnosis` has no numeric field except the paragraph
locators, no band or grade enum, and no property whose name could hold a mark.
`assertScoreFree()` walks the schema at startup and proves it. If that check ever
fails, **pass 1 is disabled and marking continues single-pass**: the guarantee
holds without taking the app down, which matters because this worker is deployed
by pasting a file into a browser.

**Pass 2 (`submit_review`, `MODEL`)** makes the HSC judgement from the question,
the criteria, the band expectations, the verified diagnosis and the full response.
The contract it returns is unchanged apart from additions.

---

## The plan is context, not marks

The student's plan and our authored argument pathways go to **pass 1 only**. Pass
2, the pass that assigns marks, never receives them. This is structural, not a
prompt instruction:

| Layer | What it does |
| --- | --- |
| Construction | `pass2Message()` builds its message through `pickPass2()`, which copies only `PASS2_FIELDS`. The caller cannot hand it a plan. |
| Denylist | `plan`, `validContent`, `pathways`, `concepts`, `evidence` throw if they appear, so the mistake shows up in test rather than in production. |
| Rendering | `diagnosisText()` renders only fields in `DIAG_TO_PASS2`. `planVsResponse` is deliberately absent and rendering it throws. |
| Free text | Pass 1 is the one pass that reads the plan, so its own prose could carry plan wording forward. `planEcho()` builds the plan's distinctive phrases **minus anything the student actually wrote**, and any observation repeating one is dropped. |
| Presence | A planned item can only be reported as carried out with a verbatim quote that verifies. Without one, `present` is forced to `false`. |

**What this does not guarantee.** Pass 1 reads the plan before describing the
response, so it can still be primed to see an argument more generously than the
writing supports. Verification proves the words exist, not that they do the job.
Three things narrow that: an observation must quote the paragraph it names,
evidence counts as *used* only when the fact and the claim are different runs of
words, and pass 2 re-reads the whole response itself. It is a real reduction, not
an elimination, and it is stated plainly here rather than claimed away.

---

## Every observation is checked against the student's own words

`quoteSpan()` decides whether a claimed quote is really in the response.

- Both sides are normalised the same way. Case, curly and straight quotes, every
  dash, hyphens, brackets and trailing punctuation are invisible to the
  comparison. Apostrophes are dropped inside words, so `McDonald's` and
  `McDonalds` are the same word.
- A quote must be **3 to 60 words** and contain at least one word that is not a
  function word. Fewer than three proves nothing, more than sixty is not a
  pointer, and `"in the response"` is not evidence.
- Under six words it must match **contiguously**. From six words up it may skip at
  most a quarter of its own length, inside a window no wider than the quote plus
  that slack. So a light elision passes and a sentence stitched out of scattered
  words does not.
- Paragraph markers (`[1]`, `[2]`) are stripped, so a quote copied with its marker
  is not rejected for carrying it.
- An observation is checked against **the paragraph it names**, not the whole
  response, so a quote lifted from elsewhere cannot make the marker point at the
  wrong place.

What happens on failure:

| Where | On failure |
| --- | --- |
| Any diagnosis row | Dropped, and counted in `checks.diagnosis.dropped`. Dropping removes a claim about the student and never adds one. |
| `planVsResponse` | `present` forced to `false`, quote blanked. Never dropped: a silently missing row would read as nothing to report. |
| `focus.quote` | Blanked, and focus falls back to the worst open issue, so there is always somewhere to go back and write. |
| A quoted run inside feedback prose | The quotation marks are removed. The point stands, it just stops claiming to be the student's words. |
| More than 40% of quotes across at least 6 | The whole diagnosis is discarded and pass 2 marks unaided. Half-trusted evidence is worse than none. |

**The paragraph shown back to the student is their own text.** The review rebuilds
each paragraph by concatenating `sentences[].text`, so whatever the marker returns
there *is* what the student reads as their own writing. `snapSentences()` locates
each sentence and replaces it with the exact characters they typed. A sentence
that locates nowhere is flagged `unplaced` and counted. A paraphrase can no longer
be handed back to a student as their own line.

---

## Credit for arguments we did not anticipate

Pass 1 records the argument each paragraph makes and whether it matches a supplied
pathway. `offPathwayCount()` counts the valid ones that do not, **only when a
pathway list was actually supplied**, and the worker injects a standing rule into
pass 2 when the count is non-zero: our list is a menu that removes the blank page,
not the set of correct answers, and never take a mark off for an argument that is
not on it. The marker is never told a canonical answer set exists.

Those arguments come back as `credited[]` and the review shows them, so a student
who thought for themselves can see that it counted.

---

## Marks that add up

`finalize()` rebuilds the arithmetic rather than trusting it.

- `marks` is validated at the door. A non-numeric value is a 400, not a review
  full of `NaN`.
- Paragraph maxima are whole numbers and are **reconciled to what the question is
  worth**. Four paragraphs marked out of 6 for a 20-mark question used to let
  22/24 be clamped and shown as 20/20, a perfect score for an imperfect answer.
  The marker's proportion is the judgement, so it is preserved; only the scale is
  corrected, by largest remainder.
- No paragraph renders as `x / 0`.
- The rubric is the same response seen a second way, so it is rebuilt against the
  criterion names that were asked for, its maxima sum to the question and its
  marks sum to the total. Exactly one band per criterion carries the you-are-here
  marker.
- A review cut off part way through is refused with a 502. A truncated review sums
  fewer paragraphs and would show the student a mark several below what was
  actually awarded, which is silent, plausible and wrong. The app already falls
  back to a labelled demo grade on a failed request.

---

## No em-dashes, enforced

`deDash()` used to turn `cost-benefit` into `cost, benefit`. It now works by rule:
figure dashes and minus signs become hyphens; a dash between two digits is a range
(`1-2`, `2019-20`); a dash tight between two word characters is a hyphen
(`e-marketing`); everything else is punctuation and is replaced in one pass that
reads what precedes it, so a doubled comma is never created. `sweepDashes()`
applies it to every string in the response **except quotes and the student's own
sentences**, which are handed back exactly as they were written.

---

## Feedback returns the student to writing

Pass 2 returns a `focus`: one improvement area, one paragraph, one or two
sentences on what that paragraph does and does not yet do, and a short verbatim
quote. It is emitted **before** `paragraphs` in the schema, so the field the
student acts on is generated first and survives any truncation that still parses.

- The review opens on that paragraph and shows a **start here** strip above
  everything else.
- In essay mode the action is **Revise this paragraph**: the review closes, the
  coached writing screen opens on that paragraph, and the marker's line is
  selected in the textarea. The next action is typing.
- On a study card there is no writing surface, so the same button opens that
  paragraph's issue walkthrough instead.
- The marker numbers the paragraphs it was **sent**, and an empty structure slot
  is never sent, so `esSlotForMarked()` maps its numbering back through the filled
  slots. Without that, "revise your second paragraph" lands on the wrong one.

An older worker does not return `focus`. `rvEnsureFocus()` derives one in the app
from the worst open issue, so the cycle works before the re-paste as well as after.

---

## What the app sends

Everything except `answer`, `prompt` and `marks` is optional, and an older client
still marks with less to go on.

```
prompt, command, marks, answer            the question and the exact response
subject, criteria                         who is marking, and against what (subject namespace)
bands, bandsSource                        band expectations (question -> subject -> general)
topic, requirements                       what this question requires
  requirements.concepts                     what has to be addressed
  requirements.relationships                what has to be demonstrated
  requirements.accomplish                   what a strong response achieves
  requirements.syllabus                     scope
model_answer, vocab, scaffold, faults     the authored marking scheme, where one exists
rubric                                    a marking guide the student pasted
plan                                      the student's own plan          -> PASS 1 ONLY
validContent                              our pathways, concepts, evidence -> PASS 1 ONLY
```

`markingRequirements()` prefers an authored `requirements` block and otherwise
**derives** from what the card already carries, its metalanguage and its scaffold,
rather than inventing requirements nobody wrote.

---

## Content added

`window.ESSAY.bandExpectations` — six general HSC band expectations, subject
agnostic, written originally for this app from general knowledge of what separates
a strong extended response from a weak one. Nothing is reproduced or reworded from
NESA marking guidelines or performance descriptions, and it carries no subject
facts. Resolution order is question `criteria.bands`, then the subject's, then
these.

The generic question-definition schema is documented and shown on two questions
that already existed, `ah-religion` and `mkt-01`. Requirements are claim-side by
construction: they say what a response must **do**, never what the subject facts
are, so they stay content-free. The rest of the question bank is unchanged and
falls through to the general expectations.

---

## Walkthrough checklist

Open the preview build with `?essaydemo=1`, which turns on essay marking for one
person without switching it on for anyone else.

1. **Setup.** There is a new **Marks this question is worth** field, default 20.
   Pick one of the practice questions from the chips, then press Start practising.
2. **Write.** Write the introduction. Press Next, skip a paragraph, write another
   one. This is the case that used to send the student back to the wrong place.
3. **Full attempt.** Switch to a full attempt and press **Submit**. It should say
   it is marking, then come back with a mark and one **start here** area with a
   short quote from something you actually wrote.
4. **Revise.** Press **Revise <paragraph>**. It should open the coached screen on
   the paragraph you wrote, with the marker's line selected, and a toast saying to
   rewrite it and ask again.
5. **See the full marking.** Reopen the result and press **See the full marking**.
   The review should open on the same paragraph, with the start-here strip above
   the paragraph rail.
6. **Check the numbers.** The paragraph marks should sum to the total, and the
   Rubric tab should show the same total again, out of the marks you set in setup.
7. **Study cards still work.** Open a long-answer card in the Economics topic and
   submit an answer. It should still grade and the review should still open.

Worth checking with a deliberately weak response: the feedback should name what
*you* wrote, not what a good answer contains.

---

## Your step: re-paste the worker

Cloudflare, Workers, `marginal-grader`, Edit code, paste the current
`proxy/worker.js`, Deploy. No new secrets.

Marking now makes **two** upstream calls per submission instead of one, so a grade
costs more and takes longer. Pass 1 runs on the fast model and is capped short;
pass 2 is unchanged. If marking feels too slow to walk, `DIAG_MODEL` at the top of
the worker can be set to `MODEL`, or pass 1 can be turned off entirely by making
`DIAG_SAFE` false, and marking falls back to single pass.

The client change is safe to merge before the paste: the old worker ignores the
new fields, and the app derives its own `focus`, so the cycle works either way. It
just will not be two-pass until the paste lands.

---

## Flagged for you, not decided by me

- **Band framing for Year 11.** Ancient History is tagged `stage: "Year 11"`.
  The general ladder is labelled with HSC bands, which is an HSC claim. If that
  should not read as HSC bands for a Preliminary course, the fix is content only:
  give `ancient_history` its own `bandExpectations` with ranges such as Top,
  Middle and Developing.
- **Pitch.** Whether Band 3 in the ladder is really where a Band 3 response sits
  is a teacher judgement. Worth running two or three real responses of known
  quality through and checking where the you-are-here marker lands.
- **The `source` string** `"general HSC band expectations"` is student-facing
  provenance. Approve the wording.
- **Default marks.** A question without a `marks` value defaults to 20. The two
  questions given `marks: 20` above are my reading of a standard extended
  response, not something I verified against a paper.
