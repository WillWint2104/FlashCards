// PAGE 2, IMPORT AND VALIDATION. Generated, like page 1 and states 12 and 13.
//
// Every verdict, every finding and the subject line come from the shipped code:
//
//   tests/fixtures/bus-practice-paper.json   the paper, and five variants of it,
//                                            each one real edit away (VARIANTS)
//   PAPER.examine()                          the Gate 3C verdict and its findings
//   ASSESS.resolveAuthority()                the subject, resolved against the
//                                            packages the app actually registers
//                                            (essay-content.js), the same call
//                                            markingContext makes before marking
//
// What this file adds is only the translation into a teacher's words: which of
// five groups a verdict belongs to, a sentence per finding code, and where in the
// paper a finding is, read from its path. The contract's own sentence and code stay
// on the page, under "Details for whoever made this file".
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

// ---- the five human groups, over the five contract states -------------------
// A verdict is the worst state present; the page's verdict is that, or "needs
// something resolved" when the subject does not resolve (UX-TEST-23: examine()
// checks the key's shape, not that a package exists for it).
const GROUP = {
  publishable: { title: "Ready to import", list: "", tone: "ok", add: true,
                 lede: "Every question can be sat and marked." },
  thin:        { title: "Ready, with limited optional support", list: "Optional, and missing", tone: "note", add: true,
                 lede: "It can be sat and marked. A few optional things are missing, listed below." },
  blocked:     { title: "Needs something resolved", list: "What needs resolving", tone: "stop", add: false,
                 lede: "It cannot be added yet. The file needs the change below first." },
  unsupported: { title: "Unsupported", list: "Why this version cannot run it", tone: "stop", add: false,
                 lede: "This version of Marginal cannot run this file." },
  malformed:   { title: "Invalid file", list: "What is wrong in the file", tone: "stop", add: false,
                 lede: "Part of this file contradicts itself or is missing, so it cannot be used." },
};
const ORDER = ["malformed", "unsupported", "blocked", "thin"];

// A sentence per code, for the codes a teacher meets. Anything without one falls
// back to the contract's own sentence, so no finding is ever dropped for want of
// copy. These say what the student will experience; the details say why.
const SAY = {
  JURISDICTION_ABSENT: () => "The paper does not say which state it is written for. Nothing depends on this yet.",
  KLA_ABSENT: () => "The paper does not say which learning area it belongs to. It still marks correctly.",
  SECTION_NAME_ABSENT: () => "This section has no name, so students will see it as a number.",
  SUBJECT_KEY_MISSING: () => "The paper does not name the subject that marks it, so its written answers could not be marked.",
  SUBJECT_KEY_MALFORMED: () => "The paper names its subject in a form Marginal cannot match to a subject.",
  SUBJECT_UNREGISTERED: f => `The paper is for ${f.course || "a subject"}, and Marginal has no marking criteria for that subject yet, so its written answers could not be marked.`,
  PACKAGE_VERSION_UNSUPPORTED: f => `The file was made for a different version of Marginal's paper format (${f.asked}). This version opens ${PAPER.FORMAT} files.`,
  SECTION_TOTAL_DISAGREES: f => `This section says it is worth ${f.said} marks, but its questions add up to ${f.sum}.`,
};

// Where a finding is, in the paper's own numbering. "sections[1].questions[0]
// .parts[1].points" is Section II, Question 11(b).
function placeOf(paper, p) {
  if (!p) return "The whole file";
  if (/^curriculum/.test(p)) return "Subject details";
  if (p === "format") return "File format";
  const s = p.match(/^sections\[(\d+)\](?:\.questions\[(\d+)\](?:\.parts\[(\d+)\])?)?/);
  if (!s) return "The whole file";
  const sec = paper.sections && paper.sections[+s[1]];
  let at = "Section " + (ROMAN[+s[1]] || +s[1] + 1);
  if (s[2] == null || !sec) return at;
  const q = sec.questions[+s[2]];
  const n = PAPER.numberOf(q);
  if (s[3] == null) return at + ", Question " + n;
  return at + ", Question " + PAPER.displayNumber(n, PAPER.labelOf(q.parts[+s[3]], +s[3]));
}

