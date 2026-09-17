// STATE 12 IS GENERATED, NOT WRITTEN.
//
// Draft 1 was hand-authored and its marker copy asserted "Figures appear once"
// about a response containing no digit. Worse, it filed verified quotations
// under named criteria on an association the payload does not carry. Both are
// impossible here: the fixture is fed to the SHIPPED finalize(), and the page is
// rendered from what comes back. A quotation appears only where snapSentences
// located the sentence; an observation appears under "Across your response" only
// where it did not; and no criterion owns either, because nothing in the payload
// says which criterion an issue belongs to.
//
//   node docs/mockups/12-extended-response.build.mjs
import { createRequire } from "node:module";
import { finalize } from "../../tests/worker.mjs";
const require = createRequire(import.meta.url);
const fs = require("node:fs"), path = require("node:path");
const HERE = path.dirname(new URL(import.meta.url).pathname);

const fx = JSON.parse(fs.readFileSync(path.join(HERE, "12-extended-response.fixture.json"), "utf8"));
const r = finalize(JSON.parse(JSON.stringify(fx.review)), fx.question.marks, fx.answer,
                   null, fx.criteria, false, "extended", null);

// ---- what the payload supports, and only that ------------------------------
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const anchored = [], across = [];
(r.paragraphs || []).forEach(p => (p.sentences || []).forEach(sn => (sn.issues || []).forEach(iss => {
  // The ONLY thing that decides which list an observation lands in.
  (sn.unplaced ? across : anchored).push({ quote: sn.text, head: iss.head, why: iss.why, unplaced: !!sn.unplaced });
})));
// A sentence the marker could not locate is the model's wording, not the
// student's, so it is never shown - only the observation made about it.
across.forEach(o => { delete o.quote; });

const ratio = r.max ? r.score / r.max : 0;
const mood = ratio >= 0.95 ? "Full marks" : ratio >= 0.6 ? "Most of it" : ratio >= 0.3 ? "Partly there" : "Not yet";

const report = {
  mark: r.score + " of " + r.max, mood,
  criteria: r.rubric.map(c => c.name),
  anchoredCount: anchored.length, acrossCount: across.length,
  everyQuoteVerbatim: anchored.every(o => fx.answer.includes(o.quote)),
  grounded: r.checks.grounded, prose: r.checks.prose,
};

const TOK = `  /* PROPOSED SHARED TEST MODE TOKENS - see docs/testmode-tokens.md.
     Nine of nine mockups fail WCAG AA on the current values, worst offenders in
     the frozen shell. Seven values move here so this draft can be judged without
     reading it through failing contrast. NOT a State 12 decision, and not
     applied to the other eight files. --green is unchanged: it stays the brand
     accent on surfaces that carry no text, and stops being a background for
     white text. */
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
const PARAS = fx.answer.split(/\n\s*\n/);

// The one thing that differs between the two states, in one place.
const responseBlock = marked => marked
  ? `<details class="submitted">
        <summary><span class="nm">Your submitted response</span><span>\u00b7 ${WORDS} words</span><span class="act"></span></summary>
        <div class="response">
