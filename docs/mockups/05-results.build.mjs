// SLICE B, STATE 2: RESULTS OVERVIEW. Generated, like pages 1 to 4.
//
// A closed attempt as a map of its marks: one total, then every section, every
// parent question with its parts beneath it (never flattened), and every
// answerable as a cell holding its own mark or the words for why it has none.
// Work with no mark is named ("Not marked", "Not answered", "Nothing marked"),
// never shown as 0; a marked 0 is a mark like any other. Nothing is computed
// here: every figure is ATT.results over the closed attempt, which tallies the
// report's own items, so Results cannot disagree with Review & submit.
//
// Each attempt is replayed through the shipped contract (replay.mjs) and closed
// with ATT.complete, as Submit paper closes it. Reasons are read from app.js.
//
//   node docs/mockups/05-results.build.mjs
//
//   05-results.html            the whole paper, mixed, 28 / 90 (primary)
//   05-results-complete.html   everything marked, 67 / 90 (Pages 1 and 3's attempt)
//   05-results-section.html    Section II only, 16 / 40
//   05-results-practice.html   a short-answer practice session, 5 / 13
//   05-results-again.html      the last result, with a new attempt in progress
//   05-results-nothing.html    nothing marked
import { ATT, ASSESS, PAPER, PACKAGES, paper, exams, SUBJECT, TYPE_NAMES, completedAttempt, scenario as replay, esc, plural, list, day } from "./replay.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUTDIR = process.env.MOCKUP_OUT || HERE;
const SUBMIT = JSON.parse(fs.readFileSync(path.join(HERE, "04-submit.fixture.json"), "utf8"));
const FX = JSON.parse(fs.readFileSync(path.join(HERE, "05-results.fixture.json"), "utf8"));
const fail = m => { throw new Error(m); };

// ---- closing an attempt, as Submit paper does ------------------------------------------
function closed(spec) {
  if (spec.done) {
    const last = completedAttempt();
    const current = spec.current ? replay(SUBMIT, spec.current).a : null;
    return { last, current, from: spec.from || "" };
  }
  const sc = spec.submit ? replay(SUBMIT, spec.submit) : replay(FX.scenarios, spec.own);
  const key = sc.a.scope === "type" ? ATT.typeKey(sc.a.format) : ATT.paperKey(paper);
  const store = { exams: exams.slice(), attempts: { [key]: { current: sc.a, last: sc.rec.last } } };
  if (!ATT.complete(store, key, spec.completedAt)) fail("the attempt could not be closed: nothing was submitted");
  const rec = store.attempts[key];
  if (rec.current || rec.last !== sc.a) fail("closing did not move the attempt to last");
  return { last: rec.last, current: null, from: spec.from || "" };
}

// ---- words, all from the results map --------------------------------------------------
const label = x => x.eitherSlot ? "Question " + x.options.join(" or ") : "Question " + x.display;
const partLabel = x => (/\(([^)]+)\)$/.exec(x.display || "") || [, x.display])[1];
const sub = g => g.state === "marked" ? `<b>${g.got}</b> / ${g.max}` : `<span class="none">${g.state === "nothing_marked" ? "Nothing marked" : "Not answered"}</span>`;
const subWords = g => g.state === "marked" ? g.got + " of " + plural(g.max, "mark") : g.state === "nothing_marked" ? "nothing marked" : "not answered";
const counts = (g, unit) => [g.done + " of " + plural(g.total, unit) + " answered", g.notMarked ? g.notMarked + " not marked" : "", g.notAnswered ? g.notAnswered + " not answered" : ""].filter(Boolean).join(" · ");
const statusWord = x => x.status === "marked" ? "" : x.status === "not_marked" ? "Not marked" : "Not answered";

