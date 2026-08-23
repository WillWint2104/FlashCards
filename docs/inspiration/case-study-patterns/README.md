# Case study patterns

A different job from `../references/`.

| layer | answers |
| --- | --- |
| `references/` | what does the student need to **understand** |
| `case-study-patterns/` | what shape does a good case study **argument** take |
| the evidence bank | what can the student safely **assert** |

## The rule

**Kathmandu is instructional guidance. McDonald's is the student-facing case
study and the evidence bank.**

The textbook ships four Kathmandu case study chapters. They are the best worked
demonstration available of how a business decision is connected to a syllabus
concept, at what level of specificity, and with what kind of evidence. That is
what we take from them.

We do not take their facts. Nothing about Kathmandu enters the evidence bank,
appears to a student, or is offered as an example. The student group's case
study is McDonald's, and the app should show them McDonald's throughout.

Concretely, from each useful section we extract only:

```
business decision -> strategy or process -> business effect -> syllabus concept -> possible HSC use
```

and then ask one question:

> What **verified** McDonald's evidence could demonstrate this same type of
> syllabus relationship?

## Not transferring

A Kathmandu fact is never converted into a McDonald's fact. If Kathmandu
sponsored an event and McDonald's has no comparable verified sponsorship, the
answer is an **evidence gap**, recorded as one. It is not an invitation to assume
McDonald's does something similar because most large businesses do.

A smaller verified evidence bank beats a comprehensive-looking one with weak
mappings, because a student is marked on what they assert.

## Not architecture

Patterns are candidates, not requirements. A pattern is only worth carrying into
the app where verified McDonald's evidence genuinely demonstrates the
relationship. Where it does not, the pathway keeps its other layers (argument,
Learn, guidance, the help ladder) and simply has no evidence attached, which the
app already handles: unsourced items are withheld rather than shown with a
warning.

## Status vocabulary

| status | meaning |
| --- | --- |
| `mapped` | an existing McDonald's bank record demonstrates this relationship |
| `partial` | a record touches it but does not establish the causal step the pattern needs |
| `gap` | no McDonald's record covers it; nothing has been invented to fill it |

Nothing here is sourced evidence. Sourcing happens against the bank in
`business-content.js` under the rules in `EVIDENCE-SOURCES.md`.
