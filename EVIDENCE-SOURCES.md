# Evidence sources

## The rule

A student has to be able to trust that anything in the evidence picker is safe to
put in an answer they will be marked on. So:

> **Evidence with no recorded source is a candidate, not evidence.** It is kept in
> the bank, it is never offered to a student, and it is never shown with a warning
> instead. A warning still puts an unchecked claim in front of someone about to be
> marked on it.

This is enforced in code, not by convention. `esEvidenceUsable(e)` is true only when
`e.source` is a non-empty string, and every route into the picker goes through it:
the plan screen chips, the paragraph setup card, and the Evidence drawer. There is
no flag that turns it off.

What a student sees while an item is withheld:

* the picker says how many pieces are waiting on a checked source
* their own evidence is still allowed, and says so
* every other layer (argument, Learn, component guidance, the help ladder) is
  unaffected, so the paragraph is still fully supported

## Current state

**58 items are written and 0 are offered**, because none carries a source yet:

| topic | items awaiting a source |
|---|---|
| operations | 17 |
| marketing | 12 |
| finance | 13 |
| human resources | 16 |

The 12 marketing items are the ones the Processes reference area depends on. Until
they are sourced, the Evidence layer is dark in the built app.

## What a source has to be

Sources are authored, never generated here and never fetched at runtime. For each
item, record:

| field | what it is |
|---|---|
| `source` | the reference in words, as a student could cite or a teacher could check |
| `sourceUrl` | where it can be confirmed, if there is a stable public page |
| `checked` | the date it was last confirmed, `YYYY-MM-DD` |

A source is only good enough if someone can confirm the **claim in `fact`**, not
merely the general topic. If part of an item is checkable and part is not, split
the item or cut the unverifiable part; do not source the easy half and leave the
rest riding on it.

Items that state a figure should keep `verify: true` as well. The source says where
the claim came from; `verify: true` says the number moves and should be re-checked
before it is used in an answer.

## How to fill it in

`evidence-sources.json` in the repo root is a worksheet with one row per item,
already keyed by topic and label:

```json
{
  "marketing": [
    { "label": "App, loyalty rewards and mobile ordering",
      "section": "marketing strategies",
      "source": "", "sourceUrl": "", "checked": "" }
  ]
}
```

Fill in whichever rows you want live, hand the file back, and the values are merged
onto the matching bank entries by label. Nothing else about the bank changes: the
`fact` and `use` text stays exactly as authored. Items left blank stay withheld.

Marketing first is enough to light up the Processes reference area.
