# The writing workspace

What the essay page is made of, and which rules the layout is allowed to break.

## The surfaces, outermost first

| Surface | Class | What it may do |
| --- | --- | --- |
| Page | `.es-scrim` | The scroller. Near-white ground, never a dimmed layer over something else. |
| Header | `.es-wrap > .es-top` | Full bleed. Global utilities only: Learn, Notebook, full attempt, setup. |
| Question | `.es-qbar` | The question, its metadata, the decode controls, and Change question. |
| Support belt | `.es-belt` | Arguments, Evidence, Structure, Vocabulary. Nothing else. |
| Writer | `.es-compose` | The only card the writing lives in. |
| Rail | `.es-rail` | Panels that have something in them. Never a placeholder. |
| Action bar | `.es-footbar` | Fixed. Save state, outline, preview, check. |

On the writing screen the question, the belt, the decode box and the writer are
four rows of one grid column, and the rail is the other column spanning all four.
So they share a left edge and a width by construction, and the rail begins beside
the question rather than halfway down the page beside the writer.

On the plan, review and full-attempt screens the question card is still a child of
the wrap and is aligned to the writing column by hand.

Change question lives on the question card, because changing which question you
are answering is an essay-workspace action. Setup, in the header, is the broader
configuration. Starting a different question replaces the draft, so a draft with
words in it is asked first.

## Inside the writer

One surface. The card is white and everything sits directly on it:

```
.es-compose        white card
  .es-parahead     which section, how many words, what it argues
  .es-guide        THE ONE MINT ELEMENT: what this sentence has to do
    .es-promptacts Show sentence shape · I am stuck on this sentence
    .es-stuck      the stuck helper, floating, anchored to the prompt
  .es-prose        the sentences already accepted, on white, at 72ch
  .es-active       transparent. The editor, the help ladder, and Add this sentence
  .es-resp         where you are in the response
```

Mint marks the sentence the student is being asked to write and nothing else.
It is not the background of the composer, and there is no card inside the card.

The reading measure belongs to the accepted prose. Everything else in the writer
uses the card's width: a legacy rule capped every child at 940px and centred it,
which inside a 1088px card reads as an accident rather than as a measure, and it
is overridden inside `.es-scrim`.

## The stuck helper

Five routes into support that already exists, anchored to the sentence they are
about. Nothing on it writes, inserts or rewrites a sentence.

| Row | Goes to |
| --- | --- |
| What this sentence has to do | the authored explanation where one exists, and otherwise the instruction already on screen |
| Show a sentence shape | the content-free frames for this stage |
| See the same shape used elsewhere | the authored worked example, on its own |
| Words this sentence needs | the vocabulary tool |
| Reading for this argument | the study resources authored for this pathway |

The menu is always five rows. A row with nothing behind it is shown disabled and
says why, because a menu that changes length teaches the student nothing about
what help exists. On an unreviewed pathway most of the rows are unavailable, and
that is the honest report of the content gap, not a bug in the menu.

Two of the rows need care.

**What this sentence has to do** can never be unavailable, because the prompt
above the menu is already telling the student what the sentence has to do. Where a
longer explanation is authored it opens the ladder at that rung; where none is, it
points at the instruction on screen. `data-esjob` on the row says which of the two
it will do, so "is an authored ladder available here" stays answerable without
opening anything.

**See the same shape used elsewhere** shows the worked example and nothing else.
Reaching it through the ladder would also uncover the start-you-finish rung below
it, which is scaffolding on the sentence the student is actually writing rather
than a structure demonstrated somewhere else. The example is safe precisely
because it is in another topic. The deeper ladder still exists and is asked for
separately.

Opening and closing it is a disclosure inside one component: it toggles its own
panel and never re-renders. On the writing screen a keeping-place render swaps
only the side column, so a component that re-rendered to show itself would not
have appeared at all.

## Widths

| Viewport | Writer | Rail |
| --- | --- | --- |
| 1920 | 1088 | 330 |
| 1700 | 1040 | 300 |
| 1499 | 958 | 286 |
| 1399 and below | `min(958px, 100vw - 110px)` | gone |

The writer never grows as the window shrinks. Dropping the rail takes the rail
away; it does not widen the writing column. The viewport unit in the last row is
deliberate: a percentage re-resolves against whichever box reads the variable,
and inside `.es-cols` that box is already the column, so the column lost the
gutter twice.
