// THE FIELD DEFINITION. One file, and everything else about the contract is
// generated from it: the JSON Schema, the authoring guide, the three templates,
// and the enum and ref checks the validator runs.
//
// It exists because four hand-maintained descriptions of one format drift, and
// the drift is invisible until an external author follows the guide and the
// validator rejects what they wrote. `tests/t18.mjs` asserts the generated
// artefacts match this file, so drift fails a gate rather than a person.
//
// Every entry answers the ten questions an external author has, in the order
// they ask them:
//
//   required      is this needed, and needed for what
//   owner         question, pathway, area, package or shared library
//   type          and allowed values
//   refTo         which library its ids may name
//   means         what it is FOR, pedagogically, not what type it is
//   surface       which student-facing surface consumes it
//   omission      leaving it out: invalid, or a capability not reached
//   studentProse  whether a student reads these words
//   good / bad    one of each, drawn from real content where possible
//
// `omission` is the field that makes the format honest. "invalid" means the
// package will not import. A capability name means the package imports and does
// not reach that capability, and the readiness report says so by name.
//
// "level:displayable" is the third answer, and it exists because vocabulary has
// two consumers with different needs. The Learn surface lists a concept's defined
// terms and needs a term and a subject meaning. The vocabulary panel needs all
// four fields, because its whole contract is that a student never meets a term
// without a meaning they can read. A record can therefore be complete enough to
// teach with and not complete enough to offer as vocabulary, and collapsing that
// into one word would either hide fourteen usable definitions or display fourteen
// half-written ones.

// The six capabilities, in the order a question climbs them. Locked by decision
// 6: readiness is not one scalar, because two questions that differ by an entire
// tier of authored support must not report alike.
const CAPABILITIES = [
  { id: "importable", means: "the package parses, resolves and can be stored" },
  { id: "writing-ready", means: "a student can be given the question and write against it" },
  { id: "pathway-guided", means: "a student can choose between authored arguments and be guided through one" },
  { id: "learning-complete", means: "a student who does not know the content can be taught it here" },
  { id: "assessment-complete", means: "the student can see what the answer must accomplish and how it is marked" },
  { id: "evidence-complete", means: "every argument has evidence carrying a source that was checked" },
];

// Enums the libraries define are named, never copied: the validator reads the
// values out of the manifest at run time, so adding a sentence shape family or
// a directive is authoring rather than a code change. The ones no library
// defines are listed here in full, once.
const ENUMS = {
  vocabularyRole: { from: "manifest", key: "vocabularyRoles" },
  directive: { from: "manifest", key: "directives" },
  connector: { from: "manifest", key: "connectors" },
  slot: { from: "manifest", key: "slotKeys" },
  capability: { values: CAPABILITIES.map(c => c.id) },
  originType: { values: ["bundled", "imported"] },
  reviewState: { values: ["draft", "in-review", "in-source", "approved"] },
  publication: { values: ["unpublished", "published", "withdrawn"] },
  mechanismStatus: { values: ["authored", "none-required", "unreviewed"] },
  learningStatus: { values: ["authored", "none-required", "unreviewed"] },
  answerMode: { values: ["causal", "judgement"] },
  relation: { values: ["shapes", "affects", "constrains", "enables"] },
  contributionRole: { values: ["support", "limitation", "conditional"] },
  lean: { values: ["positive", "qualified", "negative"] },
  ladderRung: { values: ["hint", "needs", "direction", "frame", "starter", "example"] },
  markingSource: { values: ["authored", "generated"] },
  conceptKind: { values: ["domain", "supporting"] },
  requiresTeaching: { values: ["always", "contextual", "never"] },
  evidenceRole: { from: "manifest", key: "vocabularyRoles" },
};

// The libraries a ref may name. `scope` is the part the runtime can actually
// resolve from, and readiness is only allowed to inspect those scopes: a report
// that walks a scope the engine never reaches measures something no student can
// be given.
const LIBRARIES = {
  vocabulary: { record: "VocabularyRecord", scope: "question, area, pathway" },
  concepts: { record: "ConceptRecord", scope: "pathway, learning" },
  lessons: { record: "LessonRecord", scope: "pathway" },
  evidence: { record: "EvidenceRecord", scope: "pathway" },
  syllabus: { record: "SyllabusNode", scope: "question, area, pathway" },
  resources: { record: "ResourceRecord", scope: "question, area, pathway" },
  sentenceShapes: { record: "SentenceShape", scope: "engine" },
  criteria: { record: "CriterionRecord", scope: "relationship claims" },
};

// Which top-level containers must be present, and which may honestly be null.
// A write-only question has no decode panel and no model answer, and saying so
// with null is the format telling the truth rather than carrying empty objects
// that look authored. Nullable here means "absent is a capability fact"; it never
// means "optional to think about".
const CONTAINERS = {
  required: ["schema", "version", "origin", "provenance", "requires", "question",
             "relationship", "areas", "pathways", "marking"],
  nullable: ["decode", "requirements", "coreAnswer", "workingAnswer", "reasoning", "provides"],
};

