// =============================================================================
// Marginal — essay practice content (HSC Ancient History, Year 11).
//
// ORIGINAL questions and scaffolding written for this app in the HSC genre.
// Nothing here is reproduced from NESA papers, marking guidelines or any
// textbook: published material informed the genre and topic spread only, it is
// never copied or lightly reworded into app content. Statistics or claims are
// avoided on purpose; this file carries questions and structure, not facts the
// app would have to vouch for. Coaching never supplies the argument or content.
//
// Loaded as window.ESSAY before app.js. Economics (window.CONTENT) is untouched.
// =============================================================================
window.ESSAY = {
  // Subjects keyed by the value the client subject map resolves a class code to.
  // Only ancient_history ships today; the shape is ready for more.
  subjects: {
    ancient_history: {
      key: "ancient_history",
      label: "Ancient History",
      stage: "Year 11",
      // Original practice questions in the HSC extended-response genre. Each is a
      // single, self-contained prompt a student picks from (or they paste their
      // own in setup). "command" is the HSC directive verb, surfaced as a chip.
      questions: [
        { id: "ah-sources",
          command: "Assess",
          text: "Assess the extent to which written and archaeological sources together shape our understanding of one ancient society you have studied.",
          topic: "Investigating ancient history: sources and evidence" },
        { id: "ah-religion",
          command: "Explain",
          text: "Explain how religious beliefs shaped everyday life in one ancient society you have studied.",
          topic: "Features of ancient societies: religion and belief" },
        { id: "ah-geography",
          command: "To what extent",
          text: "To what extent did geography shape the development of one ancient society you have studied?",
          topic: "Features of ancient societies: environment and economy" },
        { id: "ah-women",
          command: "Evaluate",
          text: "Evaluate the usefulness of the available sources for reconstructing the role of women in one ancient society you have studied.",
          topic: "Investigating ancient history: reliability and usefulness" },
        { id: "ah-power",
          command: "Discuss",
          text: "Discuss the relationship between political power and religious authority in one ancient society you have studied.",
          topic: "Features of ancient societies: power and authority" },
        { id: "ah-site",
          command: "Account for",
          text: "Account for the significance of one major site or monument to the society that built it.",
          topic: "Features of ancient societies: significant sites" }
      ]
    }
  },

  // Structure presets for the setup selector. The default is the five-paragraph
  // shape; a student can change it in setup and re-pick it later. "roles" drives
  // both the stepper labels and how many paragraph slots the draft holds.
  structures: [
    { key: "five",  label: "5 paragraphs (intro, 3 body, conclusion)",
      roles: ["Introduction", "Body 1", "Body 2", "Body 3", "Conclusion"] },
    { key: "four",  label: "4 paragraphs (intro, 2 body, conclusion)",
      roles: ["Introduction", "Body 1", "Body 2", "Conclusion"] },
    { key: "six",   label: "6 paragraphs (intro, 4 body, conclusion)",
      roles: ["Introduction", "Body 1", "Body 2", "Body 3", "Body 4", "Conclusion"] }
  ],
  defaultStructure: "five",

  // Generic HSC band expectations, in writable register, no em-dashes. Shown as
  // light reference in setup when a student has not pasted their own rubric. The
  // coaching model is told these same expectations server-side; this copy is for
  // the student to read, never asserted as the only right answer.
  bands: [
    { range: "Bands 5 to 6", text: "Sustained, well reasoned judgement. Analysis runs ahead of description, evidence is integrated and specific, and the writing signposts clearly." },
    { range: "Bands 3 to 4", text: "A clear line of argument with some analysis, but parts slip into retelling and the evidence is uneven or loosely linked." },
    { range: "Bands 1 to 2", text: "Mostly description or general comment, with little argument and evidence that is thin, vague or unconnected to the question." }
  ],

  // ---------------------------------------------------------------------------
  // coachSample — the labelled DEMO FALLBACK for coaching, mirroring the marking
  // demo fallback (demoEssay). Lets all three screens be walked end to end before
  // the worker is re-pasted. SUGGEST, NEVER SUBSTITUTE: nudges are questions, not
  // answers; chips are word-level alternatives the student picks and applies.
  // Never a rewritten sentence or a paste-ready paragraph.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // slots — the ONE shared paragraph model. Both the missing-element checker (the
  // coach names which slot is ABSENT) and the quiz "complete enough" check read
  // this. A body paragraph has four slots; intro and conclusion get light sets.
  // The "job" text is what the app shows on a missing-element card, so the coach
  // worker never has to write that text (it returns only the slot key).
  //
  // templates are the TIERED, CONTENT-FREE frames a student can toggle on a
  // missing-element card. HARD RULE: blank connective tissue only, NEVER a worked
  // example with real history, names, dates or model analysis. tier1 is one simple
  // frame; tier2 offers a few frame TYPES that scaffold the KIND of analysis.
  // Keep the slot KEYS here in sync with proxy/worker.js COACH_SYSTEM.
  // ---------------------------------------------------------------------------
  slots: {
    roleSets: {
      body: [
        { key: "point",    label: "point",     job: "state the argument this paragraph makes" },
        { key: "analysis", label: "analysis",  job: "explain the effect or why it matters" },
        { key: "evidence", label: "evidence",  job: "ground the point in a specific source or detail" },
        { key: "link",     label: "link",      job: "connect the point back to the question" }
      ],
      introduction: [
        { key: "thesis",  label: "thesis",   job: "state your overall line of argument" },
        { key: "methods", label: "approach", job: "signpost how the essay will get there" }
      ],
      conclusion: [
        { key: "restate",   label: "restatement", job: "draw the argument together without simply repeating" },
        { key: "judgement", label: "judgement",   job: "land a clear, weighed judgement" }
      ]
    },
    templates: {
      point:     { tier1: "____ was a key way that ____.",
                   tier2: [ { type: "claim", frame: "One way ____ can be seen is through ____." },
                            { type: "contrast", frame: "While ____, this paragraph argues that ____." } ] },
      analysis:  { tier1: "This demonstrates that ____ because ____.",
                   tier2: [ { type: "significance", frame: "This was significant because it allowed ____ to ____, which shows ____." },
                            { type: "appearance and reality", frame: "This created the impression of ____ while in reality ____, revealing ____." },
                            { type: "cause and effect", frame: "By doing this, ____ led to ____." } ] },
      evidence:  { tier1: "This is supported by ____, which shows ____.",
                   tier2: [ { type: "named source", frame: "According to ____, ____, which suggests ____." },
                            { type: "specific detail", frame: "The detail that ____ shows ____." } ] },
      link:      { tier1: "Therefore, ____ was a key method because ____.",
                   tier2: [ { type: "answer the question", frame: "This shows that ____, which directly addresses ____." },
                            { type: "weigh it", frame: "This mattered more than ____ because ____." } ] },
      thesis:    { tier1: "____ can be assessed by weighing ____ against ____.",
                   tier2: [ { type: "line of argument", frame: "While ____, ultimately ____ because ____." } ] },
      methods:   { tier1: "This will be shown through ____ and ____.",
                   tier2: [ { type: "signpost", frame: "By examining ____ and ____, this essay will argue ____." } ] },
      restate:   { tier1: "Overall, ____ shows that ____.",
                   tier2: [ { type: "draw together", frame: "Taken together, ____ and ____ reveal ____." } ] },
      judgement: { tier1: "On balance, ____ was ____ because ____.",
                   tier2: [ { type: "weighed judgement", frame: "Although ____, on balance ____ because ____." } ] }
    }
  },

  // coachSample — the labelled DEMO FALLBACK, in the categorised shape the worker
  // now returns: a substance note, ABSENT slots (each renders a missing-element
  // card with the tiered frames above), and nudges tagged so on-target substance
  // shows by default while expression and signposting polish tuck away. Chips stay
  // word-level. Nothing here contains real history: it is all content-free.
  coachSample: {
    note: "There is a clear point and a source here, but the paragraph leans on description. The marker wants analysis that answers the question.",
    missing: [ { slot: "analysis" }, { slot: "link" } ],
    nudges: [
      { text: "Your source is named, but what does it let you argue about the question?", category: "on_target" },
      { text: "What is the effect of this for your overall line of argument?", category: "on_target" },
      { text: "Could a clearer signpost open this paragraph so the marker sees the point first?", category: "signposting" },
      { text: "Is there a more precise word than this one for what you mean here?", category: "expression" }
    ],
    chips: [
      { from: "shows", options: ["suggests", "indicates", "reveals"] },
      { from: "big", options: ["significant", "substantial", "far-reaching"] },
      { from: "a lot of", options: ["considerable", "extensive"] }
    ],
    check: "If you have stated a date or figure, check it against your own notes before you rely on it."
  }
};
