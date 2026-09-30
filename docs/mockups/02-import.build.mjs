// PAGE 2, IMPORT AND VALIDATION. Generated, like page 1 and states 12 and 13.
//
// Every verdict, every finding and the subject line come from the shipped code:
//
//   tests/fixtures/bus-practice-paper.json   the paper, and variants of it, each a
//                                            realistic kind of file (VARIANTS)
//   PAPER.examine()                          the Gate 3C verdict and its findings
//   ASSESS.resolveAuthority()                the subject, resolved against the
//                                            packages the app actually registers
//                                            (essay-content.js), the same call
//                                            markingContext makes before marking
//
// What this file adds is only the translation into a teacher's words: which of the
// five groups a verdict belongs to, one sentence per finding code, and where in the
// paper a finding is, read from its path. The contract's own sentence, code and
// path stay on the page, under "Details for whoever made this file".
//
// THE ORDER A FILE IS READ IN, and why each step can end the reading:
//   1. JSON.parse. Unreadable: Invalid file, and nothing else is shown.
//   2. Its family. A flashcard set is not a paper: it belongs to Create.
//   3. Its version. A version this release does not run is Unsupported, and the
//      rest is NOT read as if it were this version: the contract "does not guess
//      at the difference", so neither does the page. No subject, no contents.
//   4. examine() and the subject's resolution. The verdict is the worst state.
//   5. Already in the library, by exam.id and exam.version.
//
// FOCUS. When a check finishes, focus moves to the verdict heading (tabindex -1),
// so a screen reader reads the verdict the moment it exists. There is no live
// region: the result replaces the chooser, and a region inserted with its content
// already in it is not reliably announced.
//
//   node docs/mockups/02-import.build.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "..", "..");
const OUTDIR = process.env.MOCKUP_OUT || HERE;
globalThis.window = globalThis;
require(path.join(ROOT, "essay-content.js"));            // registers window.ESSAY.subjects
const PAPER = require(path.join(ROOT, "tools/contract/exam.js"));
const ASSESS = require(path.join(ROOT, "tools/contract/assessment.js"));
const PACKAGES = window.ESSAY.subjects;

const FIXTURE = "tests/fixtures/bus-practice-paper.json";
const RAW = fs.readFileSync(path.join(ROOT, FIXTURE), "utf8");
const fresh = () => JSON.parse(RAW);
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const list = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

// ---- the five groups ------------------------------------------------------
// The names are the product owner's. A verdict is the worst state present. The
// lede is chosen by cause where the cause changes what the reader can do.
const GROUP = {
  publishable: { title: "Ready to import", tone: "ok", add: true, list: "",
                 lede: "Every question can be sat, and everything Marginal needs to mark it is in the file." },
  thin:        { title: "Ready, with limited optional support", tone: "note", add: true, list: "Optional, and missing",
                 lede: "Every question can be sat, and everything Marginal needs to mark it is in the file. Some optional details are missing." },
  blocked:     { title: "Needs something resolved", tone: "stop", add: false, list: "What needs resolving",
                 lede: "It cannot be added yet. Whoever made the file needs to make the change below." },
  unsupported: { title: "Unsupported", tone: "stop", add: false, list: "Why this version cannot use it",
                 lede: "This version of Marginal cannot use this file." },
  malformed:   { title: "Invalid file", tone: "stop", add: false, list: "What is wrong in the file",
                 lede: "Part of this file contradicts itself or is missing, so it cannot be used as it is." },
};
const ORDER = ["malformed", "unsupported", "blocked", "thin"];
const STOP = ["malformed", "unsupported", "blocked"];

