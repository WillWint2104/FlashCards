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
    },

    // -------------------------------------------------------------------------
    // Business Studies (Year 12). Extended-response practice built around the
    // syllabus RELATIONSHIP the question tests (Term 1 affects Term 2), not just
    // the command verb. Each question carries: qtype (A relationship, B judgement,
    // C multi-element with mandatory targets), a topic tag, an exemplar paragraph
    // PLAN (four syllabus relationships, not "four paragraphs"), and the core
    // argument. Questions are original wording; FIN-01/FIN-02 mirror the 2024/2025
    // HSC finance relationships and are flagged as such. No case-study content is
    // asserted here: the student supplies the business evidence.
    // -------------------------------------------------------------------------
    business_studies: {
      key: "business_studies",
      label: "Business Studies",
      stage: "Year 12",
      defaultStructure: "six",           // intro + four body + conclusion (four relationships)
      paraModels: ["teeec", "tdecc"],    // student-selectable paragraph structure (see scaffolds)
      questions: [
        { id: "ops-01", command: "How can", qtype: "A", qtypeLabel: "relationship",
          text: "How can operations strategies contribute to the achievement of performance objectives?",
          topic: "Operations", term1: "Operations strategies", term2: "Performance objectives",
          plan: ["Technology to speed and cost", "Inventory management to dependability and cost", "Quality management to quality", "Supply chain management to speed and dependability"],
          argument: "Operations strategies influence business performance by changing the quality, speed, dependability, flexibility, customisation and cost of outputs." },
        { id: "ops-02", command: "Assess", qtype: "B", qtypeLabel: "judgement",
          text: "Assess the impact of globalisation on operations management.",
          topic: "Operations", term1: "Globalisation", term2: "Operations management",
          plan: ["Global sourcing to costs and supply", "Economies of scale to cost leadership", "Scanning and learning to innovation", "Research and development to differentiation"],
          argument: "Globalisation can substantially improve cost competitiveness and innovation but exposes businesses to greater supply-chain and global risk." },
        { id: "ops-03", command: "How can", qtype: "A", qtypeLabel: "relationship",
          text: "How can operations strategies affect corporate social responsibility?",
          topic: "Operations", term1: "Operations strategies", term2: "Corporate social responsibility",
          plan: ["Supply chain and global sourcing to social responsibility", "Outsourcing to employee and community responsibilities", "Inventory and waste management to environmental sustainability", "Technology and design to environmental and social consequences"],
          argument: "Operations strategies shape a business's social and environmental responsibilities as much as its efficiency." },
        { id: "mkt-01", command: "Explain", qtype: "C", qtypeLabel: "multi-element",
          text: "Explain how target markets influence the development of marketing strategies.",
          topic: "Marketing", term1: "Target markets", term2: "Marketing strategies",
          plan: ["Target market to product", "Target market to price", "Target market to promotion and e-marketing", "Target market to place, people, processes and physical evidence"],
          argument: "The chosen target market shapes every element of the marketing mix so that strategy fits the customer." },
        { id: "mkt-02", command: "Assess", qtype: "B", qtypeLabel: "judgement",
          text: "Assess the effectiveness of marketing strategies in achieving marketing objectives.",
          topic: "Marketing", term1: "Marketing strategies", term2: "Marketing objectives",
          plan: ["Product differentiation to market share", "Pricing to sales and profitability", "Promotion to awareness and sales", "Distribution and e-marketing to market expansion"],
          argument: "Marketing strategies can be effective in achieving objectives, though their success depends on fit with the market and on competitors' responses." },
        { id: "mkt-03", command: "To what extent", qtype: "B", qtypeLabel: "judgement",
          text: "To what extent do influences on marketing determine business success?",
          topic: "Marketing", term1: "Influences on marketing", term2: "Business success",
          plan: ["Psychological influences", "Sociocultural influences", "Economic influences", "Government, legal and ethical influences"],
          argument: "Influences significantly shape customer behaviour and constrain decisions, though management's response ultimately determines their effect on success." },
        { id: "fin-01", command: "How can", qtype: "A", qtypeLabel: "relationship",
          text: "How can financial strategies affect the objectives of financial management?",
          topic: "Finance", term1: "Financial management strategies", term2: "Objectives of financial management",
          note: "2024 HSC Section IV question.",
          plan: ["Cash flow management to liquidity", "Working capital management to liquidity and efficiency", "Profitability management to profitability and growth", "Global financial management to profitability and solvency"],
          argument: "Financial strategies substantially help businesses achieve financial objectives by controlling cash, working capital, costs, revenues and financial risk, though achieving one objective can involve a trade-off with another." },
        { id: "fin-02", command: "Explain", qtype: "C", qtypeLabel: "multi-element",
          text: "Explain how financial strategies can achieve liquidity and profitability objectives.",
          topic: "Finance", term1: "Financial management strategies", term2: "Liquidity and profitability",
          note: "2025 HSC finance question. Constrained selection: liquidity and profitability are mandatory targets.",
          plan: ["Distribution of payments to liquidity", "Factoring and early-payment discounts to liquidity", "Working capital controls to liquidity", "Cost and revenue controls to profitability"],
          argument: "Financial strategies can achieve both liquidity and profitability, but the same strategy can help one objective while costing the other." },
        { id: "fin-03", command: "Assess", qtype: "B", qtypeLabel: "judgement",
          text: "Assess the impact of influences on the financial management of a business.",
          topic: "Finance", term1: "Influences on financial management", term2: "Financial management and performance",
          plan: ["Sources of finance", "Financial institutions", "Government", "Global market influences"],
          argument: "The significance of each influence depends on the business's financial position and activities, though global market conditions can be particularly significant for large and international businesses." },
        { id: "hr-01", command: "Evaluate", qtype: "B", qtypeLabel: "judgement",
          text: "Evaluate the effectiveness of human resource strategies in improving business performance.",
          topic: "Human Resources", term1: "Human resource strategies", term2: "Business performance",
          plan: ["Leadership style to satisfaction and culture", "Training and development to productivity and skills", "Performance management and rewards to turnover and performance", "Dispute resolution to disputation and satisfaction"],
          argument: "Human resource strategies can be effective in improving performance, measured against indicators such as turnover, absenteeism, disputation and worker satisfaction." },
        { id: "hr-02", command: "Analyse", qtype: "A", qtypeLabel: "relationship",
          text: "Analyse how key influences affect human resource management.",
          topic: "Human Resources", term1: "Key influences", term2: "Human resource management",
          plan: ["Stakeholders", "Legal influences", "Economic influences", "Technological, social and ethical influences"],
          argument: "Key influences shape human resource decisions by changing the expectations, constraints and conditions managers must respond to." },
        { id: "hr-03", command: "To what extent", qtype: "B", qtypeLabel: "judgement",
          text: "To what extent can human resource processes contribute to effective human resource management?",
          topic: "Human Resources", term1: "Human resource processes", term2: "Effective human resource management",
          plan: ["Acquisition to an appropriate workforce", "Development to skills and productivity", "Maintenance to retention and satisfaction", "Separation to restructuring, costs and culture"],
          argument: "Human resource processes contribute substantially to effective management, though their effect depends on how well each stage is carried out." }
      ],
      // Two selectable paragraph structures. Each overrides the BODY slot set only;
      // intro and conclusion reuse the shared light sets. Slot keys are stable and
      // are the contract with the coach worker. Content-free frames only.
      scaffolds: {
        teeec: {
          label: "TEEEC", expansion: "Topic, Explain, Example, Effect, Concluding link",
          body: [
            { key: "topic",   label: "topic",           job: "state the relationship this paragraph argues, a strategy affecting an objective" },
            { key: "explain", label: "explanation",     job: "explain how the strategy works, using business terminology" },
            { key: "example", label: "example",         job: "apply a real case study or business example" },
            { key: "effect",  label: "effect",          job: "explain the effect on the objective and why it matters to the business" },
            { key: "link",    label: "concluding link", job: "link back to the question with a clear judgement" }
          ],
          templates: {
            topic:   { tier1: "____ can affect ____ because ____.",
                       tier2: [ { type: "cause and effect", frame: "____ influences ____ by ____." } ] },
            explain: { tier1: "This works because ____ leads to ____.",
                       tier2: [ { type: "mechanism", frame: "By ____, the business is able to ____, which changes ____." } ] },
            example: { tier1: "For example, a business could ____, which shows ____." },
            effect:  { tier1: "As a result, ____ improves ____, which matters because ____.",
                       tier2: [ { type: "trade-off", frame: "This improves ____, although it can reduce ____." } ] },
            link:    { tier1: "Therefore, ____ affects ____, which addresses the question because ____." }
          }
        },
        tdecc: {
          label: "TDECC", expansion: "Topic, Define, Example, Comment, Concluding link",
          body: [
            { key: "topic",   label: "topic",           job: "state the relationship this paragraph argues, a strategy affecting an objective" },
            { key: "define",  label: "definition",      job: "define the key strategy or term precisely, using business terminology" },
            { key: "example", label: "example",         job: "apply a real case study or business example" },
            { key: "comment", label: "comment",         job: "analyse the consequence: how it affects the objective, including any trade-off" },
            { key: "link",    label: "concluding link", job: "link back to the question with a clear judgement" }
          ],
          templates: {
            topic:   { tier1: "____ can affect ____ because ____." },
            define:  { tier1: "____ refers to ____.",
                       tier2: [ { type: "define then apply", frame: "____ is ____, which allows a business to ____." } ] },
            example: { tier1: "For example, a business could ____, which shows ____." },
            comment: { tier1: "This matters because ____ leads to ____, although ____.",
                       tier2: [ { type: "weigh it", frame: "This affects ____ more than ____ because ____." } ] },
            link:    { tier1: "Therefore, ____ affects ____, which addresses the question because ____." }
          }
        }
      },
      // Fixed, pre-written worked examples in the business genre, deliberately on a
      // DIFFERENT relationship from most questions so the analytical shape transfers
      // without being liftable. Generic firm ("a business"): no real company named.
      // Slots use the TEEEC keys; TDECC-only slots simply show no example.
      examples: [
        { topic: "finance-liquidity", label: "Cash flow management and liquidity", slots: {
          topic: "Cash flow management can significantly improve a business's liquidity because it changes the timing and availability of cash.",
          explain: "Strategies such as the distribution of payments, discounts for early payment and factoring alter when cash flows in and out, so more cash is available to meet short-term commitments.",
          example: "For example, a business could use factoring to sell its accounts receivable for immediate cash rather than waiting for customers to pay.",
          effect: "This increases the funds available to pay suppliers and wages, improving liquidity, although factoring carries a cost that can reduce profitability.",
          link: "Therefore, cash flow management can be highly effective in achieving liquidity, provided managers weigh the trade-off with profitability." } },
        { topic: "operations-quality", label: "Quality management and the quality objective", slots: {
          topic: "Quality management can strengthen the performance objective of quality because it builds consistency into outputs.",
          explain: "Approaches such as quality control, quality assurance and continuous improvement reduce defects and variation in the production process.",
          example: "For example, a business could introduce standardised checks at each stage of production to catch faults before goods reach customers.",
          effect: "This raises the reliability of outputs and customer satisfaction, which matters because it protects reputation and repeat sales.",
          link: "Therefore, quality management directly supports the quality objective and, through it, wider business performance." } }
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
    },
    // Worked examples for the optional "see a worked example" reference. These are
    // FIXED, pre-written (never generated, so no invented history), and ALWAYS on a
    // DIFFERENT topic from the student's, so the analytical SHAPE transfers but no
    // content is liftable into their own essay. Shown only in a separate reference
    // panel labelled "model to study, not to copy". Two topics are provided so the
    // app can pick the one that does NOT match the student's chosen topic. Original
    // wording, general and uncontroversial, never reproduced from any source.
    //
    // This list is the SUBJECT-AGNOSTIC FALLBACK (authored for Ancient History). Any
    // other subject borrows it as a clearly-labelled placeholder. To give a subject
    // its OWN worked examples later, add `examples: [ ... ]` (same shape) under that
    // subject in `subjects.<key>` above; the app prefers a subject's own set and
    // drops the placeholder note automatically. No engine change is needed.
    examples: [
      { topic: "sparta", label: "Spartan society", slots: {
        point: "Spartan upbringing was designed above all to produce obedient soldiers.",
        analysis: "This mattered because the agoge took boys from their families young, which shows the state placed loyalty to Sparta above loyalty to kin.",
        evidence: "This is supported by descriptions of the agoge as harsh communal training from about the age of seven, which suggests how early the conditioning began.",
        link: "This addresses the question because it shows control was built through upbringing, not through force alone.",
        thesis: "Spartan society can be assessed by weighing its military strength against the rigidity that strength demanded.",
        methods: "This will be examined through Spartan education, the role of the helots, and the place of women.",
        restate: "Overall, Spartan strength and Spartan rigidity were two sides of one system.",
        judgement: "On balance, the system was effective for war but slow to adapt, which limited Sparta over time."
      } },
      { topic: "egypt", label: "Old Kingdom Egypt", slots: {
        point: "In the Old Kingdom, the pharaoh's authority rested on his presentation as a divine ruler.",
        analysis: "This mattered because commanding the resources to build the pyramids displayed that power, which shows religion and royal authority reinforced each other.",
        evidence: "This is supported by the scale of the pyramid complexes at Giza, which suggests the level of organisation the state could reach.",
        link: "This addresses the question because it shows authority was expressed through monuments as much as through administration.",
        thesis: "Old Kingdom Egypt can be assessed by weighing the power of the pharaoh against the burden such projects placed on the state.",
        methods: "This will be examined through kingship, religion, and the organisation of labour.",
        restate: "Overall, royal power and religious belief in the Old Kingdom were deeply intertwined.",
        judgement: "On balance, this concentration of power enabled great works but left the state vulnerable when central authority weakened."
      } }
    ]
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