function cell(x) {
  const lab = x.eitherSlot ? "Q" + x.options.join(" or Q") : x.pi != null ? partLabel(x) : "Q" + x.display;
  const st = x.status === "marked" ? "m" : x.status === "not_marked" ? "nm" : "na";
  const top = (x.flagged ? `<span class="fl" aria-hidden="true">⚑</span>` : "") + esc(lab) + (st === "m" ? "" : " · " + plural(x.marks, "mark"));
  const val = st === "m" ? `${x.score} / ${x.max}` : statusWord(x);
  const said = label(x) + ": " + (st === "m" ? x.score + " of " + plural(x.max, "mark") : plural(x.marks, "mark") + ", " + (st === "nm" ? "submitted, not marked" : "not answered")) + (x.flagged ? ", flagged" : "") + ". Review it.";
  return `<a class="rc ${st}" href="#review-${esc(x.key)}"><span class="l">${top}</span><span class="v">${esc(val)}</span><span class="vh">, ${esc(said)}</span></a>`;
}
function eitherLine(r, si, type) {
  if (type) return "";
  const e = r.either.find(y => y.si === si); if (!e) return "";
  const slot = r.items.find(y => y.eitherSlot && y.si === si);
  const others = e.options.filter(o => o.qi !== e.chosen).map(o => "Question " + o.number);
  if (e.chosen === null) return (e.options.length === 2 ? "Neither question was chosen." : "None of these questions was chosen.") +
    (slot && slot.weight > 1 ? " It counted as " + slot.weight + " questions." : " It counted as one question.");
  const chosen = e.options.find(o => o.qi === e.chosen);
  const answered = r.items.some(y => y.si === si && y.status !== "not_answered");
  return "You chose Question " + chosen.number + (answered ? "." : " and did not answer it.") + " " + list(others) + (others.length === 1 ? " was" : " were") + " not part of this attempt.";
}
function band(b, r, type) {
  const id = "b-" + r.bands.indexOf(b);
  const title = type ? esc(b.paperName) + " · " + esc(b.short) : esc(b.name);
  const one = b.entries.length === 1 && b.entries[0].kind === "leaf";
  const ei = eitherLine(r, b.si, type);
  if (one) {
    const x = b.entries[0].item;
    return `<section class="band half" aria-labelledby="${id}"><div class="bh"><div class="bt"><h3 id="${id}">${title}</h3>
      ${ei ? `<p class="bc">${esc(ei)}</p>` : `<p class="bc">${esc(counts(b, "question"))}</p>`}</div>${cell(x)}</div></section>`;
  }
  return `<section class="band" aria-labelledby="${id}">
    <div class="bh"><div class="bt"><h3 id="${id}">${title}</h3><p class="bc">${esc(counts(b, "question"))}</p></div>
      <p class="bs"><span class="vh">${esc(b.name)}: ${esc(subWords(b))}</span><span aria-hidden="true">${sub(b)}</span></p></div>
    <div class="ents">${b.entries.map(g => g.kind === "leaf" ? cell(g.item) : `<div class="pg" role="group" aria-labelledby="g-${esc(g.key)}">
      <div class="pgh"><h4 id="g-${esc(g.key)}">Question ${esc(g.number)}</h4><span class="ps"><span class="vh">${esc(subWords(g))}</span><span aria-hidden="true">${sub(g)}</span></span></div>
      ${g.caption || g.items.length < g.parts ? `<p class="cap">${esc(g.caption)}${g.items.length < g.parts ? (g.caption ? " · " : "") + g.items.length + " of its " + g.parts + " parts were in this " + (type ? "practice" : "attempt") : ""}</p>` : ""}
      <div class="cells">${g.items.map(cell).join("")}</div>
      <p class="pc">${esc(counts(g, "part"))}</p></div>`).join("")}${ei ? `<p class="bc either">${esc(ei)}</p>` : ""}</div>
  </section>`;
}
function bands(r, type) {
  // Sections of one question sit side by side, two to a row.
  const out = [];
  for (let i = 0; i < r.bands.length; i++) {
    const b = r.bands[i], n = r.bands[i + 1];
    const single = x => x && x.entries.length === 1 && x.entries[0].kind === "leaf";
    if (single(b) && single(n)) { out.push(`<div class="pair">${band(b, r, type)}${band(n, r, type)}</div>`); i++; }
    else out.push(band(b, r, type));
  }
  return out.join("");
}
function tally(r, a) {
  const R = r.rows, none = `<span class="none">None</span>`, cellv = (n, t) => n ? t : "";
  const whole = a.scope === "type" ? "This practice" : a.sections.length === paper.sections.length ? "The whole paper" : list(a.sections.map(si => ATT.sectionShort(paper.sections[si], si))) + " only";
  return `<table class="tally">
    <caption class="vh">What your mark is made of</caption>
    <thead><tr><th scope="col">Status</th><th scope="col">Questions</th><th scope="col">Worth</th><th scope="col">Earned</th></tr></thead>
    <tbody>
      <tr><th scope="row"><span class="sw m" aria-hidden="true"></span>Answered and marked</th><td>${R.marked.count || none}</td><td>${cellv(R.marked.count, plural(R.marked.worth, "mark"))}</td><td>${cellv(R.marked.count, `<b>${R.marked.earned}</b>`)}</td></tr>
      <tr><th scope="row"><span class="sw nm" aria-hidden="true"></span>${R.notMarked.count ? `<a href="#g-nm">Submitted, not marked</a>` : "Submitted, not marked"}</th><td>${R.notMarked.count || none}</td><td>${cellv(R.notMarked.count, plural(R.notMarked.worth, "mark"))}</td><td>${cellv(R.notMarked.count, `<span class="none">Not marked</span>`)}</td></tr>
      <tr><th scope="row"><span class="sw na" aria-hidden="true"></span>${R.notAnswered.count ? `<a href="#g-na">Not answered</a>` : "Not answered"}</th><td>${R.notAnswered.count || none}</td><td>${cellv(R.notAnswered.count, plural(R.notAnswered.worth, "mark"))}</td><td>${cellv(R.notAnswered.count, none)}</td></tr>
    </tbody>
    <tfoot><tr><th scope="row">${esc(whole)}</th><td>${r.total}</td><td>${plural(r.max, "mark")}</td><td>${R.marked.count ? `<b>${r.got}</b> / ${r.max}` : `<span class="none">Nothing marked</span>`}</td></tr></tfoot>
  </table>`;
}
// One set of words for something not answered, in every list (Submit's statusTag, closed).
const naTag = x => x.eitherSlot ? "Not chosen" : x.draft === "written" ? "Draft saved · written, not submitted" : x.draft === "selected" ? "Selected, not submitted" : "Not started";
function details(r, a) {
  const type = a.scope === "type";
  // A practice drawing on more than one paper names the paper on every row.
  const many = type && new Set(r.bands.map(b => b.paper)).size > 1;
  const src = x => many ? " · " + esc((r.bands.find(b => b.paper === x.paper) || {}).paperName || "") : "";
  const where = x => `<div class="where"><b>${esc(label(x))}</b> · ${plural(x.marks, "mark")}${type ? src(x) : " · " + esc(ATT.sectionShort(paper.sections[x.si], x.si))}${x.flagged ? ` <span class="flagged">⚑ flagged</span>` : ""}</div>`;
  const go = (x, extra) => `<p class="route"><a class="link" href="#review-${esc(x.key)}">Review ${esc(label(x))}${extra || ""}</a></p>`;
  const grp = (id, title, n, gold, lede, rows) => `<section class="grp" id="${id}" tabindex="-1" aria-labelledby="${id}h"><h3 id="${id}h">${title} <span class="n${gold ? " gold" : ""}">${n}</span></h3>${lede ? `<p class="glede">${lede}</p>` : ""}<ul>${rows}</ul></section>`;
  const nm = r.items.filter(x => x.status === "not_marked"), na = r.items.filter(x => x.status === "not_answered");
  const ch = r.items.filter(x => x.changed), fl = r.items.filter(x => x.flagged);
  const what = type ? "session" : "attempt", R = r.rows;
  let out = "";
  if (nm.length) out += grp("g-nm", "Submitted, not marked", nm.length, false,
    `${nm.length === 1 ? "It was" : "Each was"} submitted and not marked. This ${what} is closed, so ${nm.length === 1 ? "it stays" : "they stay"} not marked. ${nm.length === 1 ? "Its" : "Their"} ${plural(R.notMarked.worth, "mark")} still count in the ${r.max}.`,
    nm.map(x => `<li>${where(x)}<p class="tagline"><span class="tag nm">Not marked</span></p><p class="why">Reason at the time: ${esc(x.cause || "No reason was recorded.")}</p>${go(x)}</li>`).join(""));
  if (na.length) {
    // Three or more neighbours with nothing in them read as one row.
    const runs = [];
    na.forEach(x => {
      const plain = !x.draft && !x.flagged && !x.eitherSlot, last = runs[runs.length - 1];
      const same = last && last.plain && plain && last.items[0].paper === x.paper && last.items[0].si === x.si && (last.items[0].qi === x.qi || (last.items[0].pi == null && x.pi == null)) &&
        r.items.indexOf(x) === r.items.indexOf(last.items[last.items.length - 1]) + 1;
      if (same) last.items.push(x); else runs.push({ plain, items: [x] });
    });
    const rows = runs.flatMap(run => run.plain && run.items.length >= 3 ? [`<li><div class="where"><b>Questions ${esc(run.items[0].display)} to ${esc(run.items[run.items.length - 1].display)}</b> · ${plural(run.items.reduce((n, x) => n + x.marks, 0), "mark")}${type ? src(run.items[0]) : " · " + esc(ATT.sectionShort(paper.sections[run.items[0].si], run.items[0].si))}</div>
        <p class="tagline"><span class="tag na">Not started</span></p>${go(run.items[0])}</li>`]
      : run.items.map(x => `<li>${where(x)}<p class="tagline"><span class="tag na">${naTag(x)}</span></p>
        ${x.eitherSlot ? `<p class="why">${esc(eitherLine(r, x.si, type))}</p>` : x.draft ? `<p class="why">It was never submitted for marking.</p>` : ""}${go(x)}</li>`));
    out += grp("g-na", "Not answered", R.notAnswered.count, false,
      `Nothing was submitted for marking for ${R.notAnswered.count === 1 ? "this, so it" : "these, so they"} earned nothing. ${R.notAnswered.count === 1 ? "Its" : "Their"} ${plural(R.notAnswered.worth, "mark")} still count in the ${r.max}.`, rows.join(""));
  }
  if (ch.length) out += grp("g-ch", "Changed after marking", ch.length, false, "",
    ch.map(x => `<li>${where(x)}<p class="why">${x.status === "marked" ? "This answer has changed since it was marked, and the new version has no mark. Your mark of " + x.score + " of " + plural(x.max, "mark") + " stands, for the version it was given for." : "This answer has changed since it was sent for marking. It stays not marked."}</p>${go(x, x.status === "marked" ? " to see the version that was marked" : "")}</li>`).join(""));
  if (fl.length) {
    const dup = fl.filter(x => x.status !== "marked" || x.changed).length;
    out += grp("g-fl", "Flagged", fl.length, true, "You flagged these to come back to. Flags never changed a mark." + (!dup ? "" : fl.length === 1 ? " It is also listed above." : dup === fl.length ? " They are also listed above." : dup === 1 ? " One of these is also listed above." : " " + dup + " of these are also listed above."),
      fl.map(x => `<li><div class="where"><span class="flagged">⚑</span> <b>${esc(label(x))}</b> · ${plural(x.marks, "mark")}${type ? src(x) : " · " + esc(ATT.sectionShort(paper.sections[x.si], x.si))}</div>
        <p class="tagline"><span class="tag${x.status === "not_marked" ? " nm" : x.status === "not_answered" ? " na" : ""}">${x.status === "marked" ? "Answered · " + x.score + " of " + plural(x.max, "mark") : x.status === "not_marked" ? "Not marked" : naTag(x)}</span></p>${go(x)}</li>`).join(""));
  }
  return out || `<p class="clear">Nothing was left not marked or not answered, and nothing was flagged.</p>`;
}
function aside(r, a, rec) {
  const type = a.scope === "type", what = type ? "session" : "attempt";
  const dates = day(r.startedAt) === day(r.completedAt) ? "Started and completed " + day(r.completedAt) : "Started " + day(r.startedAt) + " · completed " + day(r.completedAt);
  const closedLine = type ? "This practice is finished. Its marks will not change, and another mark for any answer needs a new session."
    : "This attempt is closed. Its marks will not change, and another mark for any answer needs a new attempt.";
  const kept = type ? "Only your latest completed session is kept. Finishing a new one replaces these results." : "Only your latest completed attempt is kept. Submitting a new attempt replaces these results.";
  const ver = r.superseded && r.version && r.libraryVersion ? `<h3 class="k">Version</h3><p class="p">This attempt was on version ${esc(r.version)}. Your library now has version ${esc(r.libraryVersion)}, which your next attempt will use.</p>` : "";
  if (type) {
    const names = [...new Set(r.bands.map(b => b.paperName))];
    return `<aside class="about" aria-labelledby="ab"><h2 id="ab">About this practice</h2>
      <h3 class="k">Questions</h3><p class="p">${esc(names.length === 1 ? "From " + names[0] : "From " + plural(names.length, "paper") + " in your library")}. ${plural(r.total, "question")}, fixed once a session starts.</p>
      <h3 class="k">Your paper attempts</h3><p class="p">This practice did not change any paper attempt, even where they share a question.</p>
      <h3 class="k">Closed</h3><p class="p">${closedLine}</p>
      <h3 class="k">Dates</h3><p class="p">${dates}</p>
      <h3 class="k">Kept</h3><p class="p">${kept}</p></aside>`;
  }
  const whole = a.sections.length === paper.sections.length;
  const either = r.either.map(e => { const sec = paper.sections[e.si];
    return `<h3 class="k">${esc(ATT.sectionName(sec, e.si))}</h3>${sec.instructions ? `<blockquote class="ins"><p>${esc(sec.instructions)}</p><cite>Original paper instructions</cite></blockquote>` : ""}<p class="p either">${esc(eitherLine(r, e.si, false))}</p>`; }).join("");
  return `<aside class="about" aria-labelledby="ab"><h2 id="ab">About this attempt</h2>
    <h3 class="k">Sections</h3><ul class="secl">${a.sections.map(si => `<li>${esc(ATT.sectionName(paper.sections[si], si))}</li>`).join("")}</ul>
    <p class="p sm">${whole ? "The whole paper. Sections are fixed once an attempt starts." : esc(list(a.sections.map(si => ATT.sectionShort(paper.sections[si], si)))) + " only. Sections not chosen were not part of this attempt and are not counted."}</p>
    ${either}
    <h3 class="k">Closed</h3><p class="p">${closedLine}</p>
    <h3 class="k">Dates</h3><p class="p">${dates}</p>${ver}
    <h3 class="k">Kept</h3><p class="p">${kept}</p></aside>`;
}

