// FOUR STUDENTS. They differ in what they know and in what they are willing to
// do about not knowing it, and in nothing else. No profile names a button.
//
// The paragraph-review knobs below obey the same rule. A student does not "press
// Save"; a student either understands a diagnosis or does not, is willing to look
// for help or is not, and rewrites a sentence in their own words or leaves it
// alone. journey.js turns that into presses. Anything phrased as a control
// belongs in journey.js, not here.
//
//   readsDiagnosis   will open a flagged part to find out what is wrong
//   actsOnDiagnosis  will rewrite the sentence the coach named
//   needsHelpFirst   cannot act until it has read the deeper authored guidance
//   revise(...)      the sentence they write, in their own words, from what the
//                    diagnosis told them - never the app's scaffold text
const { termsOf } = require("./lib");

const ZERO = {
  name: "zero knowledge",
  style: "plain",
  // Reads everything, cannot act on a diagnosis until it has read the deeper
  // guidance behind it, and then rewrites in plain words of its own.
  readsDiagnosis: true, actsOnDiagnosis: true, needsHelpFirst: true,
  revise(d, was) {
    return "Because these customers behave that way, the business changes what it does, and that is what the " +
      (d.label || d.slot) + " has to show.";
  },
  knowsAll: false, knowsSome: false,
  canJudge: false,                 // cannot evaluate a question they do not understand
  readsMeanings: true,             // will read what an option means before choosing it
  opensLearn: true,                // will go looking when that is not enough
  opensLesson: true,               // and will read the lesson about the argument it chose
  opensExplore: true,              // and the fuller resource under it, still not understanding
  transferProbe: true,             // then states the same relationship somewhere new
  tryOrder: [1, 0],                // tries a plausible wrong answer, then the right one
  usesHelp: true,                  // and will climb the help ladder rather than guess
  writesOwnArgument: false,
  checksPlanAfter: [],
  // takes the first argument it has not already used: it has no basis to prefer one
  pick(ids, k, q, used) { return ids.find(id => used.indexOf(id) < 0) || ids[0]; },
  answerTension() { return "keep"; },
};

const STRONG = {
  name: "strong independent",
  style: "strong",
  // Understands the diagnosis immediately and fixes the sentence without opening
  // anything optional. If this student ever opens More help, the acceptance suite
  // should say so rather than pass quietly.
  readsDiagnosis: true, actsOnDiagnosis: true, needsHelpFirst: false,
  revise(d, was) {
    return "Because that characteristic of the target market comes first, the business adopts the strategy in order to answer it.";
  },
  knowsAll: true,
  canJudge: true, position: "Effective, but dependent",
  readsMeanings: false,            // needs no explanation of terms it already holds
  opensLearn: false,
  opensLesson: false,              // and no lesson about an argument it could have written
  usesHelp: false,
  writesOwnArgument: true,
  checksPlanAfter: [],
  // knows the subject, so can name a relationship the question supports without
  // being shown the list. Derived from the question so the same student works on
  // any question rather than reciting hardcoded human-resources content.
  // names a relationship the question supports, from whatever this paragraph is
  // actually about, so its sentences are about the part it is answering
  ownArgument(k, cs, q, used, offered) {
    const pool = (offered && offered.length)
      ? (q.pathways || []).filter(x => offered.indexOf(x.id) >= 0)
      : (q.pathways || []);
    const path = pool[k % Math.max(pool.length, 1)] || pool[0] || {};
    // both ends named in the question's own vocabulary, because a student who
    // knows the subject states a relationship, not half of one
    const r = q.reasoning || {};
    const hay = ((path.short || "") + " " + (path.relationship || "") + " " + (path.adds || "")).toLowerCase();
    const pick = (side, fallback) => {
      const list = ((r[side] || {}).terms) || [];
      return list.find(x => hay.indexOf(x) >= 0) || list[0] || fallback;
    };
    const t = termsOf(path);
    const a = pick("cause", t[0] || "this"), b = pick("effect", t[1] || "performance");
    const judging = ((q.coreAnswer || {}).mode || "causal") === "judgement";
    const line = judging
      ? a.charAt(0).toUpperCase() + a.slice(1) + " raises " + b + " significantly at " + cs + ", where it is carried out well."
      : a.charAt(0).toUpperCase() + a.slice(1) + " changes " + b + " at " + cs + ", and I can show by how much.";
    return { line: line, terms: t };
  },
  pick(ids) { return ids[0]; },
  answerTension() { return "keep"; },
};

