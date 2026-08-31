// The support surfaces must not depend on one another's DOM presence.
//
// Four separate defects came from that coupling: the decoder went dead when the rail
// was emptied, twice; the contextual control opened a surface that did not hold what
// it named; and the grid stayed one column because only one class was toggled. Each
// was found by a single suite that happened to use the right question, so this walks
// the combinations instead: role x mode x which support surface is open.
const { chromium, T, OUT, usePractice } = require('./env');
const { openMap } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// mkt-01 is causal and authors a decoder; hr-01 is a judgement question.
const QUESTIONS = [
  { name: 'causal, decoder authored', re: /target markets affect/, mode: 'causal' },
  { name: 'judgement', re: /the effectiveness of human resource/, mode: 'judgement' },
];

async function open(p, re) {
  await p.goto(T); await p.waitForTimeout(500);
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(650);
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(400);
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await usePractice(p); await p.$$eval('.es-qrow', (es, r) => { const t = es.find(x => new RegExp(r, 'i').test(x.textContent)); t && t.click(); }, re.source);
  await p.click('#esstart'); await p.waitForTimeout(700);
  await p.click('#esposdefer').catch(() => {});
  await p.waitForTimeout(300);
}
async function toRole(p, role) {
  if (await p.$('.es-startrow')) {
    const hit = await p.$$eval('.es-startrow', (es, r) => {
      const t = es.find(x => new RegExp(r, 'i').test(x.textContent)); if (t) { t.click(); return true; } return false; }, role);
    if (hit) { await p.waitForTimeout(600); return true; }
  }
  await openMap(p);
  const hit = await p.$$eval('.es-mapitem', (es, r) => {
    const t = es.find(x => new RegExp(r, 'i').test(x.textContent)); if (t) { t.click(); return true; } return false; }, role);
  await p.waitForTimeout(600);
  return hit;
}
// Exactly one panel, always, whatever else is on screen.
const hosts = p => p.$$eval('[data-esdecbox]', es => es.length);
const chips = p => p.$$eval('[data-esdecode],[data-esdecopen]', es => es.length);

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1050 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await p.route(/workers\.dev/, r => r.abort());

  for (const q of QUESTIONS) {
    console.log(`\n=== ${q.name} ===`);
    await open(p, q.re);
    for (const role of ['Introduction', 'Body 1', 'Conclusion']) {
      if (!(await toRole(p, role))) { console.log(`  (${role} not reachable on this question)`); continue; }
      const label = `${q.mode}/${role}`;

      // 1. at rest
      ok(await hosts(p) <= 1, `${label} at rest: never more than one decoder panel: ${await hosts(p)}`);

      // 2. with a tool open
      const tool = await p.$('[data-estool="structure"]:not([disabled])');
      if (tool) {
        await tool.click(); await p.waitForTimeout(350);
        ok(await hosts(p) <= 1, `${label} + tool: still one panel: ${await hosts(p)}`);
        const c = await chips(p);
        if (c) {
          const bound = await p.evaluate(() => {
            const btn = document.querySelector('[data-esdecode],[data-esdecopen]');
            if (!btn) return 'none'; btn.click();
            const box = document.querySelector('[data-esdecbox]');
            return box && !box.hidden ? 'opens' : 'DEAD';
          });
          ok(bound === 'opens', `${label} + tool: a highlighted question word still opens the panel: ${bound}`);
        }
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      }

      // 3. with the context panel, where the role offers one
      const cx = await p.$('#esctx');
      if (cx) {
        await cx.click(); await p.waitForTimeout(400);
        const railText = await p.$eval('.es-rest', e => e.innerText.trim()).catch(() => '');
        ok(railText.length > 0, `${label} + context: the control opens the surface it names`);
        ok(await hosts(p) <= 1, `${label} + context: still one panel: ${await hosts(p)}`);
        const gridCols = await p.$eval('.es-cols', e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
        ok(gridCols === 2, `${label} + context: the grid actually has two columns: ${gridCols}`);
        // The control selects a NAMED view. It must open the view it names, not
        // whichever surface happens to hold something plan shaped.
        const named = await p.$eval('#esctx', e => e.dataset.esctxview);
        const want = /Conclusion/i.test(role) ? 'judgement' : 'plan';
        ok(named === want, `${label} + context: the control names the view it selects: ${named}`);
        const showed = await p.$eval('.es-rest', e => e.innerText).catch(() => '');
        const proof = want === 'judgement' ? /judgement|established|paragraphs/i : /plan|signpost|argue/i;
        ok(proof.test(showed), `${label} + context: and the rail shows that view, not another one`);
        await cx.click().catch(() => {}); await p.waitForTimeout(350);
      }

      // 4. and the composer survives all of it
      ok(!!(await p.$('#esline')) || !!(await p.$('.es-setup')) || !!(await p.$('.es-done')),
        `${label}: the writing surface is still reachable afterwards`);
    }
  }
  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors across the matrix');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
