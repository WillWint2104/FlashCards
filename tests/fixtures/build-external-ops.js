// AN EXTERNAL QUESTION PACKAGE, AUTHORED AGAINST THE PUBLISHED TEMPLATE.
//
// This is the input to the end-to-end proof: a Business Studies question that
// did not ship with the app, written the way a teacher outside Marginal would
// have to write one, using docs/contract/template-causal.json and the authoring
// guide and nothing else. It is built by a script rather than typed as JSON so
// the template is genuinely the starting point: every key the template defines
// is filled or explicitly cleared here, and a template that gains a field makes
// this script fail rather than quietly authoring around it.
//
// WHAT IT MAY NOT DO. It may not reference anything authored for another
// question. The four lessons in the shared library were written for mkt-01 and
// are about a marketing mix, so pointing an operations pathway at one of them
// would be borrowing support, which is the thing the whole runtime is built to
// refuse. Every lesson, concept and vocabulary record this question needs is
// PROVIDED by the package and is original to it.
//
// It also may not carry evidence. Evidence records need a source that somebody
// checked, and inventing one to reach evidence-complete would be fabricating
// exactly the kind of academic claim this project refuses to fabricate. So this
// package authors no evidence, and the readiness report says evidence-complete
// is not reached. That is the honest state, and the student journeys have to
// work without it.
//
//   node tests/fixtures/build-external-ops.js     rewrites the JSON beside it
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const TEMPLATE = path.join(ROOT, "docs/contract/template-causal.json");
const OUT = path.join(__dirname, "external-ops-package.json");

const t = JSON.parse(fs.readFileSync(TEMPLATE, "utf8"));
const ID = "bus-ext-ops-01";
const V = id => "bus.ext.vocab." + id;
// A vocabulary reference is an object naming a record by id, never the term
// itself: the validator refuses a bare string so that a package can never match
// vocabulary by its own text.
const VR = (id, role) => (role ? { id: V(id), role: role } : { id: V(id) });
const C = id => "bus.ext.concept." + id;
const L = id => "bus.ext.lesson." + id;
const SYL = "business.operations.operations-strategies.";

// ---- the vocabulary this question needs, defined here --------------------
// Original definitions. A term is only listed when this question's guidance
// actually uses it, because a vocabulary panel padded with terms nobody needs
// is a list to scroll past rather than a thing to read.
const vocabulary = {
  [V("performance-objective")]: {
    term: "performance objective", subject: "business_studies",
    plain: "A goal a business sets for how its operations should run, such as producing to a set standard, producing faster, producing more cheaply, or being able to change what it produces.",
    example: "A bakery that promises bread on the shelf by six every morning has set speed as a performance objective.",
  },
  [V("operations-strategy")]: {
    term: "operations strategy", subject: "business_studies",
    plain: "A deliberate change a business makes to how it produces, chosen because of what it wants its operations to achieve.",
    example: "Moving from ordering stock monthly to ordering it daily is an operations strategy.",
  },
  [V("defect")]: {
    term: "defect", subject: "business_studies",
    plain: "A unit of output that does not meet the standard the business set for it, so it has to be scrapped, remade or discounted.",
    example: "A shirt that leaves the line with a seam sewn open is a defect.",
  },
  [V("lead-time")]: {
    term: "lead time", subject: "business_studies",
    plain: "The time between a business placing an order and the goods being available to use or sell.",
    example: "If a cafe orders beans on Monday and they arrive on Thursday, the lead time is three days.",
  },
  [V("carrying-cost")]: {
    term: "carrying cost", subject: "business_studies",
    plain: "What it costs a business to hold stock it is not using yet: the space, the handling, the insurance, and the money tied up in it.",
    example: "A warehouse rented to hold spare parts is a carrying cost even in a month when no part is used.",
  },
  [V("non-core-process")]: {
    term: "non-core process", subject: "business_studies",
    plain: "A process a business needs done but that is not the thing customers choose it for.",
    example: "Payroll is a non-core process for a furniture maker.",
  },
  [V("changeover")]: {
    term: "changeover", subject: "business_studies",
    plain: "The work of switching a production line from making one thing to making another.",
    example: "Resetting a bottling line from 600ml to 1.25 litre bottles is a changeover.",
  },
};