// ---- one check, end to end ------------------------------------------------
function check(paper) {
  const v = PAPER.examine(paper);
  const cur = ASSESS.curriculumOf(paper) || {};
  const auth = ASSESS.resolveAuthority({ curriculum: cur, packages: PACKAGES });
  const findings = v.findings.map(f => ({ state: f.state, code: f.code, path: f.path, message: f.message }));
  // The subject is resolved or it is not. When the key is well formed and names
  // no package, examine() has nothing to say and the page must.
  if (!auth.ok && auth.code === "SUBJECT_UNREGISTERED")
    findings.unshift({ state: "blocked", code: auth.code, path: "curriculum.subjectKey", message: auth.why });
  const worst = ORDER.find(s => findings.some(f => f.state === s)) || "publishable";
  const t = PAPER.totals(paper);
  return { v, auth, cur, findings, worst, totals: t };
}

// ---- the page ----------------------------------------------------------------
function identity(c, paper) {
  const cur = c.cur, stage = cur.stage || "";
  if (c.auth.ok) {
    return `<div class="ident ok">
      <p class="k">Subject and course</p>
      <p class="who">${esc([c.auth.label, stage].filter(Boolean).join(" · "))}</p>
      <p class="how"><span class="tick" aria-hidden="true">✓</span>Matched to Marginal's ${esc(c.auth.label)} marking criteria${cur.jurisdiction ? " · " + esc(cur.jurisdiction) : ""}</p>
    </div>`;
  }
  const said = cur.course || paper.subject || "";
  return `<div class="ident no">
    <p class="k">Subject and course</p>
    <p class="who">${said ? esc([said, stage].filter(Boolean).join(" · ")) : "Not identified"}</p>
    <p class="how"><span class="cross" aria-hidden="true">✕</span>${said ? "Named by the file, not matched to any subject in Marginal" : "The file does not say which subject marks it"}</p>
  </div>`;
}

function contents(paper, c) {
  const rows = paper.sections.map((sec, i) => {
    const t = PAPER.totals({ sections: [sec] });
    return `<li><span class="sn">${esc(sec.name || "Section " + (ROMAN[i] || i + 1))}</span>
      <span class="sm">${plural(t.questions, "question")} · ${plural(t.marks, "mark")}</span></li>`;
  }).join("");
  return `<ul class="secs">${rows}</ul>`;
}

// What adding it would put under "Practise a question type" on page 1: the same
// count, by canonical format, of the same leaves.
const TYPES = [["multiple_choice", "multiple choice"], ["short_answer", "short answer"], ["calculation", "calculation"],
               ["business_report", "business report"], ["extended_response", "extended response"]];
function adds(paper) {
  const n = {};
  paper.sections.forEach(sec => sec.questions.forEach(q =>
    (PAPER.isParent(q) ? PAPER.partsOf(q) : [q]).forEach(leaf => {
      const f = ASSESS.normaliseFormat(leaf).format; n[f] = (n[f] || 0) + 1;
    })));
  const parts = TYPES.filter(([f]) => n[f]).map(([f, w]) => n[f] + " " + w);
  return parts.length ? parts.slice(0, -1).join(", ") + (parts.length > 1 ? " and " : "") + parts[parts.length - 1] : "";
}

function findingsHTML(paper, c) {
  const groups = ORDER.map(s => ({ s, list: c.findings.filter(f => f.state === s) })).filter(g => g.list.length);
  if (!groups.length) return "";
  return groups.map(g => `<section class="group ${GROUP[g.s].tone}" aria-labelledby="g-${g.s}">
      <h3 id="g-${g.s}">${esc(GROUP[g.s].list)} <span class="n">${g.list.length}</span></h3>
      <ul>${g.list.map(f => `<li><p class="where">${esc(placeOf(paper, f.path))}</p>
        <p class="what">${esc(f.say)}</p></li>`).join("")}</ul>
    </section>`).join("") +
    `<details class="tech"><summary>Details for whoever made this file</summary>
      <ul>${c.findings.map(f => `<li><code>${esc(f.code)}</code> at <code>${esc(f.path || "(file)")}</code>. ${esc(f.message)}.</li>`).join("")}</ul>
    </details>`;
}

