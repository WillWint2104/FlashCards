# QuestionPackage v1 — decisions

Decisions taken on the design, in the order they were settled. Recorded here
because a decision that lives only in a conversation gets re-litigated by the
next person to read the schema.

Nothing in this file is implemented. The schema has not been changed to match
it yet: six further decisions are open, and changing the format around half a
set of answers is how a format ends up incoherent.

## Locked

**1. Complete reusable teaching does not live inside a question package.**
A pathway may reference teaching; it may not contain a lesson. The four
pathway-local `learning.status: "authored"` lessons on `mkt-01` move into the
shared content library and are referenced by stable id. The exception is not
preserved on the grounds that it currently exists.

The boundary is:

    QuestionPackage  ->  references conceptRef / learningRef
    SharedContent    ->  owns definitions, lessons, examples, diagrams, vocabulary
    Engine           ->  owns how those are displayed and used

**2. Evidence roles are authored, never inferred.**
The 22 existing references that carry no role stay `null`. A missing role is a
readiness fact, not an import blocker: a package can be structurally valid and
pathway-guided with unresolved roles, and cannot reach the evidence-complete
dimension without them. The vocabulary is:

    relationship-support
    strategy-example
    outcome-evidence
    topic-context

No role is ever derived from topic proximity or from prose. More roles may be
added later; none is defaulted.

**3. The evidence publication requirement stands as it is.**
0 of 58 records carry both a source and a verification, so no package can reach
the evidence-complete dimension today. That is the validator telling the truth
about the content. The requirement is not weakened to make the top state
reachable.

**4. Prose-prefix and display-label joins are not acceptable package
identifiers.** An external package cannot depend on `"training and development"`
matching the start of `"training and development – current or future skills"`,
nor on an evidence record's display label. Canonical ids are required:

    "conceptRef":  "business.hr.strategies.training-development"
    "evidenceRef": "mcdonalds.operations.standardised-production-01"

Legacy aliases, old prefix to canonical id and old label to canonical evidence
id, exist only as a migration compatibility layer. They are not part of the v1
authoring contract and are not documented in the authoring guide.

**5. The Learning centre's plan-line parsing does not survive into the format.**
Splitting a plan line on the word "to" and matching the right-hand side against
the six Operations performance objectives is exactly the inference this work
exists to remove. The package states the relationship instead:

    { "leftRef": "business.finance.strategies.working-capital",
      "relationship": "supports",
      "rightRef": "business.finance.objectives.liquidity" }

Final naming to be settled with the remaining schema decisions.

**6. Readiness is capability-based, not one scalar.**
Six independent dimensions, reported separately:

    importable
    writing-ready
    pathway-guided
    learning-complete
    assessment-complete
    evidence-complete

with a friendly headline derived from them, such as
`Guided — learning complete, evidence incomplete`. `fully-authored` remains the
aggregate state when every required dimension passes. The point is that the two
guided tiers already in the bank, `mkt-01`/`fin-01`/`hr-01` with areas, per-area
guides, bands and thesis help against `ops-02`/`hr-02`/`mkt-03` without them,
must not report as identical.

**7. One canonical question-id namespace, for bundled and imported alike.**
A collision is an import-blocking error in v1 and never an implicit overwrite:

    Question id "mkt-01" already exists.

Where a question came from is metadata beside the id, not part of it, and lives
in `origin`. Update and replacement semantics are a later design; they are not
smuggled into first import.

**Where the check lives, and why not in the validator.** `validate(pkg, man)`
reads a library manifest, which holds shared records and no questions. That is
not an oversight to be corrected by handing it the bank. A colliding package is
STRUCTURALLY VALID, and reporting the collision as a schema error would tell an
author their correct file is malformed and send them to fix nothing.

The check belongs to the stage that knows the destination, and that stage is
`tools/contract/admit.js`:

    validate   is this file a valid package                 library manifest
    resolve    do the things it names exist                 shared libraries
    admit      does the destination have room               question registry