// ---- one sentence per code ------------------------------------------------
// Every code the validator, or the subject resolution this page adds, can put on
// the page. The build fails on a code without a sentence (see the check under
// SAY), so no finding ever reaches a teacher as a contract diagnostic. `d` is the
// data a sentence needs, read from the paper rather than from the message.
const WHO = "Whoever made the file needs to";
const SAY = {
  // invalid file
  NOT_AN_OBJECT: () => "The file does not contain a paper.",
  SECTIONS_MISSING: () => "The file has no sections, so there is nothing to sit.",
  NO_QUESTIONS: () => "The paper's sections have no questions in them.",
  SECTION_NOT_AN_OBJECT: () => "One of the paper's sections could not be read.",
  SECTION_EMPTY: () => "This section has no questions in it.",
  SECTION_TOTAL_NOT_A_NUMBER: () => "This section's total is not a number of marks.",
  SECTION_TOTAL_DISAGREES: d => `This section says it is worth ${d.said} marks, but its questions add up to ${d.sum}. Marginal cannot tell which is right. ${WHO} correct it.`,
  PAPER_TOTAL_NOT_A_NUMBER: () => "The paper's total is not a number of marks.",
  PAPER_TOTAL_DISAGREES: d => `The paper says it is worth ${d.said} marks, but its questions add up to ${d.sum}. Marginal cannot tell which is right. ${WHO} correct it.`,
  PARENT_TOTAL_NOT_A_NUMBER: () => "This question's total is not a number of marks.",
  PARENT_TOTAL_DISAGREES: d => `This question says it is worth ${d.said} marks, but its parts add up to ${d.sum}. Marginal cannot tell which is right. ${WHO} correct it.`,
  PARENT_IS_NOT_ANSWERED: () => "This question has parts, and it is also set up to be answered on its own. Only one of those can be right.",
  QUESTION_NOT_AN_OBJECT: () => "This question could not be read.",
  PART_NOT_AN_OBJECT: () => "One part of this question could not be read.",
  PART_LABEL_DUPLICATE: () => "Two parts of this question have the same label.",
  PROMPT_MISSING: () => "This question has no question text, so there is nothing to answer.",
  MARKS_MISSING: () => "This question does not say how many marks it is worth.",
  MARKS_NOT_A_NUMBER: () => "This question's marks are not a number.",
  MARKS_NOT_POSITIVE: () => "This question is worth no marks, or less than none.",
  MC_CHOICES_MISSING: () => "This multiple-choice question has fewer than two options.",
  MC_ANSWER_NOT_SINGULAR: () => "This multiple-choice question does not have exactly one correct option.",
  CALC_EXPECTED_MISSING: () => "This calculation does not give the answer it is marked against.",
  FORMAT_ABSENT: () => "This question does not say what kind of answer it takes.",
  POINTS_MALFORMED: () => "This question's marking points could not be read.",
  INSTRUCTIONS_MALFORMED: () => "This business report's instructions are not written as text, so they cannot be shown.",
  RESOURCE_MALFORMED: () => "Source material for this question could not be read.",
  RESOURCE_EMPTY: () => "Source material for this question is empty, so there is nothing for students to read.",
  REFERENCES_MALFORMED: () => "This question's references could not be read.",
  REFERENCE_EMPTY: () => "This question has a reference that points at nothing.",
  QUESTION_ID_DUPLICATE: () => "Two questions in the file share the same identifier.",
  QUESTION_NUMBER_DUPLICATE: () => "Two questions in the paper have the same number.",
  // unsupported
  PACKAGE_VERSION_UNSUPPORTED: () => "This file says it uses a paper format this version of Marginal cannot open. Ask whoever made it for a copy made for this version.",
  FORMAT_UNSUPPORTED: () => "This question asks for a kind of answer Marginal cannot take.",
  FORMAT_CONFLICT: () => "This question describes the kind of answer it takes in two ways that disagree.",
  PART_NESTING_TOO_DEEP: () => "This question has parts inside its parts, which Marginal cannot show.",
  MARKING_GUIDANCE_OVER_BUDGET: () => "This question carries more marking guidance than the marker can read at once, so it could not be marked against all of it.",
  SOURCE_OVER_BUDGET: () => "This question's source material is longer than the marker can read, so it could not be marked against all of it.",
  // needs something resolved
  CURRICULUM_MISSING: () => `The paper does not say which subject it belongs to, so its written answers could not be marked. ${WHO} add it.`,
  SUBJECT_KEY_MISSING: () => `The paper does not name the subject that marks it, so its written answers could not be marked. ${WHO} add it.`,
  SUBJECT_KEY_MALFORMED: () => `The paper names its subject in a form Marginal cannot match to a subject. ${WHO} correct it.`,
  KLA_KEY_MALFORMED: () => `The paper's learning area is written in a form Marginal cannot read. ${WHO} correct it.`,
  QUESTION_SUBJECT_OVERRIDE: () => `This question says it belongs to a different subject from the rest of the paper. ${WHO} correct it.`,
  SUBJECT_UNREGISTERED: d => `This file names a subject Marginal does not have${d.course ? ` (it calls it ${d.course})` : ""}, so its written answers could not be marked. Changing the file only helps if it names the wrong subject.`,
  CRITERIA_ABSENT: d => `Marginal has ${d.label}, but no marking criteria for it, so written answers in this paper could not be marked.`,
  // optional, and missing
  JURISDICTION_ABSENT: () => "The paper does not say which state it is written for. This does not affect sitting or marking.",
  KLA_ABSENT: () => "The paper does not say which learning area it belongs to. This does not affect sitting or marking.",
  SECTION_NAME_ABSENT: () => "This section has no name, so students will see it as a number.",
  PARENT_NUMBER_ABSENT: () => "This question has no number, so its parts are named by their position.",
  PART_LABEL_ABSENT: () => "This part has no label, so it is named by its position.",
  MARKING_SUPPORT_ABSENT: () => "No model answer and no marking points. Written answers are marked from the subject's criteria alone, which is allowed and less specific.",
  REPORT_GUIDANCE_ABSENT: () => "This business report does not say what the report must do, so its marker has only the subject's criteria.",
  SOURCE_NOT_REPRESENTED: () => "Part of this question's source, an image or a chart, cannot be sent to the marker as text, so written answers are marked without it.",
  RESOURCE_UNLABELLED: () => "Source material here has no caption, so students see it without a title.",
  REFERENCE_UNKNOWN: () => "This question points at something Marginal does not recognise, and it is ignored.",
};
// Codes that are refusals at marking or sitting time, never import findings.
const NOT_AT_IMPORT = new Set(["CALC_UNREADABLE", "CURRICULUM_UNOWNED", "SUBJECT_OVERRIDE_REFUSED"]);
{
  const all = new Set();
  for (const f of ["tools/contract/exam.js", "tools/contract/assessment.js"])
    for (const m of fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(/"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/g)) all.add(m[1]);
  const missing = [...all].filter(c => !NOT_AT_IMPORT.has(c) && !SAY[c]);
  if (missing.length) throw new Error("finding codes with no sentence for a teacher: " + missing.join(", "));
}

// ---- where a finding is, in the paper's own numbering ------------------------
// "sections[1].questions[0].parts[1].points" is Section II, Question 11(b). An
// unnumbered question is named by its position.
function placeOf(paper, p) {
  if (!p) return "The whole file";
  if (/^curriculum/.test(p)) return "Subject details";
  if (p === "format") return "File format";
  if (p === "marks") return "The paper's total";
  const s = p.match(/^sections\[(\d+)\](?:\.questions\[(\d+)\](?:\.parts\[(\d+)\])?)?/);
  if (!s) return "The whole file";
  const sec = paper && Array.isArray(paper.sections) ? paper.sections[+s[1]] : null;
  const at = "Section " + (ROMAN[+s[1]] || +s[1] + 1);
  if (s[2] == null || !sec || !Array.isArray(sec.questions)) return at;
  const q = sec.questions[+s[2]];
  const n = q && typeof q === "object" ? PAPER.numberOf(q) : null;
  const numbered = n != null && String(n) !== "";
  const qn = numbered ? "Question " + n : "question " + (+s[2] + 1) + " of the section";
  if (s[3] == null) return at + ", " + qn;
  const part = q.parts[+s[3]];
  const lab = part && typeof part === "object" ? PAPER.labelOf(part, +s[3]) : String.fromCharCode(97 + +s[3]);
  return numbered ? at + ", Question " + PAPER.displayNumber(n, lab) : at + ", part (" + lab + ") of " + qn;
}

// The numbers a totals sentence needs, from the paper, not from the message.
function dataFor(paper, f, auth) {
  const cur = (paper && ASSESS.curriculumOf(paper)) || {};
  const d = { course: cur.course || "", label: auth && auth.label };
  const t = paper && Array.isArray(paper.sections) ? PAPER.totals(paper) : null;
  let m;
  if (f.code === "SECTION_TOTAL_DISAGREES" && (m = f.path.match(/^sections\[(\d+)\]/))) { d.said = paper.sections[+m[1]].marks; d.sum = t.sections[+m[1]]; }
  if (f.code === "PAPER_TOTAL_DISAGREES") { d.said = paper.marks; d.sum = t ? t.marks : 0; }
  if (f.code === "PARENT_TOTAL_DISAGREES" && (m = f.path.match(/^sections\[(\d+)\]\.questions\[(\d+)\]/))) {
    const q = paper.sections[+m[1]].questions[+m[2]];
    d.said = q.marks; d.sum = PAPER.partsOf(q).reduce((a, x) => a + (Number(x.marks) || 0), 0);
  }
  return d;
}

// ---- reading one file, in order --------------------------------------------
function read(text, library) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return { kind: "unreadable", error: String(e.message) }; }
  if (data && typeof data === "object" && (Array.isArray(data.cards) || /^marginal-set@/.test(String(data.format || ""))))
    return { kind: "flashcards", name: data.name || "", cards: Array.isArray(data.cards) ? data.cards.length : 0 };
  const v = PAPER.examine(data);
  const version = v.findings.find(f => f.code === "PACKAGE_VERSION_UNSUPPORTED");
  if (version) return { kind: "version", finding: version, paper: data };
  const cur = ASSESS.curriculumOf(data) || {};
  const auth = ASSESS.resolveAuthority({ curriculum: cur, packages: PACKAGES });
  const findings = v.findings.map(f => ({ state: f.state, code: f.code, path: f.path, message: f.message }));
  // examine() checks the subject key's shape, not that a package exists for it
  // (UX-TEST-23). The two refusals it cannot see are added here; the others
  // duplicate a finding examine() already made.
  if (!auth.ok && (auth.code === "SUBJECT_UNREGISTERED" || auth.code === "CRITERIA_ABSENT"))
    findings.unshift({ state: "blocked", code: auth.code, path: "curriculum.subjectKey", message: auth.why });
  findings.forEach(f => { f.say = SAY[f.code](dataFor(data, f, auth)); });
  const worst = ORDER.find(s => findings.some(f => f.state === s)) || "publishable";
  const ex = data && data.exam;
  const dup = ex && library.find(p => p.exam && p.exam.id === ex.id && String(p.exam.version) === String(ex.version));
  return { kind: "paper", paper: data, v, auth, cur, findings, worst, dup };
}

