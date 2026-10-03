// PAGE 3, EXAM OVERVIEW AND PRACTICE SETUP. Generated, like pages 1 and 2.
//
// One shell with two ways in, and never one attempt (decision 19):
//
//   a paper   its identity, instructions and time, and the sections to choose
//             from. Start paper begins attempts["paper:" + exam.id].
//   a type    every question of one canonical format in the library, all of
//             them or a chosen few. Start practice begins
//             attempts["type:" + format].
//
// Both open the same sitting (state 8): the same navigator, marking, feedback
// and saving. They share no attempt state.
//
// Nothing is typed. The paper's identity, sections, marks and time come from
// the paper through the contract. An attempt's counts come from attempt.mjs,
// which derives them through the shipped contract and marker. The questions a
// type offers are the contract's reading of each question's format, counted
// the way Page 1's tiles count them.
//
//   node docs/mockups/03-overview.build.mjs
//
//   03-paper.html           a paper, not started, every section chosen (primary)
//   03-paper-section.html   the same paper with Section II only
//   03-paper-resume.html    the paper in progress
//   03-paper-again.html     the paper completed, opened from Try again
//   03-type.html            Short answer practice, all questions (primary)
//   03-type-choose.html     the same, with two questions chosen
//
// The selection totals are drawn by the same function the page runs when a box
// is ticked: its source is written into the page, so the static state and the
// live one cannot disagree.
import { paper, derive, PAPER, ASSESS, keyOf } from "./attempt.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "..", "..");
const OUTDIR = process.env.MOCKUP_OUT || HERE;
globalThis.window = globalThis;
require(path.join(ROOT, "essay-content.js"));            // registers window.ESSAY.subjects
const PACKAGES = window.ESSAY.subjects;

const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = iso => {
  const p = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "numeric" })
    .formatToParts(new Date(iso));
  return p.find(x => x.type === "day").value + " " + MONTHS[Number(p.find(x => x.type === "month").value) - 1];
};
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
const list = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

// ---- the paper, as the contract reads it -------------------------------------
const cur = ASSESS.curriculumOf(paper);
if (!cur || !cur.course) throw new Error("the paper no longer declares a course");
// The header names the subject the way the sitting will: from the paper's own
// curriculum, resolved against the packages Marginal has (decision 4, P0). A
// subject Marginal does not have is shown as the file names it.
const auth = ASSESS.resolveAuthority({ curriculum: cur, packages: PACKAGES });
const subjectOf = c => {
  const a = ASSESS.resolveAuthority({ curriculum: c, packages: PACKAGES });
  return a.ok ? a.label : c.course;
};
const SUBJECT = auth.ok ? auth.label : cur.course;
const identity = [SUBJECT, cur.stage].filter(Boolean).join(" · ");
const totals = PAPER.totals(paper);
const version = paper.exam && paper.exam.version;

// Each section as the picker shows it. A section's authored instructions open
// with its mark total; that sentence is dropped only when it says exactly what
// the row already shows, so nothing the author wrote is hidden.
const SECTIONS = paper.sections.map((sec, si) => {
  const t = PAPER.totals({ sections: [sec] });
  let ins = String(sec.instructions || "").trim();
  const lead = ins.match(/^(\d+) marks?\.\s*/);
  if (lead && Number(lead[1]) === t.marks) ins = ins.slice(lead[0].length);
  const either = Number(sec.choose) > 0 && sec.choose < sec.questions.length;
  return {
    si, roman: ROMAN[si], name: sec.name || "Section " + ROMAN[si], q: t.questions, m: t.marks, ins,
    either: either ? { n: Number(sec.choose), of: sec.questions.map(q => PAPER.numberOf(q)) } : null,
  };
});

