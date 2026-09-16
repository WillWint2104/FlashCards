# Calculation: deterministic checking and the worked solution

Companion to four canonical screens. Nothing in this file appears on the
student's screen.

| screen | file |
| --- | --- |
| before checking (state 14) | `14-nested-multipart.html` |
| checked — correct | `14-calculation-checked-correct.html` |
| checked — not quite | `14-calculation-checked-notquite.html` |
| not quite, solution expanded | `14-worked-solution.html` |

All four are question 11(c) of the synthetic Business Studies paper, Practice
policy, inside the approved multipart shell. The parent strip, part rail, source
panel, paper bar and footer are untouched as layout.

## Why a calculation does not go through the marker

The contract authors everything the check needs:

```json
{ "id": "q11c", "label": "c", "marks": 4, "format": "calculation",
  "expected": 1.5, "tolerance": 0.05,
  "prompt": "... Calculate its current ratio, correct to one decimal place.",
  "model": "Current ratio = current assets divided by current liabilities
            = 60 000 / 40 000 = 1.5 to 1." }
```

`expected` and `tolerance` make the judgement deterministic and local. Sending
`1.3` to a language model to be told it is not `1.5` adds latency, cost and a
failure mode in exchange for nothing. So there is no pending state, no
*"Checking…"*, and no spinner to design.

**Before:** `Submit for marking` · *"Marked against Business Studies criteria."*
**After:** `Check answer` · `View worked solution` · *"Checked against the
expected answer."*

The old hint was also untrue here. There are no Business Studies criteria being
applied to `1.5`; there is a number and a tolerance.

## The response field

`width: min(100%, 22rem)`. On desktop it settles at 352px — compact, because a
calculation answer is short: `1.5 : 1`, `$42 000`, `23.4%`, `125 units`. Below
about 400px of column it becomes fluid and fills the width. Measured: 352px at
1280, 1024, 760 and 560; 312px at 390.

Height, padding, border and focus ring are `.answerbox` unchanged, so it still
reads as a response control rather than a form field. It does **not** resize
around what is typed: a field that moves while you use it is worse than one that
is slightly too wide.

## The four states

| | primary | secondary | explanatory copy |
| --- | --- | --- | --- |
| before checking | **Check answer** | View worked solution | *Checked against the expected answer.* |
| correct | *none* | View worked solution | — |
| not quite | **Try again** | View worked solution | — |
| solution expanded | **Try again** | Hide worked solution ▴ | — |

The helper line is **pre-check explanatory text, not furniture**. Before
checking it tells the student what `Check answer` will do. Afterwards the result
itself has proved it, and *"The worked solution shows the expected answer"* was
doing work the button label already does. Both are gone, and the card is
noticeably cleaner for it.

When the answer is correct the card offers no primary action and the footer's
`Next · 11(d)` carries the student on. **The footer is unchanged in every
state**: whether a numeric answer is right does not alter how the paper is
navigated, and promoting Next to primary here would raise the same question for
every other format, which belongs to state 16.

## The expected answer is withheld on "not quite"

Showing it automatically would dissolve the distinction this design exists to
protect. If the expected answer appears on a wrong attempt, `Try again` is a
copy exercise and *correct after retry* stops meaning anything — every retry is
correct, and none of them is the student's. It is one click away in the worked
solution, whose opening is recorded. So the three attempt states stay separable:

| state | how it is reached |
| --- | --- |
| correct independently | checked correct, solution never opened |
| correct after retry | checked wrong, retried correctly, solution never opened |
| solution viewed | solution opened at any point, before or after any check |

On the **correct** screen the expected answer *is* shown, beside the student's
own, because there it confirms rather than supplies.

No scoring is proposed for these three. They are recorded, not weighted. What
results make of them belongs to state 17.

## The worked solution expands in place

It is an inline disclosure inside the question card, directly under the result
and the actions. Not a drawer, not an overlay.

