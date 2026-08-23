// A controlled fixture for the withholding rule, and nothing else.
//
// The rule was previously tested by pointing at whichever real question happened
// to be unfinished. That made the test a hostage to authoring: finishing a
// question broke it, and re-siting the probe onto a different real question broke
// it again in a worse way, because the replacement inspected an empty list and
// would have passed while checking nothing.
//
// Two pathways, one of each state, owned by the test. Finishing any real question
// cannot touch them.
const WITHHOLDING_FIXTURE = {
  key: "contract_test",
  label: "Contract test",
  stage: "Test fixture",
  markingCriteria: ["a criterion, because the shape requires one"],
  concepts: {
    testConcept: {
      kind: "domain",
      requiresTeaching: true,
      oneLine: "a concept that exists only so the authored pathway has something to declare.",
      title: "Test concept",
      quick: "This text belongs to the fixture. If a student ever sees it, a test subject has reached a real build.",
      terms: [{ term: "test concept", meaning: "a fixture concept, not teaching content." }],
      related: []
    }
  },
  questions: [{
    id: "ct-01",
    text: "A fixture question, so the two pathway states can be reached.",
    command: "Explain",
    qtype: "C",
    marks: 20,
    coreAnswer: { mode: "causal" },
    requirements: {
      concepts: ["test concept"],
      requiredAreas: [{ id: "contract", label: "contract" }],
      relationships: ["the fixture states a relationship because the shape requires one"],
      accomplish: ["reach both pathway states"],
      syllabus: "none: this is a test fixture"
    },
    areas: { contract: { label: "contract", guides: { topic: "Fixture guidance." } } },
    pathways: [
      {
        id: "ct-unreviewed", area: "contract",
        relationship: "The unreviewed pathway, which must offer nothing",
        short: "Unreviewed → nothing offered",
        adds: "the state under test",
        meaning: "This pathway has not been reviewed for what it depends on.",
        whatToProve: "nothing: this pathway exists to be withheld",
        commonMistake: "Treating an unreviewed pathway as one that depends on nothing.",
        // The state under test. Never a claim that it depends on nothing.
        learning: { status: "unreviewed" },
        concept: { topic: "test", section: "test", point: "test" },
        evidence: [],
        guides: { explain: "Fixture guidance, so the pathway is usable without a lesson." }
      },
      {
        id: "ct-authored", area: "contract",
        relationship: "The authored pathway, which must offer a lesson",
        short: "Authored → lesson offered",
        adds: "the other state under test",
        meaning: "This pathway has been reviewed and carries a lesson.",
        choiceMeaning: "The authored pathway, which the app should offer a lesson for.",
        whatToProve: "nothing: this pathway exists to be offered",
        commonMistake: "Treating an authored pathway as though it were still unreviewed.",
        learning: {
          status: "authored",
          concepts: { primary: ["testConcept"], supporting: [], optional: [] },
          know: "A fixture sentence, so the lesson has a body.",
          chain: ["the first step", "the second step", "the third step", "the fourth step"],
          misconception: {
            head: "Two fixture terms",
            a: { term: "One", line: "the first fixture term." },
            b: { term: "Two", line: "the second fixture term." }
          },
          example: {
            context: "a fixture context",
            text: "A fixture example, in a context that is not the case study.",
            pattern: "fixture pattern"
          },
          try: {
            prompt: "A fixture question with one right answer?",
            options: [
              { text: "The right one", right: true },
              { text: "The wrong one", repair: "A fixture repair." }
            ],
            onRight: "A fixture confirmation."
          },
          explore: { concept: "testConcept", label: "Read more about the test concept" }
        },
        concept: { topic: "test", section: "test", point: "test" },
        evidence: [],
        guides: { explain: "Fixture guidance." }
      }
    ],
    criteria: [{ band: 6, text: "A fixture criterion." }],
    decode: { highlights: [] },
    plan: { steps: ["A fixture plan step."] }
  }]
};
if (typeof module !== "undefined" && module.exports) module.exports = { WITHHOLDING_FIXTURE };
if (typeof window !== "undefined") window.WITHHOLDING_FIXTURE = WITHHOLDING_FIXTURE;
