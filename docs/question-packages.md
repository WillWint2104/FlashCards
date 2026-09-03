# Question packages

The interchange format a question is authored in, imported from, and validated
against. Nothing here is built into the application yet. This document, the
three packages beside it and the validator that produced their reports are the
things to argue with before the importer exists.

## Why the format exists at all

`essay-content.js` is 203KB of JavaScript object literal holding nineteen
questions, four shared libraries and every scaffold in the writing workspace. It
is a fine place to have got this far and a poor permanent authoring location: it
cannot be reviewed a question at a time, it cannot be written by anyone who is
not editing the application, and a fault in it takes the whole file down.

A package is one question, standing alone, naming what it needs. The application
runtime should be able to hold a registry assembled from packages; the current
file becomes one source of them rather than the place they live.

## The envelope

```json
{
  "format": "marginal.question-package",
  "formatVersion": 1,
  "package": { "id": "bus.mkt-01", "subject": "business_studies", "intent": "guided" },
  "requires": { "vocabulary": [], "concepts": [], "evidence": [], "resources": [], "syllabus": [] },
  "provides": { "vocabulary": {}, "concepts": {}, "evidence": {}, "resources": {} },
  "question": { },
  "pathways": [ ]
}
```

`format` and `formatVersion` are checked first and nothing else is read if
either is wrong. A validator that guesses at a version it does not understand is
worse than one that stops.

`intent` is what the package **claims** it can do for a student, and the
validator holds it to that claim rather than quietly serving whatever it can:

| intent | what a student gets | what the package must carry |
| --- | --- | --- |
| `write-only` | the question, the marking criteria, and a place to write | the question object |
| `guided` | the writing workspace, arguments to choose between | at least one pathway, and every pathway carrying a `meaning` |
| `learn-and-build` | all of the above, plus teaching for a student who does not know the content | authored `learning` on every pathway, complete records for every concept named, a full help ladder on every pathway, sourced evidence, and `question.reasoning` |

Declaring `learn-and-build` and falling short is a **shortfall**, not an error.
The package is well formed; it does not reach the level it says it reaches. The
importer offers to take it at the level it actually reaches, and the author says
yes or goes back to the content. It is never downgraded silently.

## requires and provides

`requires` lists, by library, every shared id this package references.
`provides` carries shared records this package contributes.

`requires` is **generated, never authored**. The exporter computes it from the
refs actually present, and the validator recomputes it and reports
`REQUIRES_MISMATCH` in both directions. A declared dependency list that can
disagree with the package it describes is a second source of truth.

Together they draw the line principle 5 asks for. A package references shared
content and never duplicates it: a vocabulary definition, a sentence shape
example, a reusable teaching record or a study resource lives in a library and
is named by id from as many questions as need it. What a package may do is
*bring* a record the library does not have yet. What it may not do is replace
one it already has: `PROVIDES_CONFLICT` is an error, because a definition three
other questions point at is not this import's to rewrite.

## The question object

**Required.** The application cannot render the question without these.

| field | type | note |
| --- | --- | --- |
| `id` | string | lower case, hyphens, unique in the subject |
| `text` | string | the question as a student reads it |
| `command` | string | the directive verb. It decides the family; nothing else does |
| `marks` | integer | 1 to 40 |

**Optional, and each one turns something on.**

| field | turns on |
| --- | --- |
| `topicRef` or `topicLabel` | the syllabus content panel. A ref where a library has the topic, a label where the subject has no library. Never both |
| `requirements` | the requirement rail: concepts, required areas, relationships, what a full answer accomplishes |
| `areas` | the elements the question names, each with its own writing guides. Pathways attach to these |
| `criteria` | marking criteria. `bands` present without `source` is an error |
| `decode` | the question-decoder panel. Each `highlights[].anchor` must appear in `text` |
| `workingAnswer`, `coreAnswer` | the worked answer the app compares a draft against |
| `reasoning` | which way the argument runs, so the app can notice one running backwards |
| `plan`, `argument`, `connectIntro`, `objectiveWords` | planner and setup copy |
| `focusTerms` | the two terms the sentence shapes bind to. **Not vocabulary**: they carry no meaning and are never displayed as definitions |
| `vocabRefs`, `studyRefs` | the vocabulary and study resource panels |