// ---- panels -------------------------------------------------------------------
// The subject is ticked only when the file can be added AND it resolved. A stop
// verdict shows what the file names, unticked: a green tick under "cannot be used"
// would contradict the verdict.
function identity(r) {
  const cur = r.cur, stage = cur.stage || "", state = cur.jurisdiction || "";
  const claim = [stage, state].filter(Boolean).join(", ");
  if (r.auth.ok && (GROUP[r.worst].add || r.dup)) {
    return `<div class="ident ok">
      <h3 class="k">Subject and course</h3>
      <p class="who">${esc([r.auth.label, stage].filter(Boolean).join(" · "))}</p>
      <p class="how"><span class="tick" aria-hidden="true">✓</span>Matched to Marginal's ${esc(r.auth.label)} marking criteria</p>
      ${claim ? `<p class="claim">${esc(claim)}, as stated in the file</p>` : ""}
    </div>`;
  }
  const said = cur.course || r.paper.subject || "";
  const how = r.auth.ok ? "Named by the file. Not checked further, because the file cannot be used as it is"
    : said ? "Named by the file, and not matched to any subject in Marginal" : "The file does not say which subject marks it";
  return `<div class="ident no">
    <h3 class="k">Subject and course</h3>
    <p class="who">${said ? esc([said, stage].filter(Boolean).join(" · ")) : "Not identified"}</p>
    <p class="how">${r.auth.ok ? "" : `<span class="cross" aria-hidden="true">✕</span>`}${esc(how)}</p>
  </div>`;
}

