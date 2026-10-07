// STATE 13 IS GENERATED, NOT WRITTEN, the same way state 12 is.
//
// Three sources, and none of them is this file:
//
//   tests/fixtures/bus-practice-paper.json   the question - prompt, instructions,
//                                            case study, marking points - as authored
//   13-business-report.fixture.json          the student's report and one model review
//   the SHIPPED contract and worker          markerGuidance() decides what the marker
//                                            is sent; finalize() decides what comes back
//
// So the page cannot show a marking point the question does not author, a list the
// marker was not sent, or a quotation snapSentences did not locate. The one thing
// this page adds to state 12's pattern is "What your marker was told to look for",
// and that list is ASSESS.markerGuidance(q14).items, computed here, not copied.
//
//   node docs/mockups/13-business-report.build.mjs
import { createRequire } from "node:module";
import { finalize } from "../../tests/worker.mjs";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const ASSESS = require("../../tools/contract/assessment.js");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "..", "..");
// tests/t36.mjs regenerates into a scratch directory and compares, so the pages
// in the repo are provably what this produces rather than a copy that drifted.
const OUTDIR = process.env.MOCKUP_OUT || HERE;

const paper = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/bus-practice-paper.json"), "utf8"));
const sec = paper.sections[2];
const q = sec.questions[0];
if (ASSESS.normaliseFormat(q).format !== "business_report") throw new Error("q14 is no longer the business report");
const fx = JSON.parse(fs.readFileSync(path.join(HERE, "13-business-report.fixture.json"), "utf8"));
const r = finalize(JSON.parse(JSON.stringify(fx.review)), q.marks, fx.answer,
                   null, fx.criteria, false, "extended", null);
// What the marker is sent, by the same functions the app sends it with: the
// question's guidance, and the case study it was told to use.
const PAPER = require("../../tools/contract/exam.js");
const rg = ASSESS.markerGuidance(q, ASSESS.accomplishOf(q));
if (rg.ok !== true) throw new Error("q14's guidance is refused: " + rg.why);
const sc = PAPER.sourceContext([{ stimulus: sec.source }, q]);
if (sc.ok !== true || sc.unrepresented.length) throw new Error("q14's case study cannot be sent whole");

// ---- what the payload supports, and only that ------------------------------
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const anchored = [], across = [];
(r.paragraphs || []).forEach(p => (p.sentences || []).forEach(sn => (sn.issues || []).forEach(iss => {
  (sn.unplaced ? across : anchored).push({ quote: sn.text, head: iss.head, why: iss.why });
})));
across.forEach(o => { delete o.quote; });

const ratio = r.max ? r.score / r.max : 0;
const mood = ratio >= 0.95 ? "Full marks" : ratio >= 0.6 ? "Most of it" : ratio >= 0.3 ? "Partly there" : "Not yet";