The task is local — *my answer, the check, the explanation, perhaps a retry* —
and inline keeps all of it in one field of view. The student reads **I wrote
1.3** and **$60 000 ÷ $40 000 = 1.5** without carrying anything between two
surfaces. It also removes a list of problems rather than solving them: no
backdrop, no focus trap, no separate close control, no question text obscured,
no source panel hidden, no drawer sizing, no desktop-versus-mobile
transformation, and nothing that will later compete with the source sheet on a
phone. On a narrow screen it simply stacks.

`View worked solution` and `Hide worked solution ▴` are the same button in the
same place, so the disclosure has one control rather than an opener and a
separate closer.

### Every word comes from the authored `model`

The four steps are a decomposition of one authored sentence, not an expansion:

| step | on screen | authored source |
| --- | --- | --- |
| 1 · Use the formula | `Current ratio = current assets ÷ current liabilities` | "Current ratio = current assets divided by current liabilities" |
| 2 · Substitute the values | `= $60 000 ÷ $40 000` | "= 60 000 / 40 000" |
| 3 · Calculate | `= 1.5` | "= 1.5" |
| 4 · Answer | `Current ratio = 1.5 : 1` | "1.5 to 1" |

Three notation substitutions and nothing else: `divided by` and `/` both render
as `÷`; `to` renders as `:`; the dollar signs and spaced thousands come from the
question's own prompt, which writes `$60 000`. No step was invented and no
interpretation was added. The disclosure carries **no title for the part**
because the fixture authors none.

Where a paper authors a fuller solution the same four slots take more text.
Where it authors less, steps are withheld exactly as the help region is: this is
a renderer, not a generator. An authored interpretation would sit below step 4;
11(c) has none, so there is none.

### Its shape reuses the help region

Each step is a fixed-width label beside its working, which is `.help .row` from
state 8 — a `.k` key and its text. Stacking the label above the working instead
made the disclosure 460px tall and pushed all four steps below the fold on a
900px viewport; beside, it is 339px and the first three steps are visible
without scrolling. Each line of working is `display:inline-block`, so `= 1.5`
is sized to itself rather than becoming a slab the width of the writing column.

### Opening it is recorded, and the student is told

A gold **Solution viewed** chip appears at the foot of the disclosure, next to
nothing else, as a plain statement rather than a warning. The student may still
enter and check an answer afterwards — the field and `Try again` stay live — but
the attempt is not represented as independently solved.

## Practice versus exam conditions

One component, one policy slot, consistent with the state 8 policy table:

| | Practice | Exam conditions |
| --- | --- | --- |
| `Check answer` | immediate, in place | answer is saved; checking follows submission |
| `View worked solution` | available at any time | **not available before the paper is submitted** |
| after submission | n/a | the same disclosure is reused in question review (state 18) |

Exam conditions removes the entry point. It does not need a different solution
surface, and now that the solution is inline there is no overlay to re-home.

## Written formats are untouched

Short answer, extended response and business report keep `Submit for marking`.
Prose cannot be judged by comparison against a model, so the marker stays, and a
`View model response` support action after marking is a separate question for
state 16. This pattern applies only where the contract authors an `expected`
value — that is, only to `calculation`.

## The rail gains its second composition

After a successful check, 11(c) is both **current** and **answered**. Following
the rule already set by `done + flag`, the chip carries both facts: the dark
current chip keeps its tick, `✓ c`. Three counters move with it — the parent
reads *3 of 4 parts answered*, the paper bar *13 of 20 answered*, and on the
correct screen the live score rises by the part's 4 marks to *25/90*.

On the "not quite" screens the part is still **answered** — a response exists —
and the score does not move. Answered means a response exists, not a response
that earned marks.

### A coincidence worth noticing

On the checked screens the paper bar reads *13 of 20 answered* while the footer
reads *Item 13 of 20*. Two different facts that happen, at this moment, to be
the same number. They are only distinguishable because of the word **Item**
settled in state 15. Without it the two strings would be identical.
