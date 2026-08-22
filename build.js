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
  // Returning {} here would let every check below pass by looping over nothing.
  // A file that evaluates but exports nothing is exactly the case the validators
  // exist for, so it has to reach them as an error and not as an empty pack.
  const subjects = sandbox.window.ESSAY && sandbox.window.ESSAY.subjects;
  if (!subjects || typeof subjects !== "object" || Array.isArray(subjects) || !Object.keys(subjects).length) {
    essayLoadError = "essay-content.js evaluated but exposed no window.ESSAY.subjects, so nothing could be checked";
    return null;
  }
  // Eight checks below iterate `(subs[key].questions || [])`. That default is
  // there for a subject that deliberately ships none, but it cannot tell such a
  // subject from one whose key was renamed or nulled, and in that case all eight
  // check nothing at once and the build still writes output. A subject with no
  // questions must SAY so, as an empty array.
  const shapeFaults = [];
  Object.keys(subjects).forEach(key => {
    const q = subjects[key].questions;
    if (q === undefined) shapeFaults.push(`subject ${key} has no questions key; a subject that ships none must say so as questions: []`);
    else if (!Array.isArray(q)) shapeFaults.push(`subject ${key} has questions of type ${q === null ? "null" : typeof q}, expected an array`);
  });
  if (shapeFaults.length) { essayLoadError = shapeFaults.join("; "); return null; }
  return subjects;
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
      // Having no requiredAreas is legitimate on a question that fixes no parts
      // (fin-01, hr-01). It is not legitimate on one whose own highlights tell the
      // student which parts to cover: those parts would then be required nowhere.
      if (hl.some(h => h.kind === "requiredArea") && !areaIds.length) {
        bad.push(`${key}/${q.id} has requiredArea highlights but no requirements.requiredAreas, so the parts it tells the student to cover are required nowhere`);
      }
      hl.forEach(h => {
        const n = String(q.text).split(String(h.anchor)).length - 1;
        if (n !== 1) bad.push(`${key}/${q.id} anchor ${JSON.stringify(h.anchor)} occurs ${n} times in the stem, expected exactly 1`);
        // A highlight POINTS AT a required area; it never creates one. A ref that
        // matches nothing means the presentation and the requirements have drifted.
        if (h.kind === "requiredArea") {
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
// THE STEM IN FRONT OF THE STUDENT IS THE QUESTION
//
// A question that fixes its parts teaches, decodes and marks against those
// parts. If the stem is a broader paraphrase, the student is shown one task and
// held to another, and nothing at runtime can notice: both halves are internally
// consistent. So the check is that the stem NAMES what the question requires,
// and that no two questions ship the same stem text as an alias of each other.
// See docs/inspiration/decisions/2026-08-19-canonical-stem.md.
// ---------------------------------------------------------------------------
function checkCanonicalStems() {
  const subs = essaySubjects();
  if (!subs) return [essayLoadError];
  const bad = [], seen = {};
  const norm = t => String(t || "").toLowerCase().replace(/[\u2019']/g, "'").replace(/\s+/g, " ").trim();
  Object.keys(subs).forEach(key => (subs[key].questions || []).forEach(q => {
    const where = `${key}/${q.id}`;
    const stem = norm(q.text);
    if (!stem) { bad.push(`${where} has no stem text`); return; }
    if (seen[stem]) bad.push(`${where} ships the same stem as ${seen[stem]}. Two questions with one stem is an alias, and the canonical-stem rule forbids it: give the broader wording its own id and its own authored content.`);
    else seen[stem] = where;
    const areas = ((q.requirements || {}).requiredAreas) || [];
    areas.forEach(a => {
      const label = norm(a.label || a.id);
      if (label && stem.indexOf(label) < 0) {
        bad.push(`${where} requires the part "${a.label || a.id}" but its own stem never names it: ${JSON.stringify(q.text)}. Either the stem is a broader paraphrase of the paper question, or the part should not be required.`);
      }
    });
  }));
  return bad;
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
    // Absence of pathways is normal: 16 of 19 questions are practice stems with
    // none, by design. What is not normal is a question with no pathways that
    // still carries the content only a pathway delivers. In the shipped pack the
    // two go together in 3 of 3 cases and apart in 16 of 16, so losing the
    // pathways while that content remains is drift, not authoring.
    if (!(q.pathways || []).length) {
      const orphans = [];
      if (q.workingAnswer) orphans.push("workingAnswer");
      if (q.reasoning) orphans.push("reasoning");
      if ((((q.requirements || {}).requiredAreas) || []).length) orphans.push("requirements.requiredAreas");
      if ((((q.decode || {}).highlights) || []).length) orphans.push("decode.highlights");
      if (orphans.length) bad.push(`${at} has no pathways but still carries ${orphans.join(", ")}, which only a pathway can deliver; either the pathways were lost or this content belongs to a different question`);
    }
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
// ---------------------------------------------------------------------------
// A LESSON THAT IS ONE SURFACE HAS TO BE AUTHORED AS ONE
//
// The student meets a single coherent thing about a single argument. What makes
// that possible is that each part is small and does its own job, and the failure
// mode is authors quietly making one part carry another's work: choiceMeaning
// growing into a definition, "try" testing recall instead of application, a
// worked example set in the same business the student is writing about.
// ---------------------------------------------------------------------------
function checkLearning() {
  const subs = essaySubjects();
  if (!subs) return [essayLoadError];
  const bad = [];
  Object.keys(subs).forEach(key => {
    const concepts = subs[key].concepts || {};
    (subs[key].questions || []).forEach(q => {
      const cs = String(q.caseStudy || (q.topic === "Marketing" ? "McDonald" : "") || "").toLowerCase();
      (q.pathways || []).forEach(pw => {
        const at = `${key}/${q.id}/${pw.id}`;
        const cm = pw.choiceMeaning;
        if (cm) {
          if (cm.length > 170) bad.push(`${at} choiceMeaning is ${cm.length} characters; it is there to tell this option from the others, not to teach it`);
          if ((cm.match(/[.!?]/g) || []).length > 1) bad.push(`${at} choiceMeaning is more than one sentence; the depth belongs in learning`);
        }
        const L = pw.learning;
        if (!L || L.status !== "authored") return;
        if (!cm) bad.push(`${at} has a learning block but no choiceMeaning, so meaning would have to serve both the choice and the lesson`);
        if (!L.know) bad.push(`${at} learning has no know, which is the only part shown before the student decides to read on`);
        else if (L.know.length > 340) bad.push(`${at} learning.know is ${L.know.length} characters; Know is what lets them continue, not the full teaching`);
        const chain = L.chain || [];
        if (chain.length < 3) bad.push(`${at} learning.chain has ${chain.length} steps; a relationship needs at least cause, mechanism and effect`);
        chain.forEach(s => {
          if (String(s).length > 80) bad.push(`${at} chain step ${JSON.stringify(String(s).slice(0, 40))} is too long to read as one step`);
          if (/^[A-Z]/.test(s)) bad.push(`${at} chain step ${JSON.stringify(s)} starts with a capital; the steps are fragments in a chain, not sentences`);
        });
        const m = L.misconception;
        if (m && (!m.head || !m.a || !m.b || !m.a.term || !m.b.term || !m.a.line || !m.b.line)) {
          bad.push(`${at} misconception needs a head and two named sides; a contrast with one side is just another paragraph`);
        }
        const ex = L.example;
        if (ex) {
          if (!ex.context) bad.push(`${at} example has no context, so nothing tells the student it is deliberately somewhere else`);
          if (cs && String(ex.text || "").toLowerCase().indexOf(cs) >= 0) {
            bad.push(`${at} example is set in the same business the student is writing about, so the words transfer instead of the shape`);
          }
        }
        const t = L.try;
        if (!t) { bad.push(`${at} learning has no try, so nothing checks the student can use what they just read`); return; }
        if (!t.prompt) bad.push(`${at} try has no prompt`);
        if (/^what (is|are|does) .*(definition|mean)/i.test(t.prompt || "") || /\bdefine\b/i.test(t.prompt || "")) {
          bad.push(`${at} try asks for a definition; it has to ask the student to USE the idea, not recall it`);
        }
        const opts = t.options || [];
        if (opts.length < 3) bad.push(`${at} try offers ${opts.length} options; fewer than three makes it a guess`);
        const rights = opts.filter(o => o.right);
        if (rights.length !== 1) bad.push(`${at} try has ${rights.length} right options, expected exactly 1`);
        opts.filter(o => !o.right).forEach(o => {
          if (!o.repair) bad.push(`${at} try option ${JSON.stringify(String(o.text).slice(0, 34))} has no repair; a wrong answer must be met with a correction, not a retry`);
          else if (o.repair.length > 220) bad.push(`${at} repair for ${JSON.stringify(String(o.text).slice(0, 24))} is ${o.repair.length} characters; a repair is one line, not the lesson again`);
        });
        if (!t.onRight) bad.push(`${at} try has no onRight, so a correct answer gets no confirmation of WHY it was right`);
        if (L.explore && L.explore.concept && !concepts[L.explore.concept]) {
          bad.push(`${at} explore points at concept ${JSON.stringify(L.explore.concept)}, which does not exist`);
        }
      });
    });
  });
  return bad;
}
// ---------------------------------------------------------------------------
// CONTENT THAT EXISTS BUT CANNOT REACH THE STUDENT
//
// The support report answers "does this content exist". That is the wrong
// question at the moment a student is writing: what matters is whether the
// pathway they chose can deliver it. A concept authored in the pack and not
// declared by the pathway that depends on it is invisible, and looked identical
// to a concept nobody had written.
//
// Declaring a concept does not show it. It makes it eligible here.
// ---------------------------------------------------------------------------
const CONCEPT_KINDS = ["domain", "supporting"];
const LEARNING_STATES = ["authored", "none-required", "unreviewed"];
function checkConceptRouting() {
  const subs = essaySubjects();
  if (!subs) return { faults: [essayLoadError], warnings: [] };
  const faults = [], warnings = [];
  Object.keys(subs).forEach(key => {
    const store = subs[key].concepts || {};
    const ordinary = ((subs[key].vocabulary || {}).ordinary) || [];
    Object.keys(store).forEach(id => {
      const c = store[id];
      if (CONCEPT_KINDS.indexOf(c.kind) < 0) faults.push(`${key}/concepts/${id} has kind ${JSON.stringify(c.kind || "")}, expected one of ${CONCEPT_KINDS.join(", ")}`);
      if (c.requiresTeaching === undefined) faults.push(`${key}/concepts/${id} does not say whether it requires teaching`);
      if (!c.oneLine) faults.push(`${key}/concepts/${id} has no oneLine, so a pathway lesson could not render it without repeating itself`);
      else if (c.oneLine.length > 150) faults.push(`${key}/concepts/${id} oneLine is ${c.oneLine.length} characters; it goes inline in a lesson`);
      if (ordinary.indexOf(id) >= 0) faults.push(`${key}/concepts/${id} is also listed as ordinary language; it cannot be both`);
    });
    const referenced = {};
    (subs[key].questions || []).forEach(q => (q.pathways || []).forEach(pw => {
      const L = pw.learning;
      const at = `${key}/${q.id}/${pw.id}`;
      // Every pathway ends up in one of three states. "unreviewed" is a state,
      // not a claim that the pathway depends on nothing: without it those two
      // cases are indistinguishable, and at a hundred pathways that is
      // dangerous.
      if (!L) { faults.push(`${at} has no learning status; every pathway must be authored, none-required or unreviewed`); return; }
      if (LEARNING_STATES.indexOf(L.status) < 0) {
        faults.push(`${at} has learning status ${JSON.stringify(L.status || "")}, expected one of ${LEARNING_STATES.join(", ")}`); return;
      }
      if (L.status === "unreviewed") {
        const extra = Object.keys(L).filter(k => k !== "status");
        if (extra.length) faults.push(`${at} is unreviewed but also carries ${extra.join(", ")}; review it or leave it empty`);
        return;
      }
      if (L.status === "none-required") {
        if (!L.reason) faults.push(`${at} says none-required without a reason, which is the only thing that makes it reviewable`);
        const extra = Object.keys(L).filter(k => k !== "status" && k !== "reason");
        if (extra.length) faults.push(`${at} says none-required but carries ${extra.join(", ")}`);
        return;
      }
      const c = L.concepts;
      if (!c) { faults.push(`${at} is authored but declares no concepts, so nothing it depends on is reachable from it`); return; }
      ["primary", "supporting", "optional"].forEach(tier => {
        (c[tier] || []).forEach(id => {
          referenced[id] = true;
          if (!store[id]) { faults.push(`${at} declares ${tier} concept ${JSON.stringify(id)}, which is not authored`); return; }
          if (tier === "primary" && store[id].kind !== "domain") {
            faults.push(`${at} has ${JSON.stringify(id)} as primary, but it is ${store[id].kind}; only a domain concept is something the argument cannot be understood without`);
          }
        });
      });
      if (!(c.primary || []).length) faults.push(`${at} declares no primary concept, so its lesson teaches nothing reusable`);
    }));
    // authored and never reachable: not a refusal, because a pack may be ahead
    // of the pathways, but it is exactly the failure this file exists to surface
    Object.keys(store).forEach(id => {
      if (!referenced[id] && store[id].requiresTeaching === true) {
        warnings.push(`${key}/concepts/${id} requires teaching and no pathway declares it, so no student can reach it`);
      }
    });
  });
  return { faults: faults, warnings: warnings };
}
const routing = checkConceptRouting();
if (routing.faults.length) {
  console.error("BUILD REFUSED: a pathway depends on teaching it cannot reach.");
  routing.faults.forEach(o => console.error("  - " + o));
  process.exit(1);
}
routing.warnings.forEach(w => console.warn("  note: " + w));
const reviewed = countReviewed();
if (reviewed.unreviewed) {
  console.warn(`  note: learning coverage ${reviewed.done}/${reviewed.total} reviewed; ${reviewed.unreviewed} pathways unreviewed (listed in docs/support-coverage.md)`);
  // Ordinary builds stay quiet enough to be read. A content-validation run can
  // make the queue a failure instead.
  if (process.argv.indexOf("--strict-learning") >= 0) {
    console.error("BUILD REFUSED (--strict-learning): a pathway is still unreviewed.");
    reviewed.ids.forEach(id => console.error("  - " + id));
    process.exit(1);
  }
}
function countReviewed() {
  const subs = essaySubjects() || {};
  let total = 0, done = 0; const ids = [];
  Object.keys(subs).forEach(key => (subs[key].questions || []).forEach(q => (q.pathways || []).forEach(pw => {
    total++;
    const st = (pw.learning || {}).status;
    if (st === "authored" || st === "none-required") done++;
    else ids.push(`${key}/${q.id}/${pw.id}`);
  })));
  return { total: total, done: done, unreviewed: total - done, ids: ids };
}

const learningFaults = checkLearning();
if (learningFaults.length) {
  console.error("BUILD REFUSED: a pathway lesson would not hold together.");
  learningFaults.forEach(o => console.error("  - " + o));
  process.exit(1);
}

const stemFaults = checkCanonicalStems();
if (stemFaults.length) {
  console.error("BUILD REFUSED: a question would be taught against a stem the student is not being shown.");
  stemFaults.forEach(o => console.error("  - " + o));
  process.exit(1);
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
