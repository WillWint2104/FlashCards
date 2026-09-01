// The working answer is a sentence built out of authored fragments, so the risk
// is not that a fragment is wrong but that a COMBINATION of them does not parse.
// Every non-empty subset of each question's pathways, capped at the six
// arguments an essay could hold, is rendered and read mechanically; the run
// prints how many that came to, which grows as questions are authored. This
// runs the shipped assembler, not a copy: tests/mkwashim.js lifts it out of
// app.js.
import { readFileSync } from "fs";
import { createContext, runInContext } from "vm";
import { setQuestion, esWorkingAnswer, esWorkingParts, esPositionTension } from "./wa.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };

const sandbox = { window: {} };
createContext(sandbox);
runInContext(readFileSync(new URL("../essay-content.js", import.meta.url), "utf8"), sandbox);
const subs = sandbox.window.ESSAY.subjects;
const questions = [];
Object.keys(subs).forEach(k => (subs[k].questions || []).forEach(q => { if (q.workingAnswer && q.pathways) questions.push(q); }));
ok(questions.length >= 3, "at least three questions carry a working answer, found " + questions.length);

function draft(q, ids, extra) {
  const paras = [{ role: "Introduction", text: "" }]
    .concat(ids.map((id, k) => ({ role: "Body " + (k + 1), body: true, argumentId: id, text: (extra && extra.written) ? "some prose here" : "" })))
    .concat([{ role: "Conclusion", text: "" }]);
  return Object.assign({ paras: paras }, extra || {});
}
// every non-empty subset, smallest first, capped at what an essay could hold.
// The mask is 32-bit, so past SWEEP_LIMIT this would silently enumerate nothing
// useful and the suite would report combinations it never rendered.
const SWEEP_LIMIT = 16;
function subsets(ids, max) {
  if (ids.length > SWEEP_LIMIT) throw new Error('too many pathways for the exhaustive sweep: ' + ids.length + ' > ' + SWEEP_LIMIT);
  const out = [];
  for (let mask = 1; mask < (1 << ids.length); mask++) {
    const pick = ids.filter((_, i) => mask & (1 << i));
    if (pick.length <= max) out.push(pick);
  }
  return out;
}

// ---- mechanical faults an assembled sentence must never show ----------------
function faults(text, q, ids) {
  const f = [];
  const lead = String(q.workingAnswer.lead || q.workingAnswer.base).trim();
  const join = String(q.workingAnswer.join || ", and").trim();
  const needsGerund = /\bby$/i.test(lead) || /\bby$/i.test(join);
  if (/\s{2,}/.test(text)) f.push("double space");
  if (/,\s*,|\s+,/.test(text)) f.push("stray comma");
  if (/\.\./.test(text)) f.push("double full stop");
  if (!/\.$/.test(text)) f.push("no full stop");
  if ((text.match(/\./g) || []).length !== 1) f.push("more than one full stop");
  if (!/^[A-Z]/.test(text)) f.push("does not start with a capital");
  if (/\b(\w+)\s+\1\b/i.test(text)) f.push("repeated word: " + (text.match(/\b(\w+)\s+\1\b/i) || [])[0]);
  if (/\b(and|by|but|or|although|though)\s*[,.]/i.test(text)) f.push("connective with nothing after it");
  if (/\bby\s+(though|although|but|and|because|which)\b/i.test(text)) f.push("connective following by");
  if (needsGerund) {
    const after = text.match(/\bby\s+([a-z]+)/gi) || [];
    after.forEach(m => { if (!/ing$/i.test(m.split(/\s+/)[1])) f.push("by not followed by an -ing phrase: " + m); });
  }
  const qual = q.workingAnswer.qualifier;
  if (qual && (text.split(qual).length - 1) > 1) f.push("qualifier appears twice");
  ids.forEach(id => {
    const a = (q.pathways.find(x => x.id === id) || {}).adds;
    if (a && (text.split(a).length - 1) > 1) f.push("adds repeated: " + a);
  });
  const words = text.trim().split(/\s+/).length;
  if (words > 12 + 26 * ids.length) f.push("sentence is " + words + " words for " + ids.length + " arguments");
  return f;
}

