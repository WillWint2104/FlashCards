# QuestionPackage v1 — design artefacts

Design for review. **Nothing here is implemented**: there is no importer, no
validator and no schema file, and the application reads none of it.

| file | what it is |
| --- | --- |
| `example-*.json` | all 19 questions in the bank, converted from source |
| `shared-learning.json` | the four pathway-local lessons, extracted and given ids |
| `template-causal.json` | the shape a causal question is authored into |
| `template-judgement.json` | the shape a judgement question is authored into |
| `template-write-only.json` | the honest floor: a question with no argument layer |
| `decisions.md` | the ten settled decisions, and what each rules out |

## Why the examples are generated rather than written

A hand-written example proves only that the format can express what its author
had in mind. These are produced from the questions actually in the bank, so they
prove it can express what is really there, and report what it cannot:

    node tools/packagize.js            # all 19
    node tools/packagize.js ops-02     # one

Anything that cannot be represented is printed as unmapped and left `null`,
never guessed at.

## What the current run reports

19 questions across two subjects convert: six guided, ten write-only, and three
that carry only a stem. Readiness is six independent dimensions, so the two
guided tiers no longer report alike:

    mkt-01, fin-01, hr-01   Guided — missing learning-complete, evidence-complete
    ops-02, hr-02, mkt-03   Guided — missing learning-complete, assessment-complete,
                                     evidence-complete
    the ten write-only      Writing ready — missing pathway-guided, learning-complete,
                                     assessment-complete, evidence-complete
    the six ancient history Importable — a stem and nothing else

Outstanding, by count:

- **65 criterion labels with no id.** Stating a plan claim explicitly requires
  stable ids for its right-hand end, and no objective or criterion registry
  exists. This is the largest single piece of work the decisions create.
- **25 evidence references with no authored role**, left `null` by design.
- **20 plan lines that state no right-hand end at all**, because they are section
  names rather than relationship claims.

## The templates are illustrative until the contract generator exists

In the design they are generated from one field-definition file along with the
schema, the authoring guide and the validator, so the four cannot drift apart.
Hand-maintained templates are exactly the drift the contract is meant to prevent.
