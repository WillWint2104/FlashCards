# State 13 — Business report: reading key

Companion to `13-business-report.html` (marked) and
`13-business-report-answering.html` (answering). Nothing here appears on the
student's screen. Read `docs/state13-audit.md` first: it is why this state is
small.

## The two decisions this state is built on

1. **Minimal now, doctrine later.** The answering surface is the extended
   response's with the contradiction removed: no essay skeleton, the question's
   own instructions rendered, a placeholder that says sections. The report
   doctrine in `GUIDED-MODE-PLAN.md` - sections from the task's bullets,
   executive summary written last - is **state 13b**, recorded rather than
   silently overruled.
2. **The genre reaches the marker through a door it already reads.** Not a
   worker change: the report's own instructions and marking points travel as
   `requirements.accomplish`, which both marking passes print as "what a strong
   response accomplishes".

## The pages are generated, and the question is not copied

```
tests/fixtures/bus-practice-paper.json   q14 as authored: prompt, instructions,
                                         case study, chart, marking points
13-business-report.fixture.json          the sitting: a 193-word report and one review
        ↓  ASSESS.reportGuidance()  decides what the marker is sent
        ↓  finalize()               decides what comes back
13-business-report.build.mjs
        ↓
13-business-report.html                  marked
13-business-report-answering.html        answering
```

The generator reads q14 out of the paper, so the page cannot show an instruction,
a point or a case-study sentence the question does not author. It reports what it
produced:

```
mark 15 of 20    6 items sent to the marker    3 anchored    2 across
everyQuoteVerbatim true    193 words
```

## What changed on the runtime, measured on the wire

In the real app, sitting the real paper, with the marking request intercepted and
compared against a build of the previous commit:

| | before | after |
| --- | --- | --- |
| extended response request | 3243 bytes | **byte-identical** |
| report request | no `requirements` | `requirements.accomplish` = 6 authored items |
| report: authored items in pass 1 | 0 of 6 | **6 of 6** |
| report: authored items in pass 2 | 0 of 6 | **6 of 6** |
| report: answer shape | introduction / body paragraphs / conclusion | **none** |
| report: its own instructions on screen | nowhere | **under the heading, above the case study** |

Pass 1 and pass 2 are the shipped worker's own prompt builders, fed the captured
request. `tests/ui70.js` repeats that whole chain on every full run.

**The residual, stated plainly.** No worker change was made, so pass 2's
response-type line still says `RESPONSE TYPE: extended response`. The genre now
travels as guidance, not as a type. `tests/t35.mjs` asserts that line as a known
residual, so fixing it flips the suite and brings someone back here.

## The one thing this page adds to state 12's pattern

**"What your marker was told to look for."** The question's own instructions and
marking points, listed in order, with nothing ticked or crossed.

It is there because it is now *true*: those six items are sent to the marker with
the response. The list on the page is `ASSESS.reportGuidance(q14).items`, computed
by the generator with the same function the app uses, not copied. It carries no
verdict because the marker returns none per point, and the lede says so in words.

State 12 does not get this section, and that is principled rather than
inconsistent: an extended response's points are not sent to its marker, so "your
marker was told" would be false there. Routing them is logged as a separate
decision (UX-TEST-12).

It also answers an audit finding: after marking, the report was the only 20-mark
question in the paper with no model answer, no checklist and no follow-up. It now
shows what the question was looking for, in the author's words.

## The case study collapses once marked, for the reason the response does

State 12's collapsed response was approved on one principle: once marked, what
the student has already read is compressed so the mark leads. State 13 has a case
study with a chart above the response, and rendered in full it put **15 of 20
below the fold at 1280x900**. So it collapses too, once marked, and stays open in
full while answering, because it is what the report is written from.

It stays directly under the instruction in both states, so "use the case study
below" is true in both. A side panel, as the Calculation mockups use, was
rejected for exactly that sentence: it would be false on every screen wide enough
to show one.

## The report is rendered as typed

A report's structure is its line breaks, so they render exactly as typed
(`white-space: pre-line`). Nothing is promoted to a heading: a short line is not a
heading because it looks like one, and inferring structure the student did not
mark up would be the page writing their report for them. `tests/t36.mjs` fails if
any of the student's lines is rendered as an `<h2>`-`<h6>`.

## What the marker claims, and what it could not

The marker is sent the response, the question and the report's own guidance. It
is **not sent the case study**. So the review in the fixture cites only what the
student wrote: "about 250 to about 700 a week" is the student's reading of the
chart, in their Findings. `tests/t36.mjs` fails the page if the marker's prose
carries a figure the student did not write, or case-study phrasing the student
did not use.

That constraint is also the next problem. Routing the authored words means the
marker is now told "use the case study below" and "justifies the recommendations
against the evidence in the case study", about a case study it has never seen.
Logged as UX-TEST-11. It is the first thing to fix before this marking can be
trusted to judge point 6.

## Measured

```
            footer   mark text   judgement       mark    judgement
1512x982     919     540-578     609-773         clear   clear
1280x900     837     540-578     609-773         clear   clear
1280x800     737     540-578     609-773         clear   begins
1280x700     637     540-578     609-773         clear   begins
1024x768     705     587-625     655-820         clear   begins
 834x1112   1049     587-625     655-820         clear   clear
 430x932     869     803-840     871-1134        clear   below
 390x844     781     903-941     972-1260        below   below
```

No horizontal overflow at any width. **Zero WCAG AA failures** on the shared tokens,
measured with every disclosure open: 80 text nodes marked, 32 answering. The chart
is an image, so a text sweep cannot see its labels; they are carried by its alt
text, which the generator reads off the chart's own labels rather than describing.

**At 390x844 the mark is below the first screen**, at y=903 against a footer
starting at 781. It is not behind the footer: the question itself - its
instruction, the case-study line and a five-line prompt - fills a phone screen
before the response begins. State 12's collapse cannot help here because there is
nothing left to collapse that is not the question. Logged as UX-TEST-14; the
option, if it matters, is collapsing the question's text once marked too, which is
a new pattern and not taken here.

## Not decided here

- **State 13b**: the report doctrine, as an answering scaffold.
- **UX-TEST-11**: the case study reaching the marker. A worker change.
- **UX-TEST-12**: whether an extended response's points are routed too.
- **The response-type line**: telling the marker it is a report, not only what a
  report must do. A worker change.