// ---- the concepts a student may have to be taught -------------------------
const concepts = {
  [C("quality-at-source")]: {
    requiresTeaching: "contextual", kind: "domain",
    label: "checking quality where the work happens",
    vocabRefs: [V("defect")],
  },
  [C("time-and-stock")]: {
    requiresTeaching: "contextual", kind: "domain",
    label: "the relationship between how often you order and how much you hold",
    vocabRefs: [V("lead-time"), V("carrying-cost")],
  },
};

// ---- the lessons, written for THIS question --------------------------------
// Each teaches one idea a student needs to write one pathway, and each is about
// operations. Nothing here is a marketing lesson repurposed.
const lessons = {
  [L("quality-at-source")]: {
    title: "Why checking earlier costs less than checking later",
    conceptRef: C("quality-at-source"),
    steps: [
      { kind: "idea", text: "Every business decides where in its process it looks for mistakes. It can look at the end, when the unit is finished, or it can look at each stage as the work is done." },
      { kind: "idea", text: "A mistake found at the end has already had every later stage of work spent on it. A mistake found at the stage it happened has only had that stage spent on it." },
      { kind: "idea", text: "So moving the check earlier does not make the workforce more careful. It changes how much work is thrown away when somebody is not." },
      { kind: "check", text: "A mistake is made at stage two of six. Where does the business lose less: finding it at stage three, or finding it at stage six?", answer: "At stage three, because only stage two's work has been spent on it." },
    ],
  },
  [L("time-and-stock")]: {
    title: "Ordering more often, holding less",
    conceptRef: C("time-and-stock"),
    steps: [
      { kind: "idea", text: "Stock sitting in a business is work it has already paid for and has not sold yet. It takes up space, it has to be handled, and the money spent on it cannot be spent on anything else." },
      { kind: "idea", text: "Ordering in smaller amounts more often means less of it is sitting there at any moment, so the cost of holding it falls." },
      { kind: "idea", text: "The cost of that is exposure. A business holding one day of stock has one day to fix a supplier who does not deliver, and a business holding one month has a month." },
      { kind: "check", text: "A business moves from ordering monthly to ordering weekly. What has it gained, and what has it given up?", answer: "It holds less stock, so carrying cost falls. It has less cover if a delivery is late." },
    ],
  },
};

// ---- the areas: the four objectives the question names ---------------------
const areas = [
  { id: "quality", label: "quality", syl: "performance-objectives.quality",
    direct: "Name which performance objective this paragraph is about, and say that an operations strategy is what moves it.",
    vocabRefs: [VR("performance-objective"), VR("defect")] },
  { id: "speed", label: "speed", syl: "performance-objectives.speed",
    direct: "Say that this paragraph is about how quickly the business can produce, and name the strategy that changes it.",
    vocabRefs: [VR("performance-objective"), VR("lead-time")] },
  { id: "cost", label: "cost", syl: "performance-objectives.cost",
    direct: "Say that this paragraph is about what a unit costs the business to produce, and name the strategy that changes it.",
    vocabRefs: [VR("performance-objective"), VR("carrying-cost")] },
  { id: "flexibility", label: "flexibility", syl: "performance-objectives.flexibility",
    direct: "Say that this paragraph is about how easily the business can change what it produces, and name the strategy that changes it.",
    vocabRefs: [VR("performance-objective"), VR("changeover")] },
];