const F = [];
const f = o => { F.push(o); return o; };

// ===========================================================================
// ENVELOPE
// ===========================================================================
f({ path: "schema", owner: "package", type: "const", value: "marginal.question-package",
  required: true, omission: "invalid", studentProse: false,
  means: "says what kind of file this is, so a validator never guesses at content it cannot interpret.",
  surface: "none",
  good: '"marginal.question-package"', bad: '"question" — a name a reader guesses at is not a format' });
f({ path: "version", owner: "package", type: "integer", required: true, omission: "invalid",
  studentProse: false, means: "the contract version this package was authored against.",
  surface: "none", good: "1", bad: '"1" — a string version sorts wrongly and compares wrongly' });

f({ path: "origin.type", owner: "package", type: "enum", enumName: "originType", required: true,
  omission: "invalid", studentProse: false,
  means: "whether the question shipped with the application or arrived through an import. Where a question came from is metadata beside its id and never part of it.",
  surface: "none", good: '"imported"', bad: '"mkt" — a namespace prefix belongs nowhere near origin' });
f({ path: "origin.packageId", owner: "package", type: "string", required: false, omission: "none",
  studentProse: false, means: "the authoring bundle this question arrived in, for tracing a set back to its source.",
  surface: "none", good: '"stgeorge.bus.2026t1"', bad: '"latest"' });
f({ path: "origin.author", owner: "package", type: "string", required: false, omission: "none",
  studentProse: false, means: "who authored the question, for review rather than for display.",
  surface: "none", good: '"J. Halloran"', bad: '"Marginal"' });
f({ path: "origin.authoredAt", owner: "package", type: "date", required: false, omission: "none",
  studentProse: false, means: "when it was authored. A date, not a timestamp: nothing needs the minute.",
  surface: "none", good: '"2026-02-14"', bad: '"14/2/26"' });

f({ path: "provenance.reviewState", owner: "package", type: "enum", enumName: "reviewState",
  required: true, omission: "invalid", studentProse: false,
  means: "how far through review this question is. A draft may be imported and is never served to a student.",
  surface: "none", good: '"approved"', bad: '"ready"' });
f({ path: "provenance.publication", owner: "package", type: "enum", enumName: "publication",
  required: true, omission: "invalid", studentProse: false,
  means: "whether a student may be given this question at all, independent of how complete it is.",
  surface: "the question picker", good: '"published"', bad: '"live"' });
f({ path: "provenance.notes", owner: "package", type: "string", required: false, omission: "none",
  studentProse: false, means: "anything the next reviewer needs to know. Never rendered.",
  surface: "none", good: '"Band descriptors still to come from the faculty."', bad: '"TODO"' });

// ===========================================================================
// REQUIRES AND PROVIDES
// ===========================================================================
f({ path: "requires.<library>", owner: "package", type: "string[]", required: false,
  refTo: "any", omission: "none", studentProse: false,
  means: "every shared id this package references, by library. Generated from the package rather than authored beside it: a dependency list that can disagree with the package it describes is a second source of truth. The importer recomputes it and reports any difference in both directions, so an omitted library is caught as a mismatch rather than as a missing field.",
  surface: "none",
  good: '"concepts": ["business.concept.people"]',
  bad: 'a list that omits an id the package references. The validator recomputes it and reports REQUIRES_MISMATCH' });
f({ path: "provides.<library>", owner: "package", type: "record map", required: false,
  refTo: "any", omission: "none",
  studentProse: false,
  means: "shared records this package contributes to a library. A package may bring a record the library does not have. It may never replace one it does: a definition three other questions point at is not this import's to rewrite.",
  surface: "wherever the library is consumed",
  good: 'a vocabulary record for a term nothing has defined yet',
  bad: 'a second copy of business.concept.people with different wording. That is PROVIDES_CONFLICT' });

// ===========================================================================
// QUESTION
// ===========================================================================
f({ path: "question.id", owner: "question", type: "id", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
  required: true, omission: "invalid", studentProse: false,
  means: "the stable name of this question in one namespace shared by bundled and imported questions alike. A collision is an import-blocking error and never an implicit overwrite.",
  surface: "none, and it is written into every saved draft, so it can never change",
  good: '"mkt-01"', bad: '"Mkt 01!" — spaces and case make two ids a person reads as one' });
f({ path: "question.subject", owner: "question", type: "id", pattern: "^[a-z0-9]+(_[a-z0-9]+)*$", required: true, omission: "invalid",
  studentProse: false, means: "which subject's marking criteria, paragraph models and libraries apply.",
  surface: "the subject picker", good: '"business_studies"', bad: '"Business"' });