`QUESTION_ID_ALREADY_EXISTS` is raised at the review stage, against the
destination registry, and carries the subject that holds the id. A package can
be unpublishable for reasons from more than one stage at once, so the reasons
are a list and none is folded into another. `admit.plan()` is the only producer
of a publish set, it refuses to run without a registry rather than defaulting to
an empty one, and `admit.writes()` re-runs the check against the registry as it
is at that moment, so a plan is evidence the check ran and never permission to
skip it. `tests/t20.mjs` is the regression, including the seven bad
implementations it is written to catch.

**8. Areas are question-local, and are never validated by vocabulary matching.**
An area has its own stable question-local id and an authored label, and the
label may be whatever the question genuinely needs. If the author claims a
syllabus relationship, it is stated as explicit `syllabusRefs` and those must
resolve. So:

    custom area, no syllabus ref                -> valid
    custom area, resolving syllabus ref         -> valid
    custom area, non-existent syllabus ref      -> error
    label not found verbatim in syllabus text   -> nothing; not even a warning

Matching a label against syllabus prose is the inference this work exists to
remove, and it is not reintroduced in the validator.

**9. The ten write-only questions are exported at their current capability.**
No pathways authored, no support manufactured, nothing enriched to make them
look guided. Their readiness report says plainly what they are. They become the
fixtures that prove a valid package can honestly sit at a write-only capability,
and the long-term target is that bundled and imported questions use the same
loader rather than maintaining a second hard-coded bank.

**10. Authored meaning is preserved; legacy field names are not.**
A singleton property does not become a first-class v1 field because one question
uses it. Each was audited by what it does:

| legacy | what it actually is | v1 |
| --- | --- | --- |
| `mechanism` | the authored middle step of a relationship | formal field, `{ status, text, note }` |
| `help` | a five rung escalating support ladder per slot, 99 rungs across 4 pathways | merged with `guides` into `guidance.<slot>.{direct, ladder[]}` |
| `fromLabel` | the authored cause end of the relationship, explicitly never derived | `pathway.left.{label, conceptRef}` |
| `connectIntro` | what this question's two ends ARE, replacing a synthesised sentence that is only true of Operations | `relationship.intro` |

None of the four is renderer-only. `help` in particular is 99 authored rungs of
graduated support, and `fromLabel` carries a comment in the engine saying it is
never derived from `short` or `relationship`, which is precisely the property
that makes it semantic rather than presentational.

## Locked in the second pass

Taken after the vocabulary work shipped, and after the format was built once and
checked against the content. Where one of these changes a decision above, it says
so.

**11. Vocabulary has one authority.** Concept records owned fourteen
`{term, meaning}` pairs with real definitions while the vocabulary library held
nothing. The pairs become vocabulary records; a concept points at them by
`vocabRefs`. A record is complete when it has a term and a course meaning, and
`displayable` when it also has a plain meaning and an example. The Learn
surface needs the first; the vocabulary panel needs the second. One library with
two consumers, reported as two states, rather than two libraries.

**12. An unknown vocabulary role is a validation error.** The runtime re-buckets
one defensively into `topic-context` and may go on doing so. Imported content may
not lean on that: runtime fallback is not valid authored content, and an author
who wrote `key-term` is told they did.

**13. Missing record, partial record, bad ref, unknown enum and unresolved
dependency are five different answers.** Never one count. The validator declines
to report an absence twice: declared in `requires` and absent from the library is
`DEPENDENCY_ABSENT` and nothing in the package is wrong, while the same absence
undeclared is the author's typo.

**14. Partial shared records appear in readiness whether or not anything
references them.** A half-written definition nothing points at yet is content
work begun and not finished, and it is invisible to any report that only walks
refs. `libraryReadiness` walks the library.

**15. Readiness may only inspect scopes the runtime can resolve.** The vocabulary
walker once counted refs the engine could never reach, which is a report about
content no student can be given. Every scope a ref may be authored in is recorded
against its library in `fields.js`, and the readiness walk uses that list.

**16. No unknown directive to causal fallback.** `esDirectiveFamily` returns
`causal` when nothing matches, so a question commanded "Compare" is scaffolded as
a cause all the way to submission with no error anywhere. Eight commands with an
answer shape are in neither family. For imported content that is
`DIRECTIVE_NO_FAMILY`, an error, and the guidance that depends on the family is
withheld rather than defaulted.