**Carried today and read by nothing.** `qtype` and `qtypeLabel` are authored on
all nineteen questions and no code in the application, the build or the tests
reads either. The directive contract settled that the command decides the
family; a type letter beside it is a second answer to a question that already
has one. The exporter drops both.

## The pathway object

One argument a student can choose. `id`, `area` (a key of `question.areas`),
`relationship` and `short` are required; `meaning` is required for anything
above `write-only`.

| field | note |
| --- | --- |
| `meaning`, `whatToProve`, `commonMistake`, `mechanism` | what the argument is and how it works |
| `guides`, `help` | the writing guidance and the help ladder. A full ladder is five rungs |
| `learning` | the lesson, for `learn-and-build`. `status` is `authored`, `none-required` or `unreviewed` |
| `syllabusRef` | the syllabus point this argument sits on |
| `conceptRef` | the concept record the Learn button opens |
| `evidenceRefs` | `[{ "id": "...", "why": "...", "limits": "..." }]`. `why` and `limits` belong to this pathway; the record belongs to the library |
| `vocabRefs`, `studyRefs` | as on the question |

## The joins the export had to resolve

Every one of these is prose matching, live in the application today, and the
format replaces all four with ids. None of them is currently broken. That is the
point: they work until somebody rewords a heading.

| join | how it resolves today | in the package |
| --- | --- | --- |
| `pathway.evidence` | a **label**, matched case-insensitively against `BUSCONTENT.evidence[topic][].label`. Two records sharing a label silently become one | `evidenceRefs`, by id |
| `pathway.concept` | a `{topic, section, point}` prose triple, matched by **prefix**: `indexOf(...) === 0`. Nine of the twenty-eight authored triples resolve only that way. "rewards" finds "rewards - monetary and non-monetary, individual or group, performance pay" | `syllabusRef`, one id |
| `learning.concepts` | a bare key hoping `subject.concepts` has it | `conceptRefs`, validated |
| `question.topic` | a display label ("Human Resources") that a **keyword table** guesses a topic key from: four word lists, first match wins, `null` if none hit. Right for all thirteen questions, and still a guess | `topicRef`, one id |

`concept.related` stays prose and is renamed to say so. It renders as "Sits next
to: people, physical evidence, place and distribution", and three of its eight
values happen to be concept keys while five are not. A field that looks like a
ref and is not is the same hazard from the other direction: a ref is validated,
prose is never joined, and the name says which.

## Shared libraries

| library | record | complete when |
| --- | --- | --- |
| `vocabulary` | `{ id, term, plain, subject, example }` | all four written. A partial record is not displayed |
| `concepts` | `{ id, kind, requiresTeaching, oneLine, title, quick, readMore, terms, confusions, example, related }` | `oneLine`, `title`, `quick`; plus `readMore` where `requiresTeaching` is `always` |
| `evidence` | `{ id, subject, topicRef, section, label, fact, use, source, verify }` | `label`, `fact`, `use`. `source` is reported separately: an unsourced item is usable for guided practice and not for a question claiming to teach |
| `resources` | `{ id, label, url, provider, note }` | `label` and `url`. No resource bytes live in this repository |
| `syllabus` | topics, sections, points `{ id, point, what, why, exam, legacyTerms }` | `point`, `what`, `why` |
| `sentenceShapes` | connectors, examples, and the shape library | `family`, `role`, `stage`, `frame`, `why` |
| `slots` | role sets and slot templates, including the directive families | |

`points[].terms` travels as **`legacyTerms`** and the rename is the contract.
Topic matching and the learning allowlist read it; nothing displays it; and it
can never satisfy a `vocabRefs` entry, because a ref names an id and a term
string in a ref position is `VOCAB_REF_NOT_AN_ID`.