${PARAS.map(p => "          <p>" + esc(p) + "</p>").join("\n")}
        </div>
      </details>
      <div class="saved"><span class="tick">\u2713</span> Submitted. You can leave and come back to this paper.</div>`
  : `<textarea class="answerbox" aria-label="Your response">${esc(fx.answer)}</textarea>
      <div class="saved"><span class="tick">\u2713</span> Saved. You can leave and come back to this paper.</div>`;

const page = marked => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Marginal — Extended response marked</title>
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
  .pbar i{display:block;height:100%;width:100%;background:var(--green);border-radius:99px}

  /* Question 15 authors no stimulus, so there is no second column. The card
     keeps a reading measure rather than running to 1100px. */
  .work{display:block}
  .qcard{background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:20px 24px;
         max-width:780px;margin:0 auto}

  .exam-qhead{font-family:var(--disp);font-weight:700;font-size:12.5px;color:var(--ink-3);margin-bottom:8px;
              display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .marks{color:var(--ink-2)}
  .fmt{background:var(--blue-soft);color:var(--blue-dk);border-radius:6px;padding:1px 7px;font-size:10.5px;letter-spacing:.02em}
  h1.exam-prompt{font-size:17px;font-weight:600;color:var(--ink);line-height:1.5;margin-bottom:16px}

  /* THE SUBMITTED RESPONSE HAS TWO PRESENTATION STATES, AND THE ORDER NEVER
     CHANGES. While answering it is the editable field. Once marked it is a
     compact line the student can open, because by then they have read it and
     what they want is the mark: rendering 190 words in full pushed 14 of 20
     below the fold at every size except a tall desktop. The response still
     comes first; it is compressed, not moved.

     A native <details>, so it is keyboard-reachable and needs no script. */
  .submitted{max-width:62ch;background:#FCFDFD;border:1.5px solid var(--line);border-radius:14px}
  .submitted>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;
                     padding:13px 18px;font-size:13.5px;font-weight:700;color:var(--ink-2)}
  .submitted>summary::-webkit-details-marker{display:none}
  .submitted>summary:focus-visible{outline:2px solid var(--green-dk);outline-offset:2px;border-radius:14px}
  .submitted .nm{font-family:var(--disp);font-weight:600;font-size:14px;color:var(--ink)}
  .submitted .act{margin-left:auto;font-family:var(--disp);font-weight:700;font-size:12.5px;color:var(--green-dk)}
  .submitted .act::after{content:"View response"}
  .submitted[open] .act::after{content:"Hide response"}
  /* Read-only prose, not a field. Nothing here can be typed into. */
  .response{border-top:1px solid var(--line);padding:14px 18px 17px;
            font-size:15px;line-height:1.75;font-weight:400;color:var(--ink)}
  .response p+p{margin-top:12px}
  /* While answering, the same slot is the field it has to be. */
  .answerbox{width:100%;max-width:62ch;font:inherit;font-size:15px;font-weight:400;line-height:1.75;color:var(--ink);
             background:var(--card);border:2px solid var(--line);border-radius:14px;padding:14px 18px;
             min-height:260px;resize:vertical}
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

  /* TWO INDEPENDENT REVIEW LAYERS, and their separation is the whole correction.
     A criterion owns its NAME and the line the marker returned for it. It does
     not own evidence, a count, or a verdict, because the payload carries no
     association between an authored criterion and a sentence, an issue or a
     paragraph. Filing a true quotation under a criterion would have made it a
     false academic attribution. */
  .sect{margin-top:26px;padding-top:17px;border-top:1px solid var(--line)}
  h2.secth{font-size:14.5px;color:var(--ink);margin-bottom:3px}
  .sect .lede{font-size:12.5px;color:var(--ink-3);font-weight:600;margin-bottom:12px;max-width:62ch}
  .crits{list-style:none}
  .crit{padding:13px 0;border-top:1px solid var(--line)}
  .crit:first-child{border-top:none;padding-top:4px}
  h3.critn{font-size:14px;color:var(--ink);margin-bottom:5px}
  .crit p{font-size:14.5px;font-weight:400;line-height:1.65;color:var(--ink-2);max-width:62ch}

  .obs{list-style:none}
  .ob{padding:15px 0;border-top:1px solid var(--line)}
  .ob:first-child{border-top:none;padding-top:4px}
  h4.obh{font-size:14px;color:var(--ink);margin-bottom:6px}
  .ob p{font-size:14.5px;font-weight:400;line-height:1.7;color:var(--ink);max-width:62ch}
  /* The one inset surface on the page, and it holds the STUDENT'S OWN WORDS -
     rendered only where snapSentences located the sentence verbatim. */
  .ev{margin:2px 0 9px;background:#F4F9F8;border:1px solid var(--line);border-radius:9px;padding:11px 15px;max-width:62ch}
  .ev .lbl{font-family:var(--disp);font-weight:600;font-size:11.5px;color:var(--ink-2);margin-bottom:5px}
  .ev q{display:block;font-size:15px;font-weight:400;line-height:1.65;color:var(--ink);
        border-left:2px solid #9FE3C4;padding-left:12px;quotes:'\\201C' '\\201D'}
  /* No surface, because there is nothing of the student's to show. */
  .acrossl{font-family:var(--disp);font-weight:600;font-size:11.5px;color:var(--ink-2);margin-bottom:6px}

  .footer{position:sticky;bottom:0;background:var(--card);border-top:1px solid var(--line);z-index:9;
          box-shadow:0 -6px 18px rgba(60,74,74,.05)}
  .footin{max-width:1180px;margin:0 auto;padding:11px clamp(16px,4vw,40px);display:flex;align-items:center;gap:12px}
  .flag{display:flex;align-items:center;gap:7px;font-family:var(--disp);font-weight:700;font-size:13px;color:var(--ink-2);
        background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:8px 13px}
  .where{font-size:12px;color:var(--ink-3);font-weight:800;text-align:center;flex:1}
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
      <div class="sec">Section IV — Extended response · Q15 or Q16 · 20 marks</div>
    </div>
    <div class="spacer"></div>
    <span class="policy"><span class="dot"></span>Practice · marked as you go</span>
    <button class="navbtn"><span class="grid">${'<i class="on"></i>'.repeat(9)}</span>Questions</button>
    <div class="prog"><b>20</b> of 20 answered<span class="score"> · <b>62</b>/90 marks</span><div class="pbar"><i></i></div></div>
  </div>

  <div class="work">
    <div class="qcard">
      <div class="exam-qhead">
        <span>Question ${esc(fx.question.number)}</span><span class="marks">· ${fx.question.marks} marks</span>
        <span class="fmt">extended response · ${esc(fx.question.directive)}</span>
      </div>
      <h1 class="exam-prompt">${esc(fx.question.prompt)}</h1>

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
    <button class="btn sm ghost">← Previous · 14</button>
    <button class="flag">⚑ Flag for revisit</button>
    <span class="where">Item 20 of 20 · Section IV</span>
    <button class="btn sm ghost">Finish paper →</button>
  </div>
</div>

</body>
</html>
`;
fs.writeFileSync(path.join(HERE, "12-extended-response.html"), page(true));
fs.writeFileSync(path.join(HERE, "12-extended-response-answering.html"), page(false));
report.words = WORDS;
console.log(JSON.stringify(report, null, 1));
