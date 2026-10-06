// SLICE B, STATE 1: SUBMIT PAPER. Generated, like pages 1 to 3.
//
// The page a student reaches from Finish paper on the last question. Desktop v1
// is Practice only (decision 17): every answer was marked when it was submitted,
// so submitting the paper marks nothing more. It closes the attempt on the
// results it already has, and the results open next. The page is the
// confirmation; there is no dialog after it.
//
// Nothing is typed. Each scenario in 04-submit.fixture.json is what a student
// did (inputs only). It is replayed into a real attempt through the shipped
// contract (ATT.startPaper / startType, choose, setDraft, record, toggleFlag),
// marked by attempt.mjs's mark() (the paper's own keys, scorePoints, and the
// shipped finalize() over the marker's review), and everything the page shows is
// read from ATT.report: one walk of the sequence, one predicate. A marker
// failure's words are read out of app.js, never retyped.
//
//   node docs/mockups/04-submit.build.mjs
//
//   04-submit.html            whole paper, mixed, ready to submit (primary)
//   04-submit-marking.html    the same, with an answer still being marked
//   04-submit-section.html    Section II only, after a completed attempt
//   04-submit-complete.html   everything answered and marked
//   04-submit-practice.html   a short-answer practice session (proposed reuse)
import { ATT, ASSESS, PAPER, APP, paper, exams, SUBJECT, TYPE_NAMES, appFailure, scenario as replay, esc, plural, list, day } from "./replay.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUTDIR = process.env.MOCKUP_OUT || HERE;
const FX = JSON.parse(fs.readFileSync(path.join(HERE, "04-submit.fixture.json"), "utf8"));
const scenario = name => replay(FX, name);

// ---- words the page uses, all from the report ------------------------------------------
const secOf = si => paper.sections[si];
const shortOf = si => ATT.sectionShort(secOf(si), si);
// A question by its authored number; an unchosen either/or names both options.
const label = x => x.eitherSlot ? "Question " + x.options.join(" or ") : "Question " + x.display;
const short = x => x.eitherSlot ? x.options.join(" or ") : x.display;
const scopeLine = (a, r) => a.scope === "type" ? "" :
  (a.sections.length === paper.sections.length ? "<b>The whole paper</b>" : "<b>" + esc(list(a.sections.map(shortOf))) + " only</b>") +
  " · " + plural(r.total, "question") + " · " + plural(r.max, "mark");
const sessionFrom = a => {
  const names = [...new Set(ATT.sequence(a, exams).map(e => e.paper.name || "Untitled paper"))];
  return names.length === 1 ? "From " + names[0] : "From " + plural(names.length, "paper") + " in your library";
};
const statusTag = x => {
  if (x.pending) return x.status === "marked" ? "Marked · a new answer is being marked" : x.status === "not_marked" ? "Being marked again" : "Being marked now";
  if (x.status === "marked") return "Answered · " + x.score + " of " + plural(x.max, "mark");
  if (x.status === "not_marked") return "Not marked yet";
  if (x.eitherSlot) return "Not chosen yet";
  return x.draft === "written" ? "Draft saved · written, not submitted" : x.draft === "selected" ? "Selected, not submitted" : "Not started";
};
const HELP = {
  retry: ["marking it again can help", "to try marking again"],
  change: ["changing the answer can help", "to change your answer"],
  settings: ["your teacher can fix this in Settings", ""],
  none: ["cannot be marked here", ""],
};
// An either/or, in words that hold for any number of options and for options with parts.
const eitherRule = (n, weight) => (n === 2 ? "Answer one of these, not both." : "Answer only one of these.") +
  (weight > 1 ? " It counts as " + weight + " questions, the parts of the one you choose." : " It counts as one question.");