// ---- the page --------------------------------------------------------------------------
const POLICY = `<span class="policy"><span class="dot"></span>Practice · marked as you go</span>`;
function page(note, { last: a, current, from }) {
  const r = ATT.results(a, exams), type = a.scope === "type";
  const kicker = type ? TYPE_NAMES[a.format] + " practice" : paper.name;
  const names = [...new Set(r.bands.map(b => b.paperName))];
  const facts = type ? esc(names.length === 1 ? "From " + names[0] : "From " + plural(names.length, "paper") + " in your library") + " · " + plural(r.total, "question") + " · " + plural(r.max, "mark")
    : "<b>" + (a.sections.length === paper.sections.length ? "The whole paper" : esc(list(a.sections.map(si => ATT.sectionShort(paper.sections[si], si)))) + " only") + "</b> · " + plural(r.total, "question") + " · " + plural(r.max, "mark");
  const back = from === "review" ? (type ? "Back to Review &amp; finish" : "Back to Review &amp; submit") : "Test mode";
  const R = r.rows, lost = R.notMarked.worth + R.notAnswered.worth;
  const subl = [r.rows.marked.count + " of " + r.total + " answered", R.notMarked.count ? R.notMarked.count + " not marked" : "", r.flagged.length ? `<span class="flagged">⚑ ${r.flagged.length} flagged</span>` : ""].filter(Boolean).join(" · ");
  const score = R.marked.count ? `<p class="big"><b>${r.got}</b> / ${r.max}<span class="vh"> marks</span></p>` : `<p class="big none">Nothing marked</p>`;
  const noteLine = !R.marked.count ? `Nothing in this ${type ? "session" : "attempt"} was marked, so it has no mark. It was out of ${plural(r.max, "mark")}.`
    : lost ? `Questions not marked or not answered earned nothing. Their ${plural(lost, "mark")} still count in the ${r.max}.` : "";
  const first = r.items[0];
  const prog = current ? (() => {
    const scope = current.scope === "paper" && current.sections.length !== paper.sections.length ? ", " + list(current.sections.map(si => ATT.sectionShort(paper.sections[si], si))) + " only" : "";
    return `<section class="prog" aria-labelledby="pg"><h2 class="vh" id="pg">Your ${type ? "session" : "attempt"} in progress</h2><span class="state live">In progress</span>
      <p>You started a new ${type ? "session" : "attempt"} on ${day(current.startedAt)}${esc(scope)}. ${type ? "Finishing" : "Submitting"} it replaces these results.</p>
      <span class="spacer"></span><a class="btn ghost sm" href="#resume">${type ? "Resume practice" : "Resume paper"}</a></section>`;
  })() : "";
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test mode · Results</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<!-- ${esc(note)} Generated by 05-results.build.mjs: do not edit by hand. -->
<style>
  :root{
    --bg:#EEF3F5; --card:#FFFFFF;
    --ink:#3C4A4A; --ink-2:#596866; --ink-3:#616E6C;
    --green:#1CC47D; --green-dk:#0E7A4E; --green-edge:#0A5C3C; --green-soft:#E4F9EF;
    --blue:#1CA0F2; --blue-dk:#0D5888; --blue-soft:#E2F3FE;
    --gold:#FFB323; --gold-dk:#9A6000; --gold-soft:#FFF3D8;
    --line:#E7EDED;
    --disp:'Fredoka',system-ui,sans-serif; --body:'Nunito',system-ui,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--body);font-size:16px;background:var(--bg);color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100vh}
  a{color:inherit}
  h1,h2,h3,h4{font-family:var(--disp);letter-spacing:-.01em;font-weight:600}
  :focus-visible{outline:2px solid var(--green-dk);outline-offset:3px;border-radius:10px}
  .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  header{display:flex;align-items:center;gap:12px;padding:16px clamp(16px,4vw,32px);background:var(--card);border-bottom:1px solid var(--line)}
  .brand{display:flex;align-items:center;gap:10px;font-family:var(--disp);font-weight:600;font-size:20px}
  .mk{width:28px;height:28px;border-radius:9px;background:var(--green);position:relative;flex:none;box-shadow:0 3px 0 var(--green-dk)}
  .mk::after{content:"";position:absolute;left:7px;right:7px;bottom:6px;height:3px;border-radius:2px;background:#fff}
  .mk::before{content:"";position:absolute;left:7px;bottom:6px;width:3px;height:14px;border-radius:2px;background:rgba(255,255,255,.9)}
  .unit{font-size:13px;color:var(--ink-2);font-weight:700;margin-left:auto;text-align:right;font-family:var(--disp)}
  .unit b{display:block;color:var(--ink);font-size:13.5px}
  main{max-width:1180px;width:100%;margin:0 auto;padding:24px clamp(16px,4vw,40px) 56px}
  nav.tabs{display:inline-flex;gap:4px;background:#E2EAEA;border-radius:99px;padding:5px;margin-bottom:16px}
  nav.tabs a{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink-2);text-decoration:none;padding:8px 20px;border-radius:99px}
  nav.tabs a[aria-current]{background:var(--card);color:var(--green-dk);box-shadow:0 1px 3px rgba(60,74,74,.12)}
  .back{display:block;width:max-content;font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink-2);text-decoration:none;margin-bottom:12px}
  .top{margin-bottom:18px}
  .kicker{font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--ink-2)}
  .top h1{font-size:30px;line-height:1.15;margin-top:2px}
  .factrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:6px}
  .facts{font-size:15px;color:var(--ink-2);font-weight:700}
  .facts b{color:var(--ink)}
  .policy{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:var(--green-dk);background:var(--green-soft);border:1px solid #BFEFD9;border-radius:99px;padding:3px 11px}
  .policy .dot{width:6px;height:6px;border-radius:99px;background:var(--green)}
  .state{font-family:var(--disp);font-weight:600;font-size:12.5px;border-radius:99px;padding:3px 11px;color:var(--ink-2);background:#F1F5F5;border:1px solid var(--line)}
  .state.done{color:var(--green-dk);background:var(--green-soft);border-color:#BFEFD9}
  .state.live{color:var(--blue-dk);background:var(--blue-soft);border-color:#C4E4FA}
  .spacer{flex:1}
  .none{color:var(--ink-2);font-weight:700}
  .flagged,.fl{color:var(--gold-dk);font-weight:800;white-space:nowrap}
  .k{font-family:var(--disp);font-weight:600;font-size:13px;color:var(--ink-2)}
  .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;text-decoration:none;font-family:var(--disp);font-weight:600;font-size:15px;color:#fff;background:var(--green-dk);border:none;border-radius:14px;padding:11px 22px;box-shadow:0 4px 0 var(--green-edge);white-space:nowrap}
  .btn.ghost{background:var(--card);color:var(--ink);box-shadow:0 0 0 2px var(--line) inset}
  .btn.sm{min-height:40px;padding:8px 16px;font-size:14px;border-radius:12px}
  .link{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--green-dk);text-underline-offset:3px}

  .prog{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;border:1.5px solid #C4E4FA;background:var(--blue-soft);border-radius:14px;padding:10px 16px;margin-bottom:16px}
  .prog p{font-size:14.5px;font-weight:700;color:var(--ink)}

  /* The summary: the mark, what it is made of, and what to do with it. */
  .sum{background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:20px 26px 18px}
  .head{display:grid;grid-template-columns:244px minmax(0,1fr) 214px;gap:24px;align-items:start}
  .big{font-family:var(--disp);font-size:18px;color:var(--ink-2);font-weight:600;line-height:1.1;margin-top:2px}
  .big b{font-size:40px;color:var(--ink);font-weight:600}
  .big.none{font-size:24px;color:var(--ink);margin-top:8px}
  .subl{font-size:13.5px;color:var(--ink-2);font-weight:700;margin-top:6px}
  .scnote{font-size:13px;color:var(--ink-2);font-weight:600;margin-top:8px;line-height:1.5}
  .tally{width:100%;border-collapse:collapse;font-size:14px}
  .tally th,.tally td{text-align:left;padding:5px 10px;border-top:1px solid var(--line);font-weight:700;color:var(--ink)}
  .tally thead th{font-family:var(--disp);font-weight:600;font-size:12.5px;color:var(--ink-2);border-top:none;padding-top:0}
  .tally tbody th{font-family:var(--disp);font-weight:600;font-size:14.5px;white-space:nowrap}
  .tally tbody th a{text-decoration:underline;text-decoration-color:#B9C6C5;text-underline-offset:3px}
  .tally td:last-child,.tally th:last-child{text-align:right}
  .tally tfoot th,.tally tfoot td{border-top:2px solid #D5DFDF;font-family:var(--disp);font-weight:600;font-size:14.5px}
  .tally tfoot b{font-size:16px}
  .sw{display:inline-block;width:20px;height:13px;border-radius:4px;margin-right:8px;vertical-align:-1px}
  .acts{display:flex;flex-direction:column;gap:8px}
  .acts .btn{width:100%}
  .hint{font-size:13px;color:var(--ink-2);font-weight:600;line-height:1.45}

  /* The map. A cell holds its mark, or the words for why it has none. Dashed is
     not answered, as on the navigator's chips; a solid dark edge is not marked. */
  .map{margin-top:12px;border-top:1px solid var(--line);padding-top:2px}
  .band{padding:8px 0;border-bottom:1px solid var(--line)}
  .band:last-child,.pair:last-child .band{border-bottom:none}
  .bh{display:flex;align-items:flex-start;gap:16px}
  .bt{flex:1;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px}
  .bt h3{font-size:15px}
  .bc{font-size:13px;color:var(--ink-2);font-weight:700}
  .bc.either{flex-basis:100%;margin-top:2px}
  .bs{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink-2);white-space:nowrap}
  .bs b,.ps b{font-size:18px;color:var(--ink)}
  .ents{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 10px;margin-top:8px}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;border-bottom:1px solid var(--line)}
  .pair .band{border-bottom:none}
  .half .bt{flex-direction:column;align-items:flex-start;gap:0}
  .rc{display:inline-flex;flex-direction:column;justify-content:center;min-width:72px;height:48px;padding:4px 10px;border-radius:10px;text-decoration:none;background:#fff;border:1.5px solid #C9D3D2;line-height:1.2}
  .rc .l{font-family:var(--disp);font-weight:600;font-size:12px;color:var(--ink-2);white-space:nowrap}
  .rc .v{font-family:var(--disp);font-weight:600;font-size:15.5px;color:var(--ink);white-space:nowrap}
  .rc.nm{border-color:var(--ink-3)}
  .rc.na{border-style:dashed;border-color:var(--ink-3)}
  .rc.nm .v,.rc.na .v{font-family:var(--body);font-size:12.5px;font-weight:800;color:var(--ink-2)}
  .rc:hover{border-color:var(--green-dk)}
  .sw.m{background:#fff;border:1.5px solid #C9D3D2}
  .sw.nm{background:#fff;border:1.5px solid var(--ink-3)}
  .sw.na{background:#fff;border:1.5px dashed var(--ink-3)}
  .pg{background:#FAFCFC;border-left:3px solid #CFE9DD;border-radius:10px;padding:6px 12px 6px}
  .pgh{display:flex;align-items:baseline;gap:14px}
  .pgh h4{font-size:14px;flex:1}
  .ps{font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--ink-2);white-space:nowrap}
  .cap{font-size:12.5px;color:var(--ink-2);font-weight:700}
  .cells{display:flex;gap:6px;margin-top:4px}
  .cells .rc{min-width:60px}
  .pc{font-size:12px;color:var(--ink-2);font-weight:700;margin-top:3px}

  /* Below: what to go back to, and the attempt's scope. */
  .layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start;margin-top:24px}
  .panel,.about{background:var(--card);border:1.5px solid var(--line);border-radius:18px}
  .panel{padding:4px 26px 22px}
  .grp{margin-top:18px}
  .grp+.grp{border-top:1px solid var(--line);padding-top:18px}
  .grp:focus{outline:none}
  .grp h3{font-size:16px;display:flex;align-items:center;gap:8px}
  .n{font-family:var(--body);font-size:12.5px;font-weight:800;color:var(--ink-2);background:#F1F5F5;border:1px solid var(--line);border-radius:99px;padding:0 9px}
  .n.gold{color:var(--gold-dk);background:var(--gold-soft);border-color:#F7DFA8}
  .glede{font-size:14px;color:var(--ink-2);font-weight:600;margin-top:2px}
  .grp ul{list-style:none;margin-top:10px;border:1.5px solid var(--line);border-radius:14px;overflow:hidden}
  .grp li{padding:11px 16px}
  .grp li+li{border-top:1px solid var(--line)}
  .where{font-size:14.5px;font-weight:700;color:var(--ink-2)}
  .where b{font-family:var(--disp);font-weight:600;font-size:15px;color:var(--ink)}
  .tagline{margin-top:3px}
  .tag{display:inline-block;font-size:12.5px;font-weight:800;color:var(--ink-2);background:#fff;border:1.5px solid #C9D3D2;border-radius:8px;padding:0 8px}
  .tag.nm{border-color:var(--ink-3);color:var(--ink)}
  .tag.na{border-style:dashed;border-color:var(--ink-3)}
  .why{font-size:14px;font-weight:600;color:var(--ink);margin-top:4px}
  .route{margin-top:2px}
  .clear{font-size:14.5px;font-weight:700;color:var(--ink-2);margin-top:18px}
  .about{padding:20px 22px 22px}
  .about h2{font-size:17px;line-height:1.3;margin-bottom:4px}
  .about .k{margin-top:16px;margin-bottom:4px}
  .p{font-size:14px;color:var(--ink);font-weight:600}
  .p.sm{font-size:13px;color:var(--ink-2);margin-top:6px}
  .secl{list-style:none;font-size:14px;font-weight:700}
  blockquote.ins{border-left:3px solid #CFE9DD;padding:2px 0 2px 12px}
  blockquote.ins p{font-size:14px;color:var(--ink);font-weight:600}
  blockquote.ins cite{display:block;font-style:normal;font-size:12.5px;color:var(--ink-2);font-weight:700;margin-top:4px}
  .either{margin-top:8px}
  @media(max-width:960px){ .head{grid-template-columns:1fr} .layout{grid-template-columns:1fr} .pair{grid-template-columns:1fr} }
</style>
</head>
<body>
<header>
  <div class="brand"><span class="mk"></span>Marginal</div>
  <div class="unit"><b>${esc(SUBJECT)}</b>Test mode</div>
</header>
<main>
  <nav class="tabs" aria-label="Marginal">
    <a href="#study">Study</a><a href="#create">Create</a><a href="#test" aria-current="page">Test mode</a><a href="#essay">Essay practice</a>
  </nav>
  <a class="back" href="#back"><span aria-hidden="true">← </span>${back}</a>
  <div class="top">
    <p class="kicker">${esc(kicker)}</p>
    <h1 tabindex="-1">Results</h1>
    <div class="factrow"><p class="facts">${facts}</p><span class="state done">Completed ${day(r.completedAt)}</span>${POLICY}</div>
  </div>
  ${prog}
  <section class="sum" aria-labelledby="rh">
    <div class="head">
      <div><h2 class="k" id="rh">Your mark</h2>${score}<p class="subl">${subl}</p>${noteLine ? `<p class="scnote">${noteLine}</p>` : ""}</div>
      ${tally(r, a)}
      <div class="acts">
        <a class="btn" href="#review-${esc(first.key)}">Review each question</a>
        <p class="hint">Starts at ${esc(label(first))}. You can review your ${R.marked.count ? "marks" : "answers"} but not change them.</p>
        ${current ? "" : `<a class="btn ghost sm" href="#start">${type ? "Start practice" : "Start new attempt"}</a>`}
      </div>
    </div>
    <div class="map"><h2 class="vh">Marks by section and question</h2>${bands(r, type)}</div>
  </section>
  <div class="layout">
    <section class="panel" aria-labelledby="lh"><h2 class="vh" id="lh">Questions to look at again</h2>${details(r, a)}</section>
    ${aside(r, a, { current })}
  </div>
</main>
</body>
</html>
`;
}

// ---- the pages, and the checks that keep them honest --------------------------------------
const report = [];
function check(file, { last: a }, html) {
  const r = ATT.results(a, exams), sm = ATT.summary(a, exams);
  if (r.got !== sm.got || r.max !== sm.max || r.rows.marked.count !== sm.answered) fail(file + ": results and summary() disagree");
  if (r.bands.reduce((n, b) => n + b.got, 0) !== r.got || r.bands.reduce((n, b) => n + b.max, 0) !== r.max) fail(file + ": the bands do not add up");
  r.bands.forEach(b => { if (b.entries.reduce((n, g) => n + (g.kind === "parent" ? g.max : g.item.marks), 0) !== b.max) fail(file + ": " + b.name + " does not add up"); });
  if (!a.completedAt) fail(file + ": not a closed attempt");
  // Words for a closed attempt: never yet, so far, retry, or a mood label, outside a quoted reason.
  // Causes included: a closed attempt shows no advice, quoted or not (decision 25).
  const body = html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<!--[\s\S]*?-->/g, "");
  const said = body.replace(/<[^>]+>/g, " ") + " " + [...body.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]).join(" ");
  [/—/, /%/, /so far/i, /\byet\b/i, /Try again/i, /try marking/i, /Full marks|Most of it|Partly there|Not yet/, /help/, /Wait a minute|Write the final value|check the class code/].forEach(re => { if (re.test(said)) fail(file + " says " + re); });
  // A cell with no mark holds words, never a number for its mark.
  if (/class="rc (nm|na)"[^>]*>(?:(?!<\/a>).)*class="v">\s*\d/s.test(html)) fail(file + ": a cell with no mark shows a number");
  // The option not taken is in no cell.
  r.either.forEach(e => { if (e.chosen !== null) e.options.filter(o => o.qi !== e.chosen).forEach(o => { if (new RegExp('aria-label="Question ' + o.number + '[:]').test(html)) fail(file + ": the option not taken has a cell"); }); });
}
for (const [file, spec] of Object.entries(FX.pages)) {
  const c = closed(spec), html = page(spec.note, c);
  check(file, c, html);
  fs.writeFileSync(path.join(OUTDIR, file), html);
  const r = ATT.results(c.last, exams);
  report.push({ file, mark: r.rows.marked.count ? r.got + "/" + r.max : "nothing marked", rows: [r.rows.marked.count, r.rows.notMarked.count, r.rows.notAnswered.count].join("/"),
                bands: r.bands.map(b => b.short + " " + (b.state === "marked" ? b.got + "/" + b.max : b.state)).join(", ") });
}

// ---- branches no page draws, checked so they cannot rot ------------------------------------
{
  // A parent whose marked parts all earned 0 is a real 0 / 14, not nothing marked.
  const a = completedAttempt();
  ["1-0-0", "1-0-1", "1-0-2", "1-0-3"].forEach(k => { a.results[k] = ASSESS.marked({ score: 0, max: a.results[k].max || 1, kind: "points" }); });
  const g = ATT.results(a, exams).bands[1].entries.find(x => x.number === "11");
  if (g.state !== "marked" || g.got !== 0 || !/<b>0<\/b> \/ 14/.test(sub(g))) fail("a real zero reads as nothing marked");
  // A superseded version is named in the aside, against the library's.
  const v2 = Object.assign(JSON.parse(JSON.stringify(paper)), { id: "exam-mockup-2", exam: Object.assign({}, paper.exam, { version: "2" }) });
  const lib = [Object.assign({}, paper, { superseded: true }), v2];
  const l = completedAttempt(); l.paper = lib[0].id;
  const rv = ATT.results(l, lib);
  if (!(rv.superseded && rv.version === "1" && rv.libraryVersion === "2")) fail("the version an attempt was on is not reported");
  // The option chosen with nothing written reads as chosen and not answered.
  const c = completedAttempt(); delete c.results["3-0"]; delete c.answers["3-0"];
  if (!/You chose Question 15 and did not answer it\. Question 16 was not part of this attempt\./.test(eitherLine(ATT.results(c, exams), 3, false))) fail("chosen and empty reads wrongly");
}
{
  // A practice drawing on two papers: no run of rows crosses papers, and every row names its paper.
  const two = Object.assign(JSON.parse(JSON.stringify(paper)), { id: "exam-mockup-b", name: "Second paper", exam: Object.assign({}, paper.exam, { id: "second-paper" }) });
  const lib = [paper, two];
  const t = ATT.startType("multiple_choice", ATT.bank("multiple_choice", lib, PACKAGES), "2026-10-03T09:00:00+10:00");
  const k0 = t.items[0], g = ASSESS.marked({ score: 1, max: 1, kind: "mc" });
  ATT.record(t, ATT.itemKey(k0), 0, g, "2026-10-03T09:05:00+10:00");
  const r2 = ATT.results(t, lib), html2 = details(r2, t);
  const rows = [...html2.matchAll(/<b>Questions ([^<]+)<\/b> · (\d+) marks · ([^<]+)<\/div>/g)].map(m => m[1] + " | " + m[2] + " | " + m[3]);
  if (rows.length !== 2 || !rows.some(x => /Second paper/.test(x)) || !rows.every(x => /\| 9 \||\| 10 \|/.test(x))) fail("a run of rows crosses papers: " + JSON.stringify(rows));
  // An either/or whose options have parts: one part answered is a chosen, answered question.
  const pp = JSON.parse(JSON.stringify(paper)); pp.id = "exam-mockup-parts";
  pp.sections[3].questions = pp.sections[3].questions.map((q, i) => ({ id: q.id, number: q.number, marks: q.marks, prompt: "Option",
    parts: [{ id: "a" + i, label: "a", marks: 8, format: "extended_response", prompt: q.prompt }, { id: "b" + i, label: "b", marks: 12, format: "extended_response", prompt: q.prompt }] }));
  const e = ATT.startPaper(pp, null, "2026-10-03T09:00:00+10:00");
  ATT.choose(e, 3, 0, "2026-10-03T09:01:00+10:00", pp);
  ATT.record(e, "3-0-1", "text", ASSESS.marked({ score: 9, max: 12, kind: "written" }), "2026-10-03T09:30:00+10:00");
  const line = eitherLine(ATT.results(e, [pp]), 3, false);
  if (line !== "You chose Question 15. Question 16 was not part of this attempt.") fail("an either/or with parts reads wrongly: " + line);
  const open = ATT.startPaper(pp, null, "2026-10-03T09:00:00+10:00");
  if (eitherLine(ATT.results(open, [pp]), 3, false) !== "Neither question was chosen. It counted as 2 questions.") fail("an unchosen either/or with parts reads wrongly");
}
console.log(JSON.stringify({ subject: SUBJECT, pages: report }, null, 1));