// ---- the selection summaries --------------------------------------------------
// These two run in Node to draw each variant and in the page when a box changes.
// They may use nothing but their argument.
function sectionSummary(rows) {
  const on = rows.filter(r => r.on);
  if (!on.length) return { text: "Choose at least one section to start.", ok: false };
  const q = on.reduce((n, r) => n + r.q, 0), m = on.reduce((n, r) => n + r.m, 0);
  const names = on.map(r => r.roman);
  const which = on.length === rows.length ? "All " + rows.length + " sections"
    : on.length === 1 ? "Section " + names[0] + " only"
    : "Sections " + names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  return { text: "<b>" + which + "</b> · " + q + " question" + (q === 1 ? "" : "s") + " · " + m + " mark" + (m === 1 ? "" : "s"), ok: true };
}
function questionSummary(rows, all) {
  const on = all ? rows : rows.filter(r => r.on);
  if (!on.length) return { text: "Choose at least one question to start.", ok: false };
  const m = on.reduce((n, r) => n + r.m, 0);
  const which = all ? "All " + rows.length + " question" + (rows.length === 1 ? "" : "s")
    : on.length + " of " + rows.length + " questions";
  return { text: "<b>" + which + "</b> · " + m + " mark" + (m === 1 ? "" : "s"), ok: true };
}

// ---- the question bank for one format ----------------------------------------
// Every question of the format in every paper that can be sat, in paper order:
// parts are questions, a parent is not, and both options of an either/or are
// there, because each can be practised on its own. Each carries the source it
// refers to, which the sitting shows beside it.
function bankOf(format, papers) {
  const out = [];
  papers.forEach(pp => {
    if (!PAPER.examine(pp, { packages: PACKAGES }).sittable) return;
    pp.sections.forEach((sec, si) => sec.questions.forEach((q, qi) => {
      const parent = PAPER.isParent(q);
      (parent ? PAPER.partsOf(q) : [q]).forEach((leaf, pi) => {
        if (ASSESS.normaliseFormat(leaf).format !== format) return;
        const holders = parent ? [sec, q, leaf] : [sec, q];
        const sources = holders.flatMap(h => PAPER.resourcesOf(h))
          .map(r => typeof r === "string" ? r.split("\n")[0] : (r && (r.caption || String(r.text || "").split("\n")[0])) || "")
          .filter(s => s && s !== "Note");
        out.push({
          paper: pp, key: keyOf({ si, qi, pi: parent ? pi : null }),
          display: parent ? PAPER.displayNumber(PAPER.numberOf(q), PAPER.labelOf(leaf, pi)) : PAPER.numberOf(q),
          m: Number(leaf.marks), prompt: leaf.prompt, sources,
        });
      });
    }));
  });
  return out;
}
const TYPE_NAMES = {
  multiple_choice: "Multiple choice", short_answer: "Short answer", calculation: "Calculations",
  business_report: "Business report", extended_response: "Extended response",
};

// ---- pieces --------------------------------------------------------------------
const POLICY = `<span class="policy"><span class="dot"></span>Practice · marked as you go</span>`;
// What Practice is, said once, the same for a paper and a type (decision 17).
const HOW = `<h3 class="k">How practice works</h3>
      <ul class="how">
        <li>Each answer is marked, with feedback, when you submit it for marking.</li>
        <li>Move between questions in any order, and flag any you want to come back to.</li>
        <li>Your answers are saved as you go, so you can leave and resume.</li>
      </ul>`;

function aboutPaper() {
  return `<aside class="about" aria-labelledby="ab">
    <h2 id="ab">About this paper</h2>
    ${paper.instructions ? `<h3 class="k">Instructions</h3>
      <blockquote class="ins"><p>${esc(paper.instructions)}</p><cite>From the paper</cite></blockquote>` : ""}
    ${paper.time ? `<h3 class="k">Time</h3>
      <p class="p">The paper allows ${esc(paper.time)}. Practice is not timed, so use it as a guide to pace.</p>` : ""}
    ${HOW}
    <h3 class="k">Source</h3>
    <p class="p">${esc(paper.exam.source)}${version ? ` · Version ${esc(version)}` : ""}</p>
  </aside>`;
}

