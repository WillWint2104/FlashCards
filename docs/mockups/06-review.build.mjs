// SLICE B, STATE 3: INDIVIDUAL QUESTION REVIEW. Generated, like pages 1 to 5.
//
// One question of a closed attempt, read only. No new feedback architecture:
// the question, the answer and the result are the frozen marked states the
// sitting already draws (tmQuestionHTML and tmResultHTML in app.js), set in a
// review shell that can only move: ← Results, Previous and Next through the
// attempt, and the Questions navigator. Everything that could change a mark is
// gone: the answer box is not editable, and there is no Try again, Try marking
// again, second opinion, flag or rewrite.
//
// Each attempt is the one a Results page shows, closed the way that page closes
// it, so the cell a student clicks and the page it opens cannot disagree. What a
// page says about its question is ATT.reviewAt: the Results item, the version
// that was marked, text changed after it, and text never submitted. The CSS is
// the app's own (index.html), kept to the rules these pages use.
//
//   node docs/mockups/06-review.build.mjs
//
//   06-review.html              a marked short answer (the primary proposal)
//   06-review-extended.html     a marked extended response
//   06-review-unmarked.html     submitted, not marked
//   06-review-changed.html      marked, then changed and never submitted
//   06-review-notanswered.html  not answered, with a draft never submitted
//   06-review-either.html       neither either/or question chosen
//   06-review-questions.html    the Questions navigator, open
import { ATT, ASSESS, PAPER, APP, paper, exams, SUBJECT, completedAttempt, scenario as replay, esc, plural, list, day } from "./replay.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "..", "..");
const OUTDIR = process.env.MOCKUP_OUT || HERE;
const SUBMIT = JSON.parse(fs.readFileSync(path.join(HERE, "04-submit.fixture.json"), "utf8"));
const RESULTS = JSON.parse(fs.readFileSync(path.join(HERE, "05-results.fixture.json"), "utf8"));
const FX = JSON.parse(fs.readFileSync(path.join(HERE, "06-review.fixture.json"), "utf8"));
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const fail = m => { throw new Error(m); };

// ---- the attempt a Results page shows, closed as that page closes it ----------------------
const CLOSED = {};
function attemptOf(resultsFile) {
  if (CLOSED[resultsFile]) return CLOSED[resultsFile];
  const spec = RESULTS.pages[resultsFile] || fail("no Results page " + resultsFile);
  if (spec.done) return (CLOSED[resultsFile] = completedAttempt());
  const sc = spec.submit ? replay(SUBMIT, spec.submit) : replay(RESULTS.scenarios, spec.own);
  const key = ATT.paperKey(paper);
  const store = { exams: exams.slice(), attempts: { [key]: { current: sc.a, last: sc.rec.last } } };
  if (!ATT.complete(store, key, spec.completedAt)) fail(resultsFile + ": the attempt could not be closed");
  return (CLOSED[resultsFile] = store.attempts[key].last);
}

// ---- the frozen words, read from app.js so a drift fails the build -------------------------
const APP_SAYS = [
  "Where the marker could point at the sentence it meant, your own words are shown. Where it could not, the observation is about the response as a whole.",
  "your response was judged against",
  "Your submitted response",
  "Marked against ",
  "Across your response",
  "In your response",
  'return ratio >= 0.95 ? "Full marks" : ratio >= 0.6 ? "Most of it" : ratio >= 0.3 ? "Partly there" : "Not yet";',
];
APP_SAYS.forEach(s => { if (!APP.includes(s)) fail("app.js no longer says: " + s); });
const mood = g => { const r = g.max ? g.score / g.max : 0; return r >= 0.95 ? "Full marks" : r >= 0.6 ? "Most of it" : r >= 0.3 ? "Partly there" : "Not yet"; };
const fmtWords = q => {
  const fx = ASSESS.normaliseFormat(q);
  const fw = { multiple_choice: "multiple choice", short_answer: "short answer", calculation: "calculation", business_report: "business report", extended_response: "extended response" }[fx.format] || "";
  return [fw, fx.directiveText ? String(fx.directiveText).toLowerCase() : ""].filter(Boolean).join(" · ");
};
const paras = t => String(t).split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join("");
const words = t => String(t).trim() ? String(t).trim().split(/\s+/).length : 0;
const shortOf = e => e.eitherSlot ? "Question " + e.options.join(" or ") : e.display;
const whereOf = e => e.eitherSlot ? "Question " + e.options.join(" or ") : "Question " + e.display;

