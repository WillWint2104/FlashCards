---
title:      The missing middle, and three learning systems
date:       2026-08-19
status:     active
governs:    guided mode, the concept layer, the pathway layer, marking
---

## The gap the walkthrough exposed

The app has a strong writing engine and a sophisticated final evaluation layer,
and a hole between them:

```
learn the content  →  ?  →  write  →  ?  →  AI marking
```

The composer teaches **how to construct the line**. It does not always teach
**what the answer actually is**. AI marking arrives too late, and potentially too
slowly, to be the main way a student finds out whether their thinking was right.

## Three learning systems, not two

| System | Answers | Exists? |
| --- | --- | --- |
| **Learn** | what does this content mean | yes, but only Processes is authored |
| **Compare** | what does an acceptable answer to this exact task look like | **missing** |
| **AI mark** | how good is my particular response | yes |

Compare must be authored, instant, deterministic and available throughout guided
mode. No model call.

## Start by teaching the question

Before planning, a compact **understand the question** state. The stem becomes
interactive:

```
[EXPLAIN] how [TARGET MARKETS] affect [E-MARKETING] [PEOPLE] [PROCESSES] [PHYSICAL EVIDENCE]
```

Each highlighted part is clickable. *Explain* says it means show how or why, and
that cause and effect is required rather than description. *Target markets* says
it is the cause in the question. *Processes* says it is one of four effects that
must be covered.

Then one compact `Plain English` control:

> Show how knowing who the customers are changes the way a business uses
> e-marketing, employees, service processes and physical evidence. For each one,
> explain the customer characteristic to strategy relationship and support it
> with the case study.

Most of this already exists in the question's authored `requirements`. Expose that
authored intelligence rather than inventing a parallel logic. Test mode's
answer-shape system is the beginning of this philosophy; guided mode should take
it further and make it question-specific.

## Split thesis understanding from thesis writing

The thesis is effectively the basic answer to the question, so asking a student
to choose four body pathways before they understand it is the cart before the
horse. But do not make them write and lock a final thesis sentence first either.

Before the body plan, show the **core relationship**:

> Target market characteristics cause marketing strategies to adapt to those
> customers.

Then progressive support: `I understand, continue` · `Give me a thesis
structure` · `Show me an acceptable thesis`.

Write the polished thesis sentence **after** the response plan is set, so the
introduction genuinely signposts the essay the student chose.

## Then the response map

```
overall answer established
  → e-marketing, choose relationship
  → people, choose relationship
  → processes, choose relationship
  → physical evidence, choose relationship
  → choose evidence for each
  → choose paragraph sequence
  → write the introduction
```

The existing plan architecture is close. This adds a question-understanding and
overall-answer stage in front of it rather than replacing it.

## Learning layered by where the student is

Instead of one resolver hunting for the relevant textbook fragment, four authored
levels:

| Level | Teaches |
| --- | --- |
| question | why would identifying a target market affect marketing strategy at all |
| area | what is e-marketing, people, processes, physical evidence |
| pathway | why would digitally engaged customers lead to greater use of e-marketing |
| evidence | what does this fact actually show, and what may it legitimately prove |
| line | how do I express that reasoning in this sentence *(exists)* |

The chain: what is the question → what is the concept → what is my argument →
what evidence proves it → how do I write it.

The authored Processes resource is the template. Build equivalents for target
markets, e-marketing, people and physical evidence, each with a **for this
question** block, so *People* teaches not only that people means employees in
service delivery but that expectations for speed, expertise, friendliness or
consistency change the skills, training, rostering and service standards
required.

## Every pathway carries teaching

Required on all of them, not just the strongest:

* **relationship** the one-line selectable argument
* **what this means** two to four sentences teaching the reasoning
* **what you need to prove** the causal chain
* **common mistake** what students describe instead of explain

That makes `Ideas` educational rather than a selector.

## Compare

After a thesis or a paragraph, the student's only meaningful check must not be
"send it to the model and wait".

```
Your thesis            [their sentence]
One acceptable thesis  [authored]
What to notice         ✓ answers the relationship directly
                       ✓ puts target market as the cause
                       ✓ covers all four required elements
                       ✓ tells us what the essay will explain
                       Keep mine   |   Revise mine
```

At paragraph level the app already knows the chosen pathway, so it knows exactly
which reference paragraph to show. The reference should be a **mid-level
competent paragraph, not a Band 6 exemplar**, because the first learning question
is "have I basically built this correctly", not "why am I not writing like a
professor". An optional `show why this paragraph works` can annotate point,
knowledge, explanation, evidence, connection.

Compare should be available **before** writing too, for a student who genuinely
cannot begin. This is a learning mode, not an integrity test. The system must
never insert the answer automatically.

## The philosophy correction

Three different things:

1. giving the answer automatically — bad
2. making the answer available as teaching content when requested — good
3. requiring the student to understand, select, adapt and write their own
   response after seeing it — exactly what guided mode should do

The architecture currently overprotects ownership to the point where a student
can be coached on how to phrase an idea they do not understand.

> Guided mode should never force a student to remain ignorant in order to
> preserve independence. It should make the correct content, reasoning and
> acceptable response models easy to access, while keeping the act of
> constructing the response with the student.

The sentence ladder keeps its existing rule: it never supplies the student's own
sentence. The relaxation applies to the learning layers, on explicit request.

## The canonical stem rule

All question decoding, plain-English explanation, thesis guidance and comparison
answers must use the **exact live exam stem** as canonical, never a generic
matched practice-question text. Without this rule the new layer could quietly
broaden a constrained question.

> **Resolved since this brief was written.** At the time, `mkt-01.text` was the
> broader "Explain how target markets influence the development of marketing
> strategies" while its requirements and pathways were built around the four-part
> paper question. `mkt-01.text` is now the exact paper stem, "Explain how target
> markets affect e-marketing, people, processes and physical evidence", and the
> broader wording became `mkt-04`, a separate question with no authored pathways.
> See `docs/inspiration/decisions/2026-08-19-canonical-stem.md`, which is the
> authority; this paragraph is kept for the reasoning, not the current state.

## Data model, evolved rather than bolted on

```
question
  exactStem
  decode        verb, verbMeaning, highlightedParts, plainEnglish, mandatoryCoverage
  coreAnswer    meaning, thesisFrame, acceptableThesis
  areas[]       learning
  pathways[]    relationship, meaning, whatToProve, commonMistake,
                conceptRef, evidenceRefs[], guides, help, acceptableParagraph
  comparison    thesisChecklist, paragraphChecklist
```

None of it generated by a model during student use. It is authored teaching
content.

## Implementation sequence

```
question decode → core answer / thesis → response map → area and pathway learning
→ composer → instant compare → AI marking
```