f({ path: "question.topicRef", owner: "question", type: "ref", refTo: "syllabus", required: false,
  omission: "capability:writing-ready", studentProse: false,
  means: "the syllabus node this question sits in. A ref, because the engine used to recover the topic from a display label with a keyword table: four word lists, first match wins, null if none hit.",
  surface: "the study content panel, which loads the topic's core content",
  good: '"business.marketing"', bad: '"Marketing" — a label a table then guesses a key from' });
f({ path: "question.topicLabel", owner: "question", type: "string", required: false, omission: "none",
  studentProse: true,
  means: "the topic in words, for a subject that has no syllabus library at all. Never present beside topicRef: a question carries a ref or a label.",
  surface: "the question header",
  good: '"Features of ancient societies: religion and belief"',
  bad: 'present at the same time as topicRef' });
f({ path: "question.directive", owner: "question", type: "enum", enumName: "directive", required: true,
  omission: "invalid", studentProse: true,
  means: "the command verb, which decides the directive family and therefore every slot label, sentence shape and piece of guidance downstream. Nothing else decides it.",
  surface: "the decode panel, the slot labels, the sentence shapes",
  good: '"Explain"',
  bad: '"Compare" today: it is in neither family, so the engine falls through to causal and scaffolds a comparison as a cause. An imported package may not rely on that fallback' });
f({ path: "question.text", owner: "question", type: "string", required: true, omission: "invalid",
  studentProse: true,
  means: "the question exactly as a student reads it. Every decode highlight anchors into this string.",
  surface: "the question header, the decode panel, the marking payload",
  good: '"Explain how target markets affect e-marketing, people, processes and physical evidence."',
  bad: 'a paraphrase that no longer contains the words the highlights anchor to' });
f({ path: "question.marks", owner: "question", type: "integer", range: [1, 40], required: true,
  omission: "invalid", studentProse: true,
  means: "what the question is worth, which sets the expected length and the band table.",
  surface: "the question header, the marking request", good: "20", bad: "0" });
f({ path: "question.terms.first", owner: "question", type: "string", required: false,
  omission: "capability:pathway-guided", studentProse: true,
  means: "the first of the two ends this question joins. The sentence shapes bind to it by name. It is NOT vocabulary: it carries no meaning and is never displayed as a definition.",
  surface: "the sentence shape frames, the stuck helper",
  good: '"target markets"', bad: 'a term the student is expected to have defined for them here' });
f({ path: "question.terms.second", owner: "question", type: "string", required: false,
  omission: "capability:pathway-guided", studentProse: true,
  means: "the second end. Both are present or neither is.",
  surface: "the sentence shape frames", good: '"the marketing mix"', bad: 'present without terms.first' });
f({ path: "question.overallArgument", owner: "question", type: "string", required: false,
  omission: "capability:writing-ready", studentProse: true,
  means: "the one line the whole essay is arguing, which every paragraph is held against.",
  surface: "the planner, the response map",
  good: '"Target markets decide what each element of the mix has to do."',
  bad: '"Discuss target markets." — a restatement of the task is not an argument' });
f({ path: "question.vocabRefs", owner: "question", type: "vocabRef[]", refTo: "vocabulary",
  required: false, omission: "none", studentProse: false,
  means: "the terms this question asks for by name. Vocabulary reaches a student because something named it, never because a term string appeared in prose.",
  surface: "the vocabulary panel, and nowhere else",
  good: '[{ "id": "business.vocab.market-segmentation", "role": "topic-context" }]',
  bad: '["market segmentation"] — a term string in a ref position is the pattern this replaced' });
f({ path: "question.studyRefs", owner: "question", type: "ref[]", refTo: "resources", required: false,
  omission: "none", studentProse: false,
  means: "the reading for this question. A resource is a label and a link to material the school already holds; no resource bytes live in this repository.",
  surface: "the Learn button's resource list",
  good: '["business.resource.marketing-ch6"]', bad: 'a URL inline, with no record behind it' });

// ===========================================================================
// RELATIONSHIP
// ===========================================================================
f({ path: "relationship.intro", owner: "question", type: "string", required: false,
  omission: "capability:writing-ready", studentProse: true,
  means: "what this question's two ends actually are, in the author's words. It replaced a sentence the engine synthesised, which was only ever true of Operations questions.",
  surface: "the setup screen, above the argument picker",
  good: '"Target markets are the groups a business chooses to serve. The marketing mix is what it does to serve them."',
  bad: 'a sentence generated from the stem' });
f({ path: "relationship.claims[].id", owner: "question", type: "id", required: true,
  omission: "invalid", studentProse: false,
  means: "the stable name of one claim the essay makes, so a pathway can point at it.",
  surface: "none", good: '"mkt-01-claim-1"', bad: '"1"' });
f({ path: "relationship.claims[].line", owner: "question", type: "string", required: true,
  omission: "invalid", studentProse: true,
  means: "the claim as a student reads it in the planner.",
  surface: "the planner's angle list",
  good: '"e-marketing extends reach to the chosen segment"',
  bad: '"e-marketing" — a section name is not a claim' });