// ---- every subset of every question -----------------------------------------
let rendered = 0, worst = { words: 0, text: "" };
questions.forEach(q => {
  setQuestion(q);
  const ids = q.pathways.map(x => x.id);
  const wa0 = esWorkingAnswer(draft(q, []));
  ok(wa0 && wa0.broad && wa0.text === q.workingAnswer.base, q.id + ": no arguments gives the broad base answer");
  ok(wa0.from === 0 && wa0.written === 0, q.id + ": the broad answer counts nothing");

  const all = subsets(ids, 6);
  const bad = [];
  all.forEach(pick => {
    const wa = esWorkingAnswer(draft(q, pick));
    rendered++;
    const f = faults(wa.text, q, pick);
    if (f.length) bad.push(pick.join("+") + " -> " + f.join("; ") + "\n      " + wa.text);
    const w = wa.text.trim().split(/\s+/).length;
    if (w > worst.words) worst = { words: w, text: wa.text, n: pick.length };
  });
  ok(!bad.length, q.id + ": " + bad.length + " of " + all.length + " combinations render badly\n    " + bad.slice(0, 4).join("\n    "));

  // counts follow the plan, and "written" follows prose, never the other way round
  const two = ids.slice(0, 2);
  ok(esWorkingAnswer(draft(q, two)).from === 2, q.id + ": counts the arguments chosen");
  ok(esWorkingAnswer(draft(q, two)).written === 0, q.id + ": chosen but unwritten counts as nothing written");
  ok(esWorkingAnswer(draft(q, two, { written: true })).written === 2, q.id + ": written paragraphs are counted");
  ok(esWorkingAnswer(draft(q, two)).text === esWorkingAnswer(draft(q, two, { written: true })).text,
    q.id + ": writing prose does not change the working answer, only the plan does");
});
console.log("  rendered " + rendered + " combinations; longest " + worst.words + " words at " + worst.n + " arguments");

// ---- the same argument chosen twice is one thing the response says ----------
// Subsets can never reach this state, and it is exactly what a real student did:
// took the first option in two different paragraphs and got the phrase twice.
questions.forEach(q => {
  setQuestion(q);
  const ids = q.pathways.map(x => x.id);
  ids.forEach(id => {
    const once = esWorkingAnswer(draft(q, [id]));
    const twice = esWorkingAnswer(draft(q, [id, id]));
    const thrice = esWorkingAnswer(draft(q, [id, id, id]));
    ok(twice.text === once.text, q.id + "/" + id + ": arguing it twice says it once\n      " + twice.text);
    ok(thrice.text === once.text, q.id + "/" + id + ": and three times says it once");
    ok(twice.from === 1, q.id + "/" + id + ": and counts as one argument, not two: " + twice.from);
    ok(!faults(twice.text, q, [id]).length, q.id + "/" + id + ": with no mechanical fault");
  });
  if (ids.length >= 2) {
    const a = ids[0], b = ids[1];
    ok(esWorkingAnswer(draft(q, [a, a, b])).text === esWorkingAnswer(draft(q, [a, b])).text,
      q.id + ": a repeat among distinct arguments changes nothing");
    ok(esWorkingAnswer(draft(q, [a, b, a])).text === esWorkingAnswer(draft(q, [a, b])).text,
      q.id + ": wherever the repeat sits");
    ok(esWorkingAnswer(draft(q, [a, a, b])).from === 2, q.id + ": counted as two arguments");
  }
});

