// WHAT IS PRESENTED AS THE STUDENT'S WORDS HAS PASSED THE CHECK THAT SAYS SO.
//
// Five faults met in the marking pipeline, and each one let the product show a
// student something it could not prove. They are one line from coming back, and
// four of them reported themselves as clean while they were wrong.
//
//   ORDER. `overall.summary` and `next_steps` were string copies taken BEFORE
//   groundProse ran, and they are the only copies app.js reads. An invented
//   quoted run kept its quotation marks on the one paragraph a student reads
//   first, while checks.prose reported the review cleaned.
//
//   COVERAGE. `rubric[].descriptor` is the largest block of marker writing a
//   marked extended response shows, and groundProse never touched it. Nor the
//   band text, nor focus.area.
//
//   LENGTH. The quoted-run matcher was bounded at 240 characters, so anything
//   longer was not matched at all: it kept its marks and was not counted. Fail
//   open, in the one place that exists to fail closed.
//
//   FOCUS. `checks.focusQuoted` was `!!r.focus.quote` - a non-empty test, not a
//   verification result - and groundFocus's fallback assigned an unverified
//   sentence straight through, including one snapSentences had already failed
//   to locate.
//
//   SCOPE. snapSentences located a sentence against the WHOLE response, so a
//   model "sentence" welding the end of one paragraph to the start of the next
//   verified, counted as grounded, and became quotable back at the student.
//
// And one product rule underneath all of it: a marked paper in Test Mode could
// reach the Essay Practice workspace in one click.
import { createRequire } from "node:module";
import { finalize } from "./worker.mjs";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const ANSWER = `Northline Sportswear set a marketing objective of increasing its share of the teenage market, and most of its strategies were chosen to serve that objective. The business moved from print advertising to short video content on social platforms.

Its second strategy was a loyalty app that gave members early access to new releases. Sales to members grew faster than sales overall in the year after launch.`;

const REAL = "The business moved from print advertising to short video content on social platforms";
const FAKE = "an outstanding command of marketing theory";
const CRIT = ["knowledge and understanding of course content"];

// A review the model might return, with `over` replacing any part of it.
const review = over => Object.assign({
  summary: `You write "${FAKE}" throughout.`,
  paragraphs: [{ name: "P1", score: 5, max: 10, reasons: [], sentences: [
    { text: REAL + ".", issues: [{ kind: "fix", severity: "critical",
        head: `You write "${FAKE}" without support`, why: "w", ladder: [] }] }] }],
  rubric: [{ name: CRIT[0], score: 3, max: 5, descriptor: `You say "${FAKE}", which is not shown.`, bands: [] }],
  focus: { paragraph: 1, area: `The "${FAKE}" claim`, why: "w", quote: "" },
}, over || {});
const mark = over => finalize(review(over), 10, ANSWER, null, CRIT, false, "extended", null);
const quoted = (s, q) => String(s).includes('"' + q + '"');

// --- ORDER: the fields the app reads are derived AFTER grounding ------------
{
  const r = mark();
  ok(!quoted(r.overall.summary, FAKE), "overall.summary loses an unverifiable quotation");
  ok(r.overall.summary === r.summary, "overall.summary IS the grounded string, not a copy taken before it");
  ok(!quoted(r.next_steps[0], FAKE), "next_steps loses it too");
  ok(r.next_steps[0] === r.paragraphs[0].sentences[0].issues[0].head,
     "next_steps mirrors the grounded issue head rather than a stale one");
  ok(r.checks.prose.unquoted >= 2, "and the strips are counted: " + JSON.stringify(r.checks.prose));
}

// --- COVERAGE: the criterion narrative is marker prose and is covered -------
{
  const r = mark();
  ok(!quoted(r.rubric[0].descriptor, FAKE), "rubric[].descriptor loses an unverifiable quotation");
  ok(!quoted(r.criteria[0].comment, FAKE), "criteria[].comment, copied from the descriptor, is clean too");
  ok(!quoted(r.focus.area, FAKE), "focus.area is covered");
  const b = mark({ rubric: [{ name: CRIT[0], score: 3, max: 5, descriptor: "d",
    bands: [{ range: "1-2", text: `They wrote "${FAKE}".`, here: true }] }] });
  ok(!quoted(b.rubric[0].bands[0].text, FAKE), "band text is covered");
}

