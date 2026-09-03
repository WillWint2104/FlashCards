# Vocabulary

Terms that have a meaning, asked for by name.

## Two rules

**Nothing is found by scanning prose.** A term reaches a student because a
question, an argument or an area named it, the same way study resources and
sentence shapes resolve.

**Undefined vocabulary is never displayed.** A chip carrying a word and no meaning
is worse than an empty panel: a student cannot tell a term the app is teaching from
a word somebody typed next to a heading.

## Still broken elsewhere

The rule is **do not display undefined vocabulary**, and this document is about one
tool. `esHintHTML` (app.js:8528) still renders the same `points[].terms` strings as
`.es-hintterm` chips on the **full-attempt screen** — 477 of them, undefined, in
green. Vocabulary v1 removed the pattern from the writing tool and not from the app.

It is recorded here rather than fixed because the two ways out are a product
decision: delete the chips, or author 477 records. Neither belongs in a branch that
was deliberately kept clear of content authoring.

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
vocabulary 0 refs requested / 0 defined / 0 missing
```

Until a record resolves the tool is **absent**, not disabled. A disabled control is
still the app showing a student a piece of itself that is not finished, and asking
them to read about an authoring backlog they have no part in.

Absent means absent everywhere it could be reached from, not only the belt: the
tool window offers no vocabulary tab, and the stuck helper's "Words this sentence
needs" row is closed with a reason. A door the belt hides is not hidden if another
route still opens it.

| resolved records | what the student gets |
| --- | --- |
| 0 | no vocabulary control anywhere |
| 1 or more | the control appears and opens on those records |

Undefined refs stay invisible to the student in both cases, and visible to the
readiness report in both cases:

```
vocabulary 6 refs requested / 4 usable, 2 unusable (1 naming no record, 1 half-written), 1 with an unknown role; store 5 records, 1 partial
```

The line only says what is wrong, so a clean run stays short. It reports the three
ways a ref can fail SEPARATELY, because they are opposite jobs to fix: a ref naming
no record is a typo or a deleted record; a half-written one was started and not
finished; and a ref whose role is not one of the four still works, because the
runtime re-buckets it, which is exactly why the author would otherwise never learn
they mistyped it.

It also reports the store's own state whether or not anything references it. Fifty
records with a blank field used to print the same line as fifty records that do not
exist, and as no records at all.

The empty-state copy is kept for the states that can still reach it, and asserted to
still exist rather than being deleted.

**This rule is currently Vocabulary's alone.** The other tools still render disabled
when they have nothing, which `tests/ui12.js` asserts deliberately. The two
behaviours disagree, and which one is right for the rest of the belt is a decision
that has not been made.
