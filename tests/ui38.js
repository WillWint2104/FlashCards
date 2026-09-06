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
const { chromium, T, usePractice, chooseQuestion } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// The authored strings, restated here so the suite owns its expectations. If the
// content changes, this fails and someone re-reads it, which is the point.
const AUTHORED = 'the staff member is part of what the customer is buying, so their skill and manner are the thing being judged';
const AUTHORED2 = 'if the staff are part of the product, differences between staff are differences in the product itself';
const FROM = 'customers who expect personal service';
const IDS = { authored: 'mkt01-pe-service', alsoAuthored: 'mkt01-pe-consistency', notAuthored: 'mkt01-pe-speed' };
// The connect card's own sentence. The Operations copy is false of this question,
// so it must not appear here, and mkt-01's own must.
const OPS_COPY = /are actions a business takes/i;
const MKT_INTRO = /characteristics of a target market shape the marketing strategies/i;

async function openQuestion(p, qre, bodyIndex) {
  await p.goto(T + '?eslegacy=1'); await here(p, '.navtab');
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T + '?eslegacy=1'); await here(p, '.navtab');
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await settled(p);
  await p.selectOption('#essubject', 'business_studies').catch(() => {});
  await chooseQuestion(p, qre);
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow, [data-espath]'), null, { timeout: 8000 });
  if (await p.$('.es-startrow')) await p.$$eval('.es-startrow', (es, n) => {
    const t = es.filter(x => /Body/.test(x.textContent))[n || 0]; t && t.click();
  }, bodyIndex || 0);
  await settled(p);
}
const offered = p => p.$$eval('[data-espath]', es => es.map(e => e.dataset.espath));
// Choosing an argument advances to the composer, so the chips are gone by the time
// the next selection is made. Without this the second choose() silently does
// nothing, the previous argument stays selected, and every later assertion passes
// while measuring the wrong one. It did exactly that on the first run.
async function backToArguments(p) {
  if (await p.$('[data-espath]')) return true;
  const change = await p.$('#esbackarg');
  if (change) { await change.click(); await settled(p); }
  return !!(await p.$('[data-espath]'));
}
async function choose(p, id) {
  ok(await backToArguments(p), 'the argument chooser is reachable before picking ' + id);
  const hit = await p.$$eval('[data-espath]', (es, want) => {
    const t = es.find(x => x.dataset.espath === want); if (t) { t.click(); return true; } return false;
  }, id);
  ok(hit, 'the argument ' + id + ' was on screen to be picked');
  await settled(p);
}
// Open the centre and the connect card. Returns the chain as the student sees it.
async function chain(p) {
  // Learn opens the Learning Centre directly now. It used to open a drawer that
  // carried an "Open learning centre" link, and that link no longer exists
  // because the drawer does not.
  const tool = await p.$('[data-estool="understand"]');
  if (!tool) return null;
  await tool.click(); await settled(p);
  if (!(await p.$('.esl-panel'))) return null;
  const opened = await p.$$eval('.esl-panel button', es => {
    const t = es.find(x => /How they connect/i.test(x.textContent || '')); if (t) { t.click(); return true; } return false;
  });
  if (!opened) return null;
  await settled(p);
  return p.evaluate(() => ({
    mids: Array.from(document.querySelectorAll('.esl-mid')).map(e => e.textContent.trim()),
    nodes: Array.from(document.querySelectorAll('.esl-node')).map(e => e.textContent.trim()),
    links: document.querySelectorAll('.esl-link').length,
    intro: (document.querySelector('.esl-panel .esl-lede') || {}).textContent || ''
  }));
}
const close = async p => { await p.keyboard.press('Escape'); await settled(p); };

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1050 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());

  // Body 2 is the people area, where the authored mechanisms live. Asserted rather
  // than assumed: on the wrong body the ids below are simply absent and every
  // assertion after them would be measuring another argument entirely.
  await openQuestion(p, 'target markets affect', 1);
  const ids = await offered(p);
  console.log('--- the arguments this suite needs are on the screen ---');
  console.log('    offered:', JSON.stringify(ids));
  ok(ids.indexOf(IDS.authored) >= 0, 'the authored-mechanism argument is offered');
  ok(ids.indexOf(IDS.alsoAuthored) >= 0, 'the second authored argument is offered');
  ok(ids.indexOf(IDS.notAuthored) >= 0, 'the unreviewed argument is offered');

  console.log('--- an authored mechanism is a three-step chain ---');
  await choose(p, IDS.authored);
  const a = await chain(p);
  ok(!!a, 'the connect card opens');
  if (a) {
    ok(a.links > 0, 'the chain rendered at all, so the assertions below mean something');
    ok(a.mids.length === 1, 'exactly one middle step is shown: ' + a.mids.length);
    ok(a.mids[0] === AUTHORED, 'and it is the authored text, character for character: ' + JSON.stringify((a.mids[0] || '').slice(0, 50)));
    ok(a.nodes.length >= 2, 'with both ends still present: ' + JSON.stringify(a.nodes.slice(0, 4)));
    console.log('--- and the cause is the characteristic, not the category ---');
    // "Target market" is the category. A zero-knowledge learner needs the
    // characteristic that actually drives the argument they picked.
    ok(a.nodes.indexOf(FROM) >= 0, 'the chosen line is labelled with its authored characteristic: ' + JSON.stringify(a.nodes.slice(0, 4)));
    ok(a.nodes.filter(x => x === 'Target market').length === 3, 'and the three lines the student did not choose keep the category label: ' + a.nodes.filter(x => x === 'Target market').length);
  }
  console.log('--- the connect card explains THIS relationship, not the Operations one ---');
  if (a) {
    ok(MKT_INTRO.test(a.intro), 'the question\u2019s own authored sentence is shown: ' + JSON.stringify(a.intro.slice(0, 70)));
    // The leak this exists to catch: a target market is not an action a business
    // takes, and a marketing strategy is not what it is trying to improve.
    ok(!OPS_COPY.test(a.intro), 'and the strategy-to-objective copy does not appear on it');
  }
  await close(p);

  console.log('--- anything not authored is a two-step chain, not an empty one ---');
  await choose(p, IDS.notAuthored);
  const n = await chain(p);
  ok(!!n, 'the connect card still opens');
  if (n) {
    ok(n.links > 0, 'the chain still rendered, so a missing middle step is not a missing chain');
    ok(n.nodes.length >= 2, 'both ends are shown: ' + JSON.stringify(n.nodes.slice(0, 4)));
    ok(n.mids.length === 0, 'and no middle step is invented for it: ' + JSON.stringify(n.mids));
    ok(n.nodes.indexOf('customers who expect speed') >= 0, 'it still gets its authored characteristic, which does not depend on the mechanism');
  }
  await close(p);

  console.log('--- the middle step belongs to the argument in play, not the line ---');
  // Three arguments share the plan line "Target market to people". If the mechanism
  // were attached to the line, the first argument\u2019s text would still be here.
  await choose(p, IDS.alsoAuthored);
  const c = await chain(p);
  ok(!!c, 'the connect card opens on the third argument');
  if (c) {
    ok(c.mids.length === 1, 'it has its own middle step: ' + c.mids.length);
    ok(c.mids[0] === AUTHORED2, 'which is its own authored text: ' + JSON.stringify((c.mids[0] || '').slice(0, 50)));
    ok(c.mids[0] !== AUTHORED, 'and not the previously chosen argument\u2019s');
  }
  await close(p);

  console.log('--- Operations is untouched by all of this ---');
  // The objective vocabulary and the intro both became per-question. Operations
  // authors neither, so it must still resolve the six performance objectives, still
  // show its own explanation, and still show no mechanism, because none is authored.
  // Two questions begin "How can operations strategies"; this suite means the
  // performance objectives one, and the list is ordered now, so it says so.
  await openQuestion(p, 'operations strategies contribute', 0);
  const o = await chain(p);
  ok(!!o, 'Operations still renders its connect card');
  if (o) {
    ok(o.links > 0, 'and still resolves its plan lines: ' + o.links);
    ok(o.mids.length === 0, 'with no middle step, because none is authored: ' + JSON.stringify(o.mids));
    ok(OPS_COPY.test(o.intro), 'and it keeps the strategy-to-objective sentence, which is true of it: ' + JSON.stringify(o.intro.slice(0, 60)));
  }

  console.log('\npageerrors:', errs.length ? errs.join(' | ') : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
