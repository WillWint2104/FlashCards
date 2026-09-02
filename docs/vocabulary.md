# Vocabulary

Terms that have a meaning, asked for by name.

## Two rules

**Nothing is found by scanning prose.** A term reaches a student because a
question, an argument or an area named it, the same way study resources and
sentence shapes resolve.

**Undefined vocabulary is never displayed.** A chip carrying a word and no meaning
is worse than an empty panel: a student cannot tell a term the app is teaching from
a word somebody typed next to a heading.

## What this replaced

`BUSCONTENT` holds 405 distinct term strings across 83 section points. The tool
rendered them as chips. There is no glossary, no definitions object, and nothing
anywhere that says what any of them means — so every one of the 405 was shown to a
student undefined. They are still in the content and no longer drive this tool.

## A record

```
{ id, term, plain, subject, example }
```

Four fields, not one gloss. `plain` is what the word means in English; `subject` is
what it means in this course, which is often narrower; `example` is the term doing
its job in a sentence, because knowing a definition and being able to use one are
different things.

**A record resolves only when all four are present.** A partial record is a term
with a gap where its meaning goes, which is the thing this exists to prevent.

## A ref

```
{ id, role: "relationship-support" | "strategy-example"
         | "outcome-evidence"     | "topic-context" }
```

The role is what the term is FOR where it was asked for, so the panel groups by job
rather than alphabetically. Refs resolve nearest first: the argument the student
chose, then the area this paragraph covers, then the question. A ref naming a
record that does not exist, or an incomplete one, never becomes a row — it is
counted so the build can report it, and shown to nobody.

An argument may author an empty `vocabRefs`. That is a decision, not missing data,
and it is honoured: the question's own refs still apply.

## Nothing here writes

There is no control in the panel that inserts a term into a sentence, and
`tests/ui47.js` asserts there is none rather than assuming it.

## Empty on purpose

The store ships with no records. Authoring 405 HSC definitions is content work, so
the build reports the gap instead of the app hiding it:

```
vocabulary 0/0 asked-for terms have a meaning (none defined yet)
```

Until a record exists the tool is disabled on the belt, and the panel says which
kind of empty it is: no meaning has been written yet, not that this question has no
terminology.
