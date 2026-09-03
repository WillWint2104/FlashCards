# Getting the questions out of source

`essay-content.js` is 203KB of object literal holding nineteen questions, the
shared libraries they draw on and every scaffold in the writing workspace. It is
a fine place to have got this far and a poor permanent authoring location: it
cannot be reviewed a question at a time, it cannot be written by anyone who is
not editing the application, and one fault in it takes the whole file down.

This is how it stops being the authoring location. Nothing in it has happened
yet beyond stage 1.

## Stage 1 - the transform exists, and nothing depends on it

**Done.** `tools/contract/packagize.js` converts every question in the bank into
a package and `tools/contract/validate.js` reports on it. Both read; neither
writes anywhere except `docs/contract/`. The application does not know they
exist.

The value of this stage is that it is a probe. Converting real content found
five things nothing else had:

- `qtype` and `qtypeLabel` authored on all nineteen questions and read by nothing
  in the app, the build or the tests;
- `requiresTeaching` authored as the boolean `true` and as the string
  `"contextual"`, which made a manifest that read it as a boolean report three
  complete concepts as incomplete;
- `contribution.role` authored as `conditional` against a schema that guessed
  `condition`, which the fixtures caught the moment `hr-01` ran;
- `tools/coverage.js` measuring `Object.keys(help).length >= 5` and calling it a
  full ladder, so a pathway with one slot and a complete five rung ladder read as
  not having one. Fixed here: 3 of 28 becomes 4 of 28;
- nine of the twenty-eight pathway concept triples resolving only by prefix.

## Stage 2 - the loader reads packages

The application gains a loader that assembles its registry from packages, and the
bundled questions become packages the loader reads at build time. `essay-content.js`
keeps the shared libraries and the engine's own scaffolds; the questions move out.

The test is that nothing changes on screen. The nineteen packages already
generated are the fixtures for it: the loader is correct when the application
built from them is byte-identical to the application built from source today.

Bundled and imported questions use the same loader from this point. Decision 7
already requires one namespace for both, so there is no second code path to keep
in step.

## Stage 3 - the shared libraries move

Vocabulary, concepts, lessons, evidence, syllabus nodes and resources move out of
`essay-content.js` and `business-content.js` into the library files, which are
already generated at `docs/contract/shared-libraries.json`.

Two things have to happen inside the application at this stage, and both are
runtime work rather than format work:

**The concept surface reads vocabulary refs.** `esConceptFor` renders
`c.terms` as label and meaning pairs today. It reads `vocabRefs` instead, and the
fourteen records already migrated are what it resolves. Nothing changes on screen:
the same fourteen terms with the same fourteen meanings, from one library instead
of from inside six concept records.

**The four prose joins are removed from the engine**, not merely unused by
imported content: the evidence label match, the concept prefix match, the bare
concept key and the topic keyword table. Until they are gone, bundled content can
still reach a student through a route no imported package is allowed to use, and
two kinds of question behave differently for reasons nobody can see.

## Stage 4 - the importer

Only after stages 2 and 3, because an importer that writes into a registry the
application does not yet read from is a feature with nothing behind it.

The order inside it is fixed by decision 18: parse the whole set, validate the
whole set, resolve the whole set, show a preview of every question and every
shared record that would change, and only then write. A package that cannot be
published in full is not published in part.

## What migrates, and what is dropped

| in source | in a package |
| --- | --- |
| `q.topic` display label | `question.topicRef`, or `topicLabel` where the subject has no syllabus library |
| `q.term1` / `q.term2` | `question.terms.first` / `.second` |
| `q.command` | `question.directive`, lower case, and it must be in a family |
| `q.argument` | `question.overallArgument` |
| `q.connectIntro` | `relationship.intro` |
| `q.plan[]` | `relationship.claims[]`, with the ends stated rather than split out of the line |
| `q.criteria` | `marking.bands` and `marking.bandSource` |
| `pw.fromLabel` | `pathways[].left` |
| `pw.meaning` | `pathways[].choiceMeaning` |
| `pw.guides` + `pw.help` | `pathways[].guidance.<slot>.{direct, ladder}` |
| `pw.concept` triple | `pathways[].syllabusRef` |
| `pw.concept.key` | `pathways[].conceptRef` |
| `pw.evidence[]` labels | `pathways[].evidenceRefs[].ref` |
| `pw.learning` block | a lesson record, referenced by `learningRef` |
| `concept.terms[]` | vocabulary records, referenced by `vocabRefs` |
| `concept.related[]` | `relatedLabels`, renamed because it is display prose and always was |
| `points[].terms[]` | `legacyTerms`, which nothing displays and no ref can name |
| `q.qtype`, `q.qtypeLabel` | dropped: nothing reads them |
| `q.objectiveWords` | dropped: claim right-hand ends are explicit |

## What a package cannot yet say

Recorded so that authoring against v1 does not quietly lose it.

- **Criterion ids.** 63 claim right-hand ends are labels with no id, because no
  criterion registry exists. `criterionRef` is `null` and counted, never guessed.
- **Evidence roles.** 25 references carry none. A role is authored, never
  inferred from which topic a record was filed under.
- **Twelve plan lines** state no right-hand end at all, because they are section
  names rather than relationship claims. Those are content to rewrite, not a
  field to add.