// ---- the pathways: two arguments per objective, so each is a choice ---------
const pathways = [
  {
    id: "ext-ops-q-source", areaRef: "quality", syl: "quality-management",
    short: "Checking at each stage → fewer defects reach the customer",
    relationship: "Moving quality checks into the process reduces the number of faulty units that get out of it",
    choiceMeaning: "You are arguing that quality is decided by where the business looks for mistakes, not by how hard it tries.",
    whatToProve: "the check moves from the end of the line into each stage → a fault is caught before more work is spent on it → fewer faulty units reach the customer",
    commonMistake: "Saying the business improves quality by caring about quality. That restates the objective instead of naming what changed.",
    mechanism: { status: "authored", reason: "The two ends do not meet on their own: a check happening earlier does not obviously mean fewer faults escape until the middle step is stated.",
      text: "A fault caught at the stage it is made is corrected before the next stage runs. A fault caught at the end has already passed every stage, so it leaves as finished output or is scrapped whole." },
    conceptRef: C("quality-at-source"), learningRef: L("quality-at-source"), learning: { status: "authored" },
    vocabRefs: [VR("defect")],
    guidance: {
      topic: { direct: "State the relationship: checking during the process rather than at the end of it changes how many faulty units get out." },
      explain: { direct: "Explain WHY an earlier check means fewer faults reach the customer. Name the step in the middle, not the result.",
        ladder: [
          { rung: "hint", text: "Think about what has already happened to a unit by the time it reaches the end of the line." },
          { rung: "needs", text: "Your sentence needs the middle step: what an earlier check lets the business do that a final check does not." },
          { rung: "direction", text: "Say what happens to a faulty unit when it is caught at the stage it was made, and then what happens when it is not caught until the end." },
          { rung: "frame", text: "Because the check happens at ___, a fault is found before ___, which means ___." },
          { rung: "starter", text: "Because the check happens as each stage finishes, a fault is found before the next stage runs, which means" },
          { rung: "example", text: "In a different context: a proofreader who reads each chapter as it is written finds a wrong character name before the next twelve chapters are built on it." },
        ] },
      example: { direct: "Apply your own example. State what the business actually checks and when, then say what that shows about defects." },
      effect: { direct: "Say what this achieves for the business, in terms of quality rather than general benefit." },
      link: { direct: "Tie it back: this is one way an operations strategy affects quality." },
    },
  },
  {
    id: "ext-ops-q-supplier", areaRef: "quality", syl: "supply-chain-management.global-sourcing",
    short: "Choosing suppliers on consistency → inputs that vary less",
    relationship: "Selecting suppliers on how consistent their inputs are reduces the variation the business has to absorb",
    choiceMeaning: "You are arguing that some of a business's quality is decided before anything arrives, by who it buys from.",
    whatToProve: "the business selects a supplier on consistency rather than price alone → the inputs arriving vary less → the output varies less",
    commonMistake: "Arguing that a more expensive supplier is a better one. The claim is about variation, not price.",
    mechanism: { status: "none-required", reason: "The two ends already meet. Inputs that vary less produce output that varies less, and a middle step would restate that.", text: null },
    conceptRef: null, learningRef: null, learning: { status: "none-required" },
    vocabRefs: [],
    guidance: {
      topic: { direct: "State the relationship: which supplier the business chooses decides how much variation arrives at the door." },
      explain: { direct: "Explain WHY consistent inputs produce consistent output. Say what the business no longer has to do.",
        ladder: [
          { rung: "hint", text: "Think about what the business has to do when a delivery is not quite the same as the last one." },
          { rung: "needs", text: "Your sentence needs to say what varying inputs force the process to absorb." },
          { rung: "direction", text: "Name the work that disappears when the input is the same every time: the adjusting, the re-sorting, the rejecting." },
          { rung: "frame", text: "When the input arriving is ___, the process no longer has to ___, so the output ___." },
          { rung: "starter", text: "When the input arriving is the same every time, the process no longer has to" },
          { rung: "example", text: "In a different context: a printer given paper of one weight does not have to reset the press between jobs." },
        ] },
      example: { direct: "Apply your own example. Say what the business buys and what it selects the supplier on." },
      effect: { direct: "Say what this achieves for quality specifically." },
      link: { direct: "Tie it back: this is one way an operations strategy affects quality." },
    },
  },
  {
    id: "ext-ops-s-jit", areaRef: "speed", syl: "inventory-management.jit",
    short: "Ordering to demand → a shorter path from order to delivery",
    relationship: "Ordering inputs against actual demand shortens the time between a customer ordering and the business delivering",
    choiceMeaning: "You are arguing that speed comes from removing waiting, not from working faster.",
    whatToProve: "inputs arrive against real demand rather than a forecast → less of the process is spent waiting for the right input → the customer waits less",
    commonMistake: "Saying the business becomes faster because it holds less stock. Holding less stock is the change; the speed comes from what the business no longer waits for.",
    mechanism: { status: "authored", reason: "Holding less stock sounds like it should make a business slower, not faster, so the step that resolves that has to be stated.",
      text: "Time in a process is mostly waiting rather than working. Ordering against real demand removes the wait for a forecast to be corrected, which is the wait that sits between the order and the work starting." },
    conceptRef: C("time-and-stock"), learningRef: L("time-and-stock"), learning: { status: "authored" },
    vocabRefs: [VR("lead-time")],
    guidance: {
      topic: { direct: "State the relationship: ordering against demand rather than a forecast changes how long the customer waits." },
      explain: { direct: "Explain WHY ordering to demand shortens the wait. Say which wait disappears.",
        ladder: [
          { rung: "hint", text: "Think about what a business is waiting for when it cannot start a job." },
          { rung: "needs", text: "Your sentence needs to name the wait that is removed, not just say things get faster." },
          { rung: "direction", text: "Separate the time spent working from the time spent waiting, and say which one this changes." },
          { rung: "frame", text: "Because inputs arrive ___, the business no longer waits for ___, so the time between ___ and ___ falls." },
          { rung: "starter", text: "Because inputs arrive against real orders, the business no longer waits for" },
          { rung: "example", text: "In a different context: a kitchen that preps to the bookings does not wait for the wrong prep to be redone." },
        ] },
      example: { direct: "Apply your own example. Say what the business orders and what it orders against." },
      effect: { direct: "Say what this achieves for speed specifically." },
      link: { direct: "Tie it back: this is one way an operations strategy affects speed." },
    },
  },
  {
    id: "ext-ops-s-tech", areaRef: "speed", syl: "technology.leading-edge",
    short: "Newer equipment → more output in the same hour",
    relationship: "Replacing equipment with a faster generation of it raises how much the business can produce in the time it has",
    choiceMeaning: "You are arguing the simplest version of speed: the same hour produces more.",
    whatToProve: "the business replaces the equipment doing the slowest step → that step takes less time → the whole process finishes sooner",
    commonMistake: "Arguing that new technology is faster without saying which step it changed. Replacing equipment that was never the constraint changes nothing.",
    mechanism: { status: "authored", reason: "A student who does not name the constraint will argue that any new equipment is faster, which is not true and is the mistake this pathway exists to prevent.",
      text: "A process finishes no faster than its slowest step. Replacing equipment only shortens the whole process when the equipment replaced was the step everything else was waiting on." },
    conceptRef: null, learningRef: null, learning: { status: "none-required" },
    vocabRefs: [],
    guidance: {
      topic: { direct: "State the relationship: replacing the equipment at the slowest step changes how much the business produces per hour." },
      explain: { direct: "Explain WHY this equipment, at this step, changes the whole process rather than one part of it.",
        ladder: [
          { rung: "hint", text: "Think about what decides how fast a chain of steps finishes." },
          { rung: "needs", text: "Your sentence needs to say which step was the constraint." },
          { rung: "direction", text: "Say what the rest of the process was waiting for, and what happens to that wait." },
          { rung: "frame", text: "The step at ___ was the one everything else waited on, so shortening it means ___." },
          { rung: "starter", text: "The step at the mixing stage was the one everything else waited on, so shortening it means" },
          { rung: "example", text: "In a different context: widening the narrowest section of a road changes the journey; widening a section that was already clear does not." },
        ] },
      example: { direct: "Apply your own example. Name the equipment and the step it sits at." },
      effect: { direct: "Say what this achieves for speed specifically." },
      link: { direct: "Tie it back: this is one way an operations strategy affects speed." },
    },
  },
  {
    id: "ext-ops-c-outsource", areaRef: "cost", syl: "outsourcing",
    short: "Outsourcing a non-core process → a fixed cost becomes a variable one",
    relationship: "Handing a non-core process to an outside provider turns the cost of running it into a cost that moves with use",
    choiceMeaning: "You are arguing that the saving is in the shape of the cost, not only in its size.",
    whatToProve: "the business stops running the process itself → it stops paying for that capacity whether or not it is used → cost now rises and falls with output",
    commonMistake: "Claiming outsourcing is cheaper. Sometimes it is not; what changes reliably is that the business stops paying for idle capacity.",
    mechanism: { status: "authored", reason: "Cheaper and differently shaped are two different claims, and a student who does not have the middle step will make the first one, which is not always true.",
      text: "Running a process in house means paying for the people and equipment to do it at its busiest, in every month including the quiet ones. Buying it means paying for what was used." },
    conceptRef: null, learningRef: null, learning: { status: "none-required" },
    vocabRefs: [VR("non-core-process")],
    guidance: {
      topic: { direct: "State the relationship: moving a non-core process outside the business changes what the business pays for it." },
      explain: { direct: "Explain WHY the cost changes shape. Say what the business was paying for before.",
        ladder: [
          { rung: "hint", text: "Think about what the in-house version of the process costs in a quiet month." },
          { rung: "needs", text: "Your sentence needs to say what the business stops paying for, not just that it saves money." },
          { rung: "direction", text: "Contrast paying for capacity with paying for use." },
          { rung: "frame", text: "In house the business paid for ___ whether or not ___, so buying it means ___." },
          { rung: "starter", text: "In house the business paid for the staff and equipment whether or not the work was there, so buying it means" },
          { rung: "example", text: "In a different context: hiring a van for the two days you move costs less than owning one you use twice a year." },
        ] },
      example: { direct: "Apply your own example. Name the process and say why it is not the thing customers choose the business for." },
      effect: { direct: "Say what this achieves for cost specifically." },
      link: { direct: "Tie it back: this is one way an operations strategy affects cost." },
    },
  },
  {
    id: "ext-ops-c-stock", areaRef: "cost", syl: "inventory-management.disadvantages-of-holding-stock",
    short: "Holding less stock → less money tied up in things not sold",
    relationship: "Reducing how much stock is held lowers what the business spends holding it",
    choiceMeaning: "You are arguing that stock is a cost while it sits there, not only when it is bought.",
    whatToProve: "the business holds less stock → it pays for less space, handling and tied-up money → the cost of producing a unit falls",
    commonMistake: "Treating this as the same argument as ordering to demand. That one is about time; this one is about what holding costs.",
    mechanism: { status: "none-required", reason: "The two ends already meet. Less stock held is less space, handling and money committed, and a middle step would restate it.", text: null },
    conceptRef: C("time-and-stock"), learningRef: L("time-and-stock"), learning: { status: "authored" },
    vocabRefs: [VR("carrying-cost")],
    guidance: {
      topic: { direct: "State the relationship: how much stock the business holds decides what it spends holding it." },
      explain: { direct: "Explain WHY held stock costs money even when nothing is bought that month.",
        ladder: [
          { rung: "hint", text: "Think about where the stock physically is, and what that space costs." },
          { rung: "needs", text: "Your sentence needs to name at least two of the things holding stock costs." },
          { rung: "direction", text: "Space, handling, insurance, and money that cannot be spent on anything else." },
          { rung: "frame", text: "Stock held is ___ and ___, so holding less of it means ___." },
          { rung: "starter", text: "Stock held is space the business rents and money it cannot spend elsewhere, so holding less of it means" },
          { rung: "example", text: "In a different context: a second fridge bought for one party costs power in every week there is no party." },
        ] },
      example: { direct: "Apply your own example. Say what the business holds and roughly how much of it." },
      effect: { direct: "Say what this achieves for cost specifically." },
      link: { direct: "Tie it back: this is one way an operations strategy affects cost." },
    },
  },
  {
    id: "ext-ops-f-design", areaRef: "flexibility", syl: "new-product-or-service-design-and-development",
    short: "Designing around shared parts → a range that can change without retooling",
    relationship: "Designing products around shared components lets the business change its range without rebuilding the process",
    choiceMeaning: "You are arguing that flexibility is designed in before production, not added to it afterwards.",
    whatToProve: "products are designed to share parts and steps → changing the range does not change most of the process → the business can respond without rebuilding",
    commonMistake: "Saying the business is flexible because it offers more products. A wide range built on unrelated processes is less flexible, not more.",
    mechanism: { status: "authored", reason: "More products sounds like more flexibility, so the step that separates the range from the process behind it has to be stated.",
      text: "What limits how quickly a business can change what it makes is how much of the process has to change with it. Products built from the same parts and steps share that process, so the change is at the end of it rather than through it." },
    conceptRef: null, learningRef: null, learning: { status: "none-required" },
    vocabRefs: [VR("changeover")],
    guidance: {
      topic: { direct: "State the relationship: how products are designed decides how much of the process has to change when the range does." },
      explain: { direct: "Explain WHY shared parts make the range easier to change. Say what does not have to change.",
        ladder: [
          { rung: "hint", text: "Think about what a business has to redo when it makes something genuinely new." },
          { rung: "needs", text: "Your sentence needs to say what stays the same, not just that changing is easier." },
          { rung: "direction", text: "Name what shared parts let the business avoid: retooling, retraining, requalifying suppliers." },
          { rung: "frame", text: "Because the products share ___, changing the range only changes ___ rather than ___." },
          { rung: "starter", text: "Because the products share the same base components, changing the range only changes" },
          { rung: "example", text: "In a different context: a menu built on one stock can add a dish without a new delivery." },
        ] },
      example: { direct: "Apply your own example. Name the shared part or step." },
      effect: { direct: "Say what this achieves for flexibility specifically." },
      link: { direct: "Tie it back: this is one way an operations strategy affects flexibility." },
    },
  },
  {
    id: "ext-ops-f-tech", areaRef: "flexibility", syl: "technology.established",
    short: "Equipment that does several jobs → capacity that can be redirected",
    relationship: "Choosing equipment that can be reset for several jobs lets the business move capacity to whatever is being demanded",
    choiceMeaning: "You are arguing that flexibility is a property of the equipment the business bought, and that it was paid for.",
    whatToProve: "the equipment can be reset between jobs → capacity can move to what is being demanded → the business can meet a change in demand without new equipment",
    commonMistake: "Ignoring what it costs. Equipment that does several jobs is usually slower at each one, and a paragraph that does not say so is arguing for something free.",
    mechanism: { status: "none-required", reason: "The two ends already meet. Equipment that can be reset is capacity that can be moved, and a middle step would restate the relationship.", text: null },
    conceptRef: null, learningRef: null, learning: { status: "none-required" },
    vocabRefs: [VR("changeover")],
    guidance: {
      topic: { direct: "State the relationship: equipment that can be reset between jobs is capacity the business can point at whatever is selling." },
      explain: { direct: "Explain WHY this is flexibility, and be honest about what it costs.",
        ladder: [
          { rung: "hint", text: "Think about what a business does when demand moves from one product to another." },
          { rung: "needs", text: "Your sentence needs to say what the business can do that it could not with single-purpose equipment." },
          { rung: "direction", text: "Say what the changeover involves, and what the business gives up for being able to do it." },
          { rung: "frame", text: "Because the equipment can be reset for ___, the business can ___, although ___." },
          { rung: "starter", text: "Because the equipment can be reset for a different product, the business can" },
          { rung: "example", text: "In a different context: one oven that roasts and bakes serves a changing menu, and does neither as fast as a dedicated one." },
        ] },
      example: { direct: "Apply your own example. Name the equipment and the jobs it can be set for." },
      effect: { direct: "Say what this achieves for flexibility specifically." },
      link: { direct: "Tie it back: this is one way an operations strategy affects flexibility." },
    },
  },
];