// ---- the pieces ---------------------------------------------------------------------------
function blocked(r, a) {
  const xs = r.items.filter(x => x.pending);
  if (!xs.length) return "";
  const one = xs.length === 1;
  return `<section class="busy" aria-labelledby="bz">
    <h3 id="bz">${one ? esc(label(xs[0])) + " is still being marked" : plural(xs.length, "answer") + " are still being marked"}</h3>
    <p>You can submit once ${one ? "its mark arrives" : "their marks arrive"}, which takes at most about a minute, or leave ${one ? "it" : "them"} unmarked.</p>
    <ul>${xs.map(x => `<li>
      <div class="bzrow"><span class="where"><b>${esc(label(x))}</b> · ${plural(x.marks, "mark")}</span><span class="tag busy">${esc(statusTag(x))}</span>
        <span class="spacer"></span><button type="button" class="link">Leave it unmarked</button></div>
      <p class="then">${x.status === "marked"
        ? "If you leave it unmarked, your earlier mark of " + x.score + " of " + x.max + " stands and the new answer is not marked."
        : x.status === "not_marked" ? "If you leave it unmarked, it stays not marked."
        : "If you leave it unmarked, it is submitted without a mark and its " + plural(x.marks, "mark") + " still count in the " + r.max + ". A mark that arrives later is not used."}</p>
    </li>`).join("")}</ul>
  </section>`;
}
function consequence(r, a) {
  const R = r.rows, lost = R.notMarked.worth + R.notAnswered.worth;
  const cell = (n, txt) => n ? txt : "";
  const busy = n => n ? ` <span class="sm">· ${n} being marked</span>` : "";
  const verb = a.scope === "type" ? "finishing" : "submitting";
  const whole = a.scope === "type" ? "This practice" : a.sections.length === paper.sections.length ? "The whole paper" : list(a.sections.map(shortOf)) + " only";
  return `<table class="tally">
    <caption class="vh">What you are ${verb}</caption>
    <thead><tr><th scope="col">Status</th><th scope="col">Questions</th><th scope="col">Worth</th><th scope="col">Earned</th></tr></thead>
    <tbody>
      <tr><th scope="row">Answered and marked</th><td>${R.marked.count ? R.marked.count + busy(R.marked.pending) : `<span class="none">None</span>`}</td><td>${cell(R.marked.count, plural(R.marked.worth, "mark"))}</td><td>${cell(R.marked.count, `<b>${R.marked.earned}</b>`)}</td></tr>
      <tr><th scope="row">${R.notMarked.count ? `<a href="#g-nm">Submitted, not marked</a>` : "Submitted, not marked"}</th><td>${R.notMarked.count ? R.notMarked.count + busy(R.notMarked.pending) : `<span class="none">None</span>`}</td><td>${cell(R.notMarked.count, plural(R.notMarked.worth, "mark"))}</td><td>${cell(R.notMarked.count, `<span class="none">Not marked</span>`)}</td></tr>
      <tr><th scope="row">${R.notAnswered.count ? `<a href="#g-na">Not answered</a>` : "Not answered"}</th><td>${!R.notAnswered.count ? `<span class="none">None</span>` : R.notAnswered.count + busy(R.notAnswered.pending)}</td><td>${cell(R.notAnswered.count, plural(R.notAnswered.worth, "mark"))}</td><td>${cell(R.notAnswered.count, `<span class="none">None</span>`)}</td></tr>
    </tbody>
    <tfoot><tr><th scope="row">${esc(whole)}</th><td>${r.total}</td><td>${plural(r.max, "mark")}</td><td><b>${r.got}/${r.max}</b> marks so far</td></tr></tfoot>
  </table>
  ${lost ? `<p class="note">Questions not marked or not answered earn nothing${a.scope === "type" ? "" : " when you submit"}. Their ${plural(lost, "mark")} still count in the ${r.max}.</p>` : ""}
  ${r.flagged.length ? `<p class="note"><span class="flagged">⚑ ${r.flagged.length} flagged</span> · Flags do not change a mark, and they do not stop you ${verb}. <a href="#g-fl">See flagged</a></p>` : ""}
  ${changedNote(r)}`;
}
// A change nobody submitted: a marked answer keeps its mark, a not-marked one stays not marked.
function changedNote(r) {
  const m = r.items.filter(x => x.changed && x.status === "marked").length, n = r.items.filter(x => x.changed && x.status === "not_marked").length;
  if (!m && !n) return "";
  const parts = [m ? (m === 1 ? "1 answer has" : m + " answers have") + " changed since marking, so the earlier mark stands, for the earlier version" : "",
                 n ? (n === 1 ? "1 not-marked answer has" : n + " not-marked answers have") + " changed since it was sent for marking, so it stays not marked" : ""].filter(Boolean);
  return `<p class="note">${parts.join(". ")}. <a href="#g-ch">See which</a></p>`;
}
function lastStrip(rec, a) {
  if (!rec.last) return "";
  const l = ATT.summary(rec.last, exams);
  return `<section class="last" aria-labelledby="la">
    <h3 class="vh" id="la">Your last completed attempt</h3>
    <span class="state done">Completed ${day(rec.last.completedAt)}</span>
    <p class="lastline"><b>${l.got} / ${l.max}</b> · ${l.answered} of ${l.total} answered${rec.last.sections && rec.last.sections.join() !== (a.sections || []).join()
      ? " · " + (rec.last.sections.length === paper.sections.length ? "the whole paper" : esc(list(rec.last.sections.map(shortOf))) + " only") : ""}</p>
    <span class="spacer"></span><a class="btn ghost sm" href="#results">View results</a>
    <p class="keep">Submitting replaces this result. Only your latest completed ${a.scope === "type" ? "session" : "attempt"} is kept.</p>
  </section>`;
}
function groups(r, a) {
  const out = [];
  const row = (x, body, route) => `<li${x.flagged ? ' class="fl"' : ""}>
      <div class="where"><b>${esc(label(x))}</b> · ${plural(x.marks, "mark")}${a.scope === "paper" ? " · " + esc(shortOf(x.si)) : ""}${x.flagged ? ` <span class="flagged">⚑ flagged</span>` : ""}</div>
      ${body}
      ${route ? `<p class="route">${route}</p>` : ""}
    </li>`;
  const go = (x, why) => x.eitherSlot ? `<a class="link" href="#go-${x.key}">Go to ${esc(shortOf(x.si))} to choose</a>`
    : `<a class="link" href="#go-${x.key}">Go to ${esc(short(x))}${why ? " " + why : ""}</a>`;
  const nm = r.items.filter(x => x.status === "not_marked");
  if (nm.length) out.push(`<section class="grp" id="g-nm" tabindex="-1" aria-labelledby="h-nm">
    <h3 id="h-nm">Submitted, not marked <span class="n">${nm.length}</span></h3>
    <p class="glede">Each answer is still here, and nothing has been recorded against it.</p>
    <ul>${nm.map(x => row(x, x.pending
      ? `<p class="tagline"><span class="tag busy">${esc(statusTag(x))}</span></p><p class="why">It is being marked again now. Until its mark arrives it stays not marked.</p>`
      : `<p class="tagline"><span class="tag nm">Not marked yet · ${HELP[x.help][0]}</span></p>
      <p class="why">${esc(x.why || "No reason was recorded.")}</p>${x.help === "none" ? `<p class="why sm">Marking it again here will not change this.</p>` : ""}`,
      x.pending ? "" : go(x, HELP[x.help][1]))).join("")}</ul></section>`);
  const na = r.items.filter(x => x.status === "not_answered");
  if (na.length) out.push(`<section class="grp" id="g-na" tabindex="-1" aria-labelledby="h-na">
    <h3 id="h-na">Not answered <span class="n">${r.rows.notAnswered.count}</span></h3>
    <p class="glede">${na.some(x => x.pending) ? "None of these has a mark yet." : "Nothing has been submitted for marking for these."}</p>
    <ul>${na.map(x => row(x, `<p class="tagline"><span class="tag${x.pending ? " busy" : ""}">${esc(statusTag(x))}</span></p>
      ${x.eitherSlot ? `<p class="why">${eitherRule(x.options.length, x.weight)}</p>`
        : x.pending ? `<p class="why">It has been sent for marking. Until its mark arrives it is not answered.</p>`
        : x.draft ? `<p class="why">${a.scope === "type" ? "Finishing" : "Submitting the paper"} does not mark it.</p>` : ""}`,
      x.pending ? "" : go(x, x.draft ? "to submit it for marking" : ""))).join("")}</ul></section>`);
  const ch = r.items.filter(x => x.changed);
  if (ch.length) out.push(`<section class="grp" id="g-ch" tabindex="-1" aria-labelledby="h-ch">
    <h3 id="h-ch">Changed after marking <span class="n">${ch.length}</span></h3>
    <ul>${ch.map(x => row(x, `<p class="why">${x.status === "marked" ? "This answer has changed since it was marked, and the new version has no mark. Your mark of " + x.score + " of " + plural(x.max, "mark") + " stands, for the version it was given for." : "This answer has changed since it was sent for marking. It stays not marked."}</p>`,
      go(x, ""))).join("")}</ul></section>`);
  const fl = r.items.filter(x => x.flagged);
  if (fl.length) out.push(`<section class="grp" id="g-fl" tabindex="-1" aria-labelledby="h-fl">
    <h3 id="h-fl">Flagged <span class="n gold">${fl.length}</span></h3>
    <p class="glede">You flagged these to come back to.${(() => {
      const dup = fl.filter(x => x.status !== "marked" || x.changed).length;
      return !dup ? "" : fl.length === 1 ? " It is also listed above." : dup === fl.length ? " They are also listed above." : dup === 1 ? " One of these is also listed above." : " " + dup + " of these are also listed above.";
    })()}</p>
    <ul>${fl.map(x => `<li class="fl"><div class="where"><span class="flagged">⚑</span> <b>${esc(label(x))}</b> · ${plural(x.marks, "mark")}${a.scope === "paper" ? " · " + esc(shortOf(x.si)) : ""}</div>
      <p class="tagline"><span class="tag${x.status === "not_marked" ? " nm" : ""}">${esc(statusTag(x))}</span></p>
      <p class="route">${go(x, "")}</p></li>`).join("")}</ul></section>`);
  return out.join("");
}
function bySection(r) {
  if (!r.sections) return "";
  return `<table class="bysec">
    <caption class="k">By section</caption>
    <thead><tr><th scope="col">Section</th><th scope="col">Answered</th><th scope="col">Flagged</th><th scope="col">Marks so far</th></tr></thead>
    <tbody>${r.sections.map(s => `<tr>
      <th scope="row">${esc(ATT.sectionName(secOf(s.si), s.si))}</th>
      <td>${s.done} of ${s.total}${s.notMarked ? ` · ${s.notMarked} not marked` : ""}</td>
      <td>${s.flagged ? `<span class="flagged">⚑ ${s.flagged}</span>` : `<span class="none">None</span>`}</td>
      <td>${s.done ? `<b>${s.got}</b>/${s.max}` : `<span class="none">${s.touched ? "Not marked yet" : "Not started"}</span>`}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}
