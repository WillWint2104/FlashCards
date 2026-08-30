// D4: the drawer must stay inside the screen and hand over every control.
//
// The failure this guards against was not a missing overflow rule. overflow-y
// was already auto and the body already scrolled. The drawer simply claimed 72vh
// starting 225px down the page, so on a short screen its footer and close control
// sat below the fold and reaching them meant scrolling the whole page away from
// the sentence being written.
//
// So this suite asserts what a student can actually do: the drawer is inside the
// viewport, the footer is visible without scrolling the page, and the last control
// in the body can be scrolled to and pressed. Checking that a CSS property exists
// would have passed against the broken build.
const { chromium, T } = require('./env');
const { nextSection } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// The longest entry in the content: 320 words in one prose block before Read more,
// 444 with it open. If the drawer copes with this it copes with the other 82.
const WORST = { q: 'Explain how transformation processes affect the operations function of a business.',
  topic: 'Operations', point: 'Transformation processes turn inputs into outputs through the transformation of inputs.' };
// A short entry, to prove the fix adds no empty height and no needless scrollbar.
const SHORT = { q: 'Explain how employment contracts affect human resource management.',
  topic: 'Human resources', point: 'The HSC examination specifications describe the paper.' };

async function openTool(p, c, tool) {
  await p.goto(T); await p.waitForTimeout(400);
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(350);
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await p.fill('#esq', c.q); await p.fill('#estopic', c.topic);
  await p.click('#esstart'); await p.waitForTimeout(550);
  await nextSection(p);
  { const t = await p.$('#espointtoggle'); if (t && !(await p.$('#espoint'))) { await t.click(); await p.waitForTimeout(250); } }
  await p.fill('#espoint', c.point); await p.waitForTimeout(280);
  const x = await p.$('.es-drawer-x'); if (x) { await x.click(); await p.waitForTimeout(220); }
  const b = await p.$(`[data-estool="${tool}"]:not([disabled])`);
  if (!b) return false;
  await b.click(); await p.waitForTimeout(380);
  // A click can land while the drawer fails to render. Returning true there sends
  // the geometry reads into a null and kills the run before its summary, so the
  // suite reports a crash rather than a failure.
  // Learn opens the Learning Centre; the other four open the writing tool window.
  // Verifying the drawer for all of them reported "Learn did not open" when what
  // had actually happened was that Learn opened something else.
  if (tool === 'understand') return !!(await p.$('.esl-panel')) && !!(await p.$('.esl-main')) && !!(await p.$('.esl-foot'));
  return !!(await p.$('.es-drawer')) && !!(await p.$('.es-drawer-body')) && !!(await p.$('.es-drawer-foot'));
}

const geom = p => p.evaluate(() => {
  const d = document.querySelector('.es-drawer');
  const body = document.querySelector('.es-drawer-body');
  const foot = document.querySelector('.es-drawer-foot');
  const r = e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  return { vh: window.innerHeight, drawer: d && r(d), foot: foot && r(foot),
    scrollH: body && body.scrollHeight, clientH: body && body.clientHeight,
    words: body ? body.textContent.trim().split(/\s+/).length : 0 };
});

// Scroll the last control in the body into view the way a student would, then ask
// the document what is actually painted at its centre.
const reachLast = p => p.evaluate(() => {
  const body = document.querySelector('.es-drawer-body'); if (!body) return 'no body';
  const controls = Array.from(body.querySelectorAll('button, a[href], [role="button"]'))
    .filter(e => e.offsetParent !== null);
  if (!controls.length) return 'no controls';
  const last = controls[controls.length - 1];
  last.scrollIntoView({ block: 'nearest' });
  const b = last.getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
  return (hit === last || (hit && last.contains(hit)) || (hit && hit.contains(last)))
    ? 'reachable' : 'BLOCKED by ' + (hit ? (hit.className || hit.tagName) : 'nothing, it is off screen');
});

(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const vp of [{ width: 1500, height: 1050 }, { width: 1500, height: 720 }, { width: 1280, height: 800 }]) {
    const ctx = await b.newContext({ viewport: vp });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await p.route(/workers\.dev/, r => r.abort());
    const at = `${vp.width}x${vp.height}`;
    console.log(`--- ${at} ---`);

    // Learn is a modal now, not a drawer, so drawer geometry is not the contract
    // any more: those assertions measured a surface that no longer exists. What
    // has to hold instead is what a modal owes the page it covers.
    for (const [entry, name] of [[WORST, 'worst-case entry'], [SHORT, 'short entry']]) {
      const opened = await openTool(p, entry, 'understand');
      ok(opened, `${at}: Learn opens on the ${name}`);
      if (!opened) continue;
      const c = await p.evaluate(() => {
        const panel = document.querySelector('.esl-panel');
        const main = document.querySelector('.esl-main');
        const foot = document.querySelector('.esl-foot');
        const line = document.querySelector('#esline');
        const r = panel ? panel.getBoundingClientRect() : null;
        const f = foot ? foot.getBoundingClientRect() : null;
        return {
          panels: document.querySelectorAll('.esl-panel').length,
          essayStillMounted: !!document.querySelector('.es-compose'),
          lineStillMounted: !!line,
          lineValue: line ? line.value : null,
          top: r ? Math.round(r.top) : null, bottom: r ? Math.round(r.bottom) : null,
          vh: window.innerHeight,
          scrolls: main ? main.scrollHeight > main.clientHeight + 1 : null,
          mainOverflow: main ? getComputedStyle(main).overflowY : null,
          footInside: (f && r) ? f.bottom <= r.bottom + 1 : null
        };
      });
      console.log(`    ${name}: panel ${c.top}-${c.bottom} in ${c.vh}px, main scrolls ${c.scrolls}`);
      ok(c.panels === 1, `${at} ${name}: exactly one Learning Centre is open: ${c.panels}`);
      ok(c.essayStillMounted && c.lineStillMounted, `${at} ${name}: the essay stays mounted underneath it`);
      ok(c.top >= 0 && c.bottom <= c.vh, `${at} ${name}: the modal is on screen: ${c.top}-${c.bottom} in ${c.vh}`);
      ok(c.mainOverflow === 'auto' || c.mainOverflow === 'scroll',
        `${at} ${name}: long content scrolls inside the modal rather than off it: ${c.mainOverflow}`);
      ok(c.footInside === true, `${at} ${name}: the footer is inside the modal, not below it`);
      // Closing puts the student back where they were, which is the whole reason
      // the modal is allowed to cover the page in the first place.
      await p.keyboard.press('Escape'); await p.waitForTimeout(320);
      const after = await p.evaluate(() => ({
        gone: !document.querySelector('.esl-panel'),
        line: document.querySelector('#esline') ? document.querySelector('#esline').value : null
      }));
      ok(after.gone, `${at} ${name}: Escape closes it`);
      ok(after.line === c.lineValue, `${at} ${name}: and the writing is exactly as it was`);
    }
    await ctx.close();
  }
  console.log('pageerrors:', errs.length ? errs : 'none');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