// ---- assemble against the template ----------------------------------------
const pkg = JSON.parse(JSON.stringify(t));
pkg.origin = { type: "imported", packageId: ID, author: "tests/fixtures/build-external-ops.js", authoredAt: "2026-09-05" };
pkg.provenance = { reviewState: "approved", publication: "unpublished",
  notes: "Authored outside the application against docs/contract/template-causal.json." };
// Everything this package references, declared. The validator compares this
// against what is actually referenced in both directions, so a list that drifts
// from the content is an error rather than a stale comment.
pkg.requires = {
  vocabulary: Object.keys(vocabulary).sort(),
  concepts: Object.keys(concepts).sort(),
  lessons: Object.keys(lessons).sort(),
  evidence: [],
  syllabus: [...new Set(["business.operations"]
    .concat(areas.map(a => SYL + a.syl))
    .concat(pathways.map(p => SYL + p.syl)))].sort(),
  resources: [],
};
pkg.provides = { vocabulary: vocabulary, concepts: concepts, lessons: lessons };

pkg.question = {
  id: ID, subject: "business_studies",
  // A ref or a label, never both: the label belongs to the syllabus record the
  // ref names, so carrying a second copy here is a second authority for it.
  topicRef: "business.operations", topicLabel: null,
  directive: "explain", marks: 20,
  text: "Explain how operations strategies affect the quality, speed, cost and flexibility of a business's operations.",
  note: null,
  areasLabel: "performance objectives",
  terms: { first: "Operations strategies", second: "Performance objectives" },
  overallArgument: "Each operations strategy changes something specific about how the business produces, and it is that change, rather than the intention behind it, that moves a performance objective.",
  vocabRefs: [VR("operations-strategy"), VR("performance-objective")],
  studyRefs: [],
};