function goBar(r, a) {
  const what = a.scope === "type" ? "practice" : "paper";
  let sum;
  if (r.pending.length) {
    const xs = r.items.filter(x => x.pending);
    sum = (xs.length === 1 ? esc(label(xs[0])) + " is" : plural(xs.length, "answer") + " are") + " still being marked. You can submit when " +
          (xs.length === 1 ? "it has its mark, or leave it unmarked." : "they have their marks, or leave them unmarked.");
  } else {
    const gaps = [r.rows.notMarked.count ? plural(r.rows.notMarked.count, "answer") + " not marked" : "",
                  r.rows.notAnswered.count ? plural(r.rows.notAnswered.count, "question") + " not answered" : ""].filter(Boolean);
    const verb = a.scope === "type" ? "Finishing closes this session" : "Submitting closes this attempt";
    sum = gaps.length ? `${verb} at <b>${r.got}/${r.max}</b>, with ${list(gaps)}.`
      : `All ${r.total} answered and marked. ${verb} at <b>${r.got}/${r.max}</b>.`;
  }
  return `<div class="go">
    <p class="sum" aria-live="polite">${sum}</p>
    <button type="button" class="btn"${r.pending.length ? " disabled" : ""}>${a.scope === "type" ? "Finish practice" : "Submit paper"}</button>
  </div>`;
}
function aside(r, a) {
  const saved = `<h3 class="k">Saved</h3><p class="p">Started ${day(a.startedAt)} · saved ${day(a.updatedAt)}</p>`;
  if (a.scope === "type") return `<aside class="about" aria-labelledby="ab">
    <h2 id="ab">About this practice</h2>
    <h3 class="k">Questions</h3>
    <p class="p">${esc(sessionFrom(a))}. ${plural(r.total, "question")}, fixed once a session starts.</p>
    <h3 class="k">Your paper attempts</h3>
    <p class="p">Finishing this practice does not change any paper attempt, even where they share a question.</p>
    ${saved}
  </aside>`;
  const either = r.either.map(e => {
    const sec = secOf(e.si), opt = qi => e.options.find(o => o.qi === qi);
    const others = e.options.filter(o => o.qi !== e.chosen).map(o => "Question " + o.number);
    const status = e.chosen === null
      ? `Not chosen yet. ${eitherRule(e.options.length, (r.items.find(y => y.eitherSlot && y.si === e.si) || { weight: 1 }).weight)}`
      : e.locked ? `You chose Question ${esc(opt(e.chosen).number)}. ${esc(list(others))} ${others.length === 1 ? "is" : "are"} not part of this attempt.`
      : `You chose Question ${esc(opt(e.chosen).number)} and have not written anything for it, so you can still change your choice.`;
    return `<h3 class="k">${esc(ATT.sectionName(sec, e.si))}</h3>
      ${sec.instructions ? `<blockquote class="ins"><p>${esc(sec.instructions)}</p><cite>Original paper instructions</cite></blockquote>` : ""}
      <p class="p either">${status}</p>`;
  }).join("");
  const whole = a.sections.length === paper.sections.length;
  return `<aside class="about" aria-labelledby="ab">
    <h2 id="ab">About this attempt</h2>
    <h3 class="k">Sections</h3>
    <ul class="secl">${a.sections.map(si => `<li>${esc(ATT.sectionName(secOf(si), si))}</li>`).join("")}</ul>
    <p class="p sm">${whole ? "" : "You are sitting " + esc(list(a.sections.map(shortOf))) + ". "}Sections are fixed once an attempt starts.</p>
    ${either}
    ${saved}
  </aside>`;
}

