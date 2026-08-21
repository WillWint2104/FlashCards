// The working answer is a sentence built out of authored fragments, so the risk
// is not that a fragment is wrong but that a COMBINATION of them does not parse.
// Eight pathways make 255 non-empty subsets, which is cheap enough to render all
// of them and read every result mechanically. This runs the shipped assembler,
// not a copy: tests/mkwashim.js lifts it out of app.js.
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
// every non-empty subset, smallest first, capped at what an essay could hold
function subsets(ids, max) {
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

// ---- the qualifier appears exactly when something qualifies the judgement ----
const hr = questions.find(q => (q.coreAnswer || {}).mode === "judgement");
ok(!!hr, "a judgement question exists to test the qualifier against");
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

  // ---- judgement against argument shape: asks, never decides ----------------
  const pos = id => ({ position: id });
  const T = (p, pick, extra) => esPositionTension(draft(hr, pick, Object.assign({}, pos(p), extra || {})));
  const one = sup.slice(0, 1), twoLim = lim.slice(0, 2);
  ok(T("high", one.concat(twoLim)) !== null, "a positive judgement against mostly qualifying arguments raises a question");
  ok(T("high", sup.slice(0, 3)) === null, "a positive judgement with supporting arguments raises nothing");
  ok(T("limited", sup.slice(0, 2)) !== null, "a negative judgement against supporting arguments raises a question");
  ok(T("limited", lim.concat(cond.slice(0, 1))) === null, "a negative judgement against limiting arguments raises nothing");
  ok(T("conditional", sup.slice(0, 3)) !== null, "an it depends judgement where every argument pulls one way raises a question");
  ok(T("conditional", sup.slice(0, 1).concat(cond.slice(0, 1), lim.slice(0, 1))) === null, "a mixed set under a qualified judgement raises nothing");
  ok(T("high", one) === null, "one argument is never enough to question a judgement");
  ok(T("own:I think they work", one.concat(twoLim)) === null, "a position the student wrote is left alone");
  ok(T(null, one.concat(twoLim)) === null, "no position means nothing to question");
  const t = T("high", one.concat(twoLim));
  ok(t && t.label && t.ask, "the question names the judgement and what is odd about the arguments");
  ok(t && !/\bwrong\b|\bshould\b|\bdowngrade\b/i.test(t.ask), "it does not tell the student the judgement is wrong");
  ok(T("high", one.concat(twoLim), { posSeenAt: 3 }) === null, "dismissing it keeps it dismissed at the same argument count");
  ok(T("high", one.concat(twoLim, cond.slice(0, 1)), { posSeenAt: 3 }) !== null, "it returns when the shape moves again");
  const d = draft(hr, one.concat(twoLim), pos("high"));
  esPositionTension(d);
  ok(d.position === "high", "checking the tension never changes the student's judgement");
  ok(esWorkingAnswer(d).text.indexOf("Highly effective") < 0, "the working answer does not restate the judgement label");
}

// ---- a pathway with no adds would silently vanish from the answer -----------
questions.forEach(q => {
  const missing = q.pathways.filter(x => !x.adds).map(x => x.id);
  ok(!missing.length, q.id + ": every pathway contributes to the working answer, missing " + missing.join(", "));
});

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