// ---- sources (tmHolders, tmSourceBody, tmSourcePanel) --------------------------------------
function holders(e) {
  const out = [];
  PAPER.resourcesOf({ stimulus: e.sec.source }).forEach((r, i, all) => out.push({ r, owner: "section", label: all.length > 1 ? "Source material " + (i + 1) : "Source material" }));
  if (e.parent) PAPER.resourcesOf(e.parent).forEach((r, i, all) => out.push({ r, owner: "parent", label: all.length > 1 ? "Source " + (i + 1) : "Source" }));
  PAPER.resourcesOf(e.q).forEach((r, i, all) => out.push({ r, owner: "question", label: all.length > 1 ? "Source " + (i + 1) : "Source" }));
  return out;
}
const srcBody = r => typeof r === "string" ? paras(r) : (r.text ? paras(r.text) : "");
function sourcePanel(e, hs) {
  const own = hs[0].owner === "parent" ? "Shared source · Question " + (PAPER.numberOf(e.parent) || "")
    : hs[0].owner === "section" ? "Source material · " + ATT.sectionShort(e.sec, e.si) : "Source · Question " + (e.display || "");
  const cap0 = hs[0].r && hs[0].r.caption ? hs[0].r.caption : hs[0].label;
  return `<aside class="tm-srcpanel" aria-label="Source">
      <div class="tm-srchead"><span class="ic" aria-hidden="true">📄</span><span class="t">${esc(cap0)}<small>${esc(own)}</small></span>
        <button type="button" class="tm-expand" title="Open the source in a larger reading view">⤢ Expand</button></div>
      <div class="tm-srcbody">${hs.map((h, i) => `${i ? `<h3 class="tm-srcsub">${esc(h.r && h.r.caption ? h.r.caption : h.label)}</h3>` : ""}${srcBody(h.r)}`).join("")}</div>
    </aside>`;
}

// ---- where an item stands, in Results' words and Results' edges -----------------------------
// A light edge is marked, a solid dark edge not marked, a dashed edge not answered.
function statusTags(v) {
  const x = v.item;
  const main = x.status === "marked" ? `<span class="tm-rvtag m"><b>${x.score} / ${x.max}</b><span class="vh"> marks${v.later ? ", for the version that was marked" : ""}</span></span>`
    : x.status === "not_marked" ? `<span class="tm-rvtag nm">Not marked · ${plural(x.marks, "mark")}</span>`
    : `<span class="tm-rvtag na">${x.eitherSlot ? "Not chosen" : "Not answered"} · ${plural(x.marks, "mark")}</span>`;
  return `<span class="tm-rvst">${main}${v.later ? `<a class="tm-rvtag ch" href="#tmlater">Changed after marking</a>` : ""}${x.flagged ? `<span class="tm-rvfl">⚑ Flagged</span>` : ""}</span>`;
}

// ---- a parent question's part chips, as the sitting draws them (tmParentHTML) --------------
function parentHTML(e, a, seq, file) {
  const sibs = seq.filter(x => x.si === e.si && x.qi === e.qi && x.parent);
  const caption = PAPER.resourcesOf(e.parent).map(r => r && typeof r === "object" ? r.caption : "").filter(Boolean)[0] || "";
  const R = ATT.results(a, exams).items;
  const st = x => R.find(y => y.key === x.key);
  const done = sibs.filter(x => st(x).status === "marked").length;
  const chips = sibs.length > 1 ? `<div class="pprog"><span class="pdone">${done} of ${plural(sibs.length, "part")} marked</span>
      <div class="parts" role="group" aria-label="Parts of Question ${esc(PAPER.numberOf(e.parent) || "")}">${sibs.map(x => {
        const s = st(x), lab = PAPER.labelOf(x.q, x.pi), here = x === e;
        const cls = ["pt", s.status === "marked" ? "done" : "", s.flagged ? "flag" : "", here ? "here" : "", s.status === "not_marked" && !here ? "nm" : "", s.status === "not_answered" && !here ? "todo" : ""].filter(Boolean).join(" ");
        const title = x.display + " · " + plural(s.marks, "mark") + " · " + (s.status === "marked" ? s.score + " of " + s.max : s.status === "not_marked" ? "not marked" : "not answered") + (s.flagged ? " · flagged" : "") + (here ? " · you are here" : "");
        return `<a class="${cls}" href="#review-${esc(x.key)}" title="${esc(title)}"${here ? ' aria-current="true"' : ""}>${s.status === "marked" ? '<span class="g">✓</span>' : ""}${s.flagged ? '<span class="g fg">⚑</span>' : ""}${esc(lab)}</a>`;
      }).join("")}</div></div>` : "";
  return `<div class="tm-parent"><div class="prow"><span class="pnum">Question ${esc(PAPER.numberOf(e.parent) || "")}</span>
      <span class="pmeta">${esc([caption, plural(PAPER.marksOf(e.parent), "mark")].filter(Boolean).join(" · "))}</span></div>${chips}</div>
      ${e.parent.instructions ? `<p class="tm-instr">${esc(e.parent.instructions)}</p>` : ""}`;
}

