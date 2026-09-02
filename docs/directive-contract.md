# The directive contract

A question's command decides what the student is being asked to do. Everything the
app offers has to stay inside that. This is the contract, and `tests/ui45.js` is
its enforcement.

## The two families

`window.ESSAY.slots.templates.directiveFamilies` is the authority, and the
question's `command` is what selects one. `coreAnswer.mode` is not: it exists on
3 of 19 questions, while every question carries a command.

| family | commands |
| --- | --- |
| causal | explain, how can, how do, how does, describe, outline, analyse, account for, examine |
| judgement | evaluate, assess, to what extent, discuss, critically |

## What the contract says

**An introduction is never handed backward-looking language.** No shape offered at
`thesis` or `methods`, in either family, may contain *Overall*, *In conclusion*,
*This essay has shown*, *Taken together*, *To conclude* or *In summary*. An
introduction has shown nothing yet, and a frame that hands a student those words
teaches them to write the wrong paragraph.

**A causal question is never asked for a verdict.** The conclusion's second slot
keeps the key `judgement` — the key is durable, written into every saved sentence
and shared with the coach worker — but what the student reads follows the family:

| family | label | job |
| --- | --- | --- |
| causal | the answer | answer the question directly, from what the body established |
| judgement | judgement | land a clear, weighed judgement |

**A causal question is never asked to beat an alternative.** *This mattered more
than [the alternative]* is a second claim with its own burden of proof. An
Evaluate question asks for exactly that, so the frame stays in the judgement
family. Explain does not, so it is gone from the causal one. The same applies to
authored `whatToProve` chains.

## How a family gate is enforced

`slotTemplatesFor(key)` resolves a slot's frames against the family, and every
surface that renders a frame goes through it. It used not to: the gate lived
inside `esShapesFor`, and `esSkeletonBlock` read `slotTemplates` directly, so the
ungated frames were served there whatever the directive said. A gate one caller
can walk around is not a gate. (`esSkeletonBlock` is currently unreferenced, so
that path was latent rather than live.)

`esSlotByFamily(slot)` does the same for a slot's `label` and `job`. It never
touches `key`.

Both take the shape `byFamily: { causal: {...}, judgement: {...} }`, and a slot or
template without one is family-neutral.

Under a causal directive, *better* asserts superiority over an alternative even
where no alternative is named, so it is inside the contract and `ui45` fails on it.
Both fields that carry that kind of claim are swept: `whatToProve`, which drives
the guidance, and `learning.chain`, which is read out in the lesson.

## What this contract does NOT cover

Two frames sit outside the three defects this contract was written for, and are
recorded so they are not mistaken for oversights. Both are OFFERED rather than
required, which is the distinction that matters: advanced phrasing a student may
reach for is not the app telling an Explain student that comparison is part of the
task. They stay logged unless a causal route starts requiring them.

- the TEEEC `effect` template offers a trade-off frame (*"although it can reduce
  [the objective it trades against]"*) on causal questions. Naming a counter-effect
  is arguably causal, and the frame is offered rather than required.
- the shared `point` template offers a contrast frame (*"While [the other view]…"*)
  on causal questions.
