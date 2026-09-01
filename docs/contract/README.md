# QuestionPackage v1 — design artefacts

Design for review. **Nothing here is implemented**: there is no importer, no
validator and no schema file yet, and the application does not read any of it.

| file | what it is |
| --- | --- |
| `example-*.json` | the six guided questions, converted from source by `tools/packagize.js` |
| `template-causal.json` | the shape a causal question is authored into |
| `template-judgement.json` | the shape a judgement question is authored into |

## Why the examples are generated rather than written

An example package written by hand proves that the format can express what its
author had in mind. These are produced from the questions actually in the bank,
so they prove the format can express what is really there, and they report what
it cannot. Run:

    node tools/packagize.js            # all six
    node tools/packagize.js ops-02     # one

Anything the transform cannot map is printed as `UNMAPPED` rather than guessed
at. Today that is:

- **22 evidence references across mkt-01, fin-01 and hr-01 carry no authored
  role.** The format requires one, because a record that merely sits in the same
  topic is topic evidence and nothing stronger. This is the parked evidence-role
  work, showing up as a schema requirement.
- `qtype` and `qtypeLabel`, dropped from v1 because nothing reads them.
- `objectiveWords` on mkt-01, dropped because plan objectives become explicit.

Everything else converts, including all 45 concept routes.

## The templates are illustrative until the contract generator exists

They show the proposed shape. In the design they are **generated** from one
field-definition file along with the schema, the authoring guide and the
validator, so the four cannot drift apart. Hand-maintained templates are exactly
the drift the contract is meant to prevent.