function sectionRows(chosen) {
  return SECTIONS.map(s => ({ roman: s.roman, q: s.q, m: s.m, on: chosen.includes(s.si) }));
}
function choosePanel(chosen, last) {
  const rows = sectionRows(chosen);
  const sum = sectionSummary(rows);
  return `<section class="panel" aria-labelledby="cs" data-kind="sections">
    ${last ? lastStrip(last) : ""}
    <div class="phead"><h2 id="cs">Choose sections</h2><span class="spacer"></span>
      <button type="button" class="link" data-all="1">Select all</button><button type="button" class="link" data-all="0">Clear</button></div>
    <p class="plede">Sit the whole paper, or only the sections you want to practise.</p>
    <ul class="secs">
      ${SECTIONS.map((s, i) => `<li><label class="row${rows[i].on ? " on" : ""}">
        <input type="checkbox" data-q="${s.q}" data-m="${s.m}" data-roman="${s.roman}"${rows[i].on ? " checked" : ""}>
        <span class="main">
          <span class="name">${esc(s.name)}</span>
          ${s.ins ? `<span class="ins">${esc(s.ins)}</span>` : ""}
          ${s.either ? `<span class="either">You choose ${s.either.n === 1 ? "Question " + list(s.either.of).replace(/ and /, " or ") : s.either.n + " of Questions " + list(s.either.of)} when you reach this section.</span>` : ""}
        </span>
        <span class="meta">${s.either ? "choose " + s.either.n + " of " + s.either.of.length : plural(s.q, "question")} · ${plural(s.m, "mark")}</span>
      </label></li>`).join("")}
    </ul>
    <div class="go">
      <p class="sum" aria-live="polite">${sum.text}</p>
      <a class="btn${sum.ok ? "" : " off"}" href="#sitting"${sum.ok ? "" : ` aria-disabled="true"`}>Start paper</a>
    </div>
  </section>`;
}

// The completed attempt stays readable while a new one is set up: Try again
// starts a new current and keeps last (docs/testmode-attempt-state.md).
function lastStrip(a) {
  return `<div class="last">
      <span class="state done">Completed ${day(a.completedAt)}</span>
      <p class="lastline"><b>${a.got} / ${a.max}</b> · ${a.answered} of ${a.total} answered${a.notMarked ? ` · ${a.notMarked} not marked` : ""}</p>
      <span class="spacer"></span><a class="btn ghost sm" href="#results">View results</a>
      <p class="keep">Those results stay available until you submit the new attempt.</p>
    </div>`;
}

function resumePanel(a) {
  const pct = Math.round(100 * a.answered / a.total);
  const rows = a.sections.map(si => {
    const items = a.items.filter(x => x.si === si);
    const t = ASSESS.tally(items.map(x => ({ marks: x.q.marks, result: a.results[keyOf(x)] })));
    const flags = a.flags.filter(k => items.some(x => keyOf(x) === k)).length;
    const s = SECTIONS[si];
    return { s, items: items.length, t, flags };
  });
  return `<section class="panel" aria-labelledby="ya">
    <div class="phead"><h2 id="ya">Your attempt</h2><span class="state live">In progress</span></div>
    <p class="count"><b>${a.answered} of ${a.total}</b> answered${a.flagged ? ` · <span class="flagged">⚑ ${a.flagged} flagged</span>` : ""}${a.notMarked ? ` · ${a.notMarked} not marked` : ""}</p>
    <div class="pbar" role="progressbar" aria-label="Answered" aria-valuemin="0" aria-valuemax="${a.total}" aria-valuenow="${a.answered}"><i style="width:${pct}%"></i></div>
    <p class="sub"><b>${a.got}/${a.max}</b> marks so far · started ${day(a.startedAt)} · saved ${day(a.updatedAt)}</p>
    <table class="bysec">
      <caption class="k">By section</caption>
      <thead><tr><th scope="col">Section</th><th scope="col">Answered</th><th scope="col">Flagged</th><th scope="col">Marks</th></tr></thead>
      <tbody>
      ${rows.map(r => `<tr>
        <th scope="row">${esc(r.s.name)}</th>
        <td>${r.t.done} of ${r.items}${r.t.refused + r.t.failed ? ` · ${r.t.refused + r.t.failed} not marked` : ""}</td>
        <td>${r.flags ? `<span class="flagged">⚑ ${r.flags}</span>` : `<span class="none">None</span>`}</td>
        <td>${r.t.done ? `<b>${r.t.got}</b>/${r.t.max}` : `<span class="none">Not started</span>`}</td>
      </tr>`).join("")}
      </tbody>
    </table>
    <p class="fixed">${a.whole ? "You are sitting all " + plural(a.sections.length, "section") : "You are sitting " + list(a.sections.map(i => "Section " + ROMAN[i]))}. Sections are fixed once an attempt starts.</p>
    <div class="go">
      <p class="sum">Picks up at <b>Question ${esc(a.current.display)}</b></p>
      <a class="btn" href="#resume">Resume paper</a>
    </div>
  </section>`;
}