// Knows some of the content, takes a confident position, and then chooses
// arguments that pull against it. The app has to get them out of that without
// blocking them and without simply overruling the judgement.
const WRONG = {
  name: "plausible wrong turn",
  style: "wrong",
  // Acts on the diagnosis, and the first thing it writes is wrong in the same way
  // its argument was wrong: it restates the effect as the cause. Reads the deeper
  // guidance only after that fails, then repairs. Recovery, not a correct answer
  // supplied from the outset.
  readsDiagnosis: true, actsOnDiagnosis: true, needsHelpFirst: false, revisesTwice: true,
  revise(d, was, attempt) {
    return attempt === 1
      ? "The result is what makes the business decide, so the outcome explains the choice here."
      : "Because this characteristic of the market comes first, the business changes what it does in response to it.";
  },
  knowsAll: false, knowsSome: true,
  canJudge: true, position: "Highly effective",
  newPosition: "Moderately effective",
  readsMeanings: true,
  opensLearn: false,
  usesHelp: true,
  // On a judgement question the wrong turn is a position its own arguments
  // undercut. On a causal question there is no position to be wrong about, so
  // the wrong turn is the relationship stated the wrong way round. Both are
  // built from the question itself rather than hardcoded, so this student can
  // take a wrong turn on any question.
  writesOwnArgument(q) { return ((q.coreAnswer || {}).mode || "causal") !== "judgement"; },
  ownArgument(k, cs, q) {
    const r = q.reasoning || {};
    const eff = ((r.effect || {}).terms || [])[k] || ((r.effect || {}).terms || [])[0] || "the objective";
    const cau = ((r.cause || {}).terms || [])[k] || ((r.cause || {}).terms || [])[0] || "the strategy";
    return { line: eff.charAt(0).toUpperCase() + eff.slice(1) + " determines the " + cau + " a business chooses at " + cs + ".",
             terms: [] };
  },
  answerDirection(n) { return n === 1 ? "keep" : "revise"; },
  areaOrder: [1, 2, 3],            // straight past the area that would support them
  checksPlanAfter: [1, 2],
  pick(ids, k, q, used) {
    const roleOf = id => (((q.pathways || []).find(x => x.id === id) || {}).contribution || {}).role;
    const fresh = ids.filter(id => used.indexOf(id) < 0);
    const pool = fresh.length ? fresh : ids;
    return pool.find(id => roleOf(id) === "limitation") || pool.find(id => roleOf(id) === "conditional") || pool[pool.length - 1];
  },
  answerTension(n) { return n === 1 ? "keep" : "change"; },
};
// Knows roughly half the content. Reads what an option means, glances at the
// lesson, does not stop for the check, and writes. The profile that matters most,
// because it is the one a real student is likeliest to be.
const PARTIAL = {
  // Understands part of the diagnosis and uses limited support: it reads the
  // flagged part, does not go looking for the deeper guidance, and rewrites once.
  readsDiagnosis: true, actsOnDiagnosis: true, needsHelpFirst: false,
  revise(d, was) {
    return "This happens because the characteristic named in the question leads the business to change its approach.";
  },
  name: "partial knowledge",
  style: "plain",
  knowsAll: false, knowsSome: true,
  canJudge: true, position: "Effective, but dependent",
  readsMeanings: true,
  opensLearn: false,               // does not go looking in the generic drawer
  opensLesson: true,               // but will read the one about this argument
  tryOrder: [],                    // and does not stop to be tested
  usesHelp: true,
  writesOwnArgument: false,
  checksPlanAfter: [],
  pick(ids, k, q, used) { return ids.find(id => used.indexOf(id) < 0) || ids[0]; },
  answerTension() { return "keep"; },
};
module.exports = { ZERO, STRONG, WRONG, PARTIAL };
