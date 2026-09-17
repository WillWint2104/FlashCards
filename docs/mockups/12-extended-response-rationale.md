# State 12 — Extended response, draft 2: reading key

Companion to `12-extended-response.html`. Nothing here appears on the student's
screen. Draft 1 was rejected as a freeze candidate; this is the corrective pass.

## The page is generated, not written

```
12-extended-response.fixture.json   the answer, the criteria, one model review
        ↓  fed to the SHIPPED finalize() in proxy/worker.js
12-extended-response.build.mjs      renders the page from what comes back
        ↓
12-extended-response.html
```

Draft 1 was hand-authored and its marker copy asserted *"Figures appear once"*
about a response containing **no digit**. That class of drift is now impossible:
the marker's words, the student's response and the evidence on screen all come
out of one run of the real pipeline. Re-run `node
docs/mockups/12-extended-response.build.mjs` and it reports what it produced:

```
mark 14 of 20    3 anchored observations    2 across    everyQuoteVerbatim true
grounded 0.6     criteria exactly as authored, in order
```

**14 of 20 was not chosen.** It is `reconcileParagraphs` summing the paragraph
scores 4+3+4+3. **Which observations are quotable was not chosen either.** Three
sentences located verbatim and two did not, and that is the only thing deciding
which list each lands in.

## The correction: two independent layers

Draft 1's blocker was that it organised evidence under criteria. Nothing in the
payload associates an issue, a sentence or a paragraph with an authored
criterion — a rubric item is `{name, score, max, descriptor, bands}`, an issue is
`{kind, severity, head, why, ladder}` under a sentence, and no field anywhere
links them. Filing a true quotation under a criterion made it a **false academic
attribution**, and the per-criterion count was a count of paragraphs the author
had written.

So the page now has two layers that do not touch:

| layer | what it may claim | what it may not |
| --- | --- | --- |
| **How this was marked** | the four authored criterion names, in order, and the line the marker returned for each | evidence, counts, verdicts, marks, bands |
| **What the marker noticed** | observations at response level, each with the student's own sentence where one was located | any criterion attribution |

Verified in the rendered page: `.crit .ev`, `.crit .obs`, `.crit q` and
`.crithead .obs` all count **zero**.

## A finding the fixture exposed, and it changes what layer one can say

`rubric[].descriptor` is documented in the worker's own schema as **"One line on
what the criterion rewards."** That is a statement about the *criterion*, not
about this response. Checked against every other field: the only response-specific
per-criterion signals in the payload are `score`, `max` and `bands[].here` — and
all three are excluded, correctly, as apportionment.

**So there is no response-specific per-criterion commentary in the payload at
all.** Layer one therefore says what each criterion rewards and stops. That is
course information rather than feedback, it is honest, and it tells a student
what they were judged against — but it is less than "qualitative criterion
feedback" implies, and the difference is the contract's, not the design's.

If per-criterion commentary about the response is wanted, the prompt has to ask
for it and the schema has to carry it. That is a contract change, not a layout
decision, and it is not made here.

## Everything the audit disqualified, still absent

No bands, criterion marks, `met`/`partial`/`missing`, `checks.grounded` as a
number, the ladder, `missing_vocabulary`, or an unverified quote as the student's
words. `next_steps` is not rendered at all: it arrives stripped of its sentence,
so it cannot be a sentence-level claim, and everything in it is already in the
observations with its sentence attached.

## What changed underneath, so the page can claim what it claims

Five runtime faults, all fixed and all proven by executing the shipped functions
(`tests/t32.mjs`, 44 assertions; eight mutations, all killed):

| | was | now |
| --- | --- | --- |
| ordering | `overall.summary` and `next_steps` were copies taken **before** `groundProse`, and are the only copies the app reads | grounding runs first; the legacy fields derive from the grounded object |
| coverage | `groundProse` never touched `rubric[].descriptor`, the band text or `focus.area` | all three covered, before `criteria[].comment` copies the descriptor |
| length | quoted runs over 240 characters were not matched, so they kept their marks uncounted | bound raised; `verifyQuote` decides; fail closed |
| focus | `checks.focusQuoted` was a non-empty test, and the fallback used unverified text | both verify, and never fall back to a sentence that failed to locate |
| scope | `snapSentences` located against the whole response, so a "sentence" could weld two paragraphs and count as grounded | located inside its own paragraph; a run containing a blank line is refused |

And the product rule: **a marked paper in Test Mode could reach the Essay
Practice workspace in one click** — the Clear / Better / Band 6 rungs as pickable
sentences, a rewrite box, criterion score pills, band descriptors. Both routes are
closed, `examOpenReview` and `examRevise` are gone, and the marker's words now
come back into the sheet instead.

## Accessibility

The page uses the **proposed shared tokens** in `docs/testmode-tokens.md`, not
State-12-specific colours. Measured in the rendered page: **zero WCAG AA
failures**, against 18 in draft 1 and 17 to 28 in every other mockup. Seven token
values move; `--green` is unchanged and remains the brand accent on surfaces that
carry no text.

Also structural, and new: **twelve real headings** where draft 1 had none (`h1`
prompt, `h2` per section, `h3` per criterion, `h4` per observation); the criteria
and the observations are ordered lists; and **there are zero editable fields** —
the submitted response is read-only prose, not a live textarea with nowhere to
save.

## Does it still fit inline? Measured

```
            card   doc    screens   mark visible   judgement visible
1512x982    780   2955     3.01        yes             no
1280x900    780   2955     3.28        no              no
1280x800    780   2955     3.69        no              no
1280x700    780   2955     4.22        no              no
1024x768    780   3002     3.91        no              no
 834x1112   767   3007     2.70        yes             no
 430x932    396   4334     4.65        no              no
 390x844    358   4607     5.46        no              no
```

No horizontal overflow at any width. No page errors.

**The honest finding: the mark is below the fold at every size except a tall
desktop and a tablet held upright.** That is not length for its own sake — it is
the locked hierarchy meeting a real 20-mark response. Draft 1 put the mark on the
first screen only because its textarea hid half the answer; rendering the whole
submitted response, which is the more honest thing, costs about 340px and the
mark goes under.

**This is not an argument for state 16.** A dedicated review screen would face
the same content and the same order. Three ways to fix it, none of which needs a
new state, and the choice is a product one:

1. **Put the mark above the response.** The cheapest, and it inverts the locked
   order. A student who has just submitted wants the mark before they re-read
   what they wrote.
2. **Collapse the response behind a disclosure**, open by default on short
   answers and closed on long ones. Keeps the order, costs a click.
3. **Scroll the result into view when marking completes**, which the build
   already does elsewhere (`sheet.scrollIntoView`).

I have left the hierarchy exactly as locked and am reporting the measurement.

**Inline review is otherwise coherent at every size.** Nothing wraps badly, the
two layers stay distinct, the evidence surfaces keep their measure, and the
footer behaves. The problem is one of order, not of containment, and a separate
screen would not solve it.

## Not decided here

- **Whether the mark moves above the response**, per the finding above.
- **Business report** (state 13), which shares this plumbing.
- **Whether the contract should carry response-specific criterion commentary.**
- **The shared accessibility pass** across the other eight mockups.