f({ path: "relationship.claims[].left.label", owner: "question", type: "string", required: true,
  omission: "invalid", studentProse: true,
  means: "the cause end of the claim, authored. The engine used to recover it by splitting the line on the word \"to\".",
  surface: "the planner", good: '"e-marketing"', bad: 'derived by splitting the line' });
f({ path: "relationship.claims[].left.conceptRef", owner: "question", type: "ref", refTo: "concepts",
  required: false, omission: "capability:learning-complete", studentProse: false,
  means: "the concept record behind the cause end, so a student can open it.",
  surface: "the Learn button", good: '"business.concept.e-marketing"', bad: '"e-marketing"' });
f({ path: "relationship.claims[].relation", owner: "question", type: "enum", enumName: "relation",
  required: true, omission: "invalid", studentProse: true,
  means: "how the left end acts on the right end. Authored, because the difference between shaping and constraining is the argument.",
  surface: "the planner", good: '"shapes"', bad: '"relates to"' });
f({ path: "relationship.claims[].right[].label", owner: "question", type: "string", required: true,
  omission: "invalid", studentProse: true,
  means: "the effect end of the claim.",
  surface: "the planner", good: '"reach into the chosen segment"', bad: 'omitted, leaving a claim with one end' });
f({ path: "relationship.claims[].right[].criterionRef", owner: "question", type: "ref", refTo: "criteria",
  required: false, omission: "capability:assessment-complete", studentProse: false,
  means: "the objective or criterion the effect end names, so two questions arguing towards the same objective can be told they do.",
  surface: "the planner, the coverage report",
  good: '"business.marketing.objective.market-share"',
  bad: 'null where an objective registry entry exists. 65 criterion labels currently have no id, which is the largest single piece of work this contract creates' });
f({ path: "relationship.claims[].pathwayRefs", owner: "question", type: "string[]", required: false,
  omission: "none", studentProse: false,
  means: "which authored arguments serve this claim, so the planner and the argument picker agree.",
  surface: "the planner", good: '["mkt01-em-reach"]', bad: 'a pathway id that is not in this package' });

// ===========================================================================
// DECODE
// ===========================================================================
f({ path: "decode.verbMeaning", owner: "question", type: "string", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "what this directive verb demands, in this question, in plain words.",
  surface: "the decode panel",
  good: '"Show how or why one thing affects another."',
  bad: '"Explain means to explain."' });
f({ path: "decode.plainEnglish", owner: "question", type: "string", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "the question restated so a student who stalls on its wording can still start.",
  surface: "the decode panel", good: 'the stem in ordinary words', bad: 'the stem again' });
f({ path: "decode.highlights[].anchor", owner: "question", type: "string", required: true,
  omission: "invalid", studentProse: true,
  means: "the exact substring of question.text this note attaches to. It must appear in the text or nothing on screen can be highlighted.",
  surface: "the decode panel's highlighted stem",
  good: '"Explain", where the stem begins with Explain',
  bad: '"Evaluate" on a stem that says Explain' });
f({ path: "decode.highlights[].note", owner: "question", type: "string", required: true,
  omission: "invalid", studentProse: true,
  means: "what that part of the stem is asking for.",
  surface: "the decode panel", good: 'a note about what the directive rules out', bad: 'a definition of the word' });
f({ path: "decode.cover.forEach", owner: "question", type: "string", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "what has to be done for every element the question names.",
  surface: "the coverage rail", good: '"Say what it changes and why."', bad: '"Cover everything."' });

// ===========================================================================
// REQUIREMENTS
// ===========================================================================
f({ path: "requirements.concepts", owner: "question", type: "string[]", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "the ideas a full answer has to use. Labels, not refs: this is the requirement rail, and it states what the answer must contain rather than opening a lesson.",
  surface: "the requirement rail", good: '["market segmentation", "service quality"]', bad: 'ids, which belong in conceptRefs' });
f({ path: "requirements.relationships", owner: "question", type: "string[]", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "the connections a full answer has to make, as distinct from the ideas it has to mention.",
  surface: "the requirement rail",
  good: '"a segmentation decision changes what each element of the mix has to do"',
  bad: '"segmentation"' });
f({ path: "requirements.accomplish", owner: "question", type: "string[]", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "what the answer as a whole has to achieve, which is what separates a complete response from a correct one.",
  surface: "the requirement rail, the marking request",
  good: '"holds one judgement rather than listing the areas it touched"',
  bad: '"answers the question"' });
f({ path: "requirements.syllabusSummary", owner: "question", type: "string", required: false,
  omission: "none", studentProse: true,
  means: "the syllabus wording this question sits under, in the author's summary. Original words: syllabus text is not reproduced.",
  surface: "the requirement rail", good: 'a one line summary', bad: 'a quotation from the syllabus document' });