// ---- the qualifier appears exactly when something qualifies the judgement ----
// This block needs a particular SHAPE of judgement question: one offering a
// negative position and at least two different limitations, because half of what
// it asserts is a judgement sitting against arguments that pull the other way.
// It used to take the first judgement question in the bank and then name hr-01's
// position ids as literals, so authoring an earlier judgement question silently
// pointed it at positions that did not exist and every assertion here failed.
// It now says what it needs and resolves positions by their lean.
const leansOf = q => ((q.coreAnswer || {}).positions || []).map(x => x.lean);
const rolesOf = q => (q.pathways || []).reduce((a, x) => {
  const r = (x.contribution || {}).role; if (r) a[r] = (a[r] || 0) + 1; return a;
}, {});
const posByLean = (q, lean) => ((((q.coreAnswer || {}).positions || []).find(x => x.lean === lean)) || {}).id;
const isJudgement = q => (q.coreAnswer || {}).mode === "judgement";
const hr = questions.find(q => isJudgement(q) && leansOf(q).indexOf("negative") >= 0
  && (rolesOf(q).limitation || 0) >= 2 && (rolesOf(q).conditional || 0) >= 1 && (rolesOf(q).support || 0) >= 1);
ok(!!hr, "a judgement question with a negative position and two limitations exists to test the qualifier against");
if (hr) {
  setQuestion(hr);
  const ids = hr.pathways.map(x => x.id);
  const role = id => ((hr.pathways.find(x => x.id === id) || {}).contribution || {}).role;
  const of = r => ids.filter(id => role(id) === r);
  const sup = of("support"), cond = of("conditional"), lim = of("limitation");
  ok(sup.length && cond.length && lim.length, "the judgement question offers all three contribution roles");
  const q = hr.workingAnswer.qualifier;
  const has = pick => esWorkingAnswer(draft(hr, pick)).text.indexOf(q) >= 0;
  ok(!has(sup.slice(0, 1)), "one supporting argument does not pick up the qualifier");
  ok(!has(sup), "support only, however many, does not pick up the qualifier");
  ok(has(cond.slice(0, 1)), "one conditional argument picks up the qualifier");
  ok(has(lim.slice(0, 1)), "one limitation picks up the qualifier");
  ok(has(sup.slice(0, 1).concat(cond.slice(0, 1))), "support plus conditional picks up the qualifier");
  ok(has(sup.slice(0, 1).concat(lim.slice(0, 1))), "support plus limitation picks up the qualifier");
  ok(has(lim), "several limitations pick up the qualifier once");
  ok((esWorkingAnswer(draft(hr, lim)).text.split(q).length - 1) === 1, "several limitations do not repeat the qualifier");
  ok(has([lim[0], lim[0]]), "the same limitation written out twice still qualifies the judgement");
  ok((esWorkingAnswer(draft(hr, [lim[0], lim[0]])).text.split(q).length - 1) === 1, "and does not qualify it twice");

  // ---- judgement against argument shape: asks, never decides ----------------
  const pos = id => ({ position: id });
  const POSITIVE = posByLean(hr, "positive"), NEGATIVE = posByLean(hr, "negative"), QUALIFIED = posByLean(hr, "qualified");
  const T = (p, pick, extra) => esPositionTension(draft(hr, pick, Object.assign({}, pos(p), extra || {})));
  const one = sup.slice(0, 1), twoLim = lim.slice(0, 2);
  ok(T(POSITIVE, one.concat(twoLim)) !== null, "a positive judgement against mostly qualifying arguments raises a question");
  ok(T(POSITIVE, sup.slice(0, 3)) === null, "a positive judgement with supporting arguments raises nothing");
  ok(T(NEGATIVE, sup.slice(0, 2)) !== null, "a negative judgement against supporting arguments raises a question");
  ok(T(NEGATIVE, lim.concat(cond.slice(0, 1))) === null, "a negative judgement against limiting arguments raises nothing");
  ok(T(QUALIFIED, sup.slice(0, 3)) !== null, "an it depends judgement where every argument pulls one way raises a question");
  ok(T(QUALIFIED, sup.slice(0, 1).concat(cond.slice(0, 1), lim.slice(0, 1))) === null, "a mixed set under a qualified judgement raises nothing");
  ok(T(POSITIVE, one) === null, "one argument is never enough to question a judgement");
  ok(T(POSITIVE, [lim[0], lim[0]]) === null, "and neither is one argument written out twice");
  ok(T(POSITIVE, [lim[0], lim[0], lim[1]]) !== null, "two different limitations do question it");
  ok(T("own:I think they work", one.concat(twoLim)) === null, "a position the student wrote is left alone");
  ok(T(null, one.concat(twoLim)) === null, "no position means nothing to question");
  const t = T(POSITIVE, one.concat(twoLim));
  ok(t && t.label && t.ask, "the question names the judgement and what is odd about the arguments");
  ok(t && !/\bwrong\b|\bshould\b|\bdowngrade\b/i.test(t.ask), "it does not tell the student the judgement is wrong");
  const t0 = T(POSITIVE, one.concat(twoLim));
  ok(T(POSITIVE, one.concat(twoLim), { posSeenShape: t0.shape }) === null, "dismissing it keeps that shape dismissed");
  ok(T(POSITIVE, one.concat(twoLim, cond.slice(0, 1)), { posSeenShape: t0.shape }) !== null, "it returns when the shape moves again");
  // the reason the key is the shape and not a count: swapping one argument for
  // another of a different kind leaves the count identical and changes the
  // question entirely
  const swapped = T(POSITIVE, one.concat(lim.slice(0, 1), cond.slice(0, 1)), { posSeenShape: t0.shape });
  ok(swapped !== null, "and returns when an argument is swapped for a different kind without the count moving");
  ok(T(NEGATIVE, sup.slice(0, 2), { posSeenShape: t0.shape }) !== null,
    "a different judgement is never covered by another judgement's dismissal");
  const d = draft(hr, one.concat(twoLim), pos(POSITIVE));
  esPositionTension(d);
  ok(d.position === POSITIVE, "checking the tension never changes the student's judgement");
  const label = (((hr.coreAnswer || {}).positions || []).find(x => x.id === POSITIVE) || {}).label || "";
  ok(esWorkingAnswer(d).text.indexOf(label) < 0, "the working answer does not restate the judgement label");
}

