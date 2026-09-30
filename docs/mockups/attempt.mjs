// AN ATTEMPT, DERIVED. Shared by every workflow page that shows one (library,
// overview, submit, results, review), so no page can type a number the student's
// answers do not produce.
//
// The attempt record is the minimal one fixed in docs/testmode-attempt-state.md:
// what the student did (sections chosen, answers, flags, the either/or choice,
// where they were, when). Everything a page shows about it - status, answered,
// flagged, marks - is computed here, from:
//
//   tests/fixtures/bus-practice-paper.json   the paper, as authored
//   attempts.fixture.json                    what a student did, and the marker's
//                                            reviews for the answers only a marker
//                                            can mark
//   the SHIPPED contract and worker          answerables() and tally() decide what
//                                            counts; scorePoints() and finalize()
//                                            decide the marks
//
// Multiple choice and calculation are read against the paper's own key (a
// choice's `ok`, a calculation's `expected` and `tolerance`), which is all the
// app's gradeMC and gradeCalc do. Written answers go where the app sends them:
// weighted points to ASSESS.scorePoints, everything else to the marker, which
// here is the fixture's review run through the shipped finalize().
import { createRequire } from "node:module";
import { finalize } from "../../tests/worker.mjs";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const ASSESS = require("../../tools/contract/assessment.js");
const PAPER = require("../../tools/contract/exam.js");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "..", "..");

export const paper = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/bus-practice-paper.json"), "utf8"));
const fx = JSON.parse(fs.readFileSync(path.join(HERE, "attempts.fixture.json"), "utf8"));
// The two long responses already reviewed for states 12 and 13 are reused rather
// than written twice, so the results a later page shows for them are the ones
// those frozen states show.
const S12 = JSON.parse(fs.readFileSync(path.join(HERE, "12-extended-response.fixture.json"), "utf8"));
const S13 = JSON.parse(fs.readFileSync(path.join(HERE, "13-business-report.fixture.json"), "utf8"));
const BORROWED = { "2-0": S13, "3-0": S12 };

export const keyOf = a => a.si + "-" + a.qi + (a.pi == null ? "" : "-" + a.pi);

function mark(a, input, review) {
  const q = a.q, f = ASSESS.normaliseFormat(q).format;
  if (f === "multiple_choice") {
    const ch = q.choices[input];
    return ASSESS.marked({ score: ch.ok ? q.marks : 0, max: q.marks, kind: "mc" });
  }
  if (f === "calculation") {
    const got = parseFloat(String(input).replace(/[^0-9.\-]/g, ""));
    const ok = Number.isFinite(got) && Math.abs(got - q.expected) <= q.tolerance;
    return ASSESS.marked({ score: ok ? q.marks : 0, max: q.marks, kind: "calc" });
  }
  const sp = ASSESS.scorePoints(q, input);
  if (sp.ok === true && sp.weighted) return ASSESS.marked({ score: sp.score, max: sp.max, kind: "points" });
  if (!review) throw new Error(keyOf(a) + " goes to the marker and the fixture carries no review for it");
  const mode = ASSESS.writtenModeOf(f) === "extended" ? "extended" : "short";
  const r = finalize(JSON.parse(JSON.stringify(review.review || review)), q.marks, input, null,
                     (review.criteria || S13.criteria), false, mode, null);
  return ASSESS.marked({ score: r.score, max: r.max, kind: "written" });
}

// The facts every page reads, and nothing else. `status` is one of three words.
export function derive(name) {
  const at = fx[name];
  if (at === undefined) throw new Error("no attempt called " + name);
  const sections = at ? at.sections : paper.sections.map((_, i) => i);
  const choice = at ? at.choice || {} : {};
  const items = PAPER.answerables(paper, choice).filter(a => sections.includes(a.si));
  const results = {};
  if (at) Object.keys(at.answers).forEach(k => {
    const a = items.find(x => keyOf(x) === k);
    if (!a) throw new Error(name + ": answer for " + k + ", which is not in the sections sat");
    const b = BORROWED[k];
    const input = b ? b.answer : at.answers[k];
    if (b && at.answers[k] !== "fixture:" + (k === "2-0" ? "13" : "12")) throw new Error(k + " should borrow its frozen state's answer");
    results[k] = mark(a, input, b || (at.reviews || {})[k]);
  });
  const t = ASSESS.tally(items.map(a => ({ marks: a.q.marks, result: results[keyOf(a)] })));
  const flagged = at ? (at.flags || []).filter(k => items.some(a => keyOf(a) === k)) : [];
  const status = !at ? "not_started" : at.completedAt ? "completed" : "in_progress";
  const current = at && at.at ? items.find(a => keyOf(a) === at.at) : null;
  return {
    status, sections, whole: sections.length === paper.sections.length,
    total: items.length, answered: t.done, notMarked: t.refused + t.failed,
    flagged: flagged.length, got: t.got, max: t.max,
    current: current ? { key: keyOf(current), display: current.display, item: items.indexOf(current) + 1 } : null,
    startedAt: at && at.startedAt, updatedAt: at && at.updatedAt, completedAt: at && at.completedAt,
    results, items,
  };
}
export { ASSESS, PAPER };