// ---- the result, as tmResultHTML draws it, with every action taken out ---------------------
function resultHTML(e, v, total) {
  const q = e.q, g = v.result, x = v.item, f = ASSESS.normaliseFormat(q).format;
  if (x.status === "not_marked") {
    return `<div class="tm-result nm"><span class="badge">Not marked</span><span class="pair"><span class="k">Marks</span><span class="v">None</span></span></div>
      <p class="tm-mnote"><span class="who">Reason at the time</span>${esc(x.cause || "No reason was recorded.")}</p>
      <p class="tm-whynot">This attempt is closed, so it stays not marked. Nothing was recorded against your answer, and its ${plural(x.marks, "mark")} still count in the ${total}.</p>`;
  }
  if (x.status === "not_answered") {
    const either = x.eitherSlot ? (x.options.length === 2 ? `Neither Question ${x.options[0]} nor Question ${x.options[1]} was chosen.` : "None of these questions was chosen.") + ` The section counted as ${x.weight === 1 ? "one question" : x.weight + " questions"} and earned nothing.`
      : "Nothing was submitted for marking for this question, so it earned nothing.";
    return `<div class="tm-result na"><span class="badge">${x.eitherSlot ? "Not chosen" : "Not answered"}</span><span class="pair"><span class="k">Marks</span><span class="v">None</span></span></div>
      <p class="tm-whynot">${esc(either)} ${x.eitherSlot ? "Its" : "Its"} ${plural(x.marks, "mark")} still count in the ${total}.</p>`;
  }
  const pair = `<span class="pair"><span class="k">Marks</span><span class="v">${g.score} of ${g.max}</span></span>`;
  const result = `<div class="tm-result"><span class="badge">${esc(mood(g))}</span>${pair}</div>`;
  const fb = g.kind === "llm" ? g.fb || {} : {};
  const summary = fb.summary || (fb.overall && fb.overall.summary) || "";
  const mnote = summary ? `<p class="tm-mnote"><span class="who">Marked against ${esc(SUBJECT)} criteria</span>${esc(summary)}</p>` : "";
  if (!(f === "extended_response" || f === "business_report")) {
    const pts = Array.isArray(g.points) && g.points.length ? g.points : null;
    return result + mnote + (pts ? fail("a points checklist is not drawn by this generator") : "");
  }
  const crits = (Array.isArray(fb.rubric) ? fb.rubric : []).filter(r => r && r.name).map(r => ({ name: r.name, d: r.descriptor || "" }));
  const anchored = [], across = [];
  (fb.paragraphs || []).forEach(p => (p.sentences || []).forEach(sn => (sn.issues || []).forEach(iss => (sn.unplaced ? across : anchored).push({ quote: sn.text, head: iss.head || "", why: iss.why || "" }))));
  return result + mnote +
    (crits.length ? `<section class="tm-sect"><h2 class="secth">How this was marked</h2>
      <p class="lede">${crits.length === 1 ? "The criterion" : "The " + crits.length + " criteria"} your response was judged against, in the order the ${esc(SUBJECT)} course sets them.</p>
      <ol class="crits">${crits.map(c => `<li class="tm-crit"><h3 class="critn">${esc(c.name)}</h3>${c.d ? `<p>${esc(c.d)}</p>` : ""}</li>`).join("")}</ol></section>` : "") +
    (anchored.length || across.length ? `<section class="tm-sect"><h2 class="secth">What the marker noticed</h2>
      <p class="lede">Where the marker could point at the sentence it meant, your own words are shown. Where it could not, the observation is about the response as a whole.</p>
      <ol class="obs">${anchored.map(o => `<li class="ob"><h4 class="obh">${esc(o.head)}</h4><div class="ev"><div class="tm-lbl">In your response</div><q>${esc(o.quote)}</q></div>${o.why ? `<p>${esc(o.why)}</p>` : ""}</li>`).join("")}
        ${across.map(o => `<li class="ob"><h4 class="obh">${esc(o.head)}</h4><div class="acrossl">Across your response</div>${o.why ? `<p>${esc(o.why)}</p>` : ""}</li>`).join("")}</ol></section>` : "");
}