function typePanel(format, bank, chosenKeys) {
  const all = chosenKeys == null;
  const rows = bank.map(b => ({ m: b.m, on: all || chosenKeys.includes(b.key) }));
  const sum = questionSummary(rows, all);
  const papers = [...new Set(bank.map(b => b.paper))];
  return `<section class="panel${all ? "" : " choosing"}" aria-labelledby="qq" data-kind="questions">
    <div class="phead"><h2 id="qq">Questions</h2></div>
    <fieldset class="mode"><legend class="vh">Which questions</legend>
      <label class="opt${all ? " on" : ""}"><input type="radio" name="mode" value="all"${all ? " checked" : ""}>All ${plural(bank.length, "question")}</label>
      <label class="opt${all ? "" : " on"}"><input type="radio" name="mode" value="choose"${all ? "" : " checked"}>Choose questions</label>
    </fieldset>
    ${papers.map(pp => `<div class="from">
      <h3 class="k">${esc(pp.name)}</h3>
      <ul class="qs">
        ${bank.filter(b => b.paper === pp).map(b => {
          const on = rows[bank.indexOf(b)].on;
          return `<li><label class="qrow${on ? " on" : ""}">
          <input type="checkbox" data-m="${b.m}"${on ? " checked" : ""}${all ? " disabled" : ""}>
          <span class="qn">Question ${esc(b.display)}</span>
          <span class="qbody"><span class="qp">${esc(b.prompt)}</span>
            ${b.sources.length ? `<span class="qsrc">Refers to ${esc(list(b.sources))}</span>` : ""}</span>
          <span class="qm">${plural(b.m, "mark")}</span>
        </label></li>`; }).join("")}
      </ul>
    </div>`).join("")}
    <div class="go">
      <p class="sum" aria-live="polite">${sum.text}</p>
      <a class="btn${sum.ok ? "" : " off"}" href="#sitting"${sum.ok ? "" : ` aria-disabled="true"`}>Start practice</a>
    </div>
  </section>`;
}

function aboutType(format, bank) {
  const papers = [...new Set(bank.map(b => b.paper))];
  const eg = bank[0];
  return `<aside class="about" aria-labelledby="ab">
    <h2 id="ab">About this practice</h2>
    <h3 class="k">Where the questions come from</h3>
    <p class="p">From ${plural(papers.length, "paper")} in your library: ${esc(list(papers.map(p => p.name)))}.</p>
    <p class="p">Questions come in paper order${bank.some(b => b.sources.length) ? ", each with the source it refers to" : ""}.</p>
    <h3 class="k">Separate from your papers</h3>
    <p class="p">Answering Question ${esc(eg.display)} here does not answer it in ${esc(eg.paper.name)}, and sitting the paper does not change this practice.</p>
    ${HOW}
    <h3 class="k">Time</h3>
    <p class="p">Not timed.</p>
  </aside>`;
}