const DISPUTED = new Set(["SECTION_TOTAL_DISAGREES", "SECTION_TOTAL_NOT_A_NUMBER", "PAPER_TOTAL_DISAGREES", "PAPER_TOTAL_NOT_A_NUMBER",
                          "PARENT_TOTAL_DISAGREES", "PARENT_TOTAL_NOT_A_NUMBER"]);
const UNREADABLE = new Set(["NOT_AN_OBJECT", "SECTIONS_MISSING", "SECTION_NOT_AN_OBJECT", "NO_QUESTIONS", "SECTION_EMPTY"]);
function paperPanel(r) {
  const p = r.paper, readable = !r.findings.some(f => UNREADABLE.has(f.code));
  const anyDisputed = r.findings.some(f => DISPUTED.has(f.code));
  const t = readable ? PAPER.totals(p) : null;
  const facts = readable ? [plural(t.questions, "question"), plural(p.sections.length, "section"),
                            anyDisputed ? "total marks disputed" : plural(t.marks, "mark"), p.time] : [p.time];
  return `<div class="paperid">
    <h3 class="k">Paper</h3>
    <p class="title">${esc(p.name || "Untitled paper")}</p>
    <p class="facts">${esc(facts.filter(Boolean).join(" · "))}</p>
    ${p.exam && p.exam.source ? `<p class="src">Source: ${esc(p.exam.source)}</p>` : ""}
  </div>`;
}
function contents(r) {
  const p = r.paper;
  if (r.findings.some(f => UNREADABLE.has(f.code)))
    return `<h3 class="k">Contents</h3><p class="none">The sections could not be read, so the contents cannot be listed.</p>`;
  const disputed = new Set(r.findings.filter(f => DISPUTED.has(f.code)).map(f => (f.path.match(/^sections\[(\d+)\]/) || [])[1]).filter(x => x != null).map(Number));
  const rows = p.sections.map((sec, i) => {
    const t = PAPER.totals({ sections: [sec] });
    const pick = Number(sec.choose) || 0;
    const qs = pick ? "choose " + pick + " of " + sec.questions.length : plural(t.questions, "question");
    return `<li><span class="sn">${esc(sec.name || "Section " + (ROMAN[i] || i + 1))}</span>
      <span class="sm">${esc(qs)} · ${disputed.has(i) ? "marks disputed" : plural(t.marks, "mark")}</span></li>`;
  }).join("");
  return `<h3 class="k">Contents</h3><ul class="secs">${rows}</ul>`;
}
// What adding it puts under "Practise a question type" on page 1: every leaf of a
// canonical format, both options of an either/or, counted as page 1 counts them.
const TYPES = [["multiple_choice", "multiple choice"], ["short_answer", "short answer"], ["calculation", "calculation"],
               ["business_report", "business report"], ["extended_response", "extended response"]];
function adds(p) {
  const n = {}; let all = 0; const either = [];
  p.sections.forEach((sec, i) => {
    if (Number(sec.choose)) either.push(ROMAN[i] || String(i + 1));
    sec.questions.forEach(q => (PAPER.isParent(q) ? PAPER.partsOf(q) : [q]).forEach(leaf => {
      const f = ASSESS.normaliseFormat(leaf).format; n[f] = (n[f] || 0) + 1; all++;
    }));
  });
  const parts = TYPES.filter(([f]) => n[f]).map(([f, w]) => n[f] + " " + w);
  return `<p class="adds">Adds ${all} questions to <b>Practise a question type</b>: ${esc(list(parts))}.` +
    (either.length ? ` Both options in Section ${esc(list(either))} can be practised.` : "") + `</p>`;
}

// Several places for one sentence. A paper's question numbers are unique, so when
// every place is a numbered question the section adds nothing: "Questions 11(d),
// 12(c), 13, 15 and 16" rather than the section repeated five times.
function places(ps) {
  const qs = ps.map(x => (x.match(/^Section [IVX\d]+, Question (.+)$/) || [])[1]);
  if (ps.length > 1 && qs.every(Boolean)) return "Questions " + list(qs);
  return list(ps);
}
function findingsHTML(r) {
  const stop = STOP.includes(r.worst);
  // Under a verdict that stops the file, only what stops it is listed. Optional
  // notes wait until the file can be added, and are counted rather than hidden.
  // When the structure itself cannot be read, a total that disagrees with it is
  // a consequence, not a second problem: it stays in the details only.
  const broken = r.findings.some(f => UNREADABLE.has(f.code));
  const listed = f => !(broken && DISPUTED.has(f.code));
  const shown = ORDER.filter(s => !stop || s !== "thin")
    .map(s => ({ s, list: r.findings.filter(f => f.state === s && listed(f)) })).filter(g => g.list.length);
  const held = stop ? r.findings.filter(f => f.state === "thin").length : 0;
  if (!shown.length && !held) return "";
  // One sentence per code, with every place it applies: five unsupported
  // questions are one line, not five.
  const block = g => {
    const byCode = [];
    g.list.forEach(f => {
      let e = byCode.find(x => x.code === f.code && x.say === f.say);
      if (!e) byCode.push(e = { code: f.code, say: f.say, places: [] });
      e.places.push(placeOf(r.paper, f.path));
    });
    return `<section class="group ${GROUP[g.s].tone}" aria-labelledby="g-${g.s}">
      <h3 id="g-${g.s}">${esc(GROUP[g.s].list)} <span class="n" aria-hidden="true">${g.list.length}</span><span class="sr">, ${plural(g.list.length, "item")}</span></h3>
      <ul>${byCode.map(e => `<li><p class="where">${esc(places(e.places))}</p><p class="what">${esc(e.say)}</p></li>`).join("")}</ul>
    </section>`;
  };
  return shown.map(block).join("") +
    (held ? `<p class="held">${plural(held, "optional note")} will be listed once the file can be added.</p>` : "") +
    `<details class="tech"><summary>Details for whoever made this file</summary>
      <ul>${r.findings.map(f => `<li><code>${esc(f.code)}</code> at <code>${esc(f.path || "(file)")}</code>. ${esc(cap(f.message))}.</li>`).join("")}</ul>
    </details>`;
}

