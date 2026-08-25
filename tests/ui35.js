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
  return true;
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

    if (await openTool(p, WORST, 'understand')) {
      for (const stage of ['collapsed', 'read more open']) {
        if (stage === 'read more open') {
          const rm = await p.$('#esmoreread');
          if (!rm) { console.log('    no Read more on this entry'); break; }
          await rm.click(); await p.waitForTimeout(320);
        }
        const g = await geom(p);
        console.log(`    worst, ${stage}: ${g.words} words, drawer ${g.drawer.top}-${g.drawer.bottom} in ${g.vh}px`);
        ok(g.drawer.bottom <= g.vh, `${at} ${stage}: the drawer ends on screen: ${g.drawer.bottom} <= ${g.vh}`);
        ok(g.drawer.top >= 0, `${at} ${stage}: the drawer starts on screen: ${g.drawer.top}`);
        ok(g.foot.bottom <= g.vh && g.foot.top >= 0,
          `${at} ${stage}: the footer is readable without scrolling the page: ${g.foot.top}-${g.foot.bottom} in ${g.vh}`);
        ok(g.scrollH > g.clientH, `${at} ${stage}: the long entry scrolls inside the body rather than overflowing it`);
        ok(g.foot.bottom <= g.drawer.bottom + 1, `${at} ${stage}: the footer is inside the drawer, not below it`);
        ok(await reachLast(p) === 'reachable', `${at} ${stage}: the last control can be pressed: ${await reachLast(p)}`);
      }
    } else ok(false, `${at}: Learn opened on the worst-case entry`);

    if (await openTool(p, SHORT, 'understand')) {
      const g = await geom(p);
      console.log(`    short: ${g.words} words, drawer ${g.drawer.top}-${g.drawer.bottom} in ${g.vh}px`);
      ok(g.drawer.bottom <= g.vh, `${at} short: the drawer ends on screen: ${g.drawer.bottom} <= ${g.vh}`);
      ok(g.foot.bottom <= g.vh && g.foot.top >= 0, `${at} short: the footer is on screen`);
      ok(await reachLast(p) === 'reachable', `${at} short: the last control can be pressed: ${await reachLast(p)}`);
      // In the three-column layout the drawer is sized by its content. A scrollbar
      // is correct only once it has run out of room: on a short screen even a
      // short entry can exceed what is left below the question and the toolbelt.
      const fixed = await p.$eval('.es-drawer', e => getComputedStyle(e).position === 'fixed');
      if (!fixed) {
        const atCap = g.drawer.bottom >= g.vh - 20;
        ok(g.scrollH <= g.clientH + 1 || atCap,
          `${at} short: a scrollbar only once the drawer is out of room: ${g.scrollH} into ${g.clientH}, at cap ${atCap}`);
        ok(g.drawer.h <= g.vh - g.drawer.top,
          `${at} short: the drawer is never taller than the room it has: ${g.drawer.h} in ${g.vh - g.drawer.top}`);
        if (!atCap) ok(g.foot.bottom <= g.drawer.bottom + 1 && g.drawer.bottom - g.foot.bottom < 8,
          `${at} short: no dead space under the footer: ${g.drawer.bottom - g.foot.bottom}px`);
      }
    } else ok(false, `${at}: Learn opened on the short entry`);
    await ctx.close();
  }
  console.log('pageerrors:', errs.length ? errs : 'none');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