function resultPage(name, paper, file, c) {
  const g = GROUP[c.worst];
  const body = `
  <div class="file"><span class="doc" aria-hidden="true"></span><span class="fn">${esc(file.name)}</span>
    <span class="fs">${esc(file.size)}</span><span class="spacer"></span>
    <a class="link" href="#choose">Choose a different file</a></div>

  <article class="result" aria-labelledby="rt">
    <div class="verdict ${g.tone}" role="status">
      <span class="mark" aria-hidden="true">${g.tone === "stop" ? "!" : "✓"}</span>
      <div><h2 id="rt">${esc(g.title)}</h2><p>${esc(g.lede)}</p></div>
    </div>
    <div class="grid">
      <div class="left">
        ${identity(c, paper)}
        <div class="paperid">
          <p class="k">Paper</p>
          <p class="title">${esc(paper.name || "Untitled paper")}</p>
          <p class="facts">${esc([plural(c.totals.questions, "question"), plural(paper.sections.length, "section"),
                                   plural(c.totals.marks, "mark"), paper.time].filter(Boolean).join(" · "))}</p>
          ${paper.exam && paper.exam.source ? `<p class="src">Source: ${esc(paper.exam.source)}</p>` : ""}
        </div>
      </div>
      <div class="right">
        <p class="k">Contents</p>
        ${contents(paper, c)}
        ${g.add ? `<p class="adds">Adds ${esc(adds(paper))} questions to <b>Practise a question type</b>.</p>` : ""}
      </div>
    </div>
    ${findingsHTML(paper, c)}
    <div class="acts">
      ${g.add ? `<a class="btn" href="#add">Add to library</a><a class="btn ghost" href="#choose">Choose a different file</a>`
              : `<a class="btn" href="#choose">Choose a different file</a><a class="link" href="#test">Back to Test mode</a>`}
    </div>
  </article>`;
  return shell(name, body);
}

