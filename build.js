#!/usr/bin/env node
// =============================================================================
// build.js — regenerate marginal-preview.html from the three sources.
//
// marginal-preview.html is a GENERATED single-file build of the whole app:
// it inlines content.js and app.js into the index.html shell so the app can be
// previewed or shared as one self-contained file. Never hand-edit it — edit the
// sources and re-run:  node build.js
//
// The TEACHER SETUP config block in index.html is carried through unchanged,
// so the single-file build picks up the same baked-in endpoint/class code.
// =============================================================================
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const shell = read("index.html");
const content = read("content.js");
const essay = read("essay-content.js");
const buscontent = read("business-content.js");
const app = read("app.js");

// Inline a source file as a <script> block. Use a replacer FUNCTION so `$` in
// the source (template literals etc.) is never interpreted as a replacement
// pattern, and assert the tag exists exactly once.
function inlineScript(html, srcTag, source) {
  if (/<\/script/i.test(source)) {
    throw new Error(`Source for ${srcTag} contains a literal </script — cannot inline.`);
  }
  const occurrences = html.split(srcTag).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one ${srcTag} in index.html, found ${occurrences}.`);
  }
  return html.replace(srcTag, () => `<script>\n${source}\n</script>`);
}

let out = shell;
out = inlineScript(out, '<script src="content.js"></script>', content);
out = inlineScript(out, '<script src="essay-content.js"></script>', essay);
out = inlineScript(out, '<script src="business-content.js"></script>', buscontent);
out = inlineScript(out, '<script src="app.js"></script>', app);

// ---------------------------------------------------------------------------
// PREVIEW EVIDENCE MUST NEVER REACH A BUILD
//
// tests/mkwalk.py can stamp unsourced evidence with a fake provenance string so
// the Evidence layer can be walked before real sources exist. That is a QA
// convenience, and a QA convenience left unguarded eventually becomes a
// production mistake. The build refuses to produce output that contains one.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// DECODE ANCHORS MUST MATCH THE CANONICAL STEM
//
// A highlight is an anchor string rather than a character offset, so it survives
// the stem being reworded. The cost of that is that a reworded stem can silently
// orphan an anchor, or make one ambiguous. The build checks both: every authored
// anchor must occur EXACTLY ONCE in the question's own text.
// ---------------------------------------------------------------------------
let essayLoadError = "";
function essaySubjects() {
  const sandbox = { window: {} };
  const vm = require("vm");
  vm.createContext(sandbox);
  try { vm.runInContext(essay, sandbox); } catch (e) { essayLoadError = "essay-content.js did not evaluate: " + e.message; return null; }
  return (sandbox.window.ESSAY && sandbox.window.ESSAY.subjects) || {};
}
function checkDecodeAnchors() {
  const subs = essaySubjects();
  if (!subs) return [essayLoadError];
  const bad = [];
  Object.keys(subs).forEach(key => {
    (subs[key].questions || []).forEach(q => {
      const hl = (q.decode && q.decode.highlights) || [];
      if (!hl.length) return;
      if (!q.text) { bad.push(`${key}/${q.id} has decode highlights but no question text`); return; }
      const areaIds = (((q.requirements || {}).requiredAreas) || []).map(a => a.id);
      hl.forEach(h => {
        const n = String(q.text).split(String(h.anchor)).length - 1;
        if (n !== 1) bad.push(`${key}/${q.id} anchor ${JSON.stringify(h.anchor)} occurs ${n} times in the stem, expected exactly 1`);
        // A highlight POINTS AT a required area; it never creates one. A ref that
        // matches nothing means the presentation and the requirements have drifted.
        if (h.kind === "requiredArea" && areaIds.length) {
          if (!h.ref) bad.push(`${key}/${q.id} highlight ${JSON.stringify(h.anchor)} is a requiredArea with no ref into requirements.requiredAreas`);
          else if (areaIds.indexOf(h.ref) < 0) bad.push(`${key}/${q.id} highlight ref ${JSON.stringify(h.ref)} is not one of requirements.requiredAreas [${areaIds.join(", ")}]`);
        }
      });
    });
  });
  return bad;
}
const anchorFaults = checkDecodeAnchors();
if (anchorFaults.length) {
  console.error("BUILD REFUSED: a decode highlight does not match its question.");
  anchorFaults.forEach(o => console.error("  - " + o));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// THE WORKING ANSWER IS ASSEMBLED, SO ITS PARTS HAVE A GRAMMAR
//
// What follows enforces THIS APPLICATION'S AUTHORED COMPOSITION PATTERN. It is
// not a grammar engine and does not claim to be one. English happily puts things
// other than "-ing" phrases after "by"; the rule here holds because these
// question families deliberately use that one construction. If a future question
// family resists the convention, change the schema to describe what that family
// actually does. Do not contort valid content to satisfy this file.
//
// The app joins `lead` + the chosen pathways' `adds` + `qualifier` into one
// sentence a student reads as the answer they are building. Nothing at runtime
// can tell whether the result parses, so the authoring convention has to be
// checked here rather than remembered: every add is a complement that follows
// the lead, all of them the same grammatical kind, none of them carrying its own
// conjunction or full stop. The gerund rule is derived from the lead itself, so
// a question that ends its lead in "by" demands "-ing" phrases and one that ends
// in "shaping" refuses them.
// ---------------------------------------------------------------------------
const ADDS_BANNED_FIRST = ["and", "but", "or", "so", "although", "though", "because",
  "which", "that", "while", "whereas", "however", "by", "with", "the-", "to"];
function checkWorkingAnswers() {
  const subs = essaySubjects();
  if (!subs) return [essayLoadError];
  const bad = [];
  Object.keys(subs).forEach(key => {
    (subs[key].questions || []).forEach(q => {
      const paths = q.pathways || [];
      const ids = paths.map((p, i) => p.id || String(i));
      const byId = {};
      paths.forEach((p, i) => { byId[p.id || String(i)] = p; });
      const w = q.workingAnswer;
      const at = `${key}/${q.id}`;
      const anyAdds = ids.some(id => byId[id].adds);
      if (!w) {
        if (anyAdds) bad.push(`${at} has pathway adds but no workingAnswer to assemble them into`);
        return;
      }
      if (!w.base) bad.push(`${at} workingAnswer has no base, so an unplanned response has nothing to say`);
      if (ids.length && !w.lead) bad.push(`${at} workingAnswer has no lead, so adds would be joined onto the base sentence`);
      const lead = String(w.lead || w.base || "").trim();
      const join = String(w.join || ", and").trim();
      const needsGerund = /\bby$/i.test(lead) || /\bby$/i.test(join);
      const seen = {};
      ids.forEach(id => {
        const a = byId[id].adds;
        if (!a) { bad.push(`${at} pathway ${id} has no adds, so choosing it would leave the working answer unchanged`); return; }
        const s = String(a).trim();
        const where = `${at} adds ${JSON.stringify(s)}`;
        if (s !== a) bad.push(`${where} has leading or trailing whitespace`);
        if (s.length > 90) bad.push(`${where} is ${s.length} characters; keep it under 90 or the assembled sentence sprawls`);
        if (/^[A-Z]/.test(s)) bad.push(`${where} starts with a capital; it continues the lead, it does not start a sentence`);
        if (/[.,;:]$/.test(s)) bad.push(`${where} ends in punctuation; the join and the full stop are added for you`);
        const first = s.split(/\s+/)[0].toLowerCase().replace(/[^a-z-]/g, "");
        if (ADDS_BANNED_FIRST.indexOf(first) >= 0) bad.push(`${where} starts with ${JSON.stringify(first)}; the lead and join supply the connective`);
        const isGerund = /ing$/.test(first);
        if (needsGerund && !isGerund) bad.push(`${where} must be an "-ing" phrase: this question's lead or join ends in "by"`);
        if (!needsGerund && isGerund) bad.push(`${where} is an "-ing" phrase but the lead does not end in "by"; the list would not parse`);
        const k = s.toLowerCase();
        if (seen[k]) bad.push(`${where} is a duplicate of pathway ${seen[k]}; two arguments would say the same thing`);
        seen[k] = id;
      });
      const qual = w.qualifier;
      if (qual) {
        const mode = (q.coreAnswer || {}).mode || "causal";
        if (mode !== "judgement") bad.push(`${at} has a workingAnswer qualifier but is not a judgement question; nothing would ever trigger it`);
        if (/^[A-Z]/.test(qual)) bad.push(`${at} qualifier starts with a capital mid-sentence`);
        if (/[.,;:]$/.test(qual)) bad.push(`${at} qualifier ends in punctuation`);
        if (/^(and|but|,)/i.test(qual.trim())) bad.push(`${at} qualifier starts with its own connective; a comma is added for you`);
        const roles = ids.map(id => ((byId[id].contribution || {}).role || ""));
        if (!roles.some(r => r === "conditional" || r === "limitation")) {
          bad.push(`${at} has a qualifier but no conditional or limitation pathway, so it can never appear`);
        }
      }
      // The judgement-versus-arguments check reads lean, never the label text.
      if (((q.coreAnswer || {}).mode) === "judgement") {
        const LEANS = ["positive", "qualified", "negative"];
        ((q.coreAnswer || {}).positions || []).forEach(p => {
          if (LEANS.indexOf(p.lean) < 0) bad.push(`${at} position ${p.id} has lean ${JSON.stringify(p.lean || "")}, expected one of ${LEANS.join(", ")}`);
        });
        ids.forEach(id => {
          const r = (byId[id].contribution || {}).role;
          if (["support", "conditional", "limitation"].indexOf(r) < 0) {
            bad.push(`${at} pathway ${id} has contribution role ${JSON.stringify(r || "")}; a judgement question needs one on every argument`);
          }
        });
      }
    });
  });
  return bad;
}
// ---------------------------------------------------------------------------
// AUTHORED TEXT IS SHOWN VERBATIM
//
// Every string in essay-content.js reaches a student as written. A literal
// "\\uXXXX" survives evaluation as six characters and is rendered as six
// characters, so a pathway shipped as "Training \\u2192 productivity" reads
// exactly that way on screen. Nothing at runtime can tell the difference between
// that and an intentional string, so it is caught here.
// ---------------------------------------------------------------------------
function checkLiteralEscapes() {
  const subs = essaySubjects();
  if (!subs) return [essayLoadError];
  const bad = [];
  const walk = (v, where) => {
    if (typeof v === "string") {
      const m = v.match(/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/);
      if (m) bad.push(`${where} ships the literal escape ${JSON.stringify(m[0])}, which a student reads as those characters: ${JSON.stringify(v.slice(0, 70))}`);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, where + "[" + i + "]")); return; }
    if (v && typeof v === "object") { Object.keys(v).forEach(k => walk(v[k], where + "." + k)); }
  };
  Object.keys(subs).forEach(key => (subs[key].questions || []).forEach(q => walk(q, `${key}/${q.id}`)));
  Object.keys(subs).forEach(key => walk(subs[key].concepts || {}, `${key}/concepts`));
  return bad;
}
const escapeFaults = checkLiteralEscapes();
if (escapeFaults.length) {
  console.error("BUILD REFUSED: authored text contains an escape a student would read literally.");
  escapeFaults.forEach(o => console.error("  - " + o));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// A QUESTION THAT CANNOT NOTICE A WRONG TURN SHOULD SAY SO
//
// The reasoning block is what lets the app tell an argument running the wrong
// way from one nobody happened to author. It is checked here because a typo in a
// term list fails silently at runtime: the check simply never fires, and the
// question looks fine.
// ---------------------------------------------------------------------------
function checkReasoning() {
  const subs = essaySubjects();
  if (!subs) return [essayLoadError];
  const bad = [];
  Object.keys(subs).forEach(key => (subs[key].questions || []).forEach(q => {
    const r = q.reasoning;
    const at = `${key}/${q.id}`;
    if (!r) {
      if ((q.pathways || []).length) bad.push(`${at} has pathways but no reasoning block, so nothing can notice an argument running the wrong way`);
      return;
    }
    ["cause", "effect"].forEach(side => {
      const s = r[side];
      if (!s || !s.label) { bad.push(`${at} reasoning.${side} has no label to name it to the student`); return; }
      const terms = s.terms || [];
      if (terms.length < 4) bad.push(`${at} reasoning.${side} has only ${terms.length} terms; too few to recognise the side at all`);
      terms.forEach(t => {
        if (t !== String(t).toLowerCase()) bad.push(`${at} reasoning.${side} term ${JSON.stringify(t)} is not lowercase, and the text is lowercased before matching, so it can never match`);
        if (/^\s|\s$/.test(t)) bad.push(`${at} reasoning.${side} term ${JSON.stringify(t)} has padding whitespace`);
      });
    });
    const overlap = (r.cause && r.cause.terms || []).filter(t => (r.effect && r.effect.terms || []).indexOf(t) >= 0);
    if (overlap.length) bad.push(`${at} reasoning has ${JSON.stringify(overlap)} on both ends of the relationship, so direction cannot be read`);
    if (!r.forward) bad.push(`${at} reasoning has no forward line, so the student would be told they are wrong without being told what right looks like`);
    if (!r.backward) bad.push(`${at} reasoning has no backward line to say what the point currently does instead`);
    const mode = (q.coreAnswer || {}).mode || "causal";
    if (r.degree && mode !== "judgement") bad.push(`${at} has a reasoning.degree but is not a judgement question, so it could never fire`);
    if (!r.degree && mode === "judgement") bad.push(`${at} is a judgement question with no reasoning.degree, so a point that stops at "this helps" passes unremarked`);
  }));
  return bad;
}
const reasoningFaults = checkReasoning();
if (reasoningFaults.length) {
  console.error("BUILD REFUSED: a question cannot check the direction of its own argument.");
  reasoningFaults.forEach(o => console.error("  - " + o));
  process.exit(1);
}

const waFaults = checkWorkingAnswers();
if (waFaults.length) {
  console.error("BUILD REFUSED: the working answer would not assemble cleanly.");
  waFaults.forEach(o => console.error("  - " + o));
  process.exit(1);
}

const PREVIEW_MARKERS = [
  { pattern: /PREVIEW ONLY/i, what: 'the "PREVIEW ONLY" provenance marker' },
  { pattern: /previewOnly\s*:\s*true/i, what: "a record flagged previewOnly: true" },
  { pattern: /evidencePreviewMode\s*:\s*(?!["']?development-only)/i, what: "evidencePreviewMode set to anything but development-only" },
];
const offences = [];
[["index.html", shell], ["content.js", content], ["essay-content.js", essay],
 ["business-content.js", buscontent], ["app.js", app]].forEach(([name, src]) => {
  PREVIEW_MARKERS.forEach(m => { if (m.pattern.test(src)) offences.push(`${name} contains ${m.what}`); });
});
if (offences.length) {
  console.error("BUILD REFUSED: preview evidence must never ship.");
  offences.forEach(o => console.error("  - " + o));
  console.error("Preview provenance is development-only. See EVIDENCE-SOURCES.md.");
  process.exit(1);
}

fs.writeFileSync(path.join(root, "marginal-preview.html"), out);
console.log(`built marginal-preview.html (${out.length} bytes)`);

// What the authored content can actually support, written out on every build so
// the architecture cannot quietly outrun it again.
const coverage = require("./tools/coverage.js");
const covRows = coverage.report();
fs.writeFileSync(path.join(root, "docs", "support-coverage.md"), coverage.format(covRows) + "\n");
console.log(coverage.summary(covRows));