// ===========================================================================
// CORE ANSWER
// ===========================================================================
f({ path: "coreAnswer.mode", owner: "question", type: "enum", enumName: "answerMode", required: false,
  omission: "capability:assessment-complete", studentProse: false,
  means: "the shape the model answer takes. It does NOT decide the directive family: the command does, and a mode that disagrees with the command is the second answer to a settled question.",
  surface: "none directly", good: '"causal" on an Explain question', bad: '"causal" on an Evaluate question' });
f({ path: "coreAnswer.statement", owner: "question", type: "string", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "the answer in one sentence, which the app compares a draft against.",
  surface: "the compare surface, on request only", good: 'one sentence', bad: 'a paragraph' });
f({ path: "coreAnswer.acceptableThesis", owner: "question", type: "string", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "what any acceptable thesis must contain, so a student's own wording can be accepted rather than matched.",
  surface: "the thesis check", good: 'the properties a thesis needs', bad: 'the one thesis that will be accepted' });
f({ path: "coreAnswer.checklist", owner: "question", type: "string[]", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "what the finished answer must contain, item by item.",
  surface: "the completion card", good: 'four short items', bad: 'a restatement of the criteria' });
f({ path: "coreAnswer.positions[].lean", owner: "question", type: "enum", enumName: "lean", required: true,
  omission: "capability:pathway-guided", studentProse: false, appliesTo: "judgement questions",
  means: "which way a position leans. A judgement question that offers no qualified position is offering a choice between two absolutes.",
  surface: "the position picker", good: '"qualified"', bad: 'positive and negative only' });
f({ path: "coreAnswer.criteria[].id", owner: "question", type: "id", required: true,
  omission: "capability:assessment-complete", studentProse: false, appliesTo: "judgement questions",
  means: "the stable name of one criterion the judgement is made against.",
  surface: "the judgement rail", good: '"cost"', bad: 'an index' });

// ===========================================================================
// WORKING ANSWER AND REASONING
// ===========================================================================
f({ path: "workingAnswer.base", owner: "question", type: "string", required: false,
  omission: "capability:writing-ready", studentProse: true,
  means: "the sentence the working answer builds from as the student picks arguments.",
  surface: "the working answer strip", good: 'a stem the picks extend', bad: 'a finished answer' });
f({ path: "reasoning.cause.label", owner: "question", type: "string", required: false,
  omission: "capability:pathway-guided", studentProse: true,
  means: "what the cause end of this question is called, so the app can tell a student their argument is running backwards.",
  surface: "the wrong-turn notice", good: '"the target market decision"', bad: 'omitted, which disables recovery entirely' });
f({ path: "reasoning.forward", owner: "question", type: "string", required: false,
  omission: "capability:pathway-guided", studentProse: true,
  means: "the direction the argument must run, stated once.",
  surface: "the wrong-turn notice", good: '"from the market to the mix"', bad: '"either way"' });

// ===========================================================================
// AREAS
// ===========================================================================
f({ path: "areas[].id", owner: "area", type: "id", required: true, omission: "invalid",
  studentProse: false,
  means: "the question-local name of one element this question names. Question-local by decision: an area is whatever the question genuinely needs.",
  surface: "the coverage rail, the argument picker", good: '"e-marketing"', bad: 'a syllabus id' });
f({ path: "areas[].label", owner: "area", type: "string", required: true, omission: "invalid",
  studentProse: true,
  means: "the element in the words a student reads. It is never matched against syllabus prose: matching a label against text is the inference this contract exists to remove.",
  surface: "the coverage rail", good: '"physical evidence"', bad: 'a label chosen to match a syllabus heading' });
f({ path: "areas[].syllabusRefs", owner: "area", type: "ref[]", refTo: "syllabus", required: false,
  omission: "none", studentProse: false,
  means: "the syllabus nodes this area claims to cover, if the author claims any. Claimed means resolved: a ref that names nothing is an error, and claiming nothing is valid.",
  surface: "the study content panel",
  good: '["business.marketing.marketing-strategies.e-marketing"]',
  bad: 'a ref left in after the node was renamed' });
f({ path: "areas[].guidance.<slot>.direct", owner: "area", type: "string", required: false,
  omission: "capability:pathway-guided", studentProse: true, enumName: "slot",
  means: "the one line always shown for this slot when the student is writing about this area.",
  surface: "the composer's guidance line", good: 'one instruction', bad: 'a model sentence to copy' });
f({ path: "areas[].vocabRefs", owner: "area", type: "vocabRef[]", refTo: "vocabulary", required: false,
  omission: "none", studentProse: false,
  means: "terms this area asks for by name.",
  surface: "the vocabulary panel", good: '[{ "id": "business.vocab.servicescape", "role": "topic-context" }]',
  bad: 'a role outside the four' });