// ---- the same reasoning, on every judgement question there is ---------------
// The block above needs one question's particular shape. These are the parts
// that need only a positive position and a limitation, so they run everywhere,
// which is how a newly authored judgement question gets checked rather than
// merely added.
questions.filter(isJudgement).forEach(q => {
  setQuestion(q);
  const ids = q.pathways.map(x => x.id);
  const role = id => ((q.pathways.find(x => x.id === id) || {}).contribution || {}).role;
  const sup = ids.filter(id => role(id) === "support");
  const lim = ids.filter(id => role(id) === "limitation");
  const positive = posByLean(q, "positive");
  ok(!!positive, q.id + ": offers a position to hold");
  ok(sup.length >= 1 && lim.length >= 1, q.id + ": offers something to weigh in both directions");
  if (!positive || !sup.length || !lim.length) return;
  const T2 = (p, pick, extra) => esPositionTension(draft(q, pick, Object.assign({ position: p }, extra || {})));
  ok(T2(positive, sup.slice(0, 3)) === null, q.id + ": a positive position with supporting arguments raises nothing");
  ok(T2(positive, [lim[0], lim[0]]) === null, q.id + ": one argument written out twice is not a pattern");
  if (lim.length >= 2) {
    const t = T2(positive, sup.slice(0, 1).concat(lim.slice(0, 2)));
    ok(t !== null, q.id + ": a positive position against two limitations raises a question");
    ok(t && !/\bwrong\b|\bshould\b|\bdowngrade\b/i.test(t.ask || ""), q.id + ": and asks rather than corrects");
    ok(T2(positive, sup.slice(0, 1).concat(lim.slice(0, 2)), { posSeenShape: t.shape }) === null,
      q.id + ": dismissing it keeps that shape dismissed");
  } else {
    // Not a gap to be filled by inventing a second limitation. Said out loud so
    // the coverage of this check is visible rather than assumed.
    console.log("  " + q.id + " has one limitation, so the two-limitation shape is not testable here");
  }
});

// ---- a pathway with no adds would silently vanish from the answer -----------
questions.forEach(q => {
  const missing = q.pathways.filter(x => !x.adds).map(x => x.id);
  ok(!missing.length, q.id + ": every pathway contributes to the working answer, missing " + missing.join(", "));
});

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
