---
title:   The pathway is the lesson
date:    2026-08-22
status:  built and frozen
governs: the Learn tool, the pathway cards, the evidence drawer, short answer
---

## The problem with the learning area as it stands

The architecture is now good at answering **what help does this student need**.
It is not yet designed around the harder question:

> How do we teach that thing in 20 to 60 seconds without the student feeling they
> have stopped writing and started studying?

Today Learn is a drawer containing explanation. A student who needed reminding
what liquidity means should not have to read a definition, its importance, the
objectives, the ratios, the strategies and a case study before returning to their
sentence.

## The decision

**The pathway becomes the primary instructional unit.** Not a concept, not a
drawer, not a router deciding which snippet to inject. The student chooses a
defensible way of answering the question, and the app teaches exactly what is
needed to understand that answer well enough to write it.

```
question → see valid pathways → choose one → learn that pathway → choose evidence
        → write it → the working answer develops → what would strengthen it next
```

The choice is not friction. It is part of answering the question, and it gives
the learning a purpose.

## Before the choice, and after it

**Before selection, teach only enough to tell the options apart.** Each card
carries a plain-English line and a "good choice if", so a student with no basis
for choosing gets one without having to learn both pathways deeply.

> **Cash flow management → liquidity**
> In plain English: changing when money comes in and goes out can help the
> business have enough cash when bills fall due.
> Good choice if: you want to write about the timing of payments.

**After selection, teach that pathway properly**, as one coherent chain rather
than six isolated atoms:

1. **What you need to know** — the two or three terms, in a sentence each
2. **How they connect** — the causal chain, revealed a step at a time
3. **What this means for your answer** — what you now have to explain
4. **Evidence** — a verified item, with the fact and the explanation held apart
5. **Use it** — straight back into the paragraph

## Progressive depth, and the right to leave early

| layer | purpose | size |
| --- | --- | --- |
| **Know** | enough to continue | 1 to 3 sentences and a small visual |
| **See** | what it looks like | example, relationship, misconception |
| **Try** | check I have it | one micro-decision |
| **Explore** | I genuinely need teaching | fuller, textbook-informed |

Only **Know** opens automatically. A student who needed a reminder may leave
after it. That is the rule the current drawer breaks.

## The causal chain becomes a reusable component

```
Training → employees become more capable → productivity rises → performance improves
Cost controls → expenses fall → more revenue retained → profitability improves
Values convenience → ordering changes → buying gets easier → experience improves
```

Weak learners need cause and effect made visible, and the chain is also the thing
the paragraph has to say. The directive decides the shape of the visual:

| directive | visual |
| --- | --- |
| Explain / Analyse | a chain: cause → mechanism → effect |
| Evaluate / Assess | a scale: benefit, how strong, what limits it, overall |
| Compare | two columns with a shared basis |

So the learning area teaches the reasoning structure the command word demands,
not only the content.

## Rules the build must keep

- **Understand, then name.** Lead with "what customers can see or experience when
  receiving the service", and introduce `servicescape` underneath it. Never the
  reverse. The support report already counts every term named and not explained.
- **Every learning interaction ends in a bridge back to the task.** Not *Close*
  but *Use this in my paragraph*, *Choose my argument*, *Back to my explanation*.
  The student should always know why they just learned that.
- **We teach the reasoning; they construct the response.** Pathway learning may
  say what the relationship is and why it holds. It never volunteers the prose
  for the sentence in front of the student, and it never writes into the draft.
  The writing ladder remains the only thing that helps with sentences. This is
  narrower than, and consistent with,
  `docs/inspiration/decisions/2026-08-19-model-answers-on-request.md`: an
  authored model paragraph may still be shown when a student explicitly asks to
  see one, on its own surface, never inserted and never unrequested.
- **Selections are provisional.** *Try this argument*, never *Lock in*. A student
  who learns the pathway and decides they understand the other one better should
  switch without losing what they wrote.
- **No learning surface contains more than the student needs for the next
  decision.** Depth is one press away, never in the way.

## Authoring stays modular; the experience does not

The student meets one coherent argument lesson. Underneath, concepts, chains,
misconceptions, examples, evidence and checks stay reusable atoms, and the
pathway decides which parts of each matter here.

```
pathway
  short, meaning, adds, contribution
  learning
    concepts[]        which terms, and which part of each matters here
    chain[]           the steps, for the visual
    misconception     the contrast worth drawing, as two short lines
    example           a different context, so the shape transfers
    check             one micro-decision, with the reason it is right
  evidence[]
  guides, help
```

## Short answer is the same idea, smaller

For a 3 to 5 mark question there is no drawer at all. The pathway *is* the
lesson: choose it, the card expands into understand → why it affects the
objective → now write. One concept, one relationship, one immediate application.

## How this gets tested

The bots score each learning interaction on four things, not on whether a
resource existed:

- **comprehension** — could the student use the concept afterwards
- **actionability** — could they do something with it immediately
- **efficiency** — how much did they read before succeeding
- **transfer** — could they use it in a slightly different situation

The target for a Learn & Build ready question is `UNSUPPORTED_DEMAND: 0`.

## The end state

A student who knows nothing opens the learning area and thinks

> Oh, that is what it means. I can do this part now.

rather than

> Now I have another lesson to study before I can answer the question.