// ---- the question, as tmQuestionHTML draws its marked state, read only --------------------
function questionHTML(e, a, v, seq, total, file) {
  const q = e.q, x = v.item, f = ASSESS.normaliseFormat(q).format;
  const big = f === "extended_response" || f === "business_report";
  const head = `<div class="exam-qhead"><span>Question ${esc(e.display || "")}</span><span class="marks">· ${plural(Number(q.marks) || 0, "mark")}</span>
      ${fmtWords(q) ? `<span class="fmt">${esc(fmtWords(q))}</span>` : ""}${statusTags(v)}</div>`;
  const prompt = `<p class="exam-prompt">${esc(q.prompt || "")}</p>`;
  // A long response's source sits in the card, collapsed, as in its marked state.
  const caseBlock = big ? holders(e).map(h => `<details class="tm-case"><summary><span class="nm">${esc(h.r && h.r.caption ? h.r.caption : h.label)}</span></summary><div class="body">${srcBody(h.r)}</div></details>`).join("") : "";
  let body = "";
  if (v.answer != null) {
    const lbl = v.later ? "The version that was marked" : x.status === "not_marked" ? "Your submitted answer, not marked" : "Your submitted answer";
    body = big
      ? `<details class="tm-submitted"><summary><span class="nm">${v.later ? "The version that was marked" : "Your submitted response"}</span><span>· ${plural(words(v.answer), "word")}</span></summary>
          <div class="response">${paras(v.answer)}</div></details>`
      : `<div class="tm-rvlbl" id="rvlbl">${lbl}</div><textarea class="tm-answerbox" rows="5" aria-labelledby="rvlbl" disabled>${esc(v.answer)}</textarea>`;
  }
  const unsent = v.unsent != null ? `<details class="tm-rvunsent"><summary>Show what you wrote</summary>
      <p class="tm-rvwhy">You wrote this but did not submit it before the attempt closed, so it was not marked.</p><div class="tm-rvtext">${paras(v.unsent)}</div></details>` : "";
  const later = v.later != null ? `<section class="tm-rvlater" id="tmlater" aria-labelledby="tmlaterh"><h3 id="tmlaterh">Changed after marking, never submitted</h3>
      <p>You changed this answer after it was marked and did not submit the change before the attempt closed. The change was never marked. The mark above is for the version that was marked, not for this text.</p>
      <div class="tm-rvtext">${paras(v.later)}</div></section>` : "";
  return `${e.parent ? parentHTML(e, a, seq, file) : ""}${head}${caseBlock}${prompt}${body}
      <div id="sheet">${resultHTML(e, v, total)}${unsent}${later}</div>`;
}
function eitherHTML(e, v, total) {
  const ins = String(e.sec.instructions || "").trim();
  return `<div class="exam-qhead"><span>${esc(ATT.sectionName(e.sec, e.si))}</span><span class="marks">· ${plural(PAPER.marksOf(e.q), "mark")}</span>${statusTags(v)}</div>
      ${ins ? `<blockquote class="tm-ins"><p>${esc(ins)}</p><cite>Original paper instructions</cite></blockquote>` : ""}
      <div id="sheet">${resultHTML(e, v, total)}</div>
      <h3 class="tm-rvopth">The questions on the paper</h3>
      <ul class="tm-rvopts">${e.options.map(o => `<li><span class="tm-lbl">Question ${esc(o.number)} · ${plural(Number(o.q.marks) || 0, "mark")}</span><span class="txt">${esc(o.q.prompt || o.q.instructions || "")}</span></li>`).join("")}</ul>`;
}