// ---- the page --------------------------------------------------------------------------
const POLICY = `<span class="policy"><span class="dot"></span>Practice · marked as you go</span>`;
function page(note, { a, r, rec }) {
  const type = a.scope === "type";
  const back = r.items.find(x => x.key === r.at);
  const title = type ? "Finish practice" : "Submit paper";
  const kicker = type ? TYPE_NAMES[a.format] + " practice" : paper.name;
  const facts = type ? esc(sessionFrom(a)) + " · " + plural(r.total, "question") + " · " + plural(r.max, "mark") : scopeLine(a, r);
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test mode · ${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<!-- ${esc(note)} Generated by 04-submit.build.mjs: do not edit by hand. -->
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
  button{font:inherit;cursor:pointer}
  a{color:inherit}
  h1,h2,h3{font-family:var(--disp);letter-spacing:-.01em;font-weight:600}
  :focus-visible{outline:2px solid var(--green-dk);outline-offset:3px;border-radius:10px}
  html{scroll-padding-bottom:110px;scroll-padding-top:16px}
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
  .back:hover{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
  .top{margin-bottom:20px}
  .kicker{font-family:var(--disp);font-weight:600;font-size:13.5px;color:var(--ink-2)}
  .top h1{font-size:30px;line-height:1.15;margin-top:2px}
  .factrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:6px}
  .facts{font-size:15px;color:var(--ink-2);font-weight:700}
  .facts b{color:var(--ink)}
  .policy{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:var(--green-dk);background:var(--green-soft);border:1px solid #BFEFD9;border-radius:99px;padding:3px 11px}
  .policy .dot{width:6px;height:6px;border-radius:99px;background:var(--green)}
  .spacer{flex:1}

  .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;text-decoration:none;font-family:var(--disp);font-weight:600;font-size:15px;color:#fff;background:var(--green-dk);border:none;border-radius:14px;padding:11px 26px;box-shadow:0 4px 0 var(--green-edge);white-space:nowrap}
  .btn:active{transform:translateY(2px);box-shadow:0 2px 0 var(--green-edge)}
  .btn.ghost{background:var(--card);color:var(--ink);box-shadow:0 0 0 2px var(--line) inset}
  .btn.sm{min-height:44px;padding:9px 18px;font-size:14px;border-radius:12px}
  .btn:disabled{background:#C9D3D2;box-shadow:none;color:var(--ink);cursor:not-allowed;transform:none}
  .link{background:none;border:none;font-family:var(--disp);font-weight:600;font-size:14px;color:var(--green-dk);text-decoration:underline;text-underline-offset:3px;padding:4px 0}

  .layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
  .panel,.about{background:var(--card);border:1.5px solid var(--line);border-radius:18px}
  .panel{padding:22px 26px 0;overflow:clip}
  .panel>h2{font-size:20px;line-height:1.3}
  .plede{font-size:15px;color:var(--ink-2);font-weight:600;margin-top:4px}
  .k{font-family:var(--disp);font-weight:600;font-size:13px;color:var(--ink-2)}
  .none{color:var(--ink-2);font-weight:600}
  .flagged{color:var(--gold-dk);font-weight:800}
  .sm{font-size:13px}

  /* Still being marked: blue, because blue already means in progress here. */
  section.busy{margin-top:16px;border:1.5px solid #C4E4FA;background:var(--blue-soft);border-radius:14px;padding:14px 16px}
  .busy h3{font-size:16px;color:var(--blue-dk)}
  .busy>p{font-size:14px;font-weight:600;color:var(--ink);margin-top:2px}
  .busy ul{list-style:none;margin-top:10px;display:flex;flex-direction:column;gap:8px}
  .busy li{background:var(--card);border:1px solid #C4E4FA;border-radius:12px;padding:8px 12px}
  .bzrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .then{font-size:13.5px;font-weight:600;color:var(--ink-2);margin-top:2px}

  /* What you are submitting: the three groups add up to the attempt. */
  .tally,.bysec{width:100%;border-collapse:collapse;margin-top:16px;font-size:14.5px}
  .tally caption,.bysec caption{text-align:left;margin-bottom:6px}
  .tally th,.tally td,.bysec th,.bysec td{text-align:left;padding:9px 12px;border-top:1px solid var(--line);font-weight:700;color:var(--ink)}
  .tally thead th,.bysec thead th{font-family:var(--disp);font-weight:600;font-size:12.5px;color:var(--ink-2);border-top:none;padding-top:0}
  .tally tbody th,.bysec tbody th{font-family:var(--disp);font-weight:600;font-size:15px}
  .tally tbody th a{text-decoration:underline;text-decoration-color:#B9C6C5;text-underline-offset:3px}
  .tally td:last-child,.tally th:last-child,.bysec td:last-child,.bysec th:last-child{text-align:right}
  .tally tfoot th,.tally tfoot td{border-top:2px solid #D5DFDF;font-family:var(--disp);font-weight:600;font-size:15px}
  .tally tfoot b{font-size:17px}
  .note{font-size:14px;color:var(--ink-2);font-weight:600;margin-top:10px}
  .note a{color:var(--green-dk);font-family:var(--disp);font-weight:600;text-underline-offset:3px}

  .last{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;border:1.5px solid #BFEFD9;background:#F6FCF9;border-radius:14px;padding:12px 16px;margin-top:18px}
  .state{align-self:center;font-family:var(--disp);font-weight:600;font-size:12.5px;border-radius:99px;padding:3px 11px;color:var(--ink-2);background:#F1F5F5;border:1px solid var(--line)}
  .state.done{color:var(--green-dk);background:var(--green-soft);border-color:#BFEFD9}
  .lastline{font-size:14.5px;color:var(--ink-2);font-weight:700}
  .lastline b{color:var(--ink);font-family:var(--disp);font-size:17px;font-weight:600}
  .keep{flex-basis:100%;font-size:13px;color:var(--ink-2);font-weight:700}

  /* The detail: one list per thing a student may want to go back to. */
  .grp{margin-top:26px;padding-top:18px;border-top:1px solid var(--line)}
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
  .tag{display:inline-block;font-size:12.5px;font-weight:800;color:var(--ink-2);background:#F1F5F5;border:1px solid var(--line);border-radius:8px;padding:1px 8px}
  .tag.nm{color:var(--ink);background:#FFFFFF;border-color:#C9D3D2;border-style:dashed}
  .tag.busy{color:var(--blue-dk);background:var(--blue-soft);border-color:#C4E4FA}
  .why{font-size:14px;font-weight:600;color:var(--ink);margin-top:4px}
  .route{margin-top:2px}

  .bysec{margin-top:28px}
  .go{display:flex;align-items:center;gap:18px;margin:24px -26px 0;padding:16px 26px;background:#F6F9F9;border-top:1px solid var(--line);position:sticky;bottom:0;z-index:2;box-shadow:0 -10px 16px -14px rgba(60,74,74,.35)}
  .sum{font-size:15px;color:var(--ink-2);font-weight:700;flex:1}
  .sum b{color:var(--ink)}

  .about{padding:20px 22px 22px}
  .about h2{font-size:17px;line-height:1.3;margin-bottom:4px}
  .about .k{margin-top:16px;margin-bottom:4px}
  .p{font-size:14px;color:var(--ink);font-weight:600}
  .p.sm{font-size:13px;color:var(--ink-2);margin-top:6px}
  .secl{list-style:none;font-size:14px;font-weight:700}
  .secl li{padding:2px 0}
  blockquote.ins{border-left:3px solid #CFE9DD;padding:2px 0 2px 12px}
  blockquote.ins p{font-size:14px;color:var(--ink);font-weight:600}
  blockquote.ins cite{display:block;font-style:normal;font-size:12.5px;color:var(--ink-2);font-weight:700;margin-top:4px}
  .either{margin-top:8px}

  @media(max-width:960px){ .layout{grid-template-columns:1fr} .go{flex-wrap:wrap} }
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
  <a class="back" href="#go-${esc(r.at)}"><span aria-hidden="true">← </span>Back to ${esc(label(back))}</a>
  <div class="top">
    <p class="kicker">${esc(kicker)}</p>
    <h1>${esc(title)}</h1>
    <div class="factrow"><p class="facts">${facts}</p>${POLICY}</div>
  </div>
  <div class="layout">
    <section class="panel" aria-labelledby="dh">
      <h2 id="dh" tabindex="-1">${type ? "Finishing ends this session" : "Submitting ends this attempt"} with the marks you have now</h2>
      <p class="plede">Answers are marked as you submit them, so ${type ? "finishing" : "submitting the paper"} marks nothing more. Your results open next, where you can review your marks but not change them.</p>
      ${blocked(r, a)}
      ${consequence(r, a)}
      ${lastStrip(rec, a)}
      ${groups(r, a)}
      ${bySection(r)}
      ${goBar(r, a)}
    </section>
    ${aside(r, a)}
  </div>
</main>
</body>
</html>
`;
}

// ---- the variants, and the checks that keep them honest ------------------------------------
const report = [];
const fail = m => { throw new Error(m); };
function check(name, { a, r }, html) {
  const sm = ATT.summary(a, exams), R = r.rows;
  if (R.marked.count + R.notMarked.count + R.notAnswered.count !== sm.total) fail(name + ": the rows do not add up to " + sm.total);
  if (R.marked.worth + R.notMarked.worth + R.notAnswered.worth !== sm.max) fail(name + ": the marks do not add up to " + sm.max);
  if (R.marked.earned !== sm.got || R.marked.count !== sm.answered || R.notMarked.count !== sm.notMarked) fail(name + ": the report and summary() disagree");
  if (r.flagged.length !== sm.flagged) fail(name + ": flags disagree");
  if (/—/.test(html)) fail(name + " has an em dash");
  if (/>\s*0\s*<\/td>/.test(html.split("<tbody>")[1] || "")) fail(name + ": a cell reads 0");
  if (html.includes("THE SHARED SITTING-SHELL FOOTER")) fail(name + " draws the frozen sitting footer, which this page does not have");
  if (!!r.pending.length !== /class="busy"/.test(html)) fail(name + ": being marked is drawn exactly when something is pending, and only then");
  if (!!r.pending.length !== /<button type="button" class="btn" disabled>/.test(html)) fail(name + ": Submit is not disabled exactly while something is being marked");
}
function write(file, name, note) {
  const sc = scenario(name), html = page(note, sc);
  check(name, sc, html);
  fs.writeFileSync(path.join(OUTDIR, file), html);
  const R = sc.r.rows;
  report.push({ file, marked: R.marked.count + " (" + R.marked.earned + "/" + R.marked.worth + ")", notMarked: R.notMarked.count, notAnswered: R.notAnswered.count,
                total: sc.r.total, marks: sc.r.got + "/" + sc.r.max, flagged: sc.r.flagged.length, pending: sc.r.pending.length, changed: sc.r.changed.length });
  return sc;
}
const primary = write("04-submit.html", "primary", "Submit paper, the whole paper, ready to submit: the primary proposal.");
write("04-submit-marking.html", "marking", "Submit paper while an answer is still being marked.");
write("04-submit-section.html", "section", "Submit paper for Section II only, after a completed attempt.");
const complete = write("04-submit-complete.html", "complete", "Submit paper with everything answered and marked.");
write("04-submit-practice.html", "practice", "Finish practice for a short-answer session: proposed reuse of the page.");

// ---- branches no variant draws, checked so they cannot rot ------------------------------
{
  const p = primary.r;
  const by = k => p.items.find(x => x.key === k);
  if (by("1-0-2").help !== "change" || by("1-1-0").help !== "retry") fail("the not-marked help is wrong: " + by("1-0-2").help + " " + by("1-1-0").help);
  if (!by("3-0").eitherSlot || by("3-0").weight !== 1) fail("the unchosen either/or is not one item");
  if (complete.r.rows.notMarked.count || complete.r.rows.notAnswered.count) fail("the complete attempt has gaps");
  if (complete.r.either[0].chosen !== 0 || !complete.r.either[0].locked) fail("the chosen either/or is not locked");
  // A refusal no retry can change (no marker connected) says so, and offers no retry.
  const a = ATT.clone ? ATT.clone(primary.a) : JSON.parse(JSON.stringify(primary.a));
  a.results["1-1-0"] = appFailure("MARKER_UNREACHABLE", 3);
  const nm = ASSESS.refuse("MARKER_NOT_CONNECTED", (APP.match(/ASSESS\.refuse\("MARKER_NOT_CONNECTED",\s*"([^"]+)"/) || fail("no MARKER_NOT_CONNECTED"))[1], { max: 3, retry: false });
  a.results["1-1-0"] = nm;
  const r2 = ATT.report(a, exams, []);
  const g2 = groups(r2, a);
  if (r2.items.find(x => x.key === "1-1-0").help !== "settings" || !/your teacher can fix this in Settings/.test(g2) || /cannot be marked here/.test(g2))
    fail("a refusal a setting fixes reads as unfixable or as retryable");
  const kq = (APP.match(/ASSESS\.refuse\("CALC_KEY_INCOMPLETE",\s*"([^"]+)"/) || fail("no CALC_KEY_INCOMPLETE"))[1];
  a.results["1-0-2"] = ASSESS.refuse("CALC_KEY_INCOMPLETE", kq, { max: 4 });
  const r3 = ATT.report(a, exams, []), g3 = groups(r3, a);
  if (r3.items.find(x => x.key === "1-0-2").help !== "none" || !/cannot be marked here/.test(g3) || !/Marking it again here will not change this/.test(g3))
    fail("a refusal nothing can change reads as fixable");
  // A retry still being marked offers no second retry, and is counted as being marked on its row.
  const r4 = ATT.report(primary.a, exams, ["1-1-0"]);
  if (/Go to 12\(a\) to try marking again/.test(groups(r4, primary.a)) || r4.rows.notMarked.pending !== 1) fail("a retry in flight invites another");
  // Nothing is "being marked" once the page is reloaded: pending is never stored.
  if (ATT.report(JSON.parse(JSON.stringify(primary.a)), exams).pending.length) fail("pending survived a reload");
}
console.log(JSON.stringify({ subject: SUBJECT, pages: report }, null, 1));