`concept.terms` is a different thing wearing the same word: fourteen distinct
`{term, meaning}` pairs that already carry real definitions. They are the
obvious first content for the vocabulary library, which currently holds nothing,
and moving them is content work rather than schema work. Recorded here, not done
here.

## Enums, and where each one is defined

A validator that carries its own copy of a list the content defines will
disagree with the content the first time somebody adds to it. So every enum
comes out of the libraries, and the four the libraries do not define are named
once in `tools/package.js`.

| enum | defined by |
| --- | --- |
| vocabulary roles | `vocab.roles` |
| directives | `slots.templates.directiveFamilies`, flattened |
| structures, sentence shape families, roles, stages, slot keys, connectors | the libraries that hold them |
| `intents`, `learningStatus`, `conceptKinds`, `requiresTeaching` | `CONTRACT_ENUMS` |

Two of these disagree with each other today, and the validator says so rather
than picking one. `answerShapes.commands` names eight commands that are in
neither directive family: **compare, distinguish, identify, list, justify,
recommend, propose, demonstrate**. `esDirectiveFamily` returns `causal` when
nothing matches, so a question commanded "Compare" is scaffolded as a causal
question all the way to submission, with no error anywhere. That is
`DIRECTIVE_NO_FAMILY`, and it is a warning rather than an error only because it
describes content that already ships.

`requiresTeaching` is authored as the boolean `true` and as the string
`"contextual"`. A field with two types is an unknown-enum fault waiting to
happen: the first version of the manifest read `"contextual"` as truthy and
reported three complete concepts as incomplete for want of a `readMore` section
they were never meant to have. It becomes `always | contextual | never`.

## Validation

Four severities, because the person reading the report does something different
for each.

| severity | means | imports |
| --- | --- | --- |
| `error` | the package is wrong | no |
| `blocked` | the package is right and the library is not ready | no, and there is nothing in the package to fix |
| `shortfall` | well formed, and below the intent it declares | at the intent it reaches, once the author agrees |
| `warning` | worth recording | yes |

**Nothing is written before the whole package has been read.** Parse, then
structure, then enums, then refs, then the library, then the contract rules,
then the intent. Every check runs; none short-circuits. A report that says one
error when there are nine is the same failure as a green aggregate whose checks
never executed.

### The five distinctions, kept apart

| code family | the fault | who fixes it |
| --- | --- | --- |
| `*_REF_UNKNOWN` | a ref names an id that exists nowhere, and was not declared | the author, in the package |
| `*_RECORD_PARTIAL` | the record exists and is half written | whoever writes content |
| `VOCAB_REF_NOT_AN_ID`, `FIELD_TYPE`, `FIELD_CONFLICT` | the ref or field is the wrong shape | the author |
| `*_UNKNOWN` on a value | outside a list the libraries define | the author, or the library gains the value |
| `DEPENDENCY_ABSENT` | declared, well formed, and the library has not caught up | nobody, in this package |

The last two rows are why `ref()` defers. An id that is **declared in
`requires`** and absent from the library reports only `DEPENDENCY_ABSENT`; the
same absence **undeclared** reports `*_REF_UNKNOWN` and `REQUIRES_MISMATCH`.
Reporting both for one id would say the same thing twice under two headings and
hide which of the two it actually is.

### Codes

**Envelope** `PACKAGE_NOT_JSON` · `PACKAGE_NOT_AN_OBJECT` · `FORMAT_UNKNOWN` ·
`FORMAT_VERSION_UNSUPPORTED`

**Structure** `FIELD_MISSING` · `FIELD_TYPE` · `FIELD_CONFLICT` ·
`ID_MALFORMED` · `ID_DUPLICATE_IN_PACKAGE`

**Enums** `INTENT_UNKNOWN` · `DIRECTIVE_UNKNOWN` · `DIRECTIVE_NO_FAMILY` ·
`VOCAB_ROLE_UNKNOWN` · `LEARNING_STATUS_UNKNOWN`

