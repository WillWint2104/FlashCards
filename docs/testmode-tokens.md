# Test Mode colour tokens — a shared accessibility pass

Not a State 12 decision. A contrast audit across **all nine** Test Mode mockups
found **9 of 9 failing WCAG AA**, 17 to 28 selectors each, and the worst
offenders are in the frozen State 8 shell. This proposes a change to a handful of
shared token values so one pass fixes every state, rather than nine files being
recoloured independently.

## What was measured

Every element carrying a text node, in every mockup, at 1280x900, against its
effective background. AA is 4.5:1 for normal text, 3:1 for large (>=24px, or
>=18.66px at weight 700). Nothing in these files is large text.

```
WORST DISTINCT SELECTORS, ALL NINE MOCKUPS               need 4.5:1
  1.70:1   .k           "Your answer"           11px/800
  1.87:1   .obs         "2 observations"        11.5px/700
  1.88:1   .tag         "not addressed"         11px/800
  1.94:1   .c           "2 of 4 parts answered" 11.5px/800
  2.00:1   span         "Question 11(c)"        12.5px/700   authored identity
  2.00:1   .saved       "Saved. Moving to..."   11.5px/800   FROZEN SHELL
  2.00:1   .where       "Item 13 of 20"         12px/800     FROZEN SHELL
  2.00:1   .hint        "Checked against..."    12.5px/700   FROZEN SHELL
  2.00:1   .pdone       "2 of 4 parts answered" 12px/800
  2.27:1   .btn         "Try again"             15px/600     THE PRIMARY ACTION
  2.95:1   .policy      "Practice · marked..."  11.5px/800
```

Two of these matter more than the count suggests. **`.btn` at 2.27:1 is white on
`--green`** — the primary action, in the accent colour the product is built on.
**`Question 11(c)` at 2:1** is the authored question identity, which Gate 3C
exists to get right, and it is currently the hardest text on the screen to read.

## The cause is three token values, not nine designs

`--ink-3` is used for every piece of metadata in the shell. `--ink-2` for every
secondary line. `--green` is a button surface as well as an accent. Fixing those
fixes almost all of it.

| token | now | proposed | why |
| --- | --- | --- | --- |
| `--ink-3` | `#AEBAB8` 2.00 | **`#616E6C`** 5.31 on white, **4.75 on its worst surface** | metadata, counts, hints, footer position |
| `--ink-2` | `#7A8A88` 3.61 | **`#596866`** 5.71 on white, **5.22 worst** | secondary prose and labels |
| `--green-dk` | `#14A368` 3.25 | **`#0E7A4E`** 5.37 white-on-it, 4.88 on green-soft | becomes the primary button SURFACE and green text |
| `--green-edge` | — | **`#0A5C3C`** | new: the button's bottom edge, was `--green-dk` |
| `--gold-dk` | `#E89400` 2.42 | **`#9A6000`** 4.71 on gold-soft | flags, "solution viewed" |
| `--blue-dk` | `#1487D6` 3.38 on blue-soft | **`#0D5888`** 6.68 | the format chip |
| `--coral-dk` | `#EE5946` 2.91 on coral-soft | **`#AE3323`** 5.43 | "Not quite" |

**`--green` `#1CC47D` does not change.** It stays the brand accent on surfaces
that carry no text: the policy dot, the progress bar fill, the focus ring, chip
borders. What changes is that it stops being a background for white text.

Each proposed value was checked against **every** surface it actually lands on -
white, the `#FAFCFC` card tint, the `#F4F9F8` working surface, the `#EEF3F5` page
and the `#F4F8F8` stat chip - and the worst of those is the number quoted. A
value that passes on white and fails on the working surface is not a fix, and the
first candidate for `--ink-3` failed exactly that way at 4.05.

## What this is not

- Not a redesign. Seven values move; no component, spacing, radius, weight or
  layout changes, and every semantic role stays where it is.
- Not nine separate fixes. The point is that one edit to the token block in each
  file — or one shared stylesheet when this is implemented — closes all of it.
- Not State 12's to apply unilaterally. State 8 is frozen and `.saved`, `.where`
  and `.hint` are its components.

## Status

**Approved as the Test Mode accessibility baseline, and applied to seven of the
ten rendered pages.**

```
  applied   12-extended-response, 12-extended-response-answering   0 AA failures
  applied   11-short-answer, 11-short-answer-keypoints             0 AA failures  (was 31, 34)
  applied   14-calculation-checked-correct, -notquite,
            14-worked-solution                                     0 AA failures  (was 29, 29, 39)
  pending   08-sitting-shell                                      26 AA failures
  pending   14-nested-multipart                                   27 AA failures
  pending   15-navigator                                          89 AA failures
```

The three pending pages were left because the instruction that authorised the
re-render named Calculation and Short Answer. They carry the same token block and
the same swap applies unchanged.

The swap is two edits per file: the `:root` values, and the button, which is the
one component whose ROLE changes - `--green` stops being a surface under white
text and goes back to being the accent, `--green-dk` becomes the surface, and the
new `--green-edge` is the bottom edge it used to be. Measured on the five files
re-rendered: **zero layout change**, every text node at the same coordinate and
every document height identical.

**One finding against this baseline, logged as UX-TEST-08:** it fixes contrast
and flattens the grey hierarchy. `--ink-2` and `--ink-3` were 1.81:1 apart and
are now 1.10:1 apart, so metadata no longer recedes behind secondary prose. The
correction is to spread `--ink-2` rather than to revert anything, and it is a
change to an approved baseline, so it is proposed rather than taken.
