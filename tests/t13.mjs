// The reasoning-direction check, which has one job and one way to fail badly.
//
// It must tell three things apart:
//   knows nothing      names neither end of the relationship        SILENT
//   misconception      names both, running the wrong way            ASKS
//   valid alternative  names both, the right way, nobody authored it SILENT
//
// The third is the whole point. A soft prompt that fires on a legitimate
// sentence is worse than one that misses, so every case below that should be
// silent is a harder test than every case that should speak.
import { readFileSync } from "fs";
import { createContext, runInContext } from "vm";
import { setQuestion, esReasoningCheck } from "./wa.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };

const sandbox = { window: {} };
createContext(sandbox);
runInContext(readFileSync(new URL("../essay-content.js", import.meta.url), "utf8"), sandbox);
const subs = sandbox.window.ESSAY.subjects;
const Q = {};
Object.keys(subs).forEach(k => (subs[k].questions || []).forEach(q => { Q[q.id] = q; }));

const OPTS = { wantHalf: true, wantDegree: true };
const DIR = {};                       // direction only: the rule under test in 1-4
function on(id) { setQuestion(Q[id]); }
const kindOf = (t, o) => { const c = esReasoningCheck(t, o === undefined ? OPTS : o); return c ? c.kind : "silent"; };
function expect(id, text, want, why, opts) {
  on(id);
  const got = kindOf(text, opts === undefined ? DIR : opts);
  ok(got === want, `${id} expected ${want}, got ${got}: ${JSON.stringify(text)}${why ? "  (" + why + ")" : ""}`);
}

console.log("1. the misconception it was built for");
expect("fin-01", "Profitability determines which cost control a business chooses.", "backwards");
expect("fin-01", "Liquidity decides the cash flow management a business uses.", "backwards");
expect("fin-01", "Profitability drives the expense minimisation a business applies.", "backwards");
expect("fin-01", "Liquidity shapes cash flow management at Qantas.", "backwards");
expect("fin-01", "Profitability improves cost control across the business.", "backwards", "forward verb, cause as object");
expect("mkt-01", "E-marketing determines the target market a business sells to.", "backwards");
expect("hr-01", "Productivity determines the training a business provides.", "backwards");

console.log("2. arguments that run the right way, including ones nobody authored");
[
  ["fin-01", "Cost controls raise profitability."],
  ["fin-01", "Cash flow management improves liquidity at Qantas."],
  ["fin-01", "Leasing equipment instead of buying it keeps cash on hand and improves liquidity.", "not an authored pathway"],
  ["fin-01", "Hedging protects profitability when the dollar moves.", "authored area, unauthored phrasing"],
  ["fin-01", "Inventory control frees cash that was sitting in stock, which improves liquidity.", "nobody wrote this one"],
  ["mkt-01", "Customers who want convenience push a business to change its processes."],
  ["mkt-01", "A price sensitive target market shapes the promotion a business runs."],
  ["hr-01", "Training raises productivity significantly at McDonald's."],
  ["hr-01", "Job design lifts satisfaction, and the effect on turnover is substantial."],
  ["hr-01", "Flexible arrangements cut absenteeism for staff with children.", "unauthored phrasing"],
].forEach(([id, t, why]) => expect(id, t, "silent", why));

console.log("3. the effect leads, and the sentence is still fine");
[
  ["fin-01", "Liquidity improves when a business manages its cash flow.", "subordinator, not an object"],
  ["fin-01", "Liquidity is the objective that cash flow management is aimed at.", "no directional verb"],
  ["fin-01", "Profitability, liquidity and efficiency are the objectives of financial management.", "no strategy named"],
  ["fin-01", "Better liquidity means a business can pay its debts as they fall due.", "no strategy named"],
  ["fin-01", "In a large service business, profitability determines which cost control is used.", "buried subject, deliberately missed"],
  ["hr-01", "Productivity improves where training is carried out consistently.", "subordinator"],
  ["hr-01", "Turnover falls when job design gives staff more control.", "subordinator"],
].forEach(([id, t, why]) => expect(id, t, "silent", why));

console.log("4. knowing nothing is never a direction problem");
[
  ["fin-01", "I am not sure what to write here yet."],
  ["fin-01", "This paragraph will be about the business and what it does."],
  ["mkt-01", "McDonald's is a large business that operates around the world."],
  ["hr-01", "The business tries to do well and look after its staff."],
].forEach(([id, t]) => expect(id, t, "silent"));
on("fin-01");
ok(esReasoningCheck("Cost controls.", OPTS) === null, "a fragment is never judged");
ok(esReasoningCheck("", OPTS) === null, "and neither is nothing");

console.log("5. one end only, and only where it was asked for");
on("fin-01");
ok(kindOf("Cost controls matter a lot for this business.") === "half", "naming only the strategy is named as such");
ok(kindOf("Profitability is what this business is trying to improve.") === "half", "and so is naming only the objective");
ok(kindOf("Profitability, liquidity and efficiency are the objectives of financial management.") === "half",
  "a sentence about the objectives alone names one end");
ok(kindOf("Better liquidity means a business can pay its debts as they fall due.") === "half",
  "however well it explains that end");
ok(esReasoningCheck("Cost controls matter a great deal for this business.", {}) === null,
  "but silent where half an answer is a normal thing to have written");

console.log("6. a judgement question asks how far, not whether");
on("hr-01");
ok(kindOf("Training raises productivity at McDonald's.") === "degree", "a point that stops at helps is asked for a degree");
ok(kindOf("Training raises productivity significantly.") === "silent", "one that reaches a degree is not");
ok(kindOf("Training is highly effective at raising productivity.") === "silent", "however it is phrased");
ok(kindOf("Rewards lift output only where it can be measured.") === "silent", "including a conditional degree");
ok(kindOf("Job design lifts satisfaction, and the effect on turnover is substantial.") === "silent", "adjective or adverb");
ok(kindOf("Productivity improves where training is carried out consistently.") === "degree",
  "a sentence that runs the right way can still be short of a judgement");
ok(esReasoningCheck("Training raises productivity at McDonald's.", { wantHalf: true }) === null,
  "and the degree nudge is not shown where it was not asked for");
on("fin-01");
ok(kindOf("Cost controls raise profitability.") === "silent", "a causal question never asks for a degree");

console.log("7. it reads the question, not a list of answers");
on("fin-01");
const c = esReasoningCheck("Profitability determines which cost control a business chooses.", OPTS);
ok(c.cause === "a financial strategy" && c.effect === "a financial objective", "it names both ends in the question's own words");
ok(/how a strategy affects an objective/.test(c.ask), "and states the direction the question asks for");
ok(c.text === "profitability determines which cost control a business chooses.", "the claim it judged travels with it, for the acknowledgement to key on");
// every question that ships a reasoning block must be able to speak about itself
Object.keys(Q).forEach(id => {
  const q = Q[id];
  if (!q.reasoning) return;
  on(id);
  const badCause = (q.reasoning.cause.terms || []).filter(t => t !== t.toLowerCase());
  const badEffect = (q.reasoning.effect.terms || []).filter(t => t !== t.toLowerCase());
  ok(!badCause.length && !badEffect.length, id + ": every term is lowercase, because the text is lowercased before matching");
  const overlap = (q.reasoning.cause.terms || []).filter(t => (q.reasoning.effect.terms || []).indexOf(t) >= 0);
  ok(!overlap.length, id + ": no term sits on both ends of the relationship: " + overlap.join(", "));
});

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