**Refs** `VOCAB_REF_UNKNOWN` · `VOCAB_REF_NOT_AN_ID` · `CONCEPT_REF_UNKNOWN` ·
`EVIDENCE_REF_UNKNOWN` · `RESOURCE_REF_UNKNOWN` · `SYLLABUS_REF_UNKNOWN` ·
`AREA_REF_UNKNOWN` · `PATHWAY_AREA_UNKNOWN`

**Records** `VOCAB_RECORD_PARTIAL` · `CONCEPT_RECORD_PARTIAL` ·
`EVIDENCE_RECORD_PARTIAL` · `RESOURCE_RECORD_PARTIAL` · `SYLLABUS_RECORD_PARTIAL`

**Libraries** `DEPENDENCY_ABSENT` · `REQUIRES_MISMATCH` · `PROVIDES_CONFLICT`

**This app's rules** `MARKS_OUT_OF_RANGE` · `BANDS_WITHOUT_SOURCE` ·
`HIGHLIGHT_ANCHOR_ABSENT` · `EM_DASH_IN_STUDENT_TEXT`

**Intent** `SHORTFALL_NO_PATHWAYS` · `SHORTFALL_PATHWAY_NO_MEANING` ·
`SHORTFALL_NO_TEACHING` · `SHORTFALL_CONCEPT_UNEXPLAINED` ·
`SHORTFALL_NO_LADDER` · `SHORTFALL_EVIDENCE_UNSOURCED` ·
`SHORTFALL_NO_RECOVERY` · `INTENT_UNDERSTATED`

## Readiness

Seven dimensions, each reported on its own. One number would hide the thing
worth knowing: `bus.mkt-01` is fully guided and has **no sourced evidence at
all**, and a single score would average that away.

| dimension | question it answers |
| --- | --- |
| guidance | do the pathways say what the argument means? |
| teaching | do they carry a lesson for a student who does not know the content? |
| concepts | is every concept this question names explained somewhere? |
| ladders | is the help deep enough to climb? |
| evidence | does any evidence carry a source? |
| vocabulary | of the terms asked for by name, how many have complete records? |
| recovery | can the app notice an argument running backwards? |

Measured from the package, never declared in it. The numbers for `bus.mkt-01`
are cross-checked in `tests/t18.mjs` against `tools/coverage.js`, which computes
the same question from `essay-content.js` by an entirely separate path. Two
tools agreeing is what says the export lost nothing.

## The three packages

    packages/bus.mkt-01.guided.json          generated, 65KB, accepted
    packages/anc.ah-religion.write-only.json generated, 1.7KB, accepted
    packages/invalid-demo.json               authored to be wrong, rejected

The first two are produced by `node tools/package.js export <subject> <id>` from
the questions that ship today, so the format is proved against real content
rather than against an example written to fit it.

The third produces 22 errors, 2 blocked, 6 shortfalls and 1 warning: one of each
kind of fault, so the report has to keep them apart rather than counting them.
`tests/t18.mjs` asserts every planted code is reported and that the four
severities stay distinct, and removing any planted fault makes that suite fail.

## Open questions

1. **Em dash severity.** `EM_DASH_IN_STUDENT_TEXT` is a warning. The house rule
   is firm, so it could be an error; no content currently violates it, so
   raising it costs nothing today. Which?
2. **`concept.terms` migration.** Fourteen real definitions live inside concept
   records while the vocabulary library holds none. Move them, or leave concepts
   owning their own terms and let the vocabulary library be for what a question
   names directly?
3. **`DIRECTIVE_NO_FAMILY`.** Eight commands with an answer shape fall through
   to causal. Author judgement-family entries for them, add the missing families,
   or narrow the answer shape list?
4. **Sentence shapes are causal only.** Six shapes, all `family: "causal"`.
   `esShapeFor` matches the family exactly, so a judgement question resolves no
   shape and the panel is withheld. Correct behaviour, and a readiness gap
   nothing currently reports. Should shape coverage be an eighth dimension?
5. **Package granularity.** One question per package, or a pack of questions
   with one shared `requires`? One per question is assumed above.
