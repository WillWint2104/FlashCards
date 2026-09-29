// THE MARKED RESULT CLEARS THE STICKY FOOTER, MEASURED WITH THE FONTS A STUDENT GETS.
//
// The permanent invariant behind UX-TEST-06 and UX-TEST-14. Every other suite
// renders these pages in a fallback face, which is wider than Nunito and breaks
// lines earlier, and every fold number taken that way in this project was wrong.
// This one serves Fredoka and Nunito from tests/fontcache.js and refuses to report
// a single number unless both are proven loaded as FontFace objects.
//
// What is asserted, on every marked Test Mode page:
//
//   at 390x844  the score is fully on the first screen, clear of the footer;
//   everywhere  the score is never PARTLY behind the footer - on screen or off it,
//               not cut in half, which is what UX-TEST-14 showed;
//   everywhere  the whole result card clears the footer once scrolled to;
//   narrow      the footer is one row of 48px at most, with 44px targets;
//   wide        the footer is the 63px row that was signed off.
const { chromium, ROOT } = require('./env');
const { serveFonts, fontsLoaded } = require('./fontcache');
const path = require('path');
const url = f => 'file://' + path.join(ROOT, f).split(path.sep).join('/');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

const MARKED = ['11-short-answer', '11-short-answer-keypoints', '12-extended-response', '13-business-report',
  '14-calculation-checked-correct', '14-calculation-checked-notquite', '14-worked-solution']
  .map(n => 'docs/mockups/' + n + '.html');
const SIZES = [[390, 844, 'narrow'], [375, 667, 'narrow'], [430, 932, 'narrow'], [834, 1112, 'wide'], [1280, 800, 'wide']];

(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const f of MARKED) {
    const nm = path.basename(f, '.html');
    // One page per file, resized in place, so the fonts load once and cannot
    // arrive at one size and not another.
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    p.on('pageerror', e => errs.push(nm + ': ' + String(e).slice(0, 160)));
    await serveFonts(p);
    await p.goto(url(f));
    const loaded = await fontsLoaded(p);
    ok(loaded, `${nm}: Fredoka and Nunito are loaded, so what follows is what a student sees`);
    if (!loaded) { await p.close(); continue; }
    console.log('--- ' + nm);
    for (const [w, h, kind] of SIZES) {
      await p.setViewportSize({ width: w, height: h });
      await p.evaluate(() => { window.scrollTo(0, 0); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
      const r = await p.evaluate(() => {
        const ft = document.querySelector('div.footer').getBoundingClientRect();
        const el = document.querySelector('.result');
        const score = el.querySelector('.v') || el;
        const rg = document.createRange(); rg.selectNodeContents(score);
        const s = rg.getBoundingClientRect();
        return { fh: ft.height, ft: ft.top, s: [s.top, s.bottom], ih: innerHeight,
                 acts: [...document.querySelectorAll('.footin button')].map(a => a.getBoundingClientRect().height),
                 ow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      const tag = `${nm} ${w}x${h}`;
      console.log(`    ${(w + 'x' + h).padEnd(9)} footer ${r.fh}px at ${r.ft}, score ${r.s[0].toFixed(1)}-${r.s[1].toFixed(1)}`);
      if (w === 390 && h === 844)
        ok(r.s[1] <= r.ft, `${tag}: the score is on the first screen, clear of the footer (${r.s[1].toFixed(2)} <= ${r.ft})`);
      ok(r.s[1] <= r.ft || r.s[0] >= r.ft, `${tag}: the score is never partly behind the footer`);
      if (kind === 'narrow') {
        ok(r.fh <= 48.5, `${tag}: the footer is one compact row of 48px (${r.fh})`);
        ok(r.acts.length === 3 && r.acts.every(a => a >= 44), `${tag}: with three 44px targets (${r.acts.join('/')})`);
      } else {
        ok(Math.abs(r.fh - 63) <= 1, `${tag}: the wide footer is the 63px row that was signed off (${r.fh})`);
      }
      ok(!r.ow, `${tag}: no horizontal overflow`);
      const scrolled = await p.evaluate(() => {
        const el = document.querySelector('.result'); el.scrollIntoView({ block: 'center' });
        return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res(
          el.getBoundingClientRect().bottom <= document.querySelector('div.footer').getBoundingClientRect().top))));
      });
      ok(scrolled, `${tag}: and the whole result card clears the footer once scrolled to`);
    }
    await p.close();
  }
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
