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
| extended response request (q15, ui70's answer) | 3140 bytes | **byte-identical** |
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
the response. Beside it the page says the one thing the list could otherwise be
read as denying: **the case study itself is not sent, so the marker cannot check
how the student used it.** That sentence stays until UX-TEST-11 is fixed. The list on the page is `ASSESS.reportGuidance(q14).items`, computed
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
any heading or bold element appears inside the response, or if any line of the
student's report appears as a heading anywhere on the page, in any casing.

## What the marker claims, and what it could not

The marker is sent the response, the question and the report's own guidance. It
is **not sent the case study**. So the review cites only what the marker is sent:
"about 250 to about 700 a week" is the student's reading of the chart, in their
Findings, and "a different job" is the question's own marking point.

`tests/t36.mjs` reads the marker's prose off the generated PAGE, not the fixture,
and fails it if it carries a figure, or any four-word run of the case study, that
nothing the marker is sent contains. It also regenerates both pages into a scratch
directory and fails unless the committed pages are byte-identical, so the page
cannot drift from the pipeline that produced it.

The first draft failed this. Its review described the warehouse finding as "built
for bulk store replenishment and is now picking single orders", which is the case
study's sentence, not the student's - the student wrote "designed to send bulk
stock to six stores, so it is slow at picking single online orders". The
adversarial review caught it, and the four-word check now names exactly those
runs if the phrasing comes back.

That constraint is also the next problem. Routing the authored words means the
marker is now told "use the case study below" and "justifies the recommendations
against the evidence in the case study", about a case study it has never seen.
Logged as UX-TEST-11. It is the first thing to fix before this marking can be
trusted to judge point 6.

## Measured, with the page's own fonts loaded

The first version of this table was measured with the web fonts blocked, which is
what the test harness does for speed, and it did not say so. The fallback face is
wider than Nunito, so every line broke earlier and every number was wrong. These
are measured with Fredoka and Nunito proven loaded as `FontFace` objects -
`document.fonts.check()` returns true when nothing matches, so it proves nothing -
against the sticky footer's top, which is the real fold on this shell:

```
            footer   mark text   judgement       mark      judgement
1512x982     919     514-553     583-725         clear     clear
1280x900     837     514-553     583-725         clear     clear
1280x800     737     514-553     583-725         clear     clear
1280x700     637     514-553     583-725         clear     BEHIND
1024x768     705     514-553     583-725         clear     BEHIND
 834x1112   1049     561-599     630-772         clear     clear
 430x932     869     686-725     755-996         clear     BEHIND
 390x844     781     756-795     826-1091        BEHIND    below
```

No horizontal overflow at any width. **Zero WCAG AA failures** on the shared tokens,
measured with every disclosure open: 80 text nodes marked, 32 answering. The chart
is an image, so a text sweep cannot see its labels; they are carried by its alt
text, which the generator now derives clause by clause - the title and scale from
its labels, the bar count and the trend from its `<rect>` heights.

**At 390x844 the mark is behind the footer**: its text spans 756 to 795 against a
footer starting at 781. This is the UX-TEST-06 fault class, on the one page where
the shell fix does not reach it, because what sits above the mark here is the
question itself - its instruction, the collapsed case-study line and a five-line
prompt - and none of that is the student's own reading material to collapse.
The same measurement puts state 12's mark clear at all eight sizes. Logged as
UX-TEST-14; it needs a decision, because every fix reopens something locked.

## Not decided here

- **State 13b**: the report doctrine, as an answering scaffold.
- **UX-TEST-11**: the case study reaching the marker. A worker change.
- **UX-TEST-12**: whether an extended response's points are routed too.
- **The response-type line**: telling the marker it is a report, not only what a
  report must do. A worker change.
