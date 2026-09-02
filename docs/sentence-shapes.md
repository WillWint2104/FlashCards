# Sentence Shapes v2

A structure for the sentence in hand, shown under the prompt it belongs to.
Local scaffolding: not another place to go and read, and nothing in it writes,
inserts or rewrites a sentence.

## How a shape is chosen

Directive family, then paragraph role, then the stage of the paragraph the student
is on. Nothing is keyed to a question. A question contributes VALUES, never
structures, and never a model answer to itself.

| family | role | slot key | what the student reads |
| --- | --- | --- | --- |
| causal | introduction | `thesis` | thesis |
| causal | body | `topic` | state the relationship |
| causal | conclusion | `restate` | draw together |
| causal | conclusion | `judgement` | answer the question |

The slot KEY is the scaffold's and is durable; `stageLabel` is what a student
reads, and it follows the directive like everything else. Two of these matter:

- `topic` is a TEEEC position, not a job. "Write a topic sentence" is an
  instruction about where the sentence goes; this stage's job is to state one
  relationship.
- `judgement` is the durable key, and a causal question must never be headed with
  it. The composer stage was fixed in the directive contract; the shape panel had
  its own copy of the same leak, rendering the raw key over a shape whose own words
  said answer the question directly.

Variants (`variantOf`) are reached through the shape they belong to, never
resolved directly, so "other ways to phrase this" cannot become the default.

## Two treatments, four sources

A slot declares both, and they must not be collapsed:

| field | what it is for |
| --- | --- |
| `treatment` | what the STUDENT sees. `resolved` is mint, `student` is amber. Two, because a student needs to know which parts are theirs, not a taxonomy. |
| `source` | where a resolved value CAME from: `question`, `pathway`, `student`. Kept so validation can enforce it. |
| `binding` | the authored field the value is read from. |

The separation is load-bearing. `app.js` forbids deriving the cause end of a
relationship by splitting `short` or `relationship`, and that rule is only
enforceable if the shape records that the value must come from
`pathway.fromLabel`. Flattening provenance into the treatment would lose it.

Bindings name an authored field and never compute one:

| binding | reads |
| --- | --- |
| `question.concept` | `question.term1` |
| `question.areas` | `requirements.requiredAreas` labels, joined |
| `question.area` | the label for this paragraph's area |
| `pathway.fromLabel` | the chosen argument's authored cause end |

## Connectors

The furniture that joins two resolved values is authored and NAMED, never inferred.
What verb joins them depends on what the right-hand value IS, and no inspection of
the string can know that: *"shape its e-marketing"* is not English, *"lead a
business towards e-marketing"* is.

A slot names the connector set it needs; a frame reaches into it with `{@member}`,
so one set serves the recommended form and its variants, where the same
relationship has to be said in three clause positions.

```
towards   lead: "lead a business towards"   serving: "turns towards"   modal: "may turn to"
changes   lead: "lead a business to change its" ...
```

A right-hand value that fits neither declares a different set. It does not force
every frame to be rewritten, and nothing tries to work the verb out from the value.
A frame whose `{@member}` cannot resolve withholds the shape, like an unresolvable
slot: a student must never be shown a token instead of a sentence.

**A verb is never a slot.** Wrapping *affect* or *lead* in a chip makes the
sentence look fragmented and over-encoded, and a verb is not a value a student
recognises as having come from anywhere. Connecting words are prose in the frame.

## All or nothing

If a resolved slot's binding yields nothing, the whole shape is withheld and the
authored frames stand in. A mint slot rendering empty would tell the student the
app knows something it does not. A subject with no pathways therefore keeps the
old frames rather than being shown a shape with a hole where a known value was
promised.

## The mechanism is not a slot

It is optional metadata. Twenty-three of twenty-eight pathways do not carry a
usable one, and one of them declares positively that a middle step *"would restate
the relationship rather than explain it"*. A shape demanding a mechanism would
contradict its own content on the first screen a student reaches. The student slot
is named for the reasoning, not for a step the author ruled out.

## Examples

Held in `shapes.examples`, keyed by shape, never on a question. One example serves
every question that uses the shape, and a question never authors an answer to
itself.

The guard is mechanical rather than editorial: an example may not contain the live
question's own terms or any area it fixes. No example passing is a normal outcome
and shows nothing rather than the nearest thing. `fills` maps the example's own
words back onto the slots, which is what lets a student see which part is which —
rendered as prose with coloured underlines, because a finished sentence has to read
as a sentence.

## One explanation at a time

Every line in the panel earns its place on its own. All of them at once is the
mini-lesson this panel exists not to be, and three of them explain the same
resolved-versus-student distinction. So they take turns:

| state | what is on screen |
| --- | --- |
| base | the frame, one short explanation, the actions |
| a slot pressed | the frame, that slot's note, the colour key |
| the example open | the frame, the example, its warning |

Pressing a slot closes the example and the reverse, because the shape is something
a student glances at in a few seconds.

## Mint means one thing

Including on the fallback. A legacy frame carries no provenance at all, so every
hole in one is the student's, and they are drawn in the student treatment. A rule
in the old stylesheet drew them in the resolved colour, which on an Evaluate
question made *"your judgement"*, *"main reason"* and *"the qualification"* look
like values the app had already supplied — the exact opposite of what the student
has to do.

Where provenance cannot be established, the answer is the student treatment, never
mint. Provenance is never inferred from prose.

## What is not built yet

- **Only the causal family is authored.** A judgement question falls back to the
  authored frames. That is the honest state, not a silent gap.
- **Only the TEEEC `topic` stage** carries a body shape. Other stages fall back.
- Shapes are authored in `essay-content.js`. They are shaped to be importable, and
  belong in the question-package system when that lands.
