// Eight full pages of the redesigned question-setup flow, all at one desktop
// viewport so composition can be compared across them rather than component by
// component. Full-page captures: the page is the contract, not the fold.
const { chromium, T, BASE, usePractice } = require('./env');

const W = 1440, H = 960;
const wait = (p, ms) => p.waitForTimeout(ms);

async function toSetup(p) {
  await p.goto(T);
  await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector('#essubject', { timeout: 8000 });
  await p.selectOption('#essubject', 'business_studies');
  await wait(p, 300);
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());

  // The flow is a fixed full-viewport surface that scrolls internally, so a
  // fullPage capture would stop at the fold and cut the lower half of the list.
  // For capture only, the surface is unpinned and everything it overlays is
  // hidden, so the document grows to the whole page. Layout widths are unchanged
  // by this; only the scroll container is.
  const unpin = () => p.evaluate(() => {
    const qp = document.querySelector('.qp'); if (!qp) return;
    const keep = new Set(); for (let n = qp; n; n = n.parentElement) keep.add(n);
    document.querySelectorAll('body *').forEach(n => {
      if (!keep.has(n) && !qp.contains(n)) n.dataset.shothidden = n.style.display, n.style.display = 'none';
    });
    qp.style.position = 'static';
    qp.style.overflow = 'visible';
    // Pinned, the surface is exactly the viewport and the footer sits at its
    // bottom. Unpinned it would shrink to its content, so the floor is kept.
    qp.style.minHeight = '100vh';
  });
  const repin = () => p.evaluate(() => {
    const qp = document.querySelector('.qp'); if (!qp) return;
    document.querySelectorAll('[data-shothidden]').forEach(n => {
      n.style.display = n.dataset.shothidden || ''; delete n.dataset.shothidden;
    });
    qp.style.position = ''; qp.style.overflow = ''; qp.style.minHeight = '';
  });

  const shot = async name => {
    await wait(p, 250);
    // A focus ring left on whatever was last clicked is a real state, but it is
    // not the state being shown; blur so the capture is the page, not the cursor.
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    // The pointer sits wherever the last real click left it, and a row under it
    // renders as hovered. Park it in the margin so the capture is the page.
    await p.mouse.move(2, 2);
    await unpin();
    await wait(p, 120);
    await p.screenshot({ path: BASE + name, fullPage: true });
    await repin();
    const size = await p.evaluate(() => ({
      doc: (document.querySelector('.qp') || document.documentElement).scrollHeight,
      rows: document.querySelectorAll('.qp-row').length,
    }));
    console.log(name, JSON.stringify(size));
  };

  // 1 Setup
  await toSetup(p);
  await shot('p1-setup.png');

  // 2 Question list, page 1
  await usePractice(p);
  await wait(p, 300);
  await shot('p2-list-p1.png');

  // 3 Page 1 with a question selected
  await p.evaluate(() => { const r = document.querySelectorAll('.qp-row')[2]; r && r.click(); });
  await wait(p, 300);
  await shot('p3-list-selected.png');

  // 4 Question list, page 2 (three rows of thirteen)
  await p.click('[data-espage="2"]');
  await wait(p, 300);
  await shot('p4-list-p2.png');

  // 5 Directive-filtered
  await toSetup(p); await usePractice(p); await wait(p, 250);
  const dir = await p.evaluate(() => {
    const ps = [...document.querySelectorAll('[data-essetupdir]')].filter(x => x.dataset.essetupdir && !x.disabled);
    const t = ps.find(x => /explain/i.test(x.textContent)) || ps[0];
    if (!t) return null; t.click(); return t.textContent.trim();
  });
  console.log('    directive filter:', JSON.stringify(dir));
  await shot('p5-filter-directive.png');

  // 6 Topic-filtered
  await toSetup(p); await usePractice(p); await wait(p, 250);
  const top = await p.evaluate(() => {
    const ps = [...document.querySelectorAll('[data-essetuptopic]')].filter(x => x.dataset.essetuptopic && !x.disabled);
    const t = ps.find(x => /marketing/i.test(x.textContent)) || ps[0];
    if (!t) return null; t.click(); return t.textContent.trim();
  });
  console.log('    topic filter:', JSON.stringify(top));
  await shot('p6-filter-topic.png');

  // The preview pair. Which question is thin and which is well supported is a
  // fact about the bank, so it is read from the page rather than assumed.
  const support = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.qp-row').forEach(r => out.push(r.dataset.esq));
    return out;
  });
  console.log('    rows on the topic-filtered page:', support.join(', '));

  const ranked = await (async () => {
    await toSetup(p); await usePractice(p); await wait(p, 250);
    const ids = [];
    for (let pg = 1; ; pg++) {
      const got = await p.evaluate(() => [...document.querySelectorAll('.qp-row')].map(r => r.dataset.esq));
      ids.push(...got);
      const next = await p.$('[data-espage="' + (pg + 1) + '"]:not([disabled])');
      if (!next) break;
      await next.click(); await wait(p, 200);
    }
    const scored = [];
    for (const id of ids) {
      await toSetup(p); await usePractice(p); await wait(p, 150);
      // Walk to the page holding it, select it, count the rail's support rows.
      for (let pg = 1; pg <= 3; pg++) {
        const here = await p.$('.qp-row[data-esq="' + id + '"]');
        if (here) break;
        const nx = await p.$('[data-espage="' + (pg + 1) + '"]:not([disabled])');
        if (!nx) break;
        await nx.click(); await wait(p, 150);
      }
      const n = await p.evaluate(i => {
        const r = document.querySelector('.qp-row[data-esq="' + i + '"]');
        if (!r) return -1; r.click();
        return document.querySelectorAll('.qp-suprow.yes').length;
      }, id);
      scored.push({ id: id, yes: n });
    }
    scored.sort((a, b) => b.yes - a.yes);
    return scored;
  })();
  console.log('    support per question:', ranked.map(r => r.id + ':' + r.yes).join(' '));

  const open = async id => {
    await toSetup(p); await usePractice(p); await wait(p, 200);
    for (let pg = 1; pg <= 3; pg++) {
      const here = await p.$('.qp-row[data-esq="' + id + '"]');
      if (here) break;
      const nx = await p.$('[data-espage="' + (pg + 1) + '"]:not([disabled])');
      if (!nx) break;
      await nx.click(); await wait(p, 200);
    }
    await p.click('.qp-row[data-esq="' + id + '"]');
    await wait(p, 200);
    await p.click('[data-espick="preview"]');
    await p.waitForSelector('.qp-prevq', { timeout: 8000 });
  };

  // 7 Highly supported preview
  await open(ranked[0].id);
  console.log('    supported preview:', ranked[0].id, ranked[0].yes + ' of 5');
  await shot('p7-preview-supported.png');

  // 8 Thin support preview
  const thin = ranked[ranked.length - 1];
  await open(thin.id);
  console.log('    thin preview:', thin.id, thin.yes + ' of 5');
  await shot('p8-preview-thin.png');

  console.log('pageerrors:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
