// A STUDENT'S ATTEMPT, REPLAYED THROUGH THE SHIPPED CONTRACT. Shared by the
// Slice B generators (04 Submit, 05 Results), so the two pages read one
// derivation and cannot disagree about the same attempt.
//
// A scenario is inputs only (sections, what was submitted, drafts, flags, the
// either/or choice, where the student is, which submissions the marker failed
// on). It is replayed into a real attempt with ATT.startPaper / startType,
// choose, record, setDraft and toggleFlag; marked by attempt.mjs's mark() (the
// paper's keys, scorePoints, and the shipped finalize() over the marker's
// review); and a failure's words are read out of app.js, never retyped. An
// answer given as "completed" reuses the completed attempt's input and review
// from attempts.fixture.json, so its mark is the one Pages 1 and 3 show.
import { paper as PAPER_JSON, mark, BORROWED, ASSESS, PAPER } from "./attempt.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "..", "..");
export const ATT = require(path.join(ROOT, "tools/contract/attempts.js"));
globalThis.window = globalThis;
require(path.join(ROOT, "essay-content.js"));
export const PACKAGES = window.ESSAY.subjects;
export const APP = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
export const DONE = JSON.parse(fs.readFileSync(path.join(HERE, "attempts.fixture.json"), "utf8")).completed;
export { ASSESS, PAPER };

export const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
export const list = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const day = iso => {
  const p = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "numeric" }).formatToParts(new Date(iso));
  return p.find(x => x.type === "day").value + " " + MONTHS[Number(p.find(x => x.type === "month").value) - 1];
};

// ---- the shipped words for what went wrong ----------------------------------------
// A failure code's sentence and its retry flag, as app.js records them.
export function appFailure(code, max) {
  const m = APP.match(new RegExp('ASSESS\\.fail\\("' + code + '",\\s*"([^"]+)",\\s*\\{[^}]*retry:\\s*(true|false)'));
  if (!m) throw new Error("app.js no longer records " + code + " this way");
  return ASSESS.fail(code, m[1], { max, retry: m[2] === "true" });
}
// gradeCalc wraps the reader's reason in this sentence.
const CALC_WRAP = 'ASSESS.refuse(rd.code, "This answer was not marked: " + rd.why + ".",';
if (!APP.includes(CALC_WRAP)) throw new Error("app.js no longer words an unreadable calculation this way");

// ---- the paper, held as the library holds it -------------------------------------
export const paper = Object.assign(JSON.parse(JSON.stringify(PAPER_JSON)), { id: "exam-mockup-1" });
export const exams = [paper];
export const subjectOf = c => { const a = ASSESS.resolveAuthority({ curriculum: c, packages: PACKAGES }); return a.ok ? a.label : c.course; };
export const SUBJECT = subjectOf(ASSESS.curriculumOf(paper));
export const TYPE_NAMES = { multiple_choice: "Multiple choice", short_answer: "Short answer", calculation: "Calculations",
                            business_report: "Business report", extended_response: "Extended response" };

// ---- replaying a scenario into a real attempt -------------------------------------------
const answerableAt = key => PAPER.answerables(paper, { 3: Number(key.split("-")[1]) }).find(a => ATT.keyOf(a) === key);
function inputOf(key, given) {
  if (given !== "completed") return { input: given, review: null };
  const b = BORROWED[key], raw = DONE.answers[key];
  if (raw === undefined) throw new Error("the completed attempt has no answer for " + key);
  return b ? { input: b.answer, review: b } : { input: raw, review: (DONE.reviews || {})[key] || null };
}
export function resultFor(key, given, fail) {
  const a = answerableAt(key);
  const { input, review } = inputOf(key, given);
  if (fail) return { stored: input, g: appFailure(fail, Number(a.q.marks)) };
  let g = mark(a, input, review);
  if (ASSESS.outcomeOf(g) === "refused" && g.code === "CALC_UNREADABLE") g = ASSESS.refuse(g.code, "This answer was not marked: " + g.why + ".", { max: g.max });
  // A multiple-choice answer is stored as the index of the choice.
  return { stored: input, g };
}
// The completed attempt Pages 1 and 3 show (Completed 30 Sep, 67 / 90).
export function completedAttempt() {
  const l = ATT.startPaper(paper, null, DONE.startedAt);
  Object.keys(DONE.choice || {}).forEach(si => ATT.choose(l, Number(si), DONE.choice[si], DONE.startedAt, paper));
  Object.keys(DONE.answers).forEach(k => { const r = resultFor(k, "completed"); ATT.record(l, k, r.stored, r.g, DONE.completedAt); });
  l.completedAt = DONE.completedAt;
  return l;
}
// `fx` is the scenario map; a scenario may name a `base` to extend.
export function scenario(fx, name) {
  let s = fx[name];
  if (s.base) s = Object.assign({}, fx[s.base], { drafts: Object.assign({}, fx[s.base].drafts, s.drafts), pending: s.pending });
  const T = s.startedAt;
  let a;
  if (s.scope === "type") {
    const bank = ATT.bank(s.format, exams, PACKAGES);
    if (!bank.length) throw new Error("no " + s.format + " questions to practise");
    a = ATT.startType(s.format, bank, T);
  } else {
    a = ATT.startPaper(paper, s.sections, T);
  }
  const key = k => s.scope === "type" ? paper.id + "#" + k : k;
  Object.keys(s.choice || {}).forEach(si => ATT.choose(a, Number(si), s.choice[si], T));
  const answers = s.answers === "completed" ? Object.fromEntries(Object.keys(DONE.answers).map(k => [k, "completed"])) : s.answers;
  Object.keys(answers).forEach(k => {
    const r = resultFor(k, answers[k], (s.fail || {})[k]);
    ATT.record(a, key(k), r.stored, r.g, s.updatedAt);
  });
  Object.keys(s.drafts || {}).forEach(k => ATT.setDraft(a, key(k), s.drafts[k], s.updatedAt));
  (s.flags || []).forEach(k => ATT.toggleFlag(a, key(k), s.updatedAt));
  ATT.moveTo(a, key(s.at), s.updatedAt);
  a.updatedAt = s.updatedAt;
  const rec = { current: a, last: s.last === "completed" ? completedAttempt() : null };
  return { s, a, rec, r: ATT.report(a, exams, (s.pending || []).map(key)) };
}
