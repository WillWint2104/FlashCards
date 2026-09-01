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

## All ten are settled

Nothing in the design is now waiting on a decision. What remains is the
contradiction list in the report, which is work the decisions create rather than
questions they leave open.