// --- LENGTH: fail closed above the old bound --------------------------------
{
  const LONG = "z".repeat(263);
  const r = mark({ summary: `You write "${LONG}" here.` });
  ok(!quoted(r.overall.summary, LONG), "a 263-character unverifiable run loses its quotation marks");
  ok(r.checks.prose.unquoted >= 1, "and is counted rather than skipped");
  const r2 = mark({ summary: `You write "${"z".repeat(1200)}" here.` });
  ok(!quoted(r2.overall.summary, "z".repeat(1200)), "so does a 1200-character one");
}

// --- and a GENUINE quotation still survives ---------------------------------
{
  const r = mark({ summary: `You write "${REAL}" here.` });
  ok(quoted(r.overall.summary, REAL), "a verbatim quotation keeps its quotation marks");
  ok(r.checks.prose.quoted >= 1, "and is counted as quoted");
}

// --- FOCUS: focusQuoted is a verification result ----------------------------
{
  const r = mark({ focus: { paragraph: 1, area: "a", why: "w",
    quote: "The candidate demonstrates an outstanding command of marketing theory." } });
  ok(r.checks.focusQuoted === false, "an unlocatable focus quote reports focusQuoted false");
  ok(!r.focus.quote || ANSWER.includes(r.focus.quote),
     "and whatever focus.quote holds is text the student actually wrote");
  const g = mark({ focus: { paragraph: 1, area: "a", why: "w", quote: REAL } });
  ok(g.checks.focusQuoted === true, "a located focus quote reports true");
  ok(ANSWER.includes(g.focus.quote), "and is the student's own characters");
}
{
  // the fallback path: no quote given, and the most severe issue sits on a
  // sentence that does not locate
  const r = mark({ focus: { paragraph: 1, area: "", why: "", quote: "" },
    paragraphs: [{ name: "P1", score: 5, max: 10, reasons: [], sentences: [
      { text: "A sentence the student never wrote at all.",
        issues: [{ kind: "fix", severity: "critical", head: "h", why: "w", ladder: [] }] }] }] });
  ok(r.checks.focusQuoted === false, "the fallback does not manufacture a focus quote from an unplaced sentence");
  ok(!r.focus.quote, "focus.quote is empty rather than the model's wording");
}

// --- SCOPE: a sentence cannot be welded across a paragraph break -------------
{
  const weld = "Sales to members grew faster than sales overall in the year after launch. However, the business also cut its prices.";
  const r = mark({ paragraphs: [{ name: "P1", score: 5, max: 10, reasons: [],
    sentences: [{ text: weld, issues: [] }] }] });
  ok(r.paragraphs[0].sentences[0].unplaced === true, "a sentence welded across a paragraph break is unplaced");
  ok(r.checks.grounded === 0, "and does not count as grounded");
  ok(!/\n\s*\n/.test(r.paragraphs[0].sentences[0].text), "no returned sentence contains a paragraph break");
}
{
  // a real sentence from paragraph 2, reported under paragraph 2
  const r = mark({ paragraphs: [
    { name: "P1", score: 2, max: 5, reasons: [], sentences: [{ text: REAL + ".", issues: [] }] },
    { name: "P2", score: 3, max: 5, reasons: [], sentences: [
      { text: "Sales to members grew faster than sales overall in the year after launch.", issues: [] }] }] });
  ok(r.paragraphs.every(p => p.sentences.every(s => !s.unplaced)), "real sentences still locate in their own paragraph");
  ok(r.checks.grounded === 1, "and are fully grounded");
  ok(r.paragraphs.every(p => p.sentences.every(s => ANSWER.includes(s.text))),
     "every returned sentence is verbatim from the answer");
}
{
  // THE FALLBACK PATH, which the scoped lookup alone does not cover.
  //
  // When the model returns more paragraphs than the response has, scopeFor has
  // no paragraph to scope to and hands back the whole-response index. A weld
  // then verifies again - so the blank-line refusal is what fails it closed,
  // and only this case exercises it. Found by a mutation that survived: removing
  // the refusal broke nothing, because every other test located inside a real
  // paragraph where a weld cannot match in the first place.
  const weld = "The business moved from print advertising to short video content on social platforms. Its second strategy was a loyalty app that gave members early access to new releases.";
  const r = mark({ paragraphs: [
    { name: "P1", score: 3, max: 4, reasons: [], sentences: [{ text: REAL + ".", issues: [] }] },
    { name: "P2", score: 3, max: 3, reasons: [], sentences: [
      { text: "Sales to members grew faster than sales overall in the year after launch.", issues: [] }] },
    { name: "P3", score: 0, max: 3, reasons: [], sentences: [{ text: weld, issues: [] }] }] });
  const third = r.paragraphs[2].sentences[0];
  ok(third.unplaced === true, "a weld in a paragraph the response does not have is refused, not located");
  ok(!/\n\s*\n/.test(third.text), "and no sentence comes back containing a paragraph break");
  ok(r.checks.grounded < 1, "the weld does not count as grounded: " + r.checks.grounded);
}
{
  // the same sentence reported under the WRONG paragraph does not verify
  const r = mark({ paragraphs: [
    { name: "P1", score: 5, max: 10, reasons: [], sentences: [
      { text: "Sales to members grew faster than sales overall in the year after launch.", issues: [] }] }] });
  ok(r.paragraphs[0].sentences[0].unplaced === true,
     "a paragraph-2 sentence claimed under paragraph 1 does not verify");
}