// ===========================================================================
// PATHWAYS
// ===========================================================================
f({ path: "pathways[].id", owner: "pathway", type: "id", required: true, omission: "invalid",
  studentProse: false,
  means: "the stable name of one argument. It is written into saved sentences, so it can never change.",
  surface: "none", good: '"mkt01-pr-speed"', bad: 'two pathways sharing one' });
f({ path: "pathways[].areaRef", owner: "pathway", type: "string", refTo: "areas in this package",
  required: false, omission: "capability:pathway-guided", studentProse: false,
  means: "which element of the question this argument belongs to.",
  surface: "the argument picker's grouping", good: '"processes"', bad: 'an area id this package does not define' });
f({ path: "pathways[].short", owner: "pathway", type: "string", required: true,
  omission: "capability:pathway-guided", studentProse: true,
  means: "the argument in four or five words, as it appears on the choosing card.",
  surface: "the argument picker", good: '"ordering steps -> speed"', bad: 'a full sentence' });
f({ path: "pathways[].relationship", owner: "pathway", type: "string", required: true,
  omission: "capability:pathway-guided", studentProse: true,
  means: "the relationship this argument asserts, in one line.",
  surface: "the argument picker, the composer header",
  good: '"a shorter ordering process cuts the wait"', bad: '"processes are important"' });
f({ path: "pathways[].left.label", owner: "pathway", type: "string", required: false,
  omission: "capability:pathway-guided", studentProse: true,
  means: "the cause end of this argument, authored. The engine carries an explicit rule that it is never derived from `short` or `relationship`, which is what makes it semantic rather than presentational.",
  surface: "the sentence shape frames", good: '"the ordering process"', bad: 'derived from the short line' });
f({ path: "pathways[].left.conceptRef", owner: "pathway", type: "ref", refTo: "concepts", required: false,
  omission: "capability:learning-complete", studentProse: false,
  means: "the concept record behind the cause end.",
  surface: "the Learn button", good: '"business.concept.processes"', bad: '"processes"' });
f({ path: "pathways[].choiceMeaning", owner: "pathway", type: "string", required: true,
  omission: "capability:pathway-guided", studentProse: true,
  means: "what choosing this argument commits the student to. Without it the picker is a list of labels and a student cannot tell what they are choosing between.",
  surface: "the argument picker's expanded card",
  good: '"A decision about staff only reaches the customer through what those staff are taught to do."',
  bad: '"This is about people."' });
f({ path: "pathways[].whatToProve", owner: "pathway", type: "string", required: true,
  omission: "capability:pathway-guided", studentProse: true,
  means: "what this paragraph has to establish for the argument to hold.",
  surface: "the composer's target line", good: 'the one thing the paragraph must show', bad: 'a topic' });
f({ path: "pathways[].commonMistake", owner: "pathway", type: "string", required: true,
  omission: "capability:pathway-guided", studentProse: true,
  means: "the mistake students actually make on this argument, named before they make it.",
  surface: "the composer's watch-out line",
  good: '"describing the process instead of saying what it changed"', bad: '"be careful"' });
f({ path: "pathways[].mechanism.status", owner: "pathway", type: "enum", enumName: "mechanismStatus",
  required: true, omission: "capability:pathway-guided", studentProse: false,
  means: "whether the middle step of the relationship has been authored, is not needed, or has not been looked at.",
  surface: "none", good: '"authored"', bad: '"done"' });
f({ path: "pathways[].mechanism.text", owner: "pathway", type: "string", required: false,
  omission: "capability:pathway-guided", studentProse: true,
  means: "the middle step: how the cause reaches the effect. It is the difference between an argument and an assertion.",
  surface: "the composer's mechanism line",
  good: '"staff are trained to the standard, so what the customer gets stops depending on who is on shift"',
  bad: 'a restatement of the relationship' });
f({ path: "pathways[].conceptRef", owner: "pathway", type: "ref", refTo: "concepts", required: false,
  omission: "capability:learning-complete", studentProse: false,
  means: "the concept this argument sits on, which is what the Learn button opens.",
  surface: "the Learn surface", good: '"business.concept.training"', bad: 'a syllabus node id' });
f({ path: "pathways[].syllabusRef", owner: "pathway", type: "ref", refTo: "syllabus", required: false,
  omission: "capability:learning-complete", studentProse: false,
  means: "the syllabus node this argument is written against. Replaces a {topic, section, point} prose triple matched by PREFIX: nine of the twenty-eight authored triples resolve only that way, so \"rewards\" finds \"rewards - monetary and non-monetary, individual or group, performance pay\".",
  surface: "the study content drawer",
  good: '"business.hr.strategies.rewards"',
  bad: '{ "topic": "human_resources", "section": "strategies", "point": "rewards" }' });