// THE CHART'S ALT TEXT IS READ OFF THE CHART, every clause of it.
//
// The title and the axis come from its <text> labels. The bars come from its
// <rect>s: the full-canvas background is not a bar, each remaining one is, and
// the trend sentence is only written if the heights actually say it. An earlier
// version hard-coded "each bar is taller than the one before", which was true of
// this chart and would have told a screen-reader user the opposite of a falling one.
const svg = Buffer.from(q.stimulus.img.split(",")[1], "base64").toString("utf8");
const labels = [...svg.matchAll(/>([^<]+)<\/text>/g)].map(m => m[1]);
const years = labels.filter(t => /^\d{4}$/.test(t));
const ticks = labels.filter(t => /^\d+$/.test(t) && !/^\d{4}$/.test(t)).map(Number).sort((a, b) => a - b);
const canvas = svg.match(/<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
const attr = (tag, a) => Number((tag.match(new RegExp("\\b" + a + '="([\\d.]+)"')) || [])[1]);
const bars = [...svg.matchAll(/<rect\b[^>]*>/g)].map(m => m[0])
  .filter(t => !(canvas && attr(t, "width") === Number(canvas[1]) && attr(t, "height") === Number(canvas[2])))
  .map(t => ({ x: attr(t, "x"), h: attr(t, "height") })).sort((a, b) => a.x - b.x);
const rising = bars.length > 1 && bars.every((b, i) => i === 0 || b.h > bars[i - 1].h);
const falling = bars.length > 1 && bars.every((b, i) => i === 0 || b.h < bars[i - 1].h);
const ALT = `Bar chart: ${labels[0]}, ${bars.length} bars` +
  (bars.length === years.length ? `, one for each year from ${years[0]} to ${years[years.length - 1]}` : "") +
  `, on a scale from ${ticks[0]} to ${ticks[ticks.length - 1]}.` +
  (rising ? " Each bar is taller than the one before." : falling ? " Each bar is shorter than the one before." : "");

const report = {
  mark: r.score + " of " + r.max, mood,
  sentToMarker: rg.items.length, caseStudySent: sc.text.length,
  anchoredCount: anchored.length, acrossCount: across.length,
  everyQuoteVerbatim: anchored.every(o => fx.answer.includes(o.quote)),
  grounded: r.checks.grounded, prose: r.checks.prose,
};

const TOK = `  /* THE SHARED TEST MODE TOKENS - the approved accessibility baseline in
     docs/testmode-tokens.md. Not state 13's colours. */
  :root{
    --bg:#EEF3F5; --card:#FFFFFF;
    --ink:#3C4A4A; --ink-2:#596866; --ink-3:#616E6C;
    --green:#1CC47D; --green-dk:#0E7A4E; --green-edge:#0A5C3C; --green-soft:#E4F9EF;
    --blue:#1CA0F2; --blue-dk:#0D5888; --blue-soft:#E2F3FE;
    --gold:#FFB323; --gold-dk:#9A6000; --gold-soft:#FFF3D8;
    --coral:#FF7C6B; --coral-dk:#AE3323; --coral-soft:#FFE8E4;
    --line:#E7EDED;
    --disp:'Fredoka',system-ui,sans-serif; --body:'Nunito',system-ui,sans-serif;
    --footh:68px;
  }`;

const WORDS = fx.answer.trim().split(/\s+/).length;
const BLOCKS = fx.answer.split(/\n\s*\n/);

// THE CASE STUDY HAS TWO PRESENTATION STATES TOO, for the reason the response does.
//
// While answering it is open, in full, because it is what the report is written
// from. Once marked it is a line the student can open: they have read it, and
// rendered in full its text and chart put "15 of 20" below the fold at 1280x900
// - the same fault state 12's collapsed response was approved to fix, arriving
// from above the response instead of from inside it. Still directly under the
// instructions, so "use the case study below" stays true in both states.
const caseInner = `<div class="body">
          <p>${esc(q.stimulus.text)}</p>
          <img src="${q.stimulus.img}" alt="${esc(ALT)}">
        </div>`;
const caseBlock = marked => marked
  ? `<details class="case">
        <summary><span class="nm">${esc(q.stimulus.caption)}</span><span class="act"></span></summary>
        ${caseInner}
      </details>`
  : `<figure class="case">
        <figcaption>${esc(q.stimulus.caption)}</figcaption>
        ${caseInner}
      </figure>`;

// The one thing that differs between the two states, in one place.
const responseBlock = marked => marked
  ? `<details class="submitted">
        <summary><span class="nm">Your submitted response</span><span>· ${WORDS} words</span><span class="act"></span></summary>
        <div class="response">
${BLOCKS.map(b => "          <p>" + esc(b) + "</p>").join("\n")}
        </div>
      </details>
      <div class="saved"><span class="tick">✓</span> Submitted. You can leave and come back to this paper.</div>`
  : `<textarea class="answerbox" aria-label="Your response" placeholder="Write your full response here, using blank lines between sections.">${esc(fx.answer)}</textarea>
      <div class="saved"><span class="tick">✓</span> Saved. You can leave and come back to this paper.</div>`;

const page = marked => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Marginal · Business report, ${marked ? "marked" : "answering"}</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${TOK}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--body);font-size:16px;background:var(--bg);color:var(--ink);line-height:1.6;
       -webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column}
  button{font:inherit;cursor:pointer}
  h1,h2,h3,h4,.disp{font-family:var(--disp);letter-spacing:-.01em;font-weight:600}

  header{display:flex;align-items:center;gap:12px;padding:16px clamp(16px,4vw,32px);background:var(--card);
         border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
  .brand{display:flex;align-items:center;gap:10px;font-family:var(--disp);font-weight:600;font-size:20px}
  .mk{width:28px;height:28px;border-radius:9px;background:var(--green);position:relative;flex:none;box-shadow:0 3px 0 var(--green-dk)}
  .mk::after{content:"";position:absolute;left:7px;right:7px;bottom:6px;height:3px;border-radius:2px;background:#fff}
  .mk::before{content:"";position:absolute;left:7px;bottom:6px;width:3px;height:14px;border-radius:2px;background:rgba(255,255,255,.9)}
  .unit{font-size:13px;color:var(--ink-2);font-weight:700;margin-left:auto;text-align:right}
  .unit b{display:block;color:var(--ink);font-size:13.5px}

  main{max-width:1180px;width:100%;margin:0 auto;
       padding:20px clamp(16px,4vw,40px) calc(26px + var(--footh));flex:1 0 auto}

  .exam-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 16px;background:var(--card);
            border:1.5px solid var(--line);border-radius:16px;margin-bottom:14px}
  .exam-bar .x{background:none;border:none;font-size:19px;color:var(--ink-2);line-height:1;padding:0 2px}
  .paper .nm{font-family:var(--disp);font-weight:600;font-size:15px;line-height:1.25}
  .paper .sec{font-size:12px;color:var(--ink-2);font-weight:700}
  .spacer{flex:1}
  .policy{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:var(--green-dk);
          background:var(--green-soft);border:1px solid #BFEFD9;border-radius:99px;padding:4px 11px}
  .policy .dot{width:6px;height:6px;border-radius:99px;background:var(--green)}
  .navbtn{font-family:var(--disp);font-weight:700;font-size:13px;color:var(--ink);background:var(--card);
          border:1.5px solid var(--line);border-radius:12px;padding:8px 13px;display:flex;align-items:center;gap:7px}
  .navbtn .grid{display:grid;grid-template-columns:repeat(3,4px);gap:2px}
  .navbtn .grid i{width:4px;height:4px;border-radius:1px;background:var(--ink-3)}
  .navbtn .grid i.on{background:var(--green)}
  .prog{text-align:right;font-size:12px;color:var(--ink-2);font-weight:800;white-space:nowrap}
  .prog b{color:var(--ink);font-size:13px}
  .pbar{height:7px;width:190px;border-radius:99px;background:#DDE6E6;overflow:hidden;margin-top:5px}
  .pbar i{display:block;height:100%;background:var(--green);border-radius:99px}

  /* One column. The case study belongs to this question alone, and its own
     instructions say "use the case study below", so it sits below them, inline,
     the way the app renders it. A side panel would make that sentence false on
     every screen wide enough to show one. */
  .work{display:block}
  .qcard{background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:20px 24px;
         max-width:780px;margin:0 auto}

  .exam-qhead{font-family:var(--disp);font-weight:700;font-size:12.5px;color:var(--ink-3);margin-bottom:8px;
              display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .marks{color:var(--ink-2)}
  .fmt{background:var(--blue-soft);color:var(--blue-dk);border-radius:6px;padding:1px 7px;font-size:10.5px;letter-spacing:.02em}
  /* The question's own instructions, authored and verbatim. Before state 13 they
     rendered nowhere (UX-TEST-10). */
  .instr{font-size:14.5px;font-weight:600;color:var(--ink-2);line-height:1.6;max-width:62ch;margin-bottom:12px}

  /* The case study, in the family's source surface. */
  .case{background:var(--card);border:1.5px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:16px}
  .case figcaption{padding:11px 16px;border-bottom:1px solid var(--line);background:#FAFCFC;
                   font-family:var(--disp);font-weight:600;font-size:13.5px}
  .case .body{padding:14px 16px 16px;font-size:14.5px;font-weight:500;line-height:1.75;color:var(--ink)}
  .case img{display:block;width:100%;max-width:420px;height:auto;margin-top:12px;border:1px solid var(--line);border-radius:8px}
  /* Collapsed once marked. A native <details>, like the response below it. */
  details.case>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;
                       padding:11px 16px;background:#FAFCFC;font-family:var(--disp);font-weight:600;font-size:13.5px}
  details.case>summary::-webkit-details-marker{display:none}
  details.case>summary:focus-visible{outline:2px solid var(--green-dk);outline-offset:2px;border-radius:14px}
  details.case .act{margin-left:auto;font-weight:700;font-size:12.5px;color:var(--green-dk)}
  details.case .act::after{content:"View case study"}
  details.case[open] .act::after{content:"Hide case study"}
  details.case[open]>summary{border-bottom:1px solid var(--line)}
  h1.exam-prompt{font-size:17px;font-weight:600;color:var(--ink);line-height:1.5;margin-bottom:16px}

  /* THE SUBMITTED RESPONSE HAS TWO PRESENTATION STATES, as in state 12: the
     field while answering, a compact line the student can open once marked. */
  .submitted{max-width:62ch;background:#FCFDFD;border:1.5px solid var(--line);border-radius:14px}
  .submitted>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;
                     padding:13px 18px;font-size:13.5px;font-weight:700;color:var(--ink-2)}
  .submitted>summary::-webkit-details-marker{display:none}
  .submitted>summary:focus-visible{outline:2px solid var(--green-dk);outline-offset:2px;border-radius:14px}
  .submitted .nm{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink)}
  .submitted .act{margin-left:auto;font-family:var(--disp);font-weight:700;font-size:12.5px;color:var(--green-dk)}
  .submitted .act::after{content:"View response"}
  .submitted[open] .act::after{content:"Hide response"}
  /* A report's structure is its line breaks, and they are kept exactly as typed.
     Nothing is promoted to a heading: a short line is not a heading because it
     looks like one, and inferring structure the student did not mark up would be
     the page writing their report for them. */
  .response{border-top:1px solid var(--line);padding:14px 18px 17px;
            font-size:15px;line-height:1.75;font-weight:400;color:var(--ink)}
  .response p{white-space:pre-line}
  .response p+p{margin-top:12px}
  .answerbox{width:100%;max-width:62ch;font:inherit;font-size:15px;font-weight:400;line-height:1.75;color:var(--ink);
             background:var(--card);border:2px solid var(--line);border-radius:14px;padding:14px 18px;
             min-height:320px;resize:vertical}
  .answerbox:focus{outline:none;border-color:var(--green-dk);box-shadow:0 0 0 3px var(--green-soft)}
  .saved{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink-3);font-weight:700;margin-top:8px}
  .saved .tick{color:var(--green-dk)}

  .result{display:inline-flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:14px;padding:11px 15px;
          border:1.5px solid #FFE0A6;border-radius:14px;background:var(--gold-soft)}
  .result .badge{display:inline-flex;align-items:center;font-family:var(--disp);font-weight:600;font-size:14.5px;
                 border-radius:99px;padding:5px 14px;background:#fff;color:var(--gold-dk);box-shadow:0 0 0 1.5px #FFE0A6 inset}
  .pair{display:flex;flex-direction:column}
  .pair .k{font-size:11px;font-weight:800;color:var(--ink-3)}
  .pair .v{font-family:var(--disp);font-weight:600;font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums}
  .mnote{margin-top:13px;font-size:14.5px;font-weight:400;line-height:1.7;color:var(--ink);max-width:62ch}
  .mnote .who{display:block;font-family:var(--disp);font-size:11.5px;font-weight:700;color:var(--ink-3);margin-bottom:4px}

  .submitrow{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:18px}
  .btn{font-family:var(--disp);font-weight:600;font-size:15px;color:#fff;background:var(--green-dk);border:none;
       border-radius:14px;padding:12px 24px;box-shadow:0 4px 0 var(--green-edge)}
  .btn:active{transform:translateY(2px);box-shadow:0 2px 0 var(--green-edge)}
  .btn.sm.ghost{background:var(--card);color:var(--ink);box-shadow:0 0 0 2px var(--line) inset;
                padding:9px 17px;font-size:14px;border-radius:12px}

  /* Three independent layers. A criterion owns its name and the line the marker
     returned for it. The question's marking points are what the marker was told
     to look for, and carry no verdict, because the marker returns none. An
     observation owns the student's own sentence where one was located. None of
     the three is filed under another, because the payload links none of them. */
  .sect{margin-top:26px;padding-top:17px;border-top:1px solid var(--line)}
  h2.secth{font-size:14.5px;color:var(--ink);margin-bottom:3px}
  .sect .lede{font-size:12.5px;color:var(--ink-3);font-weight:600;margin-bottom:12px;max-width:62ch}
  .crits{list-style:none}
  .crit{padding:13px 0;border-top:1px solid var(--line)}
  .crit:first-child{border-top:none;padding-top:4px}
  h3.critn{font-size:14px;color:var(--ink);margin-bottom:5px}
  .crit p{font-size:14.5px;font-weight:400;line-height:1.65;color:var(--ink-2);max-width:62ch}
  /* An ordered list with its own numbers, because the order is the author's and
     the marker was given them in it. */
  .told{padding-left:22px;max-width:62ch}
  .told li{font-size:14.5px;font-weight:400;line-height:1.65;color:var(--ink);padding:5px 0 5px 4px}
  .told li::marker{font-family:var(--disp);font-weight:600;color:var(--ink-2)}

  .obs{list-style:none}
  .ob{padding:15px 0;border-top:1px solid var(--line)}
  .ob:first-child{border-top:none;padding-top:4px}
  h4.obh{font-size:14px;color:var(--ink);margin-bottom:6px}
  .ob p{font-size:14.5px;font-weight:400;line-height:1.7;color:var(--ink);max-width:62ch}
  .ev{margin:2px 0 9px;background:#F4F9F8;border:1px solid var(--line);border-radius:9px;padding:11px 15px;max-width:62ch}
  .ev .lbl{font-family:var(--disp);font-weight:600;font-size:11.5px;color:var(--ink-2);margin-bottom:5px}
  .ev q{display:block;font-size:15px;font-weight:400;line-height:1.65;color:var(--ink);
        border-left:2px solid #9FE3C4;padding-left:12px;quotes:'\\201C' '\\201D'}
  .acrossl{font-family:var(--disp);font-weight:600;font-size:11.5px;color:var(--ink-2);margin-bottom:6px}

  /* THE SHARED SITTING-SHELL FOOTER. Navigation is always available, so a
     question may be left and returned to.

     This block is byte-identical in every Test Mode mockup and in every generator
     that emits one, and tests/t34.mjs holds it that way. It had already drifted:
     the state 12 pages were missing the hover state and the note below it. */
  .footer{position:sticky;bottom:0;background:var(--card);border-top:1px solid var(--line);z-index:9;
          box-shadow:0 -6px 18px rgba(60,74,74,.05)}
  .footin{max-width:1180px;margin:0 auto;padding:11px clamp(16px,4vw,40px);display:flex;align-items:center;gap:12px}
  /* gap:0, and the space before "for revisit" is a non-breaking one, for a
     reason worth writing down.

     This rule said gap:7px and never applied it: the label was a single text
     node, a flex gap needs two items, and the space between the flag and its
     word was just the space in the text. Splitting the label so a narrow screen
     can drop its tail gave the rule a second item, the 7px woke up, and the
     button silently grew from 152.22px to 155px. A flex container also STRIPS
     whitespace at the edges of its items, so moving the ordinary space to
     either side of the span does not help: that measures 148px. gap:4px gets to
     151.70, which is half a pixel short and pins a layout to one font's space
     width. A non-breaking space is not whitespace to collapse, so it survives
     inside the item and renders the run the button always rendered: 152.23px
     wide, and 76px when the tail is dropped. */
  .flag{display:flex;align-items:center;gap:0;font-family:var(--disp);font-weight:700;font-size:13px;color:var(--ink-2);
        background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:8px 13px}
  .flag:hover{border-color:var(--gold);color:var(--gold-dk)}
  /* "Item" is SEQUENCE POSITION. It is deliberately not the word "question",
     because the question on screen may be a part - 11(c) - while the item it
     occupies in the paper is 13. */
  .where{font-size:12px;color:var(--ink-3);font-weight:800;text-align:center;flex:1}

  /* NARROW MOBILE: ONE COMPACT ROW (UX-TEST-06).

     Measured rather than guessed, with the page's own fonts loaded. The
     four-column footer wraps at every width below 660px and stands 119px tall at
     390px against 63px at desktop, which is 14% of an 844px screen, starting at
     y=725. On the extended response that put it over the marker's judgement, the
     paragraph directly under the mark. (An earlier measurement with the web fonts
     blocked put the mark itself under it; with Fredoka and Nunito loaded the mark
     clears and the judgement does not.) It is a shared-shell fault and it
     affected every marked format. The breakpoint is 640 because that is where the
     wrapping stops, not because it looks like a phone.

     WHAT GOES. The item counter, and the trailing half of each label. Neither
     leaves the page: the paper bar above carries the section and the completion
     count, and the Questions navigator carries the sequence position on the
     current item, with aria-current and "you are here - item 13 of 20" on it.
     The counter is hidden at this width, not deleted, so the vocabularies stay
     distinct - completion in the bar, sequence position in the navigator.

     WHAT STAYS. All three actions, 44px tall at this width. At desktop they are
     40px and the flag 39px, under the 44px touch target; a narrow screen is where
     a thumb uses them, so that is where they reach it.

     HOW TALL IT IS. 1.5px above and below the 44px targets, plus the 1px top
     border: 48px. It was 9px each side, 63px, and at 390x844 that put the footer
     14px over "15 of 20" on the business report, measured with the real fonts.
     At 48px the score's line ends at 794.94 and the footer starts at 796; at 49px
     the margin was 0.06px, which is not a margin. The targets did not shrink;
     only the chrome around them did. */
  @media(max-width:640px){
    .footin{gap:8px;padding:1.5px 12px;justify-content:space-between}
    .footin .where{display:none}
    .foot-lbl{display:none}
    .footin .btn.sm,.footin .flag{min-height:44px;padding-left:14px;padding-right:14px;
                                  display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
  }
  @media(max-width:900px){ .qcard{max-width:none} }
</style>
</head>
<body>

<header>
  <div class="brand"><span class="mk"></span>Marginal</div>
  <div class="unit"><b>Business Studies</b>Test mode</div>
</header>

<main>
  <div class="exam-bar">
    <button class="x" title="Leave">←</button>
    <div class="paper">
      <div class="nm">Business Studies practice paper</div>
      <div class="sec">${esc(sec.name)} · Q${esc(q.number)} · ${q.marks} marks</div>
    </div>
    <div class="spacer"></div>
    <span class="policy"><span class="dot"></span>Practice · marked as you go</span>
    <button class="navbtn"><span class="grid">${'<i class="on"></i>'.repeat(9)}</span>Questions</button>
    <div class="prog"><b>${marked ? 19 : 18}</b> of 20 answered<span class="score"> · <b>${marked ? 47 + r.score : 47}</b>/90 marks</span><div class="pbar"><i style="width:${marked ? 95 : 90}%"></i></div></div>
  </div>

  <div class="work">
    <div class="qcard">
      <div class="exam-qhead">
        <span>Question ${esc(q.number)}</span><span class="marks">· ${q.marks} marks</span>
        <span class="fmt">business report · ${esc(q.directive)}</span>
      </div>
      <p class="instr">${esc(q.instructions)}</p>
      ${caseBlock(marked)}
      <h1 class="exam-prompt">${esc(q.prompt)}</h1>

      ${responseBlock(marked)}
${marked ? `
      <div class="result">
        <span class="badge">${esc(mood)}</span>
        <span class="pair"><span class="k">Marks</span><span class="v">${r.score} of ${r.max}</span></span>
      </div>
      <p class="mnote"><span class="who">Marked against Business Studies criteria</span>${esc(r.overall.summary)}</p>

      <div class="submitrow"><button class="btn">Try again</button></div>

      <section class="sect">
        <h2 class="secth">How this was marked</h2>
        <p class="lede">The four criteria your response was judged against, in the order the Business Studies course sets them.</p>
        <ol class="crits">
${r.rubric.map(c => `          <li class="crit">
            <h3 class="critn">${esc(c.name)}</h3>
            <p>${esc(c.descriptor)}</p>
          </li>`).join("\n")}
        </ol>
      </section>

      <section class="sect">
        <h2 class="secth">What your marker was told to look for</h2>
        <p class="lede">This question's own instructions and marking points, sent to the marker with your response and the case study. It did not score them one by one, so nothing here is ticked or crossed.</p>
        <ol class="told">
${rg.items.map(x => `          <li>${esc(x)}</li>`).join("\n")}
        </ol>
      </section>

      <section class="sect">
        <h2 class="secth">What the marker noticed</h2>
        <p class="lede">Where the marker could point at the sentence it meant, your own words are shown. Where it could not, the observation is about the response as a whole.</p>
        <ol class="obs">
${anchored.map(o => `          <li class="ob">
            <h4 class="obh">${esc(o.head)}</h4>
            <div class="ev"><div class="lbl">In your response</div><q>${esc(o.quote)}</q></div>
            <p>${esc(o.why)}</p>
          </li>`).join("\n")}
${across.map(o => `          <li class="ob">
            <h4 class="obh">${esc(o.head)}</h4>
            <div class="acrossl">Across your response</div>
            <p>${esc(o.why)}</p>
          </li>`).join("\n")}
        </ol>
      </section>` : `
      <div class="submitrow"><button class="btn">Submit for marking</button></div>`}
    </div>
  </div>
</main>

<div class="footer">
  <div class="footin">
    <button class="btn sm ghost">← Previous<span class="foot-lbl"> · 13</span></button>
    <button class="flag">⚑ Flag<span class="foot-lbl">&nbsp;for revisit</span></button>
    <span class="where">Item 19 of 20 · Section III</span>
    <button class="btn sm ghost">Next<span class="foot-lbl"> · Section IV</span> →</button>
  </div>
</div>

</body>
</html>
`;
fs.writeFileSync(path.join(OUTDIR, "13-business-report.html"), page(true));
fs.writeFileSync(path.join(OUTDIR, "13-business-report-answering.html"), page(false));
report.bars = bars.length; report.alt = ALT;
report.words = WORDS;
console.log(JSON.stringify(report, null, 1));