// ---- pages ------------------------------------------------------------------
const fileBar = (name, size) => `
  <div class="file"><span class="doc" aria-hidden="true"></span><span class="fn">${esc(name)}</span>
    <span class="fs">${esc(size)}</span><span class="spacer"></span>
    <label class="link" for="f">Choose a different file</label></div>`;
const verdictBox = (tone, title, lede) => `
    <div class="verdict ${tone}">
      <span class="mark" aria-hidden="true">${tone === "stop" ? "!" : "✓"}</span>
      <div><h2 id="rt" tabindex="-1">${esc(title)}</h2><p>${esc(lede)}</p></div>
    </div>`;
const chooseAgain = `<label class="btn" for="f">Choose a different file</label>`;

function paperPage(r, file) {
  const g = GROUP[r.worst];
  let lede = g.lede;
  if (r.worst === "blocked" && r.findings.some(f => f.code === "SUBJECT_UNREGISTERED" || f.code === "CRITERIA_ABSENT"))
    lede = "Marginal cannot mark this paper's subject, so the paper cannot be added.";
  if (r.dup && g.add) {
    return shell("already in your library", fileBar(file.name, file.size) + `
  <article class="result" aria-labelledby="rt">
    ${verdictBox("ok", "Already in your library", "This paper, in this version, is already in your library. Nothing needs adding.")}
    <div class="grid"><div class="left">${identity(r)}${paperPanel(r)}</div><div class="right">${contents(r)}</div></div>
    <div class="acts"><a class="btn" href="#library">Open it in your library</a><label class="btn ghost" for="f">Choose a different file</label></div>
  </article>`);
  }
  const body = fileBar(file.name, file.size) + `
  <article class="result" aria-labelledby="rt">
    ${verdictBox(g.tone, g.title, lede)}
    <div class="grid">
      <div class="left">${identity(r)}${paperPanel(r)}</div>
      <div class="right">${contents(r)}${g.add ? adds(r.paper) : ""}</div>
    </div>
    ${findingsHTML(r)}
    <div class="acts">
      ${g.add ? `<button type="button" class="btn">Add to library</button><label class="btn ghost" for="f">Choose a different file</label>` : chooseAgain}
    </div>
  </article>`;
  return shell(r.worst, body);
}
function versionPage(r, file) {
  const g = GROUP.unsupported;
  return shell("unsupported", fileBar(file.name, file.size) + `
  <article class="result" aria-labelledby="rt">
    ${verdictBox(g.tone, g.title, g.lede)}
    <section class="group stop" aria-labelledby="g-u">
      <h3 id="g-u">${esc(g.list)}</h3>
      <ul><li><p class="where">File format</p><p class="what">${esc(SAY.PACKAGE_VERSION_UNSUPPORTED())}</p></li></ul>
    </section>
    <p class="held">Nothing else in the file is read, because this version cannot tell what the rest of it means.</p>
    <details class="tech"><summary>Details for whoever made this file</summary>
      <ul><li><code>${esc(r.finding.code)}</code> at <code>${esc(r.finding.path)}</code>. ${esc(cap(r.finding.message))}.</li></ul>
    </details>
    <div class="acts">${chooseAgain}</div>
  </article>`);
}
function flashcardsPage(r, file) {
  return shell("flashcard set", fileBar(file.name, file.size) + `
  <article class="result" aria-labelledby="rt">
    ${verdictBox("stop", GROUP.unsupported.title, "This is a flashcard set, not a paper. Flashcard sets are imported in Create, where they can be studied.")}
    <p class="held">${esc(r.name ? `"${r.name}", ` : "")}${plural(r.cards, "card")}.</p>
    <div class="acts"><a class="btn" href="#create">Go to Create</a><label class="btn ghost" for="f">Choose a different file</label></div>
  </article>`);
}
function unreadablePage(r, file) {
  return shell("not json", fileBar(file.name, file.size) + `
  <article class="result" aria-labelledby="rt">
    ${verdictBox("stop", GROUP.malformed.title, "This file cannot be read as JSON, so it cannot be checked as a paper. It may have been cut off, or it may be a different kind of file.")}
    <details class="tech"><summary>Details for whoever made this file</summary>
      <ul><li>${esc(r.error)}</li></ul>
    </details>
    <div class="acts">${chooseAgain}</div>
  </article>`);
}
function startPage() {
  return shell("choose", `
  <label class="drop" for="f">
    <span class="doc big" aria-hidden="true"></span>
    <span class="dh">Choose a paper's JSON file</span>
    <span class="ds">or drop it here. It is checked before anything is added.</span>
    <span class="btn" aria-hidden="true">Choose file</span>
  </label>
  <details class="paste"><summary>Paste JSON instead</summary>
    <textarea rows="6" aria-label="Paper JSON" placeholder='{"format":"${esc(PAPER.FORMAT)}", ...}'></textarea>
    <button type="button" class="btn ghost">Check this JSON</button>
  </details>`);
}