function startPage() {
  return shell("choose", `
  <label class="drop" for="f">
    <input id="f" type="file" accept="application/json,.json" class="sr">
    <span class="doc big" aria-hidden="true"></span>
    <span class="dh">Choose a paper's JSON file</span>
    <span class="ds">or drop it here. It is checked before anything is added.</span>
    <span class="btn">Choose file</span>
  </label>
  <details class="paste"><summary>Paste JSON instead</summary>
    <textarea rows="6" aria-label="Paper JSON" placeholder='{"format":"${esc(PAPER.FORMAT)}", ...}'></textarea>
    <a class="btn ghost" href="#check">Check this JSON</a>
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
  h1,h2,h3,.disp{font-family:var(--disp);letter-spacing:-.01em;font-weight:600}
  :focus-visible{outline:2px solid var(--green-dk);outline-offset:3px;border-radius:10px}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

  /* Page 1's header and navigation, unchanged: no paper is open, so no subject
     is named in the header. The subject this page resolves is shown in the
     result, where it is the thing being checked. */
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
  .link{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--green-dk);text-underline-offset:3px}
  .spacer{flex:1}
  .k{font-family:var(--disp);font-weight:600;font-size:12.5px;color:var(--ink-2);letter-spacing:.01em;margin-bottom:4px}

  /* The chosen file, one line, above the result it produced. */
  .doc{width:18px;height:22px;border:2px solid var(--ink-2);border-radius:3px 7px 3px 3px;flex:none;position:relative}
  .doc::after{content:"";position:absolute;left:3px;right:3px;top:7px;height:2px;background:var(--ink-2);box-shadow:0 4px 0 var(--ink-2)}
  .doc.big{width:30px;height:38px;border-width:2.5px}
  .file{display:flex;align-items:center;gap:10px;background:var(--card);border:1.5px solid var(--line);border-radius:14px;
        padding:12px 18px;margin-bottom:14px;max-width:1000px}
  .fn{font-family:var(--disp);font-weight:600;font-size:14.5px}
  .fs{font-size:13px;color:var(--ink-2);font-weight:700}

  .result{background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:24px 28px;max-width:1000px}
  /* The verdict first, in the group's words: this is the answer to "can I use
     this file?", and everything under it is the evidence. */
  .verdict{display:flex;gap:14px;align-items:flex-start;border-radius:14px;padding:14px 18px;margin-bottom:22px}
  .verdict.ok{background:var(--green-soft);border:1px solid #BFEFD9}
  .verdict.stop{background:var(--coral-soft);border:1px solid #F7C9C1}
  .verdict.note{background:var(--gold-soft);border:1px solid #F5DCA6}
  .verdict.note .mark{background:var(--gold-dk)}
  .verdict.note h2{color:#6E4500}
  .verdict .mark{width:30px;height:30px;border-radius:99px;display:flex;align-items:center;justify-content:center;flex:none;
                 font-weight:800;color:#fff;margin-top:2px}
  .verdict.ok .mark{background:var(--green-dk)}
  .verdict.stop .mark{background:var(--coral-dk)}
  .verdict h2{font-size:21px;line-height:1.25}
  .verdict.ok h2{color:var(--green-edge)}
  .verdict.stop h2{color:var(--coral-dk)}
  .verdict p{font-size:14.5px;font-weight:600;color:var(--ink)}

  .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px}
  /* The proof the user asked to see before anything is added: the subject and
     course, as Marginal resolved them, not as the file claimed them. */
  .ident{border-radius:14px;padding:16px 18px;margin-bottom:18px}
  .ident.ok{background:#F4F9F8;border:1.5px solid var(--line)}
  .ident.no{background:#FFF8F6;border:1.5px solid #F7C9C1}
  .ident .who{font-family:var(--disp);font-weight:600;font-size:26px;line-height:1.2}
  .ident .how{font-size:13.5px;font-weight:700;color:var(--ink-2);margin-top:6px;display:flex;gap:7px;align-items:baseline}
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
  .adds{font-size:13.5px;color:var(--ink-2);font-weight:600;margin-top:12px}
  .adds b{color:var(--ink)}

  /* Findings, grouped the way a teacher reads them, each with where it is. */
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
  details.tech{margin-top:16px;font-size:13px;color:var(--ink-2)}
  details.tech summary{cursor:pointer;font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--ink-2)}
  details.tech ul{margin:8px 0 0 18px}
  details.tech li{margin:4px 0;line-height:1.55}
  code{font-size:12.5px;background:#F1F5F5;border-radius:5px;padding:0 5px;color:var(--ink)}

  .acts{display:flex;align-items:center;gap:16px;margin-top:24px;padding-top:20px;border-top:1px solid var(--line)}

  /* Before a file is chosen. The whole panel is the file control. */
  .drop{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;background:var(--card);
        border:2px dashed #BFCBCA;border-radius:18px;padding:46px 28px;max-width:1000px;cursor:pointer}
  .drop:focus-within{outline:2px solid var(--green-dk);outline-offset:3px}
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
    <a href="#study">Study</a><a href="#create">Create</a><a href="#test" aria-current="page">Test mode</a><a href="#essay">Essay practice</a>
  </nav>
  <a class="back" href="#test">← Test mode</a>
  <div class="top">
    <h1>Import a paper</h1>
    <p class="lede">Choose a paper's JSON file. Marginal checks it, and shows you the subject it belongs to, before anything is added to your library.</p>
  </div>
  ${body}
</main>
</body>
</html>
`;
}

// ---- the variants: the fixture, and single real edits of it ------------------
// Each is one change a real file could arrive with. None is written as a verdict:
// the verdict is whatever examine() and resolveAuthority() say about it.
const VARIANTS = [
  ["02-import.html", "ready", p => p, "Ready to import: the synthetic paper as it is."],
  ["02-import-limited.html", "limited", p => { delete p.curriculum.jurisdiction; delete p.sections[1].name; return p; },
   "No state declared, and Section II unnamed."],
  ["02-import-resolve.html", "resolve", p => { p.curriculum.subjectKey = "legal_studies"; p.curriculum.course = "Legal Studies"; p.name = "Legal Studies practice paper"; p.subject = "Legal Studies"; return p; },
   "A well-formed subject key no package is registered for (UX-TEST-23)."],
  ["02-import-unsupported.html", "unsupported", p => { p.format = "marginal-exam@2"; return p; },
   "A package version this release does not run."],
  ["02-import-invalid.html", "invalid", p => { p.sections[1].marks = 38; return p; },
   "Section II's declared total disagrees with its questions."],
];

// A file that does not parse is "Invalid file" before the contract sees it. The
// variant is the fixture cut short, as a copy-and-paste accident would leave it,
// and the detail is the parser's own message.
function notJsonPage(file, size, err) {
  const g = GROUP.malformed;
  return shell("not json", `
  <div class="file"><span class="doc" aria-hidden="true"></span><span class="fn">${esc(file)}</span>
    <span class="fs">${esc(size)}</span><span class="spacer"></span>
    <a class="link" href="#choose">Choose a different file</a></div>
  <article class="result" aria-labelledby="rt">
    <div class="verdict stop" role="status">
      <span class="mark" aria-hidden="true">!</span>
      <div><h2 id="rt">${esc(g.title)}</h2><p>This file is not readable as JSON, so it cannot be checked as a paper. It may have been cut off, or it may be a different kind of file.</p></div>
    </div>
    <details class="tech"><summary>Details for whoever made this file</summary>
      <ul><li>${esc(err)}</li></ul>
    </details>
    <div class="acts"><a class="btn" href="#choose">Choose a different file</a><a class="link" href="#test">Back to Test mode</a></div>
  </article>`);
}

const report = [];
fs.writeFileSync(path.join(OUTDIR, "02-import-choose.html"), startPage());
report.push({ file: "02-import-choose.html", state: "no file chosen" });
for (const [file, name, edit, why] of VARIANTS) {
  const paper = edit(fresh());
  const json = JSON.stringify(paper, null, 2) + "\n";
  const c = check(paper);
  c.findings.forEach(f => {
    const m = String(f.message).match(/says it is worth (\d+) and its questions add to (\d+)/);
    const asked = String(f.message).match(/^"([^"]+)"/);
    f.say = SAY[f.code] ? SAY[f.code]({ course: (paper.curriculum || {}).course, said: m && m[1], sum: m && m[2], asked: asked && asked[1] })
                        : f.message.charAt(0).toUpperCase() + f.message.slice(1) + ".";
  });
  const kb = Math.max(1, Math.round(Buffer.byteLength(json) / 1024)) + " KB";
  const fname = name === "ready" ? path.basename(FIXTURE) : path.basename(FIXTURE, ".json") + "-" + name + ".json";
  fs.writeFileSync(path.join(OUTDIR, file), resultPage(name, paper, { name: fname, size: kb }, c));
  report.push({ file, why, examine: c.v.state, resolved: c.auth.ok ? c.auth.label : c.auth.code,
                page: GROUP[c.worst].title, findings: c.findings.map(f => f.code) });
}
{
  const cut = RAW.slice(0, Math.floor(RAW.length / 2));
  let err = "";
  try { JSON.parse(cut); } catch (e) { err = String(e.message); }
  if (!err) throw new Error("the cut-short fixture parsed, so it cannot stand for an unreadable file");
  const kb = Math.max(1, Math.round(Buffer.byteLength(cut) / 1024)) + " KB";
  fs.writeFileSync(path.join(OUTDIR, "02-import-notjson.html"), notJsonPage(path.basename(FIXTURE, ".json") + "-cut.json", kb, err));
  report.push({ file: "02-import-notjson.html", why: "The fixture cut in half.", page: GROUP.malformed.title, parser: err });
}
console.log(JSON.stringify(report, null, 1));
