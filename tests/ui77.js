// THE PAGE GITHUB PAGES SERVES, AS IT SERVES IT.
//
// Every other browser suite loads a generated build (marginal-preview.html, or
// the walkthrough built from it), where build.js has inlined every script. The
// site students open is index.html, loading its scripts as separate files. That
// difference hid a production outage: index.html asked for student-imports.js,
// a file that only ever existed inlined in the preview, so the deployed page ran
// without the attempt contract and, from the first line that used it at startup,
// rendered nothing but its header.
//
// This suite serves exactly the files git tracks, over HTTP, from the repository
// root, beginning at index.html, as Pages does. An untracked file a build left
// lying around cannot make it pass. It fails if a script index.html references
// is missing, if startup throws, or if the app does not render: the login screen
// with the shipped config, and every top-level surface with cloud sign-in off.
// And it proves the guard: with the contract bundle missing the page says so in
// words, instead of going blank.
//
// Full tier only (decision 26). External requests (fonts, the Supabase CDN) are
// blocked, as everywhere in the harness; the app does not need them to render.
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('./env');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

const TRACKED = new Set(execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let f = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
      if (f.endsWith('/')) f += 'index.html';
      if (!TRACKED.has(f)) { res.writeHead(404); return res.end('not a committed file: ' + f); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(path.join(ROOT, f)));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// A page on the local server: same-origin requests go through; anything else is
// blocked, as the harness blocks it. Records every local response and every error.
async function open(b, base, opts) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (!u.startsWith(base)) return r.abort();
    if (opts && opts.missing && u.endsWith('/' + opts.missing)) return r.fulfill({ status: 404, body: 'missing' });
    if (opts && opts.cloudOff && /\/(index\.html)?$/.test(new URL(u).pathname)) {
      // The shipped page with cloud sign-in switched off: everything else as committed.
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
        .replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""').replace(/supabaseAnonKey:\s*"[^"]*"/, 'supabaseAnonKey: ""');
      return r.fulfill({ status: 200, contentType: 'text/html', body: html });
    }
    return r.continue();
  });
  const seen = { errors: [], console: [], local: [] };
  p.on('pageerror', e => seen.errors.push(String(e).slice(0, 200)));
  // net::ERR_FAILED is the harness blocking an external request (fonts, the CDN), not the site.
  p.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) seen.console.push(m.text().slice(0, 200)); });
  p.on('response', r => { if (r.url().startsWith(base)) seen.local.push({ url: r.url().slice(base.length), status: r.status() }); });
  await p.goto(base + '/', { waitUntil: 'load' }); await settled(p);
  return { p, ctx, seen };
}
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();

  console.log('--- 1. every script index.html references is a committed file');
  {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const local = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
    ok(local.length >= 4, 'index.html loads its scripts as files: ' + local.join(', '));
    const missing = local.filter(s => !TRACKED.has(s));
    ok(!missing.length, 'every one of them is committed, so Pages can serve it: missing ' + JSON.stringify(missing));
    ok(TRACKED.has('student-imports.js'), 'student-imports.js, the contract bundle, is a committed file');
  }

  console.log('--- 2. the shipped page: the login screen renders, with no errors');
  {
    const { p, ctx, seen } = await open(b, base);
    const bad = seen.local.filter(r => r.status >= 400);
    ok(!bad.length, 'every file the page asked the site for was served: ' + JSON.stringify(bad));
    ok(!seen.errors.length, 'startup throws nothing: ' + JSON.stringify(seen.errors));
    ok(!seen.console.length, 'and logs no errors: ' + JSON.stringify(seen.console));
    ok(await p.evaluate(() => !!(window.MarginalAssessment && window.MarginalExam && window.MarginalAttempts && window.MarginalImportRead)),
       'the page has the same contracts the preview inlines');
    ok(/Sign in to start studying/.test(await text(p, '#app')), 'the login screen renders: ' + (await text(p, '#app')).slice(0, 80));
    ok(!(await p.$('#bootfail')), 'and the could-not-start message does not');
    await ctx.close();
  }

  console.log('--- 3. with cloud sign-in off, every top-level surface renders from the committed files');
  {
    const { p, ctx, seen } = await open(b, base, { cloudOff: true });
    const tabs = await p.$$eval('.navtab', es => es.map(e => e.textContent.trim()));
    ok(['Study', 'Create', 'Test mode', 'Essay practice'].every(t => tabs.some(x => new RegExp(t, 'i').test(x))), 'the navigation renders: ' + JSON.stringify(tabs));
    // Each surface is identified by what only it renders, and the tab it lit, so a
    // click that fails to switch views cannot pass on the previous view's text.
    // Study comes after Test mode so that it, too, is a real switch.
    const click = t => p.$$eval('.navtab', (es, t) => { const x = es.find(e => new RegExp(t, 'i').test(e.textContent)); x && x.click(); }, t).then(() => settled(p));
    for (const [tab, re] of [['Create', /Create a flashcard set/], ['Test mode', /Practise individual question types/], ['Study', /What are we studying\?/]]) {
      await click(tab);
      const body = await text(p, '#app'), on = await text(p, '.navtab.on');
      ok(on === tab && re.test(body), tab + ' renders: [' + on + '] ' + body.slice(0, 90));
    }
    // Essay practice is a full-screen overlay over the view, not a view of its own.
    await click('Essay practice');
    const essay = await text(p, '#eshost');
    ok(/Your essay question/.test(essay) && await p.evaluate(() => document.body.classList.contains('es-lock')),
       'Essay practice renders: ' + essay.slice(0, 90));
    ok(!seen.errors.length, 'no page errors across the four surfaces: ' + JSON.stringify(seen.errors));
    await ctx.close();
  }

  console.log('--- 4. with the contract bundle missing, the page says so instead of going blank');
  {
    const { p, ctx, seen } = await open(b, base, { missing: 'student-imports.js' });
    ok(/Marginal could not start/.test(await text(p, '#bootfail')) && /Reload the page/.test(await text(p, '#bootfail')),
       'a readable could-not-start message: ' + await text(p, '#app'));
    ok(!seen.errors.length, 'and it fails closed without an uncaught error: ' + JSON.stringify(seen.errors));
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
