// THE DISCLOSURE, MEASURED IN A BROWSER RATHER THAN READ OUT OF THE MARKUP.
//
// tests/t33.mjs reads the two generated pages as text: it can see that the
// marked state wraps the response in <details class="submitted"> with no `open`
// attribute, and that the answering state does not. What it cannot see is
// whether that markup RENDERS as a collapsed response, whether the mark it
// exists to lift is actually above the fold once it does, or whether opening it
// hands back a field. A closed <details> that some later stylesheet forces open,
// or a summary that nothing can click, would pass t33 without complaint.
//
// So this suite opens both pages and measures. The reason the disclosure exists
// is a number - "14 of 20" sat below the fold at every size except a tall
// desktop, because the whole 176-word response was above it - and a number is
// what should be guarding it.
const { chromium, ROOT } = require('./env');
const path = require('path');
const url = f => 'file://' + path.join(ROOT, f).split(path.sep).join('/');
const MARKED = url('docs/mockups/12-extended-response.html');
const ANSWERING = url('docs/mockups/12-extended-response-answering.html');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
// This page fetches nothing and has no script: the effect of a click is present
// on the next frame, so settled() is that frame rather than a guess at a delay.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// WHAT "RENDERS NOTHING" ACTUALLY MEANS, and it is not what a bounding box says.
//
// Chromium lays a closed <details>'s contents out and then skips them with
// content-visibility:hidden, so the panel still reports a 488px box while the
// disclosure itself is 50px tall. getClientRects() therefore answers yes to a
// response no one can see - this suite asserted exactly that and was wrong about
// it. checkVisibility() and innerText are the two that answer the question a
// student would ask: is the text on the screen, and is it in the page's text.
const shows = (p, sel) => p.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) return false;
  return e.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })
    && e.innerText.trim().length > 0;
}, sel);
// The prose itself, looked for in what the page renders as text.
const OPENING = 'Northline Sportswear set a marketing objective';
const textHas = (p, n) => p.evaluate(s => document.body.innerText.includes(s), n);
const boxOf = (p, sel) => p.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, height: r.height };
}, sel);
// THE FOLD IS NOT window.innerHeight, AND ASSUMING IT WAS PASSED A FALSE CLAIM.
//
// This shell has a sticky header and a sticky footer, both painted over the
// page. Measured against innerHeight alone, "14 of 20" cleared the fold on a
// 390px phone - and the capture shows it sitting UNDER the footer, which at that
// width wraps to four lines and takes 119px of an 844px screen. The last usable
// row of content is where the footer starts, so that is what clear() compares
// against, and the header's bottom is the first.
const clear = (p, sel) => p.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) return false;
  const r = e.getBoundingClientRect();
  const f = document.querySelector('div.footer').getBoundingClientRect();
  const h = document.querySelector('header').getBoundingClientRect();
  return r.top >= h.bottom && r.bottom <= f.top;
}, sel);
const foldOf = p => p.evaluate(() => ({
  ih: window.innerHeight,
  footerTop: Math.round(document.querySelector('div.footer').getBoundingClientRect().top),
  headerBottom: Math.round(document.querySelector('header').getBoundingClientRect().bottom),
}));