pkg.relationship = {
  intro: "This question asks what an operations strategy actually does to the business, and which objective that change reaches.",
  claims: areas.map(a => ({
    id: "claim-" + a.id, line: "An operations strategy affects " + a.label + " by changing something specific in how the business produces.",
    left: { label: "an operations strategy", conceptRef: null },
    relation: "affects",
    right: [{ label: a.label, criterionRef: null }],
    pathwayRefs: pathways.filter(p => p.areaRef === a.id).map(p => p.id),
  })),
};

pkg.decode = {
  verbMeaning: "Explain means show how or why. For each objective you write about, the marker is looking for the step between the strategy and the objective, not just the pair of them.",
  plainEnglish: "Show how the things a business changes about the way it produces end up changing how well, how fast, how cheaply and how adaptably it produces.",
  coreRelationship: "A business changes something about how it produces, and that change moves one of the objectives it is measured on.",
  highlights: [
    { anchor: "operations strategies", note: "The changes the business makes. Each paragraph should name one." },
    { anchor: "quality", note: "How closely output matches the standard set for it." },
    { anchor: "speed", note: "How quickly the business can produce and deliver." },
    { anchor: "cost", note: "What it costs the business to produce a unit." },
    { anchor: "flexibility", note: "How easily the business can change what it produces." },
  ],
  cover: { forEach: "operations strategy → the specific change → the objective it moves",
    consistency: "Use one business consistently across the response, so the strategies you name are strategies that business could actually run." },
};