f({ path: "pathways[].learningRef", owner: "pathway", type: "ref", refTo: "lessons", required: false,
  omission: "capability:learning-complete", studentProse: false,
  means: "the lesson that teaches this argument to a student who does not know the content. A pathway may REFERENCE teaching; it may not contain a lesson.",
  surface: "the Learn surface", good: '"business.lesson.people-training"',
  bad: 'an inline lesson object, which is the thing this ref replaced' });
f({ path: "pathways[].learning.status", owner: "pathway", type: "enum", enumName: "learningStatus",
  required: true, omission: "capability:learning-complete", studentProse: false,
  means: "whether this argument has been through learning review. `none-required` is an authored decision that the argument needs no lesson, and is not the same as nobody having looked.",
  surface: "none", good: '"none-required"', bad: '"draft"' });
f({ path: "pathways[].evidenceRefs[].ref", owner: "pathway", type: "ref", refTo: "evidence",
  required: true, omission: "capability:evidence-complete", studentProse: false,
  means: "the evidence record this argument uses. Replaces a display LABEL matched case-insensitively against the bank, where two records sharing a label silently became one.",
  surface: "the evidence drawer", good: '"mcdonalds.marketing.mobile-ordering"',
  bad: '"App, loyalty rewards and mobile ordering"' });
f({ path: "pathways[].evidenceRefs[].role", owner: "pathway", type: "enum", enumName: "evidenceRole",
  required: false, omission: "capability:evidence-complete", studentProse: false,
  means: "what this item is doing for THIS argument. Authored, never inferred: a record in the same topic is topic-context and nothing stronger, and even that is a claim the author makes.",
  surface: "the evidence drawer's grouping", good: '"outcome-evidence"',
  bad: 'a role derived from which topic the record was filed under' });
f({ path: "pathways[].evidenceRefs[].why", owner: "pathway", type: "string", required: false,
  omission: "capability:evidence-complete", studentProse: true,
  means: "why this item supports this argument. It belongs to the pathway; the record belongs to the library.",
  surface: "the evidence drawer", good: 'one line tying the item to this argument', bad: 'a restatement of the fact' });
f({ path: "pathways[].evidenceRefs[].limits", owner: "pathway", type: "string", required: false,
  omission: "none", studentProse: true,
  means: "what this item does not prove, so a student does not claim more than it supports.",
  surface: "the evidence drawer",
  good: '"It shows the ordering process changed. It does not prove customers are more satisfied."',
  bad: 'omitted on an item that is easy to overclaim from' });
f({ path: "pathways[].guidance.<slot>.direct", owner: "pathway", type: "string", required: false,
  omission: "capability:pathway-guided", studentProse: true, enumName: "slot",
  means: "the one line always shown for this slot. `guides` and `help` were two fields for one idea; this is that idea with two depths.",
  surface: "the composer's guidance line", good: 'one instruction', bad: 'a sentence to copy' });
f({ path: "pathways[].guidance.<slot>.ladder[].rung", owner: "pathway", type: "enum",
  enumName: "ladderRung", required: true, omission: "capability:pathway-guided", studentProse: false,
  means: "which step of the escalating ladder this is. Order is the meaning: each rung gives more than the one before it, and a full ladder is five rungs.",
  surface: "the stuck helper", good: '"starter"', bad: 'two rungs with the same name' });
f({ path: "pathways[].guidance.<slot>.ladder[].text", owner: "pathway", type: "string", required: true,
  omission: "capability:pathway-guided", studentProse: true,
  means: "what this rung actually offers.",
  surface: "the stuck helper",
  good: 'at the example rung, a worked sentence about a DIFFERENT context',
  bad: 'a sentence about this question that a student can paste. Nothing may write into a student sentence' });
f({ path: "pathways[].vocabRefs", owner: "pathway", type: "vocabRef[]", refTo: "vocabulary",
  required: false, omission: "none", studentProse: false,
  means: "terms this argument asks for by name.",
  surface: "the vocabulary panel", good: '[{ "id": "business.vocab.service-standards", "role": "relationship-support" }]',
  bad: 'a term with no complete record. A partial record is never displayed' });
f({ path: "pathways[].contribution.role", owner: "pathway", type: "enum", enumName: "contributionRole",
  required: true, omission: "capability:pathway-guided", studentProse: false,
  appliesTo: "judgement questions",
  means: "whether this argument supports the judgement, limits it, or holds conditionally. A judgement question offering only support is offering a case, not a judgement, so pathway-guided requires at least one limitation.",
  surface: "the argument picker's grouping", good: '"limitation"', bad: 'every pathway marked support' });

// ===========================================================================
// MARKING
// ===========================================================================
f({ path: "marking.source", owner: "question", type: "enum", enumName: "markingSource", required: true,
  omission: "capability:assessment-complete", studentProse: false,
  means: "whether the marking guidance was authored for this question or assembled from the subject's criteria.",
  surface: "the marking rail", good: '"authored"', bad: '"official"' });
