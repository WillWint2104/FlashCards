# Calculation: deterministic checking and the worked solution

Companion to four canonical screens. Nothing in this file appears on the
student's screen.

| screen | file |
| --- | --- |
| before checking (state 14, updated) | `14-nested-multipart.html` |
| checked — correct | `14-calculation-checked-correct.html` |
| checked — not quite | `14-calculation-checked-notquite.html` |
| worked solution open | `14-worked-solution.html` |

All four are question 11(c) of the synthetic Business Studies paper, Practice
policy, inside the approved multipart shell. The parent strip, part rail, source
panel, footer and paper bar are untouched as layout; only the action treatment
and the values that must move with it have changed.

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

## The three action states

| | primary | secondary | hint |
| --- | --- | --- | --- |
| before checking | **Check answer** | View worked solution | Checked against the expected answer. |
| correct | *none* | View worked solution | Checked against the expected answer. |
| not quite | **Try again** | View worked solution | The worked solution shows the expected answer. |

When the answer is correct the work is done, so the card offers no primary
action and the footer's `Next · 11(d)` carries the student on. The footer is
deliberately **unchanged in every state**: whether a numeric answer is right does
not alter how the paper is navigated, and promoting Next to primary here would
raise the same question for every other format, which belongs to state 16.

## One deviation from the brief, and the reason

The brief lists the expected answer as part of the checked state in both
outcomes. **The "not quite" screen does not show it.**

Showing it would dissolve the distinction the brief exists to protect. If the
expected answer appears automatically on a wrong attempt, `Try again` is a copy
exercise and *correct after retry* stops meaning anything — every retry is
correct, and none of them is the student's. The expected answer is still one
click away in the worked solution, which already records that it was opened. So
the three attempt states stay separable:

| state | how it is reached |
| --- | --- |
| correct independently | checked correct, solution never opened |
| correct after retry | checked wrong, retried correctly, solution never opened |
| solution viewed | solution opened at any point, before or after any check |

On the **correct** screen the expected answer *is* shown, beside the student's
own, because there it confirms rather than supplies.

This is one line to reverse if you want the brief followed literally: the
`Expected` pair is already built, and appears in `14-calculation-checked-correct.html`.

## The worked solution

**A side sheet, not a centred modal.** It belongs to the question in view, so
the student keeps their own working, their result and the question text visible
beside it. The navigator is centred because it belongs to the whole paper. Two
different scopes, two different surfaces, one visual language.

**Every word comes from the authored `model` string.** The four steps are a
decomposition of one authored sentence, not an expansion of it:

| step | on screen | authored source |
| --- | --- | --- |
| 1 · Use the formula | `Current ratio = current assets ÷ current liabilities` | "Current ratio = current assets divided by current liabilities" |
| 2 · Substitute the values | `= $60 000 ÷ $40 000` | "= 60 000 / 40 000" |
| 3 · Calculate | `= 1.5` | "= 1.5" |
| 4 · Answer | `Current ratio = 1.5 : 1` | "1.5 to 1" |

Three notation substitutions, and nothing else: `divided by` and `/` both render
as `÷`; `to` renders as `:`; the dollar signs and the spaced thousands come from
the question's own prompt, which writes `$60 000`. No step was invented, no
interpretation was added, and the sheet carries **no title for the part** because
the fixture authors none — the header reads `Question 11(c) · 4 marks ·
calculation`, which is all that is true.

Where a paper authors a fuller solution, the same four slots take more text.
Where it authors less, steps are withheld exactly as the help region is: this
sheet is a renderer, not a generator. An authored interpretation would sit below
step 4; 11(c) has none, so there is none.

## Opening it is recorded, and the student is told

The sheet's footer reads *"This part will show as 'solution viewed' in your
results."* and a gold **Solution viewed** chip appears on the card. Both are
plain statements rather than warnings. The student may still enter and check an
answer afterwards — the field and `Try again` stay live — but the attempt is not
represented as independently solved.

No scoring is proposed for the three attempt states. They are recorded, not
weighted. What results make of them belongs to state 17.

## Practice versus exam conditions

One component, one policy slot, consistent with the state 8 policy table:

| | Practice | Exam conditions |
| --- | --- | --- |
| `Check answer` | immediate, in place | answer is saved; checking follows submission |
| `View worked solution` | available at any time | **not available before the paper is submitted** |
| after submission | n/a | the same sheet is reused in question review (state 18) |

The sheet is therefore built once. Exam conditions removes the entry point; it
does not need a different solution surface.

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

On the "not quite" screen the part is still **answered** — it has a saved
response — and the score does not move. Answered means a response exists, not a
response that earned marks.

### A coincidence worth noticing

On the correct screen the paper bar reads *13 of 20 answered* while the footer
reads *Item 13 of 20*. Two different facts that happen, at this moment, to be
the same number. They are only distinguishable because of the word **Item**
settled in state 15. Without it the two strings would be identical.