// --- THE PAYLOAD CARRIES NO CRITERION LINK, AND NOTHING MAY INVENT ONE ------
//
// This is the fault that sank the first extended-response design: a verified
// quotation filed under a named criterion, on an association the marker never
// returned. The schema is the evidence, so the schema is what is asserted.
{
  const w = fs.readFileSync(path.join(ROOT, "proxy", "worker.js"), "utf8");
  const rubricItem = w.slice(w.indexOf("      rubric: {"), w.indexOf("      rubric: {") + 1200);
  ok(/required: \["name", "score", "max", "descriptor", "bands"\]/.test(rubricItem),
     "a rubric item is name, score, max, descriptor and bands - and nothing that points at a sentence");
  const issueItem = w.slice(w.indexOf('kind: { type: "string", enum: ["fix", "term"] }'), w.indexOf('kind: { type: "string", enum: ["fix", "term"] }') + 900);
  ok(/required: \["kind", "severity", "head", "why", "ladder"\]/.test(issueItem),
     "an issue is kind, severity, head, why and ladder - and carries no criterion");
  ok(!/criterion:|criterionName|criterionIndex/.test(w),
     "no field anywhere in the worker names a criterion on an issue, sentence or paragraph");
  const r = mark();
  ok(r.criteria.every(c => !("issues" in c) && !("sentences" in c) && !("observations" in c)),
     "and finalize does not build one");
}

// --- focusQuoted is computed as a verification, and stays that way ----------
//
// Asserted against the SOURCE, and the reason is worth writing down. With
// groundFocus fixed, every path to focus.quote now runs through quoteSpan, so
// the quote is either the student's characters or empty - which makes a
// non-empty test and a verification test agree on every input this suite can
// construct. The guard is defence in depth behind groundFocus, and it becomes
// load-bearing again the moment groundFocus regresses. A behavioural assertion
// would be vacuous here; this one at least fails if the guard is removed.
{
  const w = fs.readFileSync(path.join(ROOT, "proxy", "worker.js"), "utf8");
  ok(/focusQuoted: !!\(r\.focus && r\.focus\.quote && verifyQuote\(idx, r\.focus\.quote\)\)/.test(w),
     "checks.focusQuoted verifies the quote rather than testing it for emptiness");
  const gf = w.slice(w.indexOf("function groundFocus"), w.indexOf("function groundFocus") + 2200);
  ok(!/quote = best\.text/.test(gf), "and groundFocus never assigns an unverified sentence to focus.quote");
}

// --- TEST MODE DOES NOT REACH THE REWRITE WORKSPACE -------------------------
{
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  // Matched as a DEFINITION OR CALL, not as a word: the comment recording the
  // removal names the function, and a bare /examOpenReview/ fails against the
  // note explaining why it went. Same trap t30 hit.
  ok(!/function examOpenReview|examOpenReview\s*\(/.test(app),
     "examOpenReview is neither defined nor called");
  ok(!/function examRevise|examRevise\s*\(/.test(app),
     "examRevise, which reopened the answer to be rewritten, is gone with it");
  ok(!/Work through the issues \(\$\{rvIssueCount/.test(app),
     "the exam sheet no longer offers `Work through the issues`");
  const sheet = app.slice(app.indexOf("function examSheet("), app.indexOf("async function examDeepReview"));
  ok(!/openReview\(/.test(sheet), "nothing in the exam sheet opens the review workspace");
  ok(!/hasReview/.test(sheet), "the branch that decided to open it is gone");
  ok(/examDeepReview\(item, key\)/.test(sheet), "the one remaining action asks the marker instead");
  const deep = app.slice(app.indexOf("async function examDeepReview"), app.indexOf("function examResults"));
  ok(!/openReview\(/.test(deep), "and the marker's answer comes back into the sheet, not into the workspace");
  ok(/examSheet\(item, key, g\)/.test(deep), "by re-rendering the sheet");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
