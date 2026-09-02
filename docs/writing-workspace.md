# The writing workspace

What the essay page is made of, and which rules the layout is allowed to break.

## The surfaces, outermost first

| Surface | Class | What it may do |
| --- | --- | --- |
| Page | `.es-scrim` | The scroller. Near-white ground, never a dimmed layer over something else. |
| Header | `.es-wrap > .es-top` | Full bleed. Global utilities only: Learn, Notebook, full attempt, setup. |
| Question | `.es-qbar` | The question, its metadata, and the decode controls. |
| Support belt | `.es-belt` | Arguments, Evidence, Structure, Vocabulary. Nothing else. |
| Writer | `.es-compose` | The only card the writing lives in. |
| Rail | `.es-rail` | Panels that have something in them. Never a placeholder. |
| Action bar | `.es-footbar` | Fixed. Save state, outline, preview, check. |

The question, the belt and the writer share a left edge and a width. They are one
column, and they are aligned by the same expression, so a change to one has to be
a change to all three.

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
| What this sentence has to do | the authored ladder, at its "what this part has to do" rung |
| Show a sentence shape | the content-free frames for this stage |
| See the same shape used elsewhere | the authored worked example, deliberately in another topic |
| Words this sentence needs | the vocabulary tool |
| Reading for this argument | the study resources authored for this pathway |

The menu is always five rows. A row with nothing behind it is shown disabled and
says why, because a menu that changes length teaches the student nothing about
what help exists. On an unreviewed pathway most of the rows are unavailable, and
that is the honest report of the content gap, not a bug in the menu.

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
