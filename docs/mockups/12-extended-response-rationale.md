# State 12 — Extended response: reading key

Companion to `12-extended-response.html`. Nothing here appears on the student's
screen.

Shown: desktop, **Practice**, **Question 15** of the synthetic Business Studies
paper — the paper's only 20-mark extended response, directive *evaluate*, marked
**14 of 20**. The response, the marker's words and the criterion feedback are
original material written for this mockup; the four criterion names are not.

## What is on screen, and what each thing is allowed to claim

| on screen | where it comes from | what it may claim |
| --- | --- | --- |
| **14 of 20** | `score`, the runtime's real question-level result | the mark |
| *Marked against Business Studies criteria* + the paragraph under it | `overall.summary` | a judgement about the whole response |
| the four criterion **names** | the subject package, sent to the marker and required back verbatim in order | the strongest grounding in the payload |
| the narrative under each name | `rubric[].descriptor` and the sentence-level issues, rewritten as prose | what that criterion rewards and where this response sat |
| *In your response* + a quotation | a sentence the worker located **verbatim** | that these are the student's exact words |
| *Across your response* | an issue with no verified anchor | a claim about the response, with no sentence attached |
| *n observations* | how many remarks the marker made under that criterion | a count of remarks, and deliberately nothing else |

## What is not on screen, and why

Every exclusion traces to the audit, not to taste:

| kept out | because |
| --- | --- |
| band labels and descriptors | the ones a student would read are **written by the model at request time** against Marginal's generic set, whose `bandsSource` is literally *"general HSC band expectations"*. No subject package authors bands. Not Business Studies, and not a scale |
| criterion marks | `shareOut` and `fitScores` force them to sum to a total that was **already decided at paragraph level**. A criterion mark is an apportionment of someone else's arithmetic |
| `met` / `partial` / `missing` | derived from those same apportioned scores. A restatement of a share, wearing the clothes of an independent judgement |
| the `ladder` | three model-written replacement sentences, *Clear / Better / Band 6*, mandatory on every issue in the schema so it always arrives. This is Essay Practice's revision material and writing the answer is not what Test Mode is for |
| `checks.grounded` | the renderer's gate. A student does not need a confidence meter on their own marking |
| `missing_vocabulary` | unconditionally `[]` (UX-TEST-05) |
| `next_steps` as sentence-specific advice | it arrives **stripped of its sentence**, so it can only be a response-level claim |

Verified in the rendered page: the strings *band*, *Band*, *ladder*, *Clear*,
*Better*, *met*, *partial*, *missing*, *grounded* and `%` appear **zero** times.

## The one thing this screen does that the others cannot

**It quotes the student back to themselves, and only where that can be proved.**

The worker locates each sentence of its review verbatim in the answer and
replaces it with the student's own text, or marks it `unplaced`. That distinction
becomes the difference between two pieces of wording:

```
In your response          the sentence was found; these are their exact words
Across your response      it was not; the claim is about the response
```

Both quotations on this screen were checked against the submitted text at render
time and are verbatim. That check is the honesty guarantee of the whole state: a
quotation mark here is a promise, and the promise is machine-checkable.

Two criteria are anchored and two are not, deliberately, because that is the
realistic mixture and the screen has to read well in both cases. An unanchored
criterion does not get an empty evidence box; it gets a label and no surface.

## Containment

```
question card       white
└ marking SECTION   a rule, a heading, and the criteria source at its right
  ├ criterion       a rule, a name, a count, narrative
  └ evidence        #F4F9F8, r9px  ← the only inset surface
```

One inset surface, and it is the student's own words — the only material in the
section that is not the marker talking. Measured from an evidence quote outward:
`ev r9px` → `crit r0px` → `mark r0px` → `qcard r18px`. **No criterion cards.**

The criterion name is set as a heading with nothing appended that the payload
cannot support: no tick, no band, no share of the marks. *n observations* is a
count of remarks and is not a verdict, which is why it is set in the muted chip
style rather than beside a colour.

## Two shell consequences this state exposed

1. **A question that owns no source has no second column.** Question 15 authors
   no stimulus — "a business you have studied" is the student's own. So `.work`
   becomes a single column and the card keeps a **780px** reading measure rather
   than running to 1100. That keeps the response as readable as it is beside a
   source panel, and it means the length of this review was judged at roughly the
   width it will really have. A sourced extended response — 11(d), 12(c) — keeps
   the 62/38 shell unchanged.
2. **At the last item of the paper, Next has nowhere to go.** Question 15 is item
   20 of 20, so the footer reads **Finish paper →**. One label, using the button
   that is already there. What that action opens is state 19.

## Does it fit in place? Yes — with one finding

Measured at 1280x900:

```
document height        2054px = 2.28 screens
first screen carries   the question, the response, 14 of 20, and the whole
                       overall judgement — nothing important is below the fold
second screen carries  all four criteria and both pieces of evidence
```

**That is not an endless document.** A 20-mark essay review in two and a bit
screens, where the mark and the reason for it are both visible before any
scrolling, is a good outcome. On this evidence **state 16 does not need to
exist** for extended response: a dedicated review surface would add a navigation
concept in order to save one scroll, and would reintroduce the overlay that
calculation and short answer both removed.

**The finding.** `Try again` sits at y=840 in the initial view, which is
**underneath the sticky footer**. It is reachable after one scroll, and the
footer safe-space only protects the end of the document, not content that lands
mid-page. Two honest options, and it is a product call rather than a layout one:

- move `Try again` **after** the marking section for extended responses, on the
  grounds that it is the action you take once you have read why — the locked
  hierarchy puts it before, which works at short-answer length and strands it
  above 1100px of content here;
- or scroll the marking section into view when marking completes, which the
  build already does elsewhere (`sheet.scrollIntoView`), so the initial position
  is never 0.

I have left the hierarchy exactly as locked and am reporting the measurement
rather than choosing.

## Still read-only

No rewrite box, no Paragraph Review, no sentence shapes, no More Help, no Save
revision, no generated replacement prose. `Try again` reopens the response for
another attempt; the review itself is a review.

The obvious next interaction — selecting a criterion and having its quoted
sentence highlight inside the response above — is **not** built here. It is the
right idea and it is free of the coaching problem, but it is an interaction
proposal and this is a static proof of the hierarchy.

## Not decided here

- **Business report** (state 13), which shares this plumbing and adds a
  structural expectation nothing currently authors.
- **Whether `Try again` moves**, per the finding above.
- **State 16**, which this screen argues against for extended response but which
  business report has not yet been asked about.
