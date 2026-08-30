// A controlled fixture for the EVIDENCE publication contract.
//
// Publication needs BOTH halves of verification recorded:
//
//   source   WHERE the claim can be checked, in words a teacher could follow
//   checked  the date someone actually did check it
//
// Finding a source is not verification. Recording that it was checked is what
// completes publication. Six neighbouring states, so the difference between them
// is the only thing the tests can be reading:
//
//   A  draft              no source, no checked                    -> hidden
//   B  candidate          a URL located, nothing recorded          -> hidden
//   C  confirmed          source AND checked                       -> OFFERED
//   D  located            a source recorded, never checked         -> hidden
//   E  orphan check       a date, but no source to check against   -> hidden
//   F  whitespace         both fields present and both blank       -> hidden
//
// D is the dangerous one and the reason this fixture exists. It looks complete,
// it reads as authoritative, and nobody opened it. Under a source-only rule it
// would publish.
//
// B is what protects the real bank today: every McDonald's candidate carries a
// located URL and nothing else, so the day a URL counts as sourced they all
// publish at once.
const EVIDENCE_FIXTURE = {
  // the bank, as BUSCONTENT.evidence[topic] holds it
  records: [
    { label: "A draft claim",
      fact: "A fixture claim with nothing recorded at all.",
      use: "Fixture use text.",
      source: "", sourceUrl: "", checked: "" },
    { label: "B candidate with a url",
      fact: "A fixture claim where someone located a likely page and recorded nothing.",
      use: "Fixture use text.",
      source: "", sourceUrl: "https://example.invalid/a-page-someone-found", checked: "" },
    { label: "C confirmed and publishable",
      fact: "A fixture claim whose source was recorded and checked.",
      use: "Fixture use text.",
      source: "Fixture source, recorded in words a teacher could check",
      sourceUrl: "https://example.invalid/confirmed", checked: "2026-08-24" },
    { label: "D located but never checked",
      fact: "A fixture claim naming a real-sounding source that nobody opened.",
      use: "Fixture use text.",
      // The state a source-only rule would publish. It is indistinguishable from
      // C at a glance, which is exactly why it has to be tested.
      source: "Fixture source, named but never opened",
      sourceUrl: "https://example.invalid/plausible", checked: "" },
    { label: "E checked with nothing to check",
      fact: "A fixture claim carrying a date and no source.",
      use: "Fixture use text.",
      source: "", sourceUrl: "", checked: "2026-08-24" },
    { label: "F both fields blank",
      fact: "A fixture claim whose source and checked fields hold only whitespace.",
      use: "Fixture use text.",
      source: "   ", sourceUrl: "https://example.invalid/confirmed", checked: "  " }
  ],
  // the subject, whose question text has to resolve to a known topic so the bank
  // is reachable at all. Asserted in the tests rather than assumed.
  subject: {
    key: "evidence_contract",
    label: "Evidence contract",
    stage: "Test fixture",
    markingCriteria: ["a criterion, because the shape requires one"],
    concepts: {},
    questions: [{
      id: "ec-01",
      text: "A fixture marketing question, so the evidence bank for this topic is reachable.",
      command: "Explain",
      qtype: "C",
      marks: 20,
      coreAnswer: { mode: "causal" },
      requirements: {
        concepts: ["evidence"],
        requiredAreas: [{ id: "contract", label: "contract" }],
        relationships: ["the fixture states a relationship because the shape requires one"],
        accomplish: ["reach both evidence states"],
        syllabus: "none: this is a test fixture"
      },
      areas: { contract: { label: "contract", guides: { topic: "Fixture guidance." } } },
      pathways: [
        {
          // links ALL FOUR states, so one screen decides between them
          id: "ev-all", area: "contract",
          relationship: "The pathway that links every evidence state",
          short: "Every state → only the confirmed one",
          adds: "the states under test",
          meaning: "This pathway links every state a record can be in, publishable and not.",
          choiceMeaning: "The pathway linking every evidence state.",
          whatToProve: "nothing: this pathway exists so the four states meet on one screen",
          commonMistake: "Treating a located source as a checked one.",
          learning: { status: "unreviewed" },
          concept: { topic: "test", section: "test", point: "test" },
          evidence: ["A draft claim", "B candidate with a url", "C confirmed and publishable",
                     "D located but never checked", "E checked with nothing to check", "F both fields blank"],
          guides: { explain: "Fixture guidance." }
        },
        {
          // the same shape with the complete record removed
          id: "ev-incomplete", area: "contract",
          relationship: "The pathway whose evidence is all incomplete",
          short: "Incomplete only → nothing offered",
          adds: "the withheld state",
          meaning: "This pathway links only records that have never been sourced.",
          choiceMeaning: "The pathway with nothing publishable behind it.",
          whatToProve: "nothing: this pathway exists to offer nothing",
          commonMistake: "Assuming an empty picker means no evidence was written.",
          learning: { status: "unreviewed" },
          concept: { topic: "test", section: "test", point: "test" },
          evidence: ["A draft claim", "B candidate with a url", "D located but never checked",
                     "E checked with nothing to check", "F both fields blank"],
          guides: { explain: "Fixture guidance." }
        }
      ],
      criteria: [{ band: 6, text: "A fixture criterion." }],
      decode: { highlights: [] },
      plan: { steps: ["A fixture plan step."] }
    }]
  }
};
if (typeof module !== "undefined" && module.exports) module.exports = { EVIDENCE_FIXTURE };
if (typeof window !== "undefined") window.EVIDENCE_FIXTURE = EVIDENCE_FIXTURE;