// ---- the Questions navigator (tmNavigator), for a closed attempt --------------------------
function navigatorHTML(a, seq, here) {
  const R = ATT.results(a, exams), it = k => R.items.find(y => y.key === k);
  const chip = (e, label) => {
    const s = it(e.key), i = seq.indexOf(e);
    const cls = ["tm-chip", s.status === "marked" ? "done" : "", s.status === "not_marked" ? "nm" : "", s.flagged ? "flag" : "", e === here ? "here" : "", s.status === "not_answered" && e !== here ? "todo" : ""].filter(Boolean).join(" ");
    const title = label + " · " + (s.status === "marked" ? s.score + " of " + s.max : s.status === "not_marked" ? "not marked" : "not answered") + (s.flagged ? " · flagged" : "") + (e === here ? " · you are here, item " + (i + 1) + " of " + seq.length : "");
    return `<a class="${cls}" href="#review-${esc(e.key)}" title="${esc(title)}"${e === here ? ' aria-current="true"' : ""}>${s.status === "marked" ? "✓ " : ""}${s.flagged ? "⚑ " : ""}${esc(label)}</a>`;
  };
  const blocks = R.bands.map(b => {
    const items = seq.filter(e => e.si === b.si);
    let html = "", run = [];
    const flush = () => { if (run.length) html += `<div class="tm-chips">${run.join("")}</div>`; run = []; };
    items.forEach((e, idx) => {
      if (e.eitherSlot) { run.push(`<span class="tm-either">${e.options.map(o => chip(e, "Q" + o.number)).join('<span class="or">or</span>')}<span class="tm-muted">Neither chosen</span></span>`); return; }
      if (e.parent) {
        if (idx && items[idx - 1].parent === e.parent) return;
        flush();
        const sibs = items.filter(y => y.parent === e.parent), g = b.entries.find(y => y.kind === "parent" && y.number === String(PAPER.numberOf(e.parent)));
        html += `<div class="tm-pblock"><div class="pbh"><b>Question ${esc(PAPER.numberOf(e.parent) || "")}</b><span>${plural(PAPER.marksOf(e.parent), "mark")} · ${g.state === "marked" ? g.got + " / " + g.max : g.state === "nothing_marked" ? "nothing marked" : "not answered"}</span></div>
          <div class="tm-chips">${sibs.map(y => chip(y, PAPER.labelOf(y.q, y.pi))).join("")}</div></div>`;
        return;
      }
      run.push(chip(e, "Q" + e.display));
    });
    flush();
    return `<section class="tm-navsec"><div class="nsh"><h3>${esc(b.name)}</h3><span>${b.done} of ${b.total} answered · ${b.state === "marked" ? b.got + "/" + b.max + " marks" : b.state === "nothing_marked" ? "nothing marked" : "not answered"}</span></div>${html}</section>`;
  }).join("");
  const i = seq.indexOf(here);
  return `<div class="tm-scrim"><div class="tm-navsheet" role="dialog" aria-modal="true" aria-labelledby="tmnavh">
      <div class="tm-navhead"><h2 id="tmnavh">Questions</h2><span class="tm-spacer"></span><button type="button" class="tm-btn sm ghost">Close</button></div>
      <div class="tm-navstats"><span>${R.rows.marked.count ? `${R.got} / ${R.max} marks` : "Nothing marked"}</span><span>${R.rows.marked.count} of ${R.total} answered</span>${R.rows.notMarked.count ? `<span>${R.rows.notMarked.count} not marked</span>` : ""}<span>${R.flagged.length} flagged</span>
        <span class="pill">You are on item ${i + 1} of ${seq.length} · ${esc(whereOf(R.items[i]))} · ${esc(ATT.sectionShort(here.sec, here.si))}</span></div>
      <div class="tm-navbody">${blocks}</div>
      <p class="tm-legend"><span class="tm-chip done">✓ marked</span><span class="tm-chip nm">not marked</span><span class="tm-chip todo">not answered</span><span class="tm-chip flag">⚑ flagged</span><span class="tm-chip here">current</span></p>
      <div class="tm-navfoot"><a class="tm-btn sm ghost" href="#results">Back to Results</a></div>
    </div></div>`;
}