pkg.requirements = {
  concepts: ["operations strategy", "performance objective", "the difference between a change and its result"],
  relationships: areas.map(a => "how a named operations strategy moves " + a.label),
  accomplish: [
    "Name a specific operations strategy for each objective written about, not the objective again.",
    "State the step between the strategy and the objective.",
    "Keep one business across the response so the strategies are ones it could run.",
    "Say what each strategy costs the business as well as what it gains.",
  ],
  syllabusSummary: "Operations: operations strategies and the performance objectives they are chosen against.",
  requiredAreas: areas.map(a => ({ id: a.id, label: a.label })),
};

pkg.coreAnswer = {
  mode: "causal",
  pattern: "operations strategy → the specific change → the objective it moves",
  statement: "A business chooses operations strategies against the objectives it is under pressure on, and each strategy moves its objective by changing one concrete thing about how production runs.",
  explain: [
    "The strategy is the change, and the objective is the result. A paragraph that names both and not the step between them has described rather than explained.",
    "Objectives pull against each other, so a strategy that lifts one usually costs something on another. Saying so is part of the answer.",
  ],
  thesisIdea: "Say that operations strategies work by changing something specific in production, and that the objective moves as a result of that change.",
  acceptableThesis: "Operations strategies affect quality, speed, cost and flexibility because each one changes something concrete about how the business produces, and the objective moves as a consequence of that change rather than of the intention behind it.",
  checklist: [
    "Each paragraph names one operations strategy.",
    "Each paragraph names the objective it affects.",
    "The step between the strategy and the objective is stated, not implied.",
    "At least one paragraph says what the strategy costs as well as what it gains.",
  ],
};

