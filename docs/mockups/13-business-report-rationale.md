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
2. **What the marker is sent is what the question authored, for every written
   format.** The report's own instructions and every written question's marking
   points travel as `requirements.accomplish`; the case study the student was
   given travels as `stimulusContext`; and both marking passes are told the
   response's format - a business report - with the directive, recommend,
   carried separately. The first version of this state routed only the report's
   words and left the case study unsent; the correctness pass below replaced it.

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

## What the marker is sent, measured on the wire

In the real app, sitting the real paper, with the marking request intercepted,
then fed through the shipped worker's own intake and prompt builders
(`tests/ui70.js` repeats this on every full run):

| | before state 13 | now |
| --- | --- | --- |
| report: its instructions and 5 points, in pass 1 / pass 2 | 0 of 6 / 0 of 6 | **6 of 6 / 6 of 6** |
| report: the case study | `stimulus: true` only | **text verbatim and the chart as 4 values, in both passes** |
| report: what both passes call it | "extended response" | **"business report"; directive `recommend` separately** |
| extended response: its 4 marking points | reached nothing | **in both passes** |
| extended response request (q15, ui70's answer) | 3140 bytes | 3506 bytes: **one new field, `requirements`** |
| report: answer shape | introduction / body paragraphs / conclusion | **none** |
| report: its own instructions on screen | nowhere | **under the heading, above the case study** |

The chart travels as its title and one value per bar - 2022: 250, 2023: 390,
2024: 560, 2025: 700 - with a sentence saying how they were read: from the bar
heights against the labelled axis, 0 to 800. The reader is strict. It accepts
only a chart whose axis is labelled at both ends, whose bars stand on the
baseline, and whose bars read to whole values; anything else is not included,
the marker is told in words that something was shown that it cannot see, and the
paper validator reports `SOURCE_NOT_REPRESENTED` to the author. No model
summarises or reinterprets the source before the marker sees it.

## The one thing this page adds to state 12's pattern

**"What your marker was told to look for."** The question's own instructions and
marking points, listed in order, with nothing ticked or crossed.

It is there because it is now *true*: those six items are sent to the marker with
the response and the case study. An earlier version carried a caveat that the
case study was not sent; that was a marking-contract defect, not something to
explain to a student, and with UX-TEST-11 fixed the caveat is gone. The list on the page is `ASSESS.reportGuidance(q14).items`, computed
by the generator with the same function the app uses, not copied. It carries no
verdict because the marker returns none per point, and the lede says so in words.

State 12 does not have this section. It was left out because an extended
response's points were not sent to its marker, and "your marker was told" would
have been false. Since UX-TEST-12 they are sent, so the sentence would now be true
there too. State 12 is frozen, so whether its marked page should show them is
logged as UX-TEST-17 rather than decided here.

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

## What the marker claims, and what it was sent

The marker is sent the response, the question, its guidance and - since UX-TEST-11
- the case study. `tests/t36.mjs` reads the marker's prose off the generated PAGE
and fails it if it carries a figure that nothing the marker is sent contains, and
regenerates both pages to fail unless the committed ones are byte-identical.

Whether a model then judges well - that a recommendation is supported by rising
online orders, or contradicted by the owners' wish to keep all six stores - cannot
be proven without calling one, and no suite here does. What is proven is that both
passes are given those facts, verbatim.

## Measured, with the page's own fonts loaded

Every number here is taken with Fredoka and Nunito proven loaded as `FontFace`
objects, served from a local cache by `tests/fontcache.js`. The test harness
otherwise blocks web fonts, and every fold figure this project took in the
fallback face was wrong. `tests/ui71.js` holds these as permanent invariants on
every marked page.

**The footer at narrow widths is now 48px**: 1.5px above and below the 44px
targets, plus its 1px border. It was 63px, which put it 14px over "15 of 20" at
390x844. The targets did not shrink; only the chrome around them did.

```
state 13      footer        score "15 of 20"
390x844       48px @796     774.9-794.9     clear, by 1.06px
375x667       48px @619     862.5-882.5     below the first screen, not behind the footer
430x932       48px @884     704.7-724.7     clear
834x1112      63px @1049    579.3-599.3     clear
1280x800      63px @737     532.5-552.5     clear
```

The score's line ends 1.06px above the footer at 390x844, and "15 of 20" has no
descenders, so the glyphs themselves clear by more. At 49px the margin was 0.06px,
which is why the footer is 48 and not 49. The result card's own padding and
border still run about 15px under the footer on arrival at 390x844; the whole card
clears once scrolled to, and ui71 asserts both.

No horizontal overflow at any width. Zero WCAG AA failures on the shared tokens.

## Not decided here

- **State 13b**: the report doctrine, as a guided-writing scaffold. Deferred, and
  it belongs in guided writing, not Test Mode.
- **Section-level sources and non-bar charts**: a source the reader cannot
  represent is declared to the marker and reported to the author; representing
  more kinds is future work.
- **Teaching material already in the request**: `vocab`, `scaffold` and the
  scaffold-to-accomplish fallback predate this state and are logged as UX-TEST-16
  for a decision; nothing new of that kind was added.