// ---- the page --------------------------------------------------------------------------
function page(file, spec) {
  const a = attemptOf(spec.results);
  const v = ATT.reviewAt(a, exams, spec.key) || fail(file + ": " + spec.key + " is not in the attempt");
  const seq = ATT.sequence(a, exams), R = ATT.results(a, exams);
  const e = seq[v.index].key === v.entry.key ? seq[v.index] : fail(file + ": the review and the sequence disagree");
  const total = R.max;
  const f = e.eitherSlot ? "either" : ASSESS.normaliseFormat(e.q).format;
  const single = f === "extended_response" || f === "business_report" || f === "either";
  const hs = e.eitherSlot ? [] : holders(e);
  const secline = ATT.sectionName(e.sec, e.si) + " · " + plural(PAPER.totals({ sections: [e.sec] }).marks, "mark");
  const mark = R.rows.marked.count ? `Your mark <b>${R.got}</b>/${R.max}` : "Nothing marked";
  const prev = v.prev ? `<a class="tm-btn sm ghost" href="#review-${esc(v.prev.key)}">← Previous<span class="foot-lbl">&nbsp;·&nbsp;${esc(shortOf(v.prev))}</span></a>`
    : `<button type="button" class="tm-btn sm ghost" disabled>← Previous</button>`;
  const next = v.next ? `<a class="tm-btn sm ghost" href="#review-${esc(v.next.key)}">Next<span class="foot-lbl">&nbsp;·&nbsp;${esc(shortOf(v.next))}</span>&nbsp;→</a>`
    : `<a class="tm-btn sm ghost" href="${esc(spec.results)}">Back to Results</a>`;
  const html = `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test mode · Review · ${esc(whereOf(v.item))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<!-- ${esc(spec.note)}. Generated by 06-review.build.mjs: do not edit by hand. -->
<style>
/*APPCSS*/
${REVIEW_CSS}
</style>
</head>
<body class="tm-on tm-sitting">
<header>
  <div class="brand"><span class="mk"></span>Marginal</div>
  <div class="unit"><b>${esc(SUBJECT)}</b>Test mode</div>
</header>
<main id="app">
<div class="tm tm-sit tm-rv">
  <div class="tm-bar">
    <a class="tm-back" href="${esc(spec.results)}"><span aria-hidden="true">← </span>Results</a>
    <div class="paper"><div class="nm">${esc(paper.name)}</div><div class="sec">${esc(secline)}</div></div>
    <span class="tm-spacer"></span>
    <span class="tm-rvclosed">Completed ${day(a.completedAt)} · read only</span>
    <button type="button" class="tm-navbtn" aria-haspopup="dialog"><span class="grid" aria-hidden="true">${"<i></i>".repeat(9)}</span>Questions</button>
    <div class="tm-prog"><span class="exam-progress">${mark}</span></div>
  </div>
  <div class="tm-work${single || !hs.length ? " single" : ""}">
    <div class="tm-qcard">${e.eitherSlot ? eitherHTML(e, v, total) : questionHTML(e, a, v, seq, total, file)}</div>
    ${!single && hs.length ? sourcePanel(e, hs) : ""}
  </div>
  <div class="tm-footer"><div class="tm-footin">
    ${prev}
    <span class="tm-whereitem">Item ${v.index + 1} of ${v.count} · ${esc(ATT.sectionShort(e.sec, e.si))}</span>
    ${next}
  </div></div>
  <div id="tmnavwrap">${spec.navigator ? navigatorHTML(a, seq, e) : ""}</div>
</div>
</main>
</body>
</html>
`;
  return { html: html.replace("/*APPCSS*/", appCSS(html)), a, v };
}

