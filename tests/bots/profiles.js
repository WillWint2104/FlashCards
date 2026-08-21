// Three students. They differ in what they know and in what they are willing to
// do about not knowing it, and in nothing else. No profile names a button.
const { termsOf } = require("./lib");

const ZERO = {
  name: "zero knowledge",
  style: "plain",
  knowsAll: false, knowsSome: false,
  canJudge: false,                 // cannot evaluate a question they do not understand
  readsMeanings: true,             // will read what an option means before choosing it
  opensLearn: true,                // will go looking when that is not enough
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
  knowsAll: true,
  canJudge: true, position: "Effective, but dependent",
  readsMeanings: false,            // needs no explanation of terms it already holds
  opensLearn: false,
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
    const t = termsOf(path);
    const a = t[0] || "this", b = t[1] || "performance";
    return { line: a.charAt(0).toUpperCase() + a.slice(1) + " changes " + b + " at " + cs + ", and I can show by how much.",
             terms: t };
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
  knowsAll: false, knowsSome: true,
  canJudge: true, position: "Highly effective",
  newPosition: "Moderately effective",
  readsMeanings: true,
  opensLearn: false,
  usesHelp: true,
  writesOwnArgument: false,
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
module.exports = { ZERO, STRONG, WRONG };