f({ path: "marking.bands", owner: "question", type: "band[]", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "band descriptors. Present only with a source: marking language is quoted from somewhere or it is invented, and inventing it is the one thing this app may never do.",
  surface: "the marking rail", good: 'descriptors with bandSource naming where they came from',
  bad: 'descriptors with bandSource null' });
f({ path: "marking.bandSource", owner: "question", type: "string", required: false,
  omission: "capability:assessment-complete", studentProse: true,
  means: "where the band descriptors came from.",
  surface: "the marking rail", good: '"general HSC band expectations"', bad: 'omitted while bands are present' });

// ===========================================================================
// SHARED LIBRARY RECORDS
// ===========================================================================
f({ path: "VocabularyRecord.term", owner: "shared:vocabulary", type: "string", required: true,
  omission: "invalid", studentProse: true, means: "the term itself.",
  surface: "the vocabulary panel", good: '"market segmentation"', bad: '"segmentation (see also targeting)"' });
f({ path: "VocabularyRecord.subject", owner: "shared:vocabulary", type: "string", required: true,
  omission: "invalid", studentProse: true,
  means: "what it means in this course, which is usually narrower than the plain sense. A record with a term and no subject meaning is a word with nothing attached, which is the thing this library exists to prevent.",
  surface: "the Learn surface's defined terms, and the vocabulary panel",
  good: '"dividing a total market into subgroups so that a business can choose which of them to serve"',
  bad: 'blank' });
f({ path: "VocabularyRecord.plain", owner: "shared:vocabulary", type: "string", required: false,
  omission: "level:displayable", studentProse: true,
  means: "what the word means in ordinary English, for a student who has never met it. Without it the record still teaches on the Learn surface and is not offered in the vocabulary panel.",
  surface: "the vocabulary panel",
  good: '"splitting a large group of people into smaller groups that are alike in some way"',
  bad: 'the subject definition again in different words' });
f({ path: "VocabularyRecord.example", owner: "shared:vocabulary", type: "string", required: false,
  omission: "level:displayable", studentProse: true,
  means: "the term doing its job in a sentence, in a context other than this question.",
  surface: "the vocabulary panel", good: 'one sentence, about a different business',
  bad: 'a sentence a student could paste into their answer' });
f({ path: "ConceptRecord.requiresTeaching", owner: "shared:concepts", type: "enum",
  enumName: "requiresTeaching", required: true, omission: "invalid", studentProse: false,
  means: "whether this concept always needs teaching, needs it only in context, or never does. It was authored as the boolean true and as the string \"contextual\", and a field with two types is an unknown-enum fault waiting to happen.",
  surface: "none", good: '"contextual"', bad: 'true' });
f({ path: "ConceptRecord.vocabRefs", owner: "shared:concepts", type: "vocabRef[]", refTo: "vocabulary",
  required: false, omission: "none", studentProse: false,
  means: "the terms this concept defines, as refs. Concepts used to own {term, meaning} pairs directly, which made two definition systems; vocabulary has one authority and this is how a concept points into it.",
  surface: "the Learn surface's defined terms",
  good: '[{ "id": "business.vocab.processes", "role": "topic-context" }]',
  bad: 'an inline terms array with meanings in it' });
f({ path: "EvidenceRecord.source", owner: "shared:evidence", type: "string", required: false,
  omission: "capability:evidence-complete", studentProse: true,
  means: "where the fact came from. 0 of 58 records currently carry one, so no question can reach evidence-complete today. That is the report telling the truth about the content, and the requirement is not weakened to make the top state reachable.",
  surface: "the evidence drawer", good: 'a named, checkable source', bad: 'a plausible-looking citation nobody checked' });
f({ path: "EvidenceRecord.verify", owner: "shared:evidence", type: "boolean", required: false,
  omission: "none", studentProse: true,
  means: "that the figure moves and the student should check a current one themselves.",
  surface: "the evidence drawer's check line", good: "true on a market share figure", bad: 'used to excuse an unsourced fact' });
f({ path: "SyllabusNode.legacyTerms", owner: "shared:syllabus", type: "string[]", required: false,
  omission: "none", studentProse: false,
  means: "the term strings that sit beside a syllabus point in the source content. They have no meanings anywhere. Topic matching and the learning allowlist read them; nothing displays them, and they can never satisfy a vocabRef, because a ref names an id and a term string in a ref position is an error.",
  surface: "none. 477 of these were rendered as chips with no meaning attached and that is what the name records",
  good: 'left alone', bad: 'copied into vocabRefs' });
f({ path: "ResourceRecord.url", owner: "shared:resources", type: "url", required: true,
  omission: "invalid", studentProse: false,
  means: "where the material is. A link to what the school already holds, behind whatever access that platform applies. No resource bytes live in this repository.",
  surface: "the Learn button's resource list", good: 'a share link', bad: 'a file committed to the repository' });

module.exports = { FIELDS: F, ENUMS, LIBRARIES, CAPABILITIES, CONTAINERS };