// ---- the review shell's own rules (everything else is the app's) ---------------------------
const REVIEW_CSS = `
  /* Review shell (state 3). Edges follow Results and the navigator: light is
     marked, solid dark is not marked, dashed is not answered. */
  .tm-rv .tm-bar .tm-back{margin:0;padding:0}
  .tm-rvclosed{display:inline-flex;align-items:center;font-size:12px;font-weight:800;color:var(--ink-2);background:#F1F5F5;border:1px solid var(--line);border-radius:99px;padding:3px 11px}
  .tm-rv .tm-prog .exam-progress{margin:0;font-size:13px;color:var(--ink-2)}
  .tm-rv .tm-prog .exam-progress b{font-family:var(--disp);font-size:16px;color:var(--ink)}
  .tm-rvst{margin-left:auto;display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px}
  .tm-rvtag{font-family:var(--body);font-size:12.5px;font-weight:800;color:var(--ink);background:#fff;border:1.5px solid #C9D3D2;border-radius:8px;padding:1px 9px;text-decoration:none;white-space:nowrap}
  .tm-rvtag b{font-family:var(--disp);font-weight:600;font-size:14px}
  .tm-rvtag.m{border-color:#C9D3D2}
  .tm-rvtag.nm{border-color:var(--ink-3)}
  .tm-rvtag.na{border-color:var(--ink-3);border-style:dashed}
  .tm-rvtag.ch{color:var(--ink-2);background:#F1F5F5;border-color:var(--line)}
  .tm-rvtag.ch:hover{text-decoration:underline;text-underline-offset:3px}
  .tm-rv .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .tm-rvfl{font-size:12.5px;font-weight:800;color:var(--gold-dk);white-space:nowrap}
  .tm-rvlbl{margin:14px 0 6px;font-family:var(--disp);font-weight:600;font-size:13px;color:var(--ink-2)}
  .tm-rvlater{margin-top:22px;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;background:#F6F9F9;max-width:62ch}
  .tm-rvlater h3{font-size:15px;font-weight:600}
  .tm-rvlater>p{margin-top:4px;font-size:14px;font-weight:600;color:var(--ink-2)}
  .tm-rvtext{margin-top:10px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 14px}
  .tm-rvtext p{font-size:15px;line-height:1.65;color:var(--ink);white-space:pre-line}
  .tm-rvtext p+p{margin-top:10px}
  .tm-rvunsent{margin-top:16px;max-width:62ch}
  .tm-rvunsent summary{cursor:pointer;font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--green-dk)}
  .tm-rvwhy{margin-top:6px;font-size:13.5px;font-weight:600;color:var(--ink-2)}
  .tm-result.na{background:#fff;border-color:var(--ink-3);border-style:dashed}
  .tm-result.na .badge{color:var(--ink);box-shadow:0 0 0 1.5px var(--line) inset}
  .tm-rv .tm-result.nm{border-color:var(--ink-3)}
  .tm-rvopth{margin-top:22px;font-size:15px;font-weight:600}
  .tm-rvopts{list-style:none;margin-top:8px;display:grid;gap:8px}
  .tm-rvopts li{border:1.5px solid var(--line);border-radius:14px;padding:12px 16px;display:flex;flex-direction:column;gap:3px}
  .tm-rvopts .tm-lbl{font-family:var(--disp);font-weight:600;font-size:14px}
  .tm-rvopts .txt{font-size:14.5px;font-weight:600;color:var(--ink)}
  .tm-rv blockquote.tm-ins{margin-top:10px}
  .tm-rv a.pt,.tm-rv a.tm-chip{text-decoration:none}
`;