**17. Missing shared support is a capability gap, not a malformed package.** A
judgement question with no judgement sentence shapes is structurally valid. The
report says `sentence shapes: no shape is authored for the judgement family, so
the shape panel is withheld`. Refines decision 6: capability answers what the
CONTENT reaches, and support-unavailable answers what the ENGINE cannot give.

**18. Fail before mutation, and preview before publish.** Parse, validate and
resolve the entire import set before anything writes. Then show every question
and every shared record the publish would change, before it changes.

**19. No silent downgrade.** A package that falls short of its capability keeps
saying what it is. Publishing it at a lower capability is an explicit action a
person takes, because a question quietly demoted is a question nobody knows the
state of.

**20. One question per package in v1.** A pack of questions with one shared
`requires` is a later design and is not smuggled into the first import.

## Locked in the hardening pass

**21. One machine definition of every capability.** `tools/contract/capabilities.js`
and nothing else. The validator and the coverage report both evaluate it, and a
test runs both over all nineteen questions and requires the same answer. Each
capability is a conjunction of named rules carrying the sentence they would say,
so a result can be explained rather than printed. No score, no weight, no
average: a strong dimension cannot cover a weak one because there is no
arithmetic for it to happen in.

**22. The directive registry, and no fallback.** Unknown does not import; known
and unsupported is a valid question whose family-dependent guidance is withheld;
known and supported is served. `Compare` can no longer behave as `Explain`.

**23. Criterion ids come from the syllabus graph.** A point names its parts in
its own title, after an authored dash, and each part becomes a node with an id.
No separate registry. 14 of 63 right-hand ends resolve deterministically today,
scoped to the question's own topic and nowhere wider; the other 49 are labels
whose owning point does not name its parts, and the mapping report proposes the
id each would have. An imported author never references identity by a display
string.

**24. Evidence roles are contract data.** Their own four-value list rather than
an alias of the vocabulary roles, because a vocabulary role says what a term is
for in the argument and an evidence role says what an item is doing in the
response. The record owns provenance; the reference owns function. A missing role
denies `evidence-complete` and is never inferred from topic, label or
neighbouring content.

**25. Vocabulary levels are derived, never authored.** A record carries facts:
term, course meaning, plain meaning, example. `complete` and `displayable` are
computed from them. A concept arriving with its own `{term, meaning}` pairs is
`SECOND_VOCABULARY_AUTHORITY` and does not import.

**26. Round-trip fidelity is proved, not assumed.** Export, validate, resolve,
compare against source, over the semantic fields that carry meaning.

**27. The simulations are described before they are run.** A fixture manifest of
personas and semantic handles, so a bot can be written against the contract
rather than against a question id.

**28. The contract is versioned, and the version is read first.**
`contractVersion`, `major.minor`, written by the exporter. A different major is
refused before anything else in the file is read; a later minor within the same
major validates against what the reader knows and says so. There is no migration
framework: a package is read by a reader that understands its major version, or
it is not read. Taken now, while files exist only inside this repository, because
the point of a version is to be there before it is needed.

**29. The document is the record of truth, semantically.** Publication stores the
whole parsed package; the resolved view is derived and rebuildable. Every
property and value survives, including fields this version has never heard of.
Formatting does not survive and is not claimed: Marginal does not retain the
uploaded bytes, and a promise about a file it no longer holds would be a promise
it could not keep.

This is what makes a later minor safe to publish rather than merely safe to
read. The rule it replaces is the tempting one: rebuild the stored package from
the fields the current contract defines. That is a whitelist, it looks correct
from inside the version that wrote it, and it silently deletes everything the
next contract adds.

A version that cannot return the document it was given may inspect and must not
publish, and the report says so by name rather than in a comment.

## What is still open

Nothing in the format is waiting on a decision. What remains is work the
decisions create:

- 49 of 63 criterion right-hand ends, whose owning syllabus point does not name
  its parts in its title. The ids they would have are in `criterion-mapping.md`;
- 25 evidence references with no authored role;
- 14 vocabulary records needing a plain meaning and an example before the
  vocabulary panel can offer them;
- the eight directives in neither family, now registered and reported rather
  than silently served as causal;
- judgement sentence shapes, of which there are none.