pkg.workingAnswer = {
  base: "Operations strategies affect the performance objectives a business is measured on.",
  lead: "Operations strategies affect the performance objectives a business is measured on, because",
  join: ", and",
};

pkg.reasoning = {
  cause: { label: "an operations strategy", terms: ["quality management", "just in time", "outsourcing", "leading edge technology", "established technology", "supply chain", "inventory", "product design", "supplier selection"] },
  effect: { label: "a performance objective", terms: ["quality", "speed", "cost", "flexibility", "defects", "lead time", "carrying cost", "changeover"] },
  forward: "The question asks how the strategy affects the objective, so the sentence should travel from the change the business made to the objective it moved.",
  backward: "Your point currently names an objective and not the strategy that moves it. Say what the business changed first.",
};

// Original band descriptors, written for this package. They are not reproduced
// from any marking authority, and bandSource says exactly that, because an
// unattributed band descriptor on a student's screen is worse than none.
pkg.marking = {
  source: "authored",
  bandSource: "Written for this package by its author. Not reproduced from any external marking authority.",
  bands: [
    { range: "17-20", text: "Names a specific operations strategy for each objective, states the step between the strategy and the objective every time, and acknowledges what at least one strategy costs." },
    { range: "13-16", text: "Names specific strategies and states the step for most of them. One or more paragraphs pair a strategy with an objective without saying how it gets there." },
    { range: "9-12", text: "Names strategies and objectives correctly but mostly describes them rather than explaining the link between them." },
    { range: "5-8", text: "Discusses operations in general terms. Strategies and objectives are named loosely or interchangeably." },
    { range: "1-4", text: "Some correct terminology, without a relationship between a strategy and an objective." },
  ],
};

