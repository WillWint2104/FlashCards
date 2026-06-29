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
  coachSample: {
    note: "There is a clear point here, but it leans on description. The marker is looking for analysis that answers the question, not a retelling.",
    nudges: [
      "Your first sentence states what happened. What does it let you argue about the question?",
      "You mention a source here. What makes it useful or limited for this point, and how would you signal that to the marker?",
      "How does this paragraph connect back to your thesis? A short signpost would make the link explicit."
    ],
    chips: [
      { from: "shows", options: ["suggests", "indicates", "reveals"] },
      { from: "big", options: ["significant", "substantial", "far-reaching"] },
      { from: "a lot of", options: ["considerable", "extensive"] }
    ],
    check: "If you have stated a date or figure, check it against your own notes before you rely on it."
  }
};
