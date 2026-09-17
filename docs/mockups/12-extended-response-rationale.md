# State 12 — Extended response, draft 2: reading key

Companion to `12-extended-response.html`. Nothing here appears on the student's
screen. Draft 1 was rejected as a freeze candidate; this is the corrective pass.

## The page is generated, not written

```
12-extended-response.fixture.json   the answer, the criteria, one model review
        ↓  fed to the SHIPPED finalize() in proxy/worker.js
12-extended-response.build.mjs      renders BOTH presentation states from it
        ↓
12-extended-response.html             marked
12-extended-response-answering.html   answering
```

One question has two presentation states and one fixture. **Answering:** the
response is the editable field and there is no mark. **Marked:** the response is
a compact line the student can open, read-only, and the mark is above it. Both
come out of the same run, so the two screens cannot drift apart in the way a
pair of hand-drawn ones would.

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

The page uses the **shared tokens** in `docs/testmode-tokens.md`, which are now
the approved Test Mode accessibility baseline rather than State-12-specific
colours. Measured in both rendered pages, with the disclosure forced open so its
prose is included: **zero WCAG AA failures across 65 text nodes in the marked
state and 25 in the answering state**, against 18 failures in draft 1 and 17 to
28 in every other mockup. Seven token values move; `--green` is unchanged and
remains the brand accent on surfaces that carry no text.

The disclosure's label is CSS generated content, so a text-node sweep cannot see
it and it is measured by hand: `--green-dk` #0E7A4E on the panel's #FCFDFD is
**5.27:1** at 12.5px bold, and the summary's own line is **5.73:1**. Both clear
AA for normal text.

Also structural, and new: **twelve real headings** where draft 1 had none (`h1`
prompt, `h2` per section, `h3` per criterion, `h4` per observation); the criteria
and the observations are ordered lists; and **there are zero editable fields** —
the submitted response is read-only prose, not a live textarea with nowhere to
save.

## The one UX change since draft 2: the response collapses once marked

Draft 2 rendered the whole 176-word response above the mark, and measured that
this put **14 of 20 below the fold at every size except a tall desktop and a
tablet held upright** - and that measurement was itself too kind, for the reason
set out two sections down. Of the three fixes offered, option 2 was
taken: the response collapses behind a disclosure once the paper is marked. The
locked order is unchanged - the response still comes first - it is compressed,
not moved.

It is a native `<details>`, so it is keyboard-reachable, needs no script, and
cannot fall out of sync with a state variable. The summary carries the word count
and reads **View response** / **Hide response**. Closed, Chromium skips its
contents entirely: `checkVisibility()` is false and the prose is not in
`document.body.innerText`.

**What it must never become is a field again.** A submitted response reopened as
a textarea has nowhere for an edit to go, which is worse than either state on its
own. Opened, the page still contains zero `textarea`, zero `input` and zero
`contenteditable`.

## Does it still fit inline? Measured again, collapsed

**And measured against the right fold this time.** Draft 2's table compared each
element's bottom with `window.innerHeight`. This shell has a sticky header and a
sticky footer painted over the page, so the last usable row of content is where
the footer starts, not where the viewport ends. Checked the old way, the mark
cleared the fold at every size; checked against the footer, it does not.

```
            card   doc    header  footer   mark 14 of 20       judgement
                          ends    starts
1512x982    780   2489      75      919    clear               clear
1280x900    780   2489      75      837    clear               clear
1280x800    780   2489      75      737    clear               clear
1280x700    780   2489      75      637    clear               clear
1024x768    780   2536      75      705    clear               clear
 834x1112   767   2541      75     1049    clear               clear
 430x932    396   3523      75      813    clear               begins, 40px
 390x844    358   3691      75      725    BEHIND THE FOOTER   off-screen
```

No horizontal overflow at any width. No page errors.

**What the collapse bought.** The mark is clear of both bars at seven of eight
sizes, against two of eight in draft 2, and the document is about 470px shorter
at desktop. On a desktop the mark and the whole judgement are on the first screen
with the criteria section beginning under them.

**What it did not buy, and this is a new finding.** At 390x844 the footer starts
at y=725 and the mark spans 718 to 786: **the mark is behind the sticky footer**,
and the judgement never appears on the first screen at all. The cause is not the
response, which is now 50px. It is the footer, which at 390px wraps its three
controls and the item counter onto four lines and takes **119px of an 844px
screen**. The same page at 430x932 clears the mark with room to spare.

That is a finding against the **frozen sitting shell (state 08)**, not against
this state, so it is reported rather than fixed here. It needs a decision, and
the obvious candidates are shortening the footer's middle label at narrow widths
or letting it collapse to two rows.

**This is still not an argument for state 16**, which is now retired by decision:
a dedicated review screen would face the same content in the same order behind
the same footer.

## The regression that holds it

`tests/t33.mjs` reads both generated pages as text: the marked state wraps the
response in `<details class="submitted">` with no `open`, the answering state does
not, and the collapsed prose is byte-exact to the fixture. What text cannot see is
whether that markup *renders* as a collapsed response, or whether the mark it
exists to lift actually clears the fold.

`tests/ui69.js` opens both pages in a browser at 1280x800 and 390x844 and
measures: closed on arrival, 50px tall rather than a response with a lid on it,
prose absent from the rendered text, the click and the keyboard both opening and
closing it, the card growing by the response, and zero editable fields once open.
**30 assertions.** Proven non-vacuous by injecting the faults: adding `open` to
the disclosure fails 22 of them; making the response `contenteditable` fails the
field check; making the summary unclickable fails the suite outright.

Its fold assertions are split, because the two sizes are not in the same state.
On desktop it asserts the mark and the judgement are clear of both sticky bars.
On mobile it asserts the finding above **as a finding** - the mark is not clear
of the footer at 390px - so that fixing the shell turns the suite red and makes
someone come back to this line rather than leaving a stale claim in it. The guard
that still holds at mobile is that the mark stays near the top of the page: a
regression putting the response back above it moves the mark from y=718 to past
1100.

It is in the **full** tier only. It launches a browser to look at two static
mockups, which is not what a 40-second gate is for, and the source-level half is
already in fast.

## Not decided here

- **The sitting shell's footer at 390px**, per the measurement above. It takes
  119px of an 844px screen and puts the mark behind itself. State 08 is frozen,
  so this is reported and not touched.
- **Business report** (state 13), which shares this plumbing.
- **Whether the contract should carry response-specific criterion commentary.**
- **The shared accessibility pass** across the frozen states. The tokens in
  `docs/testmode-tokens.md` are now the Test Mode baseline; Calculation and Short
  Answer are re-checked against them after this state freezes, and are not
  redesigned unless the change exposes a real hierarchy problem.