// ---- the app's CSS, kept to the rules a page uses -------------------------------------------
// A rule is kept when every class and id its selector names is on the page, so
// these pages are styled by index.html itself and cannot drift from the app.
const APPCSS_ALL = (() => {
  const m = INDEX.match(/<style>([\s\S]*?)<\/style>/) || fail("index.html has no style block");
  return m[1].replace(/\/\*[\s\S]*?\*\//g, "");
})();
function blocks(css) {
  const out = []; let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i); if (open < 0) break;
    let d = 1, j = open + 1;
    while (j < css.length && d) { if (css[j] === "{") d++; else if (css[j] === "}") d--; j++; }
    out.push({ sel: css.slice(i, open).trim(), body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}
function appCSS(html) {
  const used = new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean));
  const ids = new Set([...html.matchAll(/id="([^"]*)"/g)].map(m => m[1]));
  const splitSel = s => { const out = []; let d = 0, cur = ""; for (const c of s) { if (c === "(") d++; if (c === ")") d--; if (c === "," && !d) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
  const keep = s => { const bare = s.replace(/:not\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");
    return [...bare.matchAll(/\.([A-Za-z0-9_-]+)/g)].every(m => used.has(m[1])) && [...bare.matchAll(/#([A-Za-z0-9_-]+)/g)].every(m => ids.has(m[1])); };
  const walk = css => blocks(css).map(b => {
    if (/^@media/.test(b.sel)) { const inner = walk(b.body); return inner ? `${b.sel}{${inner}}` : ""; }
    if (/^@/.test(b.sel)) return /^@keyframes/.test(b.sel) ? "" : `${b.sel}{${b.body}}`;
    const sels = splitSel(b.sel).filter(keep);
    return sels.length ? `${sels.join(",")}{${b.body.trim()}}` : "";
  }).filter(Boolean).join("\n");
  return walk(APPCSS_ALL);
}

// ---- the pages, and the checks that keep them honest --------------------------------------
const report = [];
function check(file, spec, { html, a, v }) {
  const x = v.item, body = html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<!--[\s\S]*?-->/g, "");
  // The page's own words: the student's text, the paper's and the marker's are quoted, not said.
  const own = body.replace(/<textarea[\s\S]*?<\/textarea>|<div class="(response|tm-rvtext|tm-srcbody)">[\s\S]*?<\/div>|<q>[\s\S]*?<\/q>/g, " ");
  const said = own.replace(/<[^>]+>/g, " ") + " " + [...own.matchAll(/(?:title|aria-label)="([^"]*)"/g)].map(m => m[1]).join(" ");
  if (!a.completedAt) fail(file + ": not a closed attempt");
  // Read only: nothing that could change, mark or re-mark an answer.
  [/<textarea(?![^>]*\bdisabled\b)/, /<input/, /id="(check|examretry|examremark|examreview|tmswitch|examflag|examfinish)"/, /data-examchoose/].forEach(re => { if (re.test(body)) fail(file + " has a control that changes the attempt: " + re); });
  // Words a closed attempt never says, and advice that was only true while it was open.
  [/—/, /%/, /\byet\b/i, /so far/i, /Try again/i, /try marking/i, /second opinion/i, /make this stronger/i, /Submit for marking|Check answer|Review &amp; submit|Review & submit/,
   /Wait a minute|Write the final value|check the class code|You can leave and come back/].forEach(re => { if (re.test(said)) fail(file + " says " + re); });
  // The mark on the page is the Results item's, and only a marked item shows one.
  const r = ATT.results(a, exams).items.find(y => y.key === x.key);
  if (r.status !== x.status || r.score !== x.score) fail(file + ": the page and Results disagree about " + x.key);
  const sheet = body.slice(body.indexOf('id="sheet"'));
  if (x.status === "marked" && !sheet.includes(`<span class="v">${x.score} of ${x.max}</span>`)) fail(file + ": the mark is not the Results mark");
  if (x.status !== "marked" && /class="v">\s*\d/.test(sheet)) fail(file + ": an item with no mark shows a number");
  if (x.status !== "marked" && /tm-mnote"><span class="who">Marked against/.test(body)) fail(file + ": feedback without a mark");
  // Changed after marking: the marked version sits with its mark; the later text only in its own section, after the mark.
  if (v.later != null) {
    const graded = esc(v.answer), later = esc(v.later), lat = body.indexOf('id="tmlater"');
    if (!(lat > body.indexOf('class="tm-result"'))) fail(file + ": the later text comes before the mark");
    if (body.indexOf(graded) < 0 || body.indexOf(graded) > body.indexOf('class="tm-result"')) fail(file + ": the version that was marked is not above its mark");
    if (body.indexOf(later) < lat) fail(file + ": the later text appears outside its section");
  }
  // A question nothing was submitted for has no answer box, and its draft is never called an answer.
  if (x.status === "not_answered" && /tm-answerbox|tm-submitted/.test(body)) fail(file + ": a not-answered question shows an answer");
  // The either/or: neither option is presented as attempted.
  if (x.eitherSlot && !/Neither Question \d+ nor Question \d+ was chosen\./.test(said)) fail(file + ": the either/or does not say neither was chosen");
  // Navigation: Previous and Next are the attempt's neighbours; ← Results goes to the page it came from.
  const seq = ATT.sequence(a, exams), i = seq.findIndex(y => y.key === x.key);
  if ((seq[i - 1] || null) && !body.includes(`href="#review-${seq[i - 1].key}"`)) fail(file + ": Previous is not the item before");
  if (seq[i + 1] && !body.includes(`href="#review-${seq[i + 1].key}"`)) fail(file + ": Next is not the item after");
  if (!body.includes(`class="tm-back" href="${spec.results}"`)) fail(file + ": ← Results does not return to " + spec.results);
  // The page uses no class the app's CSS and the review shell do not style.
  const styled = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const classes = new Set([...body.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean));
  const unstyled = [...classes].filter(c => !new RegExp("\\." + c.replace(/[-]/g, "\\-") + "(?![A-Za-z0-9_-])").test(styled) && !["paper", "nm", "sec", "g", "fg", "ic", "t", "k", "v", "pair", "badge", "who", "txt", "or", "pill", "grid", "mk", "brand", "unit"].includes(c));
  if (unstyled.length) fail(file + ": unstyled classes " + unstyled.join(", "));
}
for (const [file, spec] of Object.entries(FX.pages)) {
  const out = page(file, spec);
  check(file, spec, out);
  fs.writeFileSync(path.join(OUTDIR, file), out.html);
  const x = out.v.item;
  report.push({ file, from: spec.results, item: whereOf(x), status: x.status + (x.status === "marked" ? " " + x.score + "/" + x.max : ""),
                later: out.v.later != null, unsent: out.v.unsent != null, at: (out.v.index + 1) + " of " + out.v.count, kb: Math.round(out.html.length / 1024) });
}
console.log(JSON.stringify({ subject: SUBJECT, pages: report }, null, 1));