// ---- the page --------------------------------------------------------------------
function page(note, unit, top, main, aside) {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test mode · ${esc(top.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<!-- ${esc(note)} Generated by 03-overview.build.mjs: do not edit by hand. -->
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
  button{font:inherit;cursor:pointer}
  a{color:inherit}
  h1,h2,h3,.disp{font-family:var(--disp);letter-spacing:-.01em;font-weight:600}
  :focus-visible{outline:2px solid var(--green-dk);outline-offset:3px;border-radius:10px}
  .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

  /* The header names the open paper's subject, as the sitting does (decision 4). */
  header{display:flex;align-items:center;gap:12px;padding:16px clamp(16px,4vw,32px);background:var(--card);
         border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:10px;font-family:var(--disp);font-weight:600;font-size:20px}
  .mk{width:28px;height:28px;border-radius:9px;background:var(--green);position:relative;flex:none;box-shadow:0 3px 0 var(--green-dk)}
  .mk::after{content:"";position:absolute;left:7px;right:7px;bottom:6px;height:3px;border-radius:2px;background:#fff}
  .mk::before{content:"";position:absolute;left:7px;bottom:6px;width:3px;height:14px;border-radius:2px;background:rgba(255,255,255,.9)}
  .unit{font-size:13px;color:var(--ink-2);font-weight:700;margin-left:auto;text-align:right;font-family:var(--disp)}
  .unit b{display:block;color:var(--ink);font-size:13.5px}

  main{max-width:1180px;width:100%;margin:0 auto;padding:24px clamp(16px,4vw,40px) 56px}
  nav.tabs{display:inline-flex;gap:4px;background:#E2EAEA;border-radius:99px;padding:5px;margin-bottom:16px}
  nav.tabs a{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink-2);text-decoration:none;
             padding:8px 20px;border-radius:99px}
  nav.tabs a[aria-current]{background:var(--card);color:var(--green-dk);box-shadow:0 1px 3px rgba(60,74,74,.12)}
  .back{display:block;width:max-content;font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink-2);text-decoration:none;margin-bottom:12px}
  .back:hover{color:var(--ink);text-decoration:underline;text-underline-offset:3px}

  .top{margin-bottom:22px}
  .kicker{font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--ink-2)}
  .top h1{font-size:30px;line-height:1.15;margin-top:2px}
  .factrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:6px}
  .facts{font-size:15px;color:var(--ink-2);font-weight:700}
  .policy{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:var(--green-dk);
          background:var(--green-soft);border:1px solid #BFEFD9;border-radius:99px;padding:3px 11px}
  .policy .dot{width:6px;height:6px;border-radius:99px;background:var(--green)}
  .spacer{flex:1}

  .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;text-decoration:none;
       font-family:var(--disp);font-weight:600;font-size:15px;color:#fff;background:var(--green-dk);border:none;
       border-radius:14px;padding:11px 26px;box-shadow:0 4px 0 var(--green-edge);white-space:nowrap}
  .btn:active{transform:translateY(2px);box-shadow:0 2px 0 var(--green-edge)}
  .btn.ghost{background:var(--card);color:var(--ink);box-shadow:0 0 0 2px var(--line) inset}
  .btn.sm{min-height:44px;padding:9px 18px;font-size:14px;border-radius:12px}
  .btn.off{background:#C9D3D2;box-shadow:none;color:#3C4A4A;pointer-events:none}
  .link{background:none;border:none;font-family:var(--disp);font-weight:600;font-size:14px;color:var(--green-dk);
        text-decoration:underline;text-underline-offset:3px;padding:4px 6px}

  /* Two columns: what you will sit, and what you should know before you do.
     The choice is the wider column because it holds the one action. */
  .layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
  .panel,.about{background:var(--card);border:1.5px solid var(--line);border-radius:18px}
  .panel{padding:22px 26px 0;overflow:clip}
  .phead{display:flex;align-items:center;gap:10px}
  .phead h2{font-size:20px;line-height:1.3}
  .plede{font-size:14.5px;color:var(--ink-2);font-weight:600;margin-top:2px}
  .k{font-family:var(--disp);font-weight:600;font-size:13px;color:var(--ink-2);letter-spacing:0}

  /* A section is one large target: the whole row is the label for its box. */
  .secs{list-style:none;margin-top:14px;display:flex;flex-direction:column;gap:8px}
  .row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:start;cursor:pointer;
       border:1.5px solid var(--line);border-radius:14px;padding:12px 16px}
  .row.on{border-color:#9EDDC0;background:#F6FCF9}
  .row input,.qrow input{width:20px;height:20px;accent-color:var(--green-dk);margin-top:3px}
  .row .main{display:flex;flex-direction:column;gap:2px}
  .name{font-family:var(--disp);font-weight:600;font-size:16px;line-height:1.35}
  .ins{font-size:14px;color:var(--ink-2);font-weight:600}
  .either{font-size:13.5px;color:var(--ink);font-weight:700}
  .meta{font-size:14px;color:var(--ink);font-weight:700;white-space:nowrap;margin-top:1px}

  /* The total and the action share one bar at the foot of the panel, so what
     will be sat is read in the same glance as the button that starts it. It
     sticks to the bottom of the window while the panel is in view: a library
     with twenty multiple choice questions must not push Start off the screen. */
  .go{display:flex;align-items:center;gap:18px;margin:20px -26px 0;padding:16px 26px;background:#F6F9F9;border-top:1px solid var(--line);
      position:sticky;bottom:0;z-index:2}
  .sum{font-size:15px;color:var(--ink-2);font-weight:700;flex:1}
  .sum b{color:var(--ink)}

  /* Resume */
  .state{align-self:center;font-family:var(--disp);font-weight:600;font-size:12.5px;border-radius:99px;padding:3px 11px;
         color:var(--ink-2);background:#F1F5F5;border:1px solid var(--line)}
  .state.live{color:var(--blue-dk);background:var(--blue-soft);border-color:#C4E4FA}
  .state.done{color:var(--green-dk);background:var(--green-soft);border-color:#BFEFD9}
  .count{font-size:15px;color:var(--ink-2);font-weight:700;margin-top:12px}
  .count b{color:var(--ink);font-size:16px}
  .flagged{color:var(--gold-dk)}
  .pbar{height:8px;border-radius:99px;background:#DDE6E6;overflow:hidden;margin-top:8px}
  .pbar i{display:block;height:100%;background:var(--green);border-radius:99px}
  .sub{font-size:13.5px;color:var(--ink-2);font-weight:700;margin-top:8px}
  .sub b{color:var(--ink)}
  .bysec{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px}
  .bysec caption{text-align:left;margin-bottom:6px}
  .bysec th,.bysec td{text-align:left;padding:10px 12px;border-top:1px solid var(--line);font-weight:700;color:var(--ink)}
  .bysec thead th{font-family:var(--disp);font-weight:600;font-size:12.5px;color:var(--ink-2);border-top:none;padding-top:0}
  .bysec tbody th{font-family:var(--disp);font-weight:600;font-size:15px}
  .bysec td:last-child,.bysec th:last-child{text-align:right}
  .none{color:var(--ink-2);font-weight:600}
  .fixed{font-size:13.5px;color:var(--ink-2);font-weight:600;margin-top:14px}

  /* Try again: the last result, above the choice it does not constrain. */
  .last{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;border:1.5px solid #BFEFD9;background:#F6FCF9;
        border-radius:14px;padding:12px 16px;margin-bottom:20px}
  .lastline{font-size:14.5px;color:var(--ink-2);font-weight:700}
  .lastline b{color:var(--ink);font-family:var(--disp);font-size:17px;font-weight:600}
  .keep{flex-basis:100%;font-size:13px;color:var(--ink-2);font-weight:600}

  /* Question-type practice */
  .mode{border:none;display:flex;gap:10px;margin-top:12px}
  .opt{display:inline-flex;align-items:center;gap:9px;border:1.5px solid var(--line);border-radius:12px;padding:9px 16px;
       font-family:var(--disp);font-weight:600;font-size:15px;cursor:pointer}
  .opt.on{border-color:#9EDDC0;background:#F6FCF9;color:var(--green-dk)}
  .opt input{width:17px;height:17px;accent-color:var(--green-dk)}
  .from{margin-top:18px}
  .qs{list-style:none;margin-top:6px;border:1.5px solid var(--line);border-radius:14px;overflow:hidden}
  .qs li+li{border-top:1px solid var(--line)}
  .qrow{display:grid;grid-template-columns:auto 118px minmax(0,1fr) auto;gap:14px;align-items:start;padding:13px 16px}
  .panel:not(.choosing) .qrow{grid-template-columns:118px minmax(0,1fr) auto}
  .panel:not(.choosing) .qrow input{display:none}
  .choosing .qrow{cursor:pointer}
  .choosing .qrow.on{background:#F6FCF9}
  .qn{font-family:var(--disp);font-weight:600;font-size:15px;white-space:nowrap}
  .qbody{display:flex;flex-direction:column;gap:3px}
  .qp{font-size:14.5px;font-weight:600;color:var(--ink);line-height:1.5}
  .qsrc{font-size:13px;font-weight:700;color:var(--ink-2)}
  .qm{font-size:14px;font-weight:700;color:var(--ink);white-space:nowrap}

  /* About */
  .about{padding:20px 22px 22px}
  .about h2{font-size:17px;line-height:1.3;margin-bottom:4px}
  .about .k{margin-top:16px;margin-bottom:4px}
  .p{font-size:14px;color:var(--ink);font-weight:600}
  .ins{margin:0}
  blockquote.ins{border-left:3px solid #CFE9DD;padding:2px 0 2px 12px}
  blockquote.ins p{font-size:14px;color:var(--ink);font-weight:600}
  blockquote.ins cite{display:block;font-style:normal;font-size:12.5px;color:var(--ink-2);font-weight:700;margin-top:4px}
  .how{list-style:none;display:flex;flex-direction:column;gap:6px}
  .how li{font-size:14px;font-weight:600;color:var(--ink);padding-left:16px;position:relative}
  .how li::before{content:"";position:absolute;left:2px;top:.62em;width:6px;height:6px;border-radius:99px;background:var(--green)}

  /* Secondary target: stack, never scroll sideways. */
  @media(max-width:960px){
    .layout{grid-template-columns:1fr}
    .row{grid-template-columns:auto minmax(0,1fr)}
    .row .meta{grid-column:2}
    .qrow,.panel:not(.choosing) .qrow{grid-template-columns:auto minmax(0,1fr)}
    .go{flex-wrap:wrap}
  }
</style>
</head>
<body>
<header>
  <div class="brand"><span class="mk"></span>Marginal</div>
  <div class="unit">${unit ? `<b>${esc(unit)}</b>` : ""}Test mode</div>
</header>
<main>
  <nav class="tabs" aria-label="Marginal">
    <a href="#study">Study</a><a href="#create">Create</a><a href="#test" aria-current="page">Test mode</a><a href="#essay">Essay practice</a>
  </nav>
  <a class="back" href="#test">← Test mode</a>
  <div class="top">
    <p class="kicker">${esc(top.kicker)}</p>
    <h1>${esc(top.title)}</h1>
    <div class="factrow"><p class="facts">${esc(top.facts)}</p>${POLICY}</div>
  </div>
  <div class="layout">
    ${main}
    ${aside}
  </div>
</main>
<script>
// The live totals: the generator's own functions, so the page cannot count differently.
const sectionSummary = ${sectionSummary.toString()};
const questionSummary = ${questionSummary.toString()};
document.querySelectorAll(".panel[data-kind]").forEach(panel => {
  const boxes = () => Array.from(panel.querySelectorAll("input[type=checkbox]"));
  const sum = panel.querySelector(".sum"), go = panel.querySelector(".go .btn");
  const sync = () => {
    boxes().forEach(b => b.closest("label").classList.toggle("on", b.checked));
    const all = panel.dataset.kind === "questions" && !panel.classList.contains("choosing");
    const rows = boxes().map(b => ({ q: Number(b.dataset.q), m: Number(b.dataset.m), roman: b.dataset.roman, on: b.checked }));
    const s = panel.dataset.kind === "sections" ? sectionSummary(rows) : questionSummary(rows, all);
    sum.innerHTML = s.text; go.classList.toggle("off", !s.ok);
    if (s.ok) go.removeAttribute("aria-disabled"); else go.setAttribute("aria-disabled", "true");
  };
  boxes().forEach(b => b.addEventListener("change", sync));
  panel.querySelectorAll("[data-all]").forEach(x => x.addEventListener("click", () => {
    boxes().forEach(b => { b.checked = x.dataset.all === "1"; }); sync();
  }));
  panel.querySelectorAll("input[name=mode]").forEach(r => r.addEventListener("change", () => {
    const choose = r.value === "choose" && r.checked;
    panel.classList.toggle("choosing", choose);
    panel.querySelectorAll(".opt").forEach(o => o.classList.toggle("on", o.querySelector("input").checked));
    boxes().forEach(b => { b.disabled = !choose; if (!choose) b.checked = true; });
    sync();
  }));
});
</script>
</body>
</html>
`;
}

// ---- the variants -------------------------------------------------------------------
const paperTop = { kicker: identity, title: paper.name,
  facts: [plural(totals.questions, "question"), plural(paper.sections.length, "section"), plural(totals.marks, "mark")].join(" · ") };
const ALL = SECTIONS.map(s => s.si);
const report = [];
const write = (file, html, facts) => {
  if (/—/.test(html)) throw new Error(file + " has an em dash");
  fs.writeFileSync(path.join(OUTDIR, file), html);
  report.push(Object.assign({ file }, facts));
};

{
  const a = derive("not_started");
  if (a.status !== "not_started") throw new Error("not_started is " + a.status);
  write("03-paper.html", page("Page 3, a paper not started: the primary proposal.", SUBJECT, paperTop,
    choosePanel(ALL, null), aboutPaper()), { summary: sectionSummary(sectionRows(ALL)).text });
}
{
  const two = SECTIONS.filter(s => /short answer/i.test(s.name)).map(s => s.si);
  if (two.length !== 1) throw new Error("expected one short answer section");
  write("03-paper-section.html", page("Page 3, one section chosen.", SUBJECT, paperTop,
    choosePanel(two, null), aboutPaper()), { summary: sectionSummary(sectionRows(two)).text });
}
{
  const a = derive("in_progress");
  if (a.status !== "in_progress") throw new Error("in_progress is " + a.status);
  write("03-paper-resume.html", page("Page 3, the paper in progress.", SUBJECT, paperTop,
    resumePanel(a), aboutPaper()), { answered: a.answered + "/" + a.total, flagged: a.flagged, marks: a.got + "/" + a.max, at: a.current.display });
}
{
  const a = derive("completed");
  if (a.status !== "completed") throw new Error("completed is " + a.status);
  write("03-paper-again.html", page("Page 3, opened from Try again on a completed paper.", SUBJECT, paperTop,
    choosePanel(ALL, a), aboutPaper()), { last: a.got + "/" + a.max });
}
{
  const format = "short_answer", library = [paper];
  const bank = bankOf(format, library);
  if (!bank.length) throw new Error("no short answer questions to practise");
  const subjects = [...new Set(library.filter(pp => bank.some(b => b.paper === pp)).map(pp => subjectOf(ASSESS.curriculumOf(pp))))];
  const unit = subjects.length === 1 ? subjects[0] : "";
  const sources = [...new Set(bank.map(b => b.paper))];
  const top = { kicker: "Practise a question type", title: TYPE_NAMES[format] + " practice",
    facts: plural(bank.length, "question") + " available · from " + plural(sources.length, "paper") };
  const rows = bank.map(b => ({ m: b.m, on: true }));
  write("03-type.html", page("Page 3, question-type practice: the primary proposal.", unit, top,
    typePanel(format, bank, null), aboutType(format, bank)),
    { questions: bank.map(b => b.display).join(" "), summary: questionSummary(rows, true).text });
  // Two chosen, by what a student might pick: the two longest.
  const pick = bank.slice().sort((x, y) => y.m - x.m || bank.indexOf(x) - bank.indexOf(y)).slice(0, 2).map(b => b.key);
  write("03-type-choose.html", page("Page 3, question-type practice with questions chosen.", unit, top,
    typePanel(format, bank, pick), aboutType(format, bank)),
    { chosen: bank.filter(b => pick.includes(b.key)).map(b => b.display).join(" "),
      summary: questionSummary(bank.map(b => ({ m: b.m, on: pick.includes(b.key) })), false).text });
}
console.log(JSON.stringify({ subject: SUBJECT, identity, pages: report }, null, 1));