(async () => {
  const b = await chromium.launch();
  const errs = [];

  // Desktop and phone, because the fold is the reason the disclosure exists and
  // it sits in a different place on each.
  for (const [name, w, h] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    p.on('pageerror', e => errs.push(name + ': ' + String(e).slice(0, 200)));
    await p.goto(MARKED); await settled(p);

    console.log(`--- marked, ${name} ${w}x${h} ---`);
    ok(!(await p.$eval('details.submitted', e => e.open)),
       `${name}: the response is collapsed on arrival`);
    ok(!(await shows(p, '.submitted .response')),
       `${name}: and its prose renders nothing at all`);
    ok(!(await textHas(p, OPENING)),
       `${name}: the response is not in the page's text either`);
    ok((await boxOf(p, 'details.submitted')).height < 80,
       `${name}: the disclosure is one line tall, not a response with a lid on it`);

    // The point of the whole change. The mark and the marker's judgement are
    // what a student who has just submitted is looking for, and they were under
    // the fold behind their own answer.
    const fold = await foldOf(p);
    console.log(`    fold: header ends ${fold.headerBottom}, footer starts ${fold.footerTop} of ${fold.ih}`,
                `| mark ${JSON.stringify(await boxOf(p, '.result'))}`,
                `| judgement top ${(await boxOf(p, '.mnote')).top}`);

    if (name === 'desktop') {
      // What the collapse was for. Both were under the fold in draft 2 because
      // the whole 176-word response was above them.
      ok(await clear(p, '.result'), 'desktop: the mark is on the first screen, clear of both bars');
      ok(await clear(p, '.mnote'), "desktop: and so is the marker's judgement, whole");
    } else {
      // AND WHAT IT DID NOT FIX, asserted as the measurement rather than as the
      // claim I wanted to make. At 390x844 the footer starts at 725 and the mark
      // spans 718 to 786, so the mark is BEHIND THE FOOTER and the judgement is
      // off-screen entirely. The cause is the footer, which wraps to four lines
      // at this width: at 430x932 the same page clears the mark comfortably.
      // That is a finding against the frozen sitting shell and it is reported
      // rather than fixed here.
      ok(!(await clear(p, '.result')),
         'mobile: the mark is NOT clear of the footer at 390px, which is the open finding');
      // The guard that still means something: a regression that put the response
      // back above the mark would move it from 718 to past 1100.
      ok((await boxOf(p, '.result')).top < 800,
         'mobile: but the mark is still near the top of the page, not below the response');
    }

    // Opening it is a click on the summary, which is what the affordance says.
    const before = (await boxOf(p, '.qcard')).height;
    await p.click('details.submitted > summary'); await settled(p);
    ok(await p.$eval('details.submitted', e => e.open), `${name}: clicking the line opens it`);
    ok(await shows(p, '.submitted .response'), `${name}: and the response is there to read`);
    ok(await textHas(p, OPENING), `${name}: with the submitted prose in it`);
    ok((await boxOf(p, '.qcard')).height > before + 100,
       `${name}: the card grew by the response, so nothing was hidden behind a scrollbar`);

    // WHAT IT MUST NOT BECOME. A submitted response reopened as a live field is
    // worse than either state: there is nowhere for an edit to go.
    const fields = await p.evaluate(() => ({
      textarea: document.querySelectorAll('textarea').length,
      input: document.querySelectorAll('input').length,
      editable: document.querySelectorAll('[contenteditable]:not([contenteditable="false"])').length,
    }));
    ok(fields.textarea === 0 && fields.input === 0 && fields.editable === 0,
       `${name}: the opened response is prose, not a field: ` + JSON.stringify(fields));

    // Reachable without a mouse, which a native <details> is and a div wired to
    // a click handler is not.
    await p.keyboard.press('Enter'); await settled(p);
    ok(!(await p.$eval('details.submitted', e => e.open)),
       `${name}: and the keyboard closes it again, because the summary holds focus`);

    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
       `${name}: no horizontal overflow`);
    await p.screenshot({ path: require('./env').OUT + `shot-12-marked-${name}.png`, fullPage: true });
    await p.close();
  }

  // The other presentation state of the same question. There is nothing
  // submitted yet, so there is nothing to collapse, and the field is the point.
  console.log('--- answering ---');
  const p2 = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  p2.on('pageerror', e => errs.push('answering: ' + String(e).slice(0, 200)));
  await p2.goto(ANSWERING); await settled(p2);
  ok(!(await p2.$('details.submitted')), 'answering: no disclosure, because nothing is submitted');
  ok((await p2.$$('textarea')).length === 1, 'answering: exactly one place to write');
  ok(!(await p2.$('.result')) && !(await p2.$('.mnote')), 'answering: no mark and no judgement yet');
  await p2.close();

  console.log('pageerrors:', errs.join(' | ') || 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