function shell(state, body) {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test mode · Import a paper</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<!-- Page 2, ${esc(state)}. Generated by 02-import.build.mjs: do not edit by hand. -->
<style>
  :root{
    --bg:#EEF3F5; --card:#FFFFFF;
    --ink:#3C4A4A; --ink-2:#596866; --ink-3:#616E6C;
    --green:#1CC47D; --green-dk:#0E7A4E; --green-edge:#0A5C3C; --green-soft:#E4F9EF;
    --blue:#1CA0F2; --blue-dk:#0D5888; --blue-soft:#E2F3FE;
    --gold:#FFB323; --gold-dk:#9A6000; --gold-soft:#FFF3D8;
    --coral:#FF7C6B; --coral-dk:#AE3323; --coral-soft:#FFE8E4;
    --line:#E7EDED;
    --disp:'Fredoka',system-ui,sans-serif; --body:'Nunito',system-ui,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--body);font-size:16px;background:var(--bg);color:var(--ink);line-height:1.6;
       -webkit-font-smoothing:antialiased;min-height:100vh}
  a{color:inherit}
  button{font:inherit;cursor:pointer}
  h1,h2,h3,.disp{font-family:var(--disp);letter-spacing:-.01em;font-weight:600}
  :focus-visible{outline:2px solid var(--green-dk);outline-offset:3px;border-radius:10px}
  h2[tabindex="-1"]:focus{outline:none}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

  /* Page 1's header and navigation, unchanged: no paper is open, so no subject
     is named in the header. The subject this page resolves is in the result,
     where it is the thing being checked. */
  header{display:flex;align-items:center;gap:12px;padding:16px clamp(16px,4vw,32px);background:var(--card);
         border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:10px;font-family:var(--disp);font-weight:600;font-size:20px}
  .mk{width:28px;height:28px;border-radius:9px;background:var(--green);position:relative;flex:none;box-shadow:0 3px 0 var(--green-dk)}
  .mk::after{content:"";position:absolute;left:7px;right:7px;bottom:6px;height:3px;border-radius:2px;background:#fff}
  .mk::before{content:"";position:absolute;left:7px;bottom:6px;width:3px;height:14px;border-radius:2px;background:rgba(255,255,255,.9)}
  .unit{font-size:13.5px;color:var(--ink);font-weight:700;margin-left:auto;font-family:var(--disp)}
  main{max-width:1180px;width:100%;margin:0 auto;padding:24px clamp(16px,4vw,40px) 56px}
  nav.tabs{display:inline-flex;gap:4px;background:#E2EAEA;border-radius:99px;padding:5px;margin-bottom:22px}
  nav.tabs a{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink-2);text-decoration:none;padding:8px 20px;border-radius:99px}
  nav.tabs a[aria-current]{background:var(--card);color:var(--green-dk);box-shadow:0 1px 3px rgba(60,74,74,.12)}

  .back{display:block;width:max-content;font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink-2);text-decoration:none;margin-bottom:10px}
  .back:hover{color:var(--ink)}
  .top{margin-bottom:22px}
  .top h1{font-size:30px;line-height:1.15}
  .top .lede{font-size:15px;color:var(--ink-2);font-weight:600;margin-top:6px;max-width:64ch}

  .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;text-decoration:none;
       font-family:var(--disp);font-weight:600;font-size:15px;color:#fff;background:var(--green-dk);border:none;
       border-radius:14px;padding:11px 24px;box-shadow:0 4px 0 var(--green-edge);white-space:nowrap;cursor:pointer}
  .btn.ghost{background:var(--card);color:var(--ink);box-shadow:0 0 0 2px var(--line) inset}
  .link{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--green-dk);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
  .spacer{flex:1}
  .k{font-family:var(--disp);font-weight:600;font-size:12.5px;color:var(--ink-2);letter-spacing:.01em;margin-bottom:4px}

  .doc{width:18px;height:22px;border:2px solid var(--ink-2);border-radius:3px 7px 3px 3px;flex:none;position:relative}
  .doc::after{content:"";position:absolute;left:3px;right:3px;top:7px;height:2px;background:var(--ink-2);box-shadow:0 4px 0 var(--ink-2)}
  .doc.big{width:30px;height:38px;border-width:2.5px}
  .file{display:flex;align-items:center;gap:10px;background:var(--card);border:1.5px solid var(--line);border-radius:14px;
        padding:12px 18px;margin-bottom:14px;max-width:1000px}
  .fn{font-family:var(--disp);font-weight:600;font-size:14.5px}
  .fs{font-size:13px;color:var(--ink-2);font-weight:700}

  .result{background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:24px 28px;max-width:1000px}
  /* The verdict first, in the group's words: it answers "can I use this file?",
     and everything under it is the evidence. Tone, glyph and words all differ
     between the groups, so none depends on colour alone. */
  .verdict{display:flex;gap:14px;align-items:flex-start;border-radius:14px;padding:14px 18px;margin-bottom:22px}
  .verdict.ok{background:var(--green-soft);border:1px solid #BFEFD9}
  .verdict.note{background:var(--gold-soft);border:1px solid #F5DCA6}
  .verdict.stop{background:var(--coral-soft);border:1px solid #F7C9C1}
  .verdict .mark{width:30px;height:30px;border-radius:99px;display:flex;align-items:center;justify-content:center;flex:none;
                 font-weight:800;color:#fff;margin-top:2px}
  .verdict.ok .mark{background:var(--green-dk)}
  .verdict.note .mark{background:var(--gold-dk)}
  .verdict.stop .mark{background:var(--coral-dk)}
  .verdict h2{font-size:21px;line-height:1.25}
  .verdict.ok h2{color:var(--green-dk)}
  .verdict.note h2{color:var(--gold-dk)}
  .verdict.stop h2{color:var(--coral-dk)}
  .verdict p{font-size:14.5px;font-weight:600;color:var(--ink)}

  .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px}
  /* The proof asked for before anything is added: the subject as Marginal
     resolved it, ticked only when that is what happened and the file can be
     added. The stage and state are the file's own claims, and say so. */
  .ident{border-radius:14px;padding:16px 18px;margin-bottom:18px}
  .ident.ok{background:#F4F9F8;border:1.5px solid var(--line)}
  .ident.no{background:#FFF8F6;border:1.5px solid #F7C9C1}
  .ident .who{font-family:var(--disp);font-weight:600;font-size:26px;line-height:1.2}
  .ident .how{font-size:13.5px;font-weight:700;color:var(--ink-2);margin-top:6px;display:flex;gap:7px;align-items:baseline}
  .ident .claim{font-size:13px;font-weight:600;color:var(--ink-2);margin-top:2px}
  .tick{color:var(--green-dk);font-weight:800}
  .cross{color:var(--coral-dk);font-weight:800}
  .paperid .title{font-family:var(--disp);font-weight:600;font-size:19px;line-height:1.3}
  .paperid .facts{font-size:14px;color:var(--ink-2);font-weight:600;margin-top:2px}
  .paperid .src{font-size:13.5px;color:var(--ink-2);font-weight:600;margin-top:6px}
  .secs{list-style:none;border:1.5px solid var(--line);border-radius:12px}
  .secs li{display:flex;gap:12px;align-items:baseline;padding:9px 14px;font-size:14px}
  .secs li+li{border-top:1px solid var(--line)}
  .sn{font-weight:700}
  .sm{margin-left:auto;color:var(--ink-2);font-weight:700;font-size:13px;white-space:nowrap}
  .none{font-size:14px;color:var(--ink-2);font-weight:600}
  .adds{font-size:13.5px;color:var(--ink-2);font-weight:600;margin-top:12px}
  .adds b{color:var(--ink)}

  .group{margin-top:22px;border-top:1px solid var(--line);padding-top:16px}
  .group h3{font-size:16px;display:flex;align-items:center;gap:8px}
  .group .n{font-family:var(--body);font-size:12px;font-weight:800;border-radius:99px;padding:1px 9px}
  .group.note .n{background:var(--gold-soft);color:var(--gold-dk)}
  .group.stop .n{background:var(--coral-soft);color:var(--coral-dk)}
  .group ul{list-style:none;margin-top:8px}
  .group li{padding:9px 0}
  .group li+li{border-top:1px dashed var(--line)}
  .where{font-family:var(--disp);font-weight:600;font-size:13px;color:var(--ink-2)}
  .what{font-size:15px;line-height:1.6;max-width:70ch}
  .held{margin-top:16px;font-size:14px;font-weight:600;color:var(--ink-2)}
  details.tech{margin-top:16px;font-size:13px;color:var(--ink-2)}
  details.tech summary{cursor:pointer;font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--ink-2)}
  details.tech ul{margin:8px 0 0 18px}
  details.tech li{margin:4px 0;line-height:1.55}
  code{font-size:12.5px;background:#F1F5F5;border-radius:5px;padding:0 5px;color:var(--ink)}

  .acts{display:flex;align-items:center;gap:16px;margin-top:24px;padding-top:20px;border-top:1px solid var(--line)}

  .drop{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;background:var(--card);
        border:2px dashed #BFCBCA;border-radius:18px;padding:46px 28px;max-width:1000px;cursor:pointer}
  .drop:focus-within{outline:2px solid var(--green-dk);outline-offset:3px}
  #f:focus-visible + .drop, #f:focus-visible ~ * .drop{outline:2px solid var(--green-dk);outline-offset:3px}
  .dh{font-family:var(--disp);font-weight:600;font-size:20px;margin-top:6px}
  .ds{font-size:14.5px;color:var(--ink-2);font-weight:600;margin-bottom:10px}
  details.paste{max-width:1000px;margin-top:14px}
  details.paste summary{cursor:pointer;font-family:var(--disp);font-weight:600;font-size:14px;color:var(--green-dk)}
  details.paste textarea{display:block;width:100%;margin:10px 0 12px;font:13px ui-monospace,monospace;border:1.5px solid var(--line);border-radius:12px;padding:12px}

  @media(max-width:860px){ .grid{grid-template-columns:1fr} .acts{flex-wrap:wrap} }
</style>
</head>
<body>
<header>
  <div class="brand"><span class="mk"></span>Marginal</div>
  <div class="unit">Test mode</div>
</header>
<main>
  <nav class="tabs" aria-label="Marginal">
    <a href="#study">Study</a><a href="#create">Create</a><a href="#test" aria-current="true">Test mode</a><a href="#essay">Essay practice</a>
  </nav>
  <a class="back" href="#test"><span aria-hidden="true">← </span>Test mode</a>
  <div class="top">
    <h1>Import a paper</h1>
    <p class="lede">Choose a paper's JSON file. Marginal checks it, and shows you the subject it belongs to, before anything is added to your library.</p>
  </div>
  <input id="f" type="file" accept="application/json,.json" class="sr">
  ${body}
</main>
</body>
</html>
`;
}

// ---- the variants -------------------------------------------------------------
// Each is one kind of file a teacher could arrive with. None is written as a
// verdict: the verdict is whatever read() makes of it.
const asText = o => JSON.stringify(o, null, 2) + "\n";
const VARIANTS = [
  ["02-import.html", "ready", () => asText(fresh()), [],
   "The synthetic paper as it is."],
  ["02-import-limited.html", "limited", () => {
    // A teacher-authored file: no model answers or marking points on the long
    // responses, and no state declared.
    const p = fresh(); delete p.curriculum.jurisdiction;
    [[1, 0, 3], [1, 1, 2], [1, 2], [3, 0], [3, 1]].forEach(([s, q, pt]) => {
      const x = pt == null ? p.sections[s].questions[q] : p.sections[s].questions[q].parts[pt];
      delete x.model; delete x.points;
    });
    return asText(p);
  }, [], "No model answers or marking points on the five extended responses, and no state."],
  ["02-import-resolve.html", "resolve", () => {
    const p = fresh(); p.curriculum.subjectKey = "legal_studies"; p.curriculum.course = "Legal Studies";
    p.name = "Legal Studies practice paper"; p.subject = "Legal Studies"; return asText(p);
  }, [], "A well-formed subject key no package is registered for (UX-TEST-23)."],
  ["02-import-unsupported.html", "unsupported", () => {
    // A newer format that is genuinely different, not just renamed: questions
    // are "items" there. Read as this version, it would look like a broken file.
    const p = fresh(); p.format = "marginal-exam@2";
    p.sections.forEach(s => { s.items = s.questions; delete s.questions; }); return asText(p);
  }, [], "A marginal-exam@2 file whose sections hold items, not questions."],
  ["02-import-invalid.html", "invalid", () => { const p = fresh(); p.sections[1].marks = 38; return asText(p); }, [],
   "Section II's declared total disagrees with its questions."],
  ["02-import-broken.html", "broken", () => { const p = fresh(); delete p.sections; return asText(p); }, [],
   "A paper with no sections at all."],
  ["02-import-notjson.html", "notjson", () => RAW.slice(0, Math.floor(RAW.length / 2)), [],
   "The fixture cut in half, as a copy-and-paste accident would leave it."],
  ["02-import-flashcards.html", "flashcards", () => asText({ format: "marginal-set@1", name: "Marketing terms",
    cards: [{ type: "define", prompt: "Define market share.", model: "A business's sales as a proportion of total sales in its market." },
            { type: "define", prompt: "Define target market.", model: "The group of customers a business aims its products at." }] }),
   [], "A flashcard set, chosen on the paper import page."],
  ["02-import-duplicate.html", "duplicate", () => asText(fresh()), [fresh()],
   "The same paper, same exam.id and version, already in the library."],
];

const report = [];
fs.writeFileSync(path.join(OUTDIR, "02-import-choose.html"), startPage());
report.push({ file: "02-import-choose.html", page: "no file chosen" });
for (const [file, name, make, library, why] of VARIANTS) {
  const text = make();
  const f = { name: name === "ready" || name === "duplicate" ? path.basename(FIXTURE)
              : name === "flashcards" ? "marketing-terms.json" : path.basename(FIXTURE, ".json") + "-" + name + ".json",
              size: Math.max(1, Math.round(Buffer.byteLength(text) / 1024)) + " KB" };
  const r = read(text, library);
  const html = r.kind === "unreadable" ? unreadablePage(r, f) : r.kind === "flashcards" ? flashcardsPage(r, f)
    : r.kind === "version" ? versionPage(r, f) : paperPage(r, f);
  if (/—/.test(html)) throw new Error(file + " has an em dash");
  fs.writeFileSync(path.join(OUTDIR, file), html);
  report.push({ file, why, read: r.kind,
    page: r.kind === "paper" ? (r.dup && GROUP[r.worst].add ? "Already in your library" : GROUP[r.worst].title)
      : r.kind === "version" ? "Unsupported" : r.kind === "flashcards" ? "Unsupported (flashcard set)" : "Invalid file",
    findings: r.findings ? r.findings.map(x => x.code) : r.finding ? [r.finding.code] : [],
    resolved: r.auth ? (r.auth.ok ? r.auth.label : r.auth.code) : undefined });
}
console.log(JSON.stringify(report, null, 1));