pkg.areas = areas.map(a => ({
  id: a.id, label: a.label,
  kind: "objective",
  syllabusRefs: [SYL + a.syl],
  guidance: { topic: { direct: a.direct } },
  vocabRefs: a.vocabRefs,
}));

pkg.pathways = pathways.map(p => ({
  id: p.id, areaRef: p.areaRef,
  short: p.short,
  adds: p.short,
  relationship: p.relationship,
  left: { label: p.short.split(" → ")[0], conceptRef: p.conceptRef },
  choiceMeaning: p.choiceMeaning,
  whatToProve: p.whatToProve,
  commonMistake: p.commonMistake,
  mechanism: { status: p.mechanism.status, text: p.mechanism.text, note: null, reason: p.mechanism.reason },
  conceptRef: p.conceptRef,
  syllabusRef: SYL + p.syl,
  learningRef: p.learningRef,
  learning: p.learning,
  // No evidence. See the note at the top of this file: a source nobody checked
  // is a fabricated citation, and this package will not carry one.
  evidenceRefs: [],
  vocabRefs: p.vocabRefs,
  guidance: p.guidance,
}));

fs.writeFileSync(OUT, JSON.stringify(pkg, null, 2) + "\n");
console.log("wrote " + path.relative(ROOT, OUT) + " (" + fs.statSync(OUT).size + " bytes)");
console.log("  areas " + pkg.areas.length + " | pathways " + pkg.pathways.length +
  " | vocabulary " + Object.keys(vocabulary).length +
  " | concepts " + Object.keys(concepts).length + " | lessons " + Object.keys(lessons).length);
