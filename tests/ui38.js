// THE MECHANISM CONTRACT: the middle step is authored or it does not exist.
//
// The chain shows strategy -> objective. A middle step turns it into
// strategy -> mechanism -> objective, and the whole value of that middle step is
// that a person decided it was true. The moment a renderer can derive one, the
// chain starts teaching relationships nobody checked, and this codebase already
// has the case that proves it: a first implementation scanned prose for the
// objective word and selected a sentence saying JIT DEPENDS ON a dependable
// supply chain, which taught the causal direction backwards.
//
// So this suite asserts the negative as hard as the positive. An authored
// mechanism appears, exactly as written. Anything else appears not at all, and
// the chain falls back to the two-step pairing rather than to nothing.
const { chromium, T } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// The authored strings, restated here so the suite owns its expectations. If the
// content changes, this fails and someone re-reads it, which is the point.
const AUTHORED = 'digital channels carry an offer at a lower promotion cost, so the same customers can be reached with offers again and again';
const IDS = { authored: 'mkt01-em-value', noneRequired: 'mkt01-em-digital', alsoAuthored: 'mkt01-em-convenience' };

async function openQuestion(p, qre) {
  await p.goto(T); await p.waitForTimeout(400);
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForTimeout(700);
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForTimeout(400);
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await p.$$eval('.es-qchip', (es, r) => { const t = es.find(x => new RegExp(r, 'i').test(x.textContent)); t && t.click(); }, qre);
  await p.click('#esstart'); await p.waitForTimeout(700);
  if (await p.$('.es-startrow')) await p.$$eval('.es-startrow', es => { const t = es.filter(x => /Body/.test(x.textContent))[0]; t && t.click(); });
  await p.waitForTimeout(650);
}
const offered = p => p.$$eval('[data-espath]', es => es.map(e => e.dataset.espath));
// Choosing an argument advances to the composer, so the chips are gone by the time
// the next selection is made. Without this the second choose() silently does
// nothing, the previous argument stays selected, and every later assertion passes
// while measuring the wrong one. It did exactly that on the first run.
async function backToArguments(p) {
  if (await p.$('[data-espath]')) return true;
  const change = await p.$('#esbackarg');
  if (change) { await change.click(); await p.waitForTimeout(520); }
  return !!(await p.$('[data-espath]'));
}
async function choose(p, id) {
  ok(await backToArguments(p), 'the argument chooser is reachable before picking ' + id);
  const hit = await p.$$eval('[data-espath]', (es, want) => {
    const t = es.find(x => x.dataset.espath === want); if (t) { t.click(); return true; } return false;
  }, id);
  ok(hit, 'the argument ' + id + ' was on screen to be picked');
  await p.waitForTimeout(560);
}
// Open the centre and the connect card. Returns the chain as the student sees it.
async function chain(p) {
  const tool = await p.$('[data-estool="understand"]');
  if (tool) { await tool.click(); await p.waitForTimeout(420); }
  const lo = await p.$('#eslopen');
  if (!lo) return null;
  await lo.click(); await p.waitForTimeout(650);
  const opened = await p.$$eval('.esl-panel button', es => {
    const t = es.find(x => /How they connect/i.test(x.textContent || '')); if (t) { t.click(); return true; } return false;
  });
  if (!opened) return null;
  await p.waitForTimeout(420);
  return p.evaluate(() => ({
    mids: Array.from(document.querySelectorAll('.esl-mid')).map(e => e.textContent.trim()),
    nodes: Array.from(document.querySelectorAll('.esl-node')).map(e => e.textContent.trim()),
    links: document.querySelectorAll('.esl-link').length
  }));
}
const close = async p => { await p.keyboard.press('Escape'); await p.waitForTimeout(450); };

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1050 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());

  await openQuestion(p, 'target markets affect');
  const ids = await offered(p);
  console.log('--- the three arguments this suite needs are on the screen ---');
  console.log('    offered:', JSON.stringify(ids));
  // Asserted before anything else. Choosing a pathway that was never offered
  // leaves the previous one selected, and every assertion below would then be
  // measuring the wrong argument while reporting a pass.
  ok(ids.indexOf(IDS.authored) >= 0, 'the authored-mechanism argument is offered');
  ok(ids.indexOf(IDS.noneRequired) >= 0, 'the none-required argument is offered');
  ok(ids.indexOf(IDS.alsoAuthored) >= 0, 'the second authored argument is offered');

  console.log('--- an authored mechanism is a three-step chain ---');
  await choose(p, IDS.authored);
  const a = await chain(p);
  ok(!!a, 'the connect card opens');
  if (a) {
    ok(a.links > 0, 'the chain rendered at all, so the assertions below mean something');
    ok(a.mids.length === 1, 'exactly one middle step is shown: ' + a.mids.length);
    ok(a.mids[0] === AUTHORED, 'and it is the authored text, character for character: ' + JSON.stringify((a.mids[0] || '').slice(0, 50)));
    ok(a.nodes.length >= 2, 'with both ends still present: ' + JSON.stringify(a.nodes.slice(0, 4)));
  }
  await close(p);

  console.log('--- anything not authored is a two-step chain, not an empty one ---');
  await choose(p, IDS.noneRequired);
  const n = await chain(p);
  ok(!!n, 'the connect card still opens');
  if (n) {
    ok(n.links > 0, 'the chain still rendered, so a missing middle step is not a missing chain');
    ok(n.nodes.length >= 2, 'both ends are shown: ' + JSON.stringify(n.nodes.slice(0, 4)));
    ok(n.mids.length === 0, 'and no middle step is invented for it: ' + JSON.stringify(n.mids));
  }
  await close(p);

  console.log('--- the middle step belongs to the argument in play, not the line ---');
  // Three arguments share the plan line "Target market to e-marketing". If the
  // mechanism were attached to the line rather than to the chosen argument, the
  // text above would still be showing here, against a claim nobody made.
  await choose(p, IDS.alsoAuthored);
  const c = await chain(p);
  ok(!!c, 'the connect card opens on the third argument');
  if (c) {
    ok(c.mids.length === 1, 'it has its own middle step: ' + c.mids.length);
    ok(c.mids[0] !== AUTHORED, 'which is not the previous argument’s: ' + JSON.stringify((c.mids[0] || '').slice(0, 50)));
  }
  await close(p);

  console.log('--- Operations is untouched by all of this ---');
  // The objective vocabulary became per-question. Operations authors none, so it
  // must still resolve the six performance objectives and still show no mechanism,
  // because none is authored there either.
  await openQuestion(p, 'operations strategies');
  const o = await chain(p);
  ok(!!o, 'Operations still renders its connect card');
  if (o) {
    ok(o.links > 0, 'and still resolves its plan lines: ' + o.links);
    ok(o.mids.length === 0, 'with no middle step, because none is authored: ' + JSON.stringify(o.mids));
  }

  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
