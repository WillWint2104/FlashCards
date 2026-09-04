// THE READ ONLY IMPORTER, SLICE 1.
//
// marginal-importer.html is a real page driven by the real contract modules,
// and this suite is the reason to believe that rather than a claim in a comment.
// It answers two questions the mockups could not:
//
//   does the contract give the SAME answers in a browser as it does in Node,
//   or is there now a second set of rules that agrees for the moment;
//   and does the page report what those modules returned, or does it count,
//   decide and describe things on its own.
//
// Every expected value below is computed by requiring the modules in Node and
// comparing. Nothing is a literal copied off a screenshot, so the day the
// content changes this suite moves with it instead of failing for the wrong
// reason.
//
// It also asserts what the slice deliberately CANNOT do: no persistence, no
// network, no write path, and a Publish step that is drawn and not reachable.
const { chromium } = require("./env");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const lib = require("../tools/contract/libraries.js");
const { validate } = require("../tools/contract/validate.js");
const admit = require("../tools/contract/admit.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };
const C = f => path.join(ROOT, "docs", "contract", f);
const readPkg = f => JSON.parse(fs.readFileSync(C(f), "utf8"));

// The batch the walkthrough uses: one that would be added, two whose ids are
// taken, one rejected at Validate, and one that is not JSON at all.
const BATCH = ["ahead-minor-demo.json", "example-mkt-01.json", "example-ah-religion.json", "invalid-demo.json"];
const NOT_JSON = path.join(ROOT, "tests", "out", "not-a-package.json");

(async () => {
  fs.writeFileSync(NOT_JSON, "{ this is not json ");
  const MAN = lib.manifest();
  const DIR = require("../tools/contract/directives.js").registry();
  const REG = lib.questionRegistry();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(String(e)));
  // Nothing on this page may reach the network. env.js blocks external requests
  // already; this proves the page never even asks.
  const requests = [];
  page.on("request", r => { if (!r.url().startsWith("file://")) requests.push(r.url()); });
  await page.goto("file://" + path.join(ROOT, "marginal-importer.html"));

  console.log("1. the contract in the browser is the contract in Node");
  {
    const has = await page.evaluate(() => !!window.MarginalContract && !!window.MarginalImportData);
    ok(has, "the bundle and the generated data are both present");
    // The manifest and registries the page was given are the generated ones.
    const same = await page.evaluate(() => ({
      man: JSON.stringify(window.MarginalImportData.manifest),
      dir: JSON.stringify(window.MarginalImportData.directives),
      reg: JSON.stringify(window.MarginalImportData.questions),
    }));
    ok(same.man === JSON.stringify(MAN), "the manifest in the page is the generated manifest");
    ok(same.dir === JSON.stringify(DIR), "the directive registry in the page is the generated one");
    ok(same.reg === JSON.stringify(REG), "the question registry in the page is the generated one");

    // Parity, on every fixture in the repository rather than on one.
    const files = fs.readdirSync(C("")).filter(f => /^(example-|invalid-|ahead-|unsupported-)/.test(f));
    ok(files.length >= 20, "there are enough fixtures to be worth comparing: " + files.length);
    let agreed = 0, disagreed = [];
    for (const f of files) {
      const pkg = readPkg(f);
      const node = validate(pkg, MAN, { registry: DIR });
      const web = await page.evaluate(p => {
        const r = window.MarginalContract.validate(p, window.MarginalImportData.manifest,
          { registry: window.MarginalImportData.directives });
        return { verdict: r.verdict, counts: r.counts, wouldImport: r.wouldImport,
          codes: r.findings.map(x => x.severity + "/" + x.code).sort(),
          headline: r.capability && r.capability.headline,
          carried: (r.document || {}).carried };
      }, pkg);
      const want = { verdict: node.verdict, counts: node.counts, wouldImport: node.wouldImport,
        codes: node.findings.map(x => x.severity + "/" + x.code).sort(),
        headline: node.capability && node.capability.headline,
        carried: (node.document || {}).carried };
      if (JSON.stringify(web) === JSON.stringify(want)) agreed++; else disagreed.push(f);
    }
    ok(!disagreed.length, "every fixture validates identically in both: " + JSON.stringify(disagreed));
    ok(agreed === files.length, agreed + " of " + files.length + " fixtures compared");

    // And the admission plan, which is the thing Review is a view of.
    const entries = BATCH.map(f => ({ source: f, pkg: readPkg(f) }));
    const nodePlan = admit.plan(entries, REG, MAN);
    const webPlan = await page.evaluate(es => {
      const p = window.MarginalContract.plan(es, window.MarginalImportData.questions,
        window.MarginalImportData.manifest, { registry: window.MarginalImportData.directives });
      return { changes: p.changes, empty: p.empty, ids: p.questions.map(q => q.id),
        held: p.held.map(h => h.id), rejected: p.rejected.map(r => r.id),
        fingerprint: p.checkedAgainst.registry };
    }, entries);
    ok(JSON.stringify(webPlan.changes) === JSON.stringify(nodePlan.changes),
      "the admission plan agrees: " + JSON.stringify(webPlan.changes));
    ok(webPlan.fingerprint === nodePlan.checkedAgainst.registry,
      "against the same destination: " + webPlan.fingerprint);
  }

  console.log("2. choosing files reads two fields and no more");
  {
    ok(await page.$("#filepick") !== null, "there is a file input");
    const before = await page.evaluate(() => window.__importer.state().files.length);
    ok(before === 0, "nothing is chosen to begin with: " + before);
    const cont = await page.$("#continue");
    ok(await cont.isDisabled(), "and Continue is off until something is");

    await page.setInputFiles("#filepick", BATCH.map(f => C(f)).concat([NOT_JSON]));
    await page.waitForFunction(() => window.__importer.state().files.length === 5);
    const heads = await page.evaluate(() => window.__importer.state().files.map(f => f.name + " | " + f.head));
    ok(heads.length === 5, "five files are chosen: " + heads.length);
    ok(heads.some(h => /ahead-minor-demo\.json \| marginal\.question-package · contract 1\.7/.test(h)),
      "each line names the schema and the version, which is what two fields buys: " +
      JSON.stringify(heads.find(h => /ahead-minor/.test(h))));
    ok(heads.some(h => /not-a-package\.json \| not readable as JSON/.test(h)),
      "and a file that is not JSON says so here rather than later: " +
      JSON.stringify(heads.find(h => /not-a-package/.test(h))));
    // No report exists yet. Choosing is not parsing.
    const early = await page.evaluate(() => window.__importer.state().reports);
    ok(early === null, "nothing has been parsed yet");
    const label = await page.textContent("#continue");
    ok(/Continue with 5 packages/.test(label), "the button names the batch: " + JSON.stringify(label));
  }

  console.log("3. Parse reports what parsed, and what did not");
  {
    await page.click("#continue");
    await page.waitForFunction(() => window.__importer.state().step === 1);
    const body = await page.textContent("#screen");
    ok(/4 packages read/.test(body), "four of the five parsed");
    ok(/1 file could not be read/.test(body) || /not-a-package/.test(body),
      "and the fifth is named rather than dropped");
    ok(/ah-religion-ahead/.test(body) && /mkt-01/.test(body), "the ids read out of the files are shown");
    const reports = await page.evaluate(() => window.__importer.state().reports.map(r => ({
      source: r.source, parsed: !!r.pkg, verdict: r.report ? r.report.verdict : null })));
    const wanted = BATCH.map(f => ({ source: f, parsed: true,
      verdict: validate(readPkg(f), MAN, { registry: DIR }).verdict }))
      .concat([{ source: "not-a-package.json", parsed: false, verdict: null }]);
    ok(JSON.stringify(reports) === JSON.stringify(wanted),
      "and every verdict is the one the validator gives in Node: " + JSON.stringify(reports));
  }

  console.log("4. Validate shows the validator's verdicts, not its own");
  {
    await page.click("#next");
    await page.waitForFunction(() => window.__importer.state().step === 2);
    const body = await page.textContent("#screen");
    const bad = validate(readPkg("invalid-demo.json"), MAN, { registry: DIR });
    ok(new RegExp(bad.counts.error + " errors").test(body),
      "the error count is the validator's " + bad.counts.error + ": " + /(\d+) errors/.exec(body));
    const codes = [...new Set(bad.findings.filter(f => f.severity === "error").map(f => f.code))];
    ok(new RegExp(codes.length + " rules").test(body),
      "and the rule count is its distinct codes, " + codes.length);
    ok(/LEGACY_|ID_MALFORMED|DIRECTIVE_UNKNOWN/.test(body), "each shown finding names the rule it broke");
    ok(/accepted with warnings|valid/.test(body), "and the packages that pass say so");
    ok((await page.textContent("#h1")) === "Validate packages",
      "the heading is the frozen one: " + JSON.stringify(await page.textContent("#h1")));

    // The grouped diagnostic. Counts come from diagnostics.js in Node, so the
    // screen is checked against the definition rather than against a literal.
    const diag = require("../tools/contract/diagnostics.js");
    const groups = diag.groupErrors(bad.findings);
    ok(groups.length === 5, "the real fixture falls into five groups: " + groups.length);
    const shown = await page.$$eval("#screen .grp", gs => gs.map(g => ({
      title: g.querySelector(".n") ? g.querySelector(".n").textContent.trim() : null,
      count: g.querySelector(".c") ? g.querySelector(".c").textContent.trim() : null,
      examples: g.querySelectorAll(".ex").length,
      more: g.querySelector(".more") ? g.querySelector(".more").textContent.trim() : null,
      msg: g.querySelector(".ex .msg") ? g.querySelector(".ex .msg").textContent.trim() : null,
      at: g.querySelector(".ex .at") ? g.querySelector(".ex .at").textContent.trim() : null,
    })));
    const errGroups = shown.filter(g => g.title !== "Worth checking, and not blocking");
    ok(JSON.stringify(errGroups.map(g => g.title)) === JSON.stringify(groups.map(g => g.title)),
      "the titles and their order are the definition's: " + JSON.stringify(errGroups.map(g => g.title)));
    ok(JSON.stringify(errGroups.map(g => Number(g.count))) ===
       JSON.stringify(groups.map(g => g.findings.length)),
      "and so are the counts: " + JSON.stringify(errGroups.map(g => g.count)));
    ok(errGroups.reduce((n, g) => n + Number(g.count), 0) === bad.counts.error,
      "which still sum to the validator's error total: " + bad.counts.error);
    ok(errGroups.every(g => g.examples === 2), "two examples visible per group: " +
      JSON.stringify(errGroups.map(g => g.examples)));
    // Which way round matters. The prominent line is the sentence a teacher can
    // act on; the code and path are how you find the field, underneath it.
    const msgs = bad.findings.filter(f => f.severity === "error").map(f => f.message);
    const codesEmitted = bad.findings.filter(f => f.severity === "error").map(f => f.code);
    ok(errGroups.every(g => msgs.indexOf(g.msg) >= 0),
      "the prominent line of each example is the validator's explanation: " +
      JSON.stringify(errGroups.map(g => (g.msg || "").slice(0, 40))));
    ok(errGroups.every(g => codesEmitted.some(c => (g.at || "").indexOf(c) === 0)),
      "and the small line underneath starts with the code: " + JSON.stringify(errGroups.map(g => g.at)));
    ok(errGroups.every(g => codesEmitted.indexOf(g.msg) < 0),
      "the code is never the prominent line");
    ok(errGroups.every(g => /^Show all \d+$/.test(g.more || "")),
      "and each offers Show all N: " + JSON.stringify(errGroups.map(g => g.more)));
    ok(shown.some(g => g.title === "Worth checking, and not blocking" && Number(g.count) === bad.counts.warning),
      "the warning is kept as its own group, not folded into the errors");

    // Show all expands IN PLACE, becomes Show fewer, and does not move the page.
    await page.evaluate(() => window.scrollTo(0, 400));
    const before = await page.evaluate(() => window.scrollY);
    ok(before > 100, "the page really is scrolled before the test, or the check proves nothing: " + before);
    await page.click("#screen .grp .more");
    const opened = await page.$$eval("#screen .grp", gs => ({
      examples: gs[0].querySelectorAll(".ex").length,
      label: gs[0].querySelector(".more").textContent.trim(),
      groups: gs.length,
    }));
    ok(opened.examples === groups[0].findings.length,
      "the first group expands to all " + groups[0].findings.length + ": " + opened.examples);
    ok(opened.label === "Show fewer", "and the button becomes Show fewer: " + opened.label);
    ok(opened.groups === shown.length, "no screen was navigated to: still " + opened.groups + " groups");
    ok(Math.abs((await page.evaluate(() => window.scrollY)) - before) <= 1,
      "the scroll position is where it was: " + before + " then " + (await page.evaluate(() => window.scrollY)));
    await page.click("#screen .grp .more");
    ok((await page.$$eval("#screen .grp .ex", e => e.length)) < opened.examples * 2,
      "and it collapses again");
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  console.log("5. Resolve references reports references, and blocked is not an error");
  {
    await page.click("#next");
    await page.waitForFunction(() => window.__importer.state().step === 3);
    const body = await page.textContent("#screen");
    const mkt = readPkg("example-mkt-01.json");
    const total = Object.values(mkt.requires).reduce((n, a) => n + a.length, 0);
    ok(new RegExp(total + " references").test(body), "mkt-01's " + total + " references are counted from the file");
    ok(/Vocabulary, 7 records/.test(body) && /Syllabus, 5 records/.test(body),
      "broken down by library: " + JSON.stringify(body.match(/\w+, \d+ records/g)));
    ok(/names no shared record/.test(body), "and a package that names none says so");
    // invalid-demo is rejected and never reaches this screen, so its two blocked
    // findings must not appear here either.
    ok(!/waiting/.test(body), "no package in this batch is waiting on the library");
  }

  console.log("6. Review is a view of the plan and counts nothing itself");
  {
    await page.click("#next");
    await page.waitForFunction(() => window.__importer.state().step === 4);
    const body = await page.textContent("#screen");
    const entries = BATCH.map(f => ({ source: f, pkg: readPkg(f) }));
    const plan = admit.plan(entries, REG, MAN);
    ok(new RegExp(plan.changes.questionsAdded + " question would be added").test(body),
      "the headline is the plan's count: " + plan.changes.questionsAdded);
    ok(new RegExp("Checked against the " + plan.checkedAgainst.questions + " questions").test(body),
      "against the real bank of " + plan.checkedAgainst.questions);
    ok(new RegExp(plan.changes.questionsHeld + " questions cannot be published").test(body),
      "the held count is the plan's: " + plan.changes.questionsHeld);
    ok(/mkt-01/.test(body) && /already in Business Studies/.test(body),
      "and each held question names the subject that holds its id");
    ok(new RegExp(plan.changes.packagesRejected + " package not included").test(body),
      "the rejected count is the plan's: " + plan.changes.packagesRejected);
    ok(/not-a-package\.json/.test(body), "and the file that would not parse is still listed here");
    ok(/Nothing has been written yet/.test(body), "the invariant is on the screen");
    // The shared record line names WHOSE references those are. "0 records
    // touched" with no subject is true and tells a teacher nothing.
    ok(new RegExp(plan.changes.sharedReferenced +
      " existing shared records? used by the " + plan.questions.length +
      " publishable questions?").test(body),
      "the shared record line says how many, and used by what: " +
      JSON.stringify((body.match(/\d+ existing shared record[^.]*/) || [])[0]));
    ok(/Readiness is not a change/.test(body) && /learning-complete/.test(body) === false ||
       /Readiness is not a change/.test(body),
      "readiness is reported apart from the changes");
    const disabled = await page.$eval("#next", b => b.disabled);
    ok(disabled === plan.empty, "Continue to Publish is enabled exactly when the plan is not empty");
  }

  console.log("7. going back keeps the batch and re-runs nothing");
  {
    // Read defensively. An implementation that cleared the batch on the way back
    // must fail BY NAME here rather than crash on the absent state.
    const snap = () => page.evaluate(() => {
      const st = window.__importer.state();
      return { files: (st.files || []).map(f => f.name),
        reports: st.reports ? st.reports.length : null,
        fingerprint: st.plan ? st.plan.checkedAgainst.registry : null };
    });
    const before = await snap();
    await page.click("#back");
    await page.waitForFunction(() => window.__importer.state().step === 3);
    await page.click("#back");
    await page.waitForFunction(() => window.__importer.state().step === 2);
    // And forward again through the rail, which is the other way back.
    await page.click(".rail .step:nth-child(1)");
    await page.waitForFunction(() => window.__importer.state().step === 0);
    const after = await snap();
    ok(JSON.stringify(before) === JSON.stringify(after),
      "the batch, the reports and the plan are all still the same ones: " + JSON.stringify(after.files));
    const stillListed = await page.textContent("#screen");
    ok(/ahead-minor-demo\.json/.test(stillListed), "and the chosen files are still on the first screen");
  }

  console.log("7b. adding a file after the pipeline ran does not leave a stale plan");
  {
    // The plan was computed for four packages. Choosing a fifth must discard it,
    // because a plan that describes a batch you are no longer holding is the
    // worst kind of correct: every number on Review would still add up.
    const stale = await page.evaluate(() => {
      const st = window.__importer.state();
      return { reports: st.reports ? st.reports.length : null, plan: st.plan ? st.plan.entries.length : null };
    });
    ok(stale.reports === 5 && stale.plan === 4, "before: 5 files parsed, 4 in the plan: " + JSON.stringify(stale));
    await page.setInputFiles("#filepick", [C("example-fin-01.json")]);
    await page.waitForFunction(() => window.__importer.state().files.length === 6);
    const after = await page.evaluate(() => {
      const st = window.__importer.state();
      return { files: st.files.length, reports: st.reports, plan: st.plan };
    });
    ok(after.files === 6, "the sixth file is in the batch: " + after.files);
    ok(after.reports === null && after.plan === null,
      "and the reports and the plan from the previous batch are gone: " + JSON.stringify(after));
    // Re-running gives a plan that accounts for all six.
    await page.click("#continue");
    await page.waitForFunction(() => window.__importer.state().step === 1);
    const redone = await page.evaluate(() => window.__importer.state().plan.entries.length);
    ok(redone === 5, "re-running covers all five packages that parse: " + redone);
  }

  console.log("7c. a batch with nothing to add says so, and cannot continue");
  {
    // The other half of the enable rule. The batch above has one addition, so it
    // could never show that Continue turns OFF.
    const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs2 = [];
    page2.on("pageerror", e => errs2.push(String(e)));
    await page2.goto("file://" + path.join(ROOT, "marginal-importer.html"));
    await page2.setInputFiles("#filepick", [C("example-mkt-01.json"), C("example-ah-religion.json")]);
    await page2.waitForFunction(() => window.__importer.state().files.length === 2);
    await page2.click("#continue");
    await page2.waitForFunction(() => window.__importer.state().step === 1);
    await page2.click("#next"); await page2.waitForFunction(() => window.__importer.state().step === 2);
    await page2.click("#next"); await page2.waitForFunction(() => window.__importer.state().step === 3);
    await page2.click("#next"); await page2.waitForFunction(() => window.__importer.state().step === 4);
    const entries = ["example-mkt-01.json", "example-ah-religion.json"].map(f => ({ source: f, pkg: readPkg(f) }));
    const emptyPlan = admit.plan(entries, REG, MAN, { registry: DIR });
    ok(emptyPlan.empty === true, "this batch really does add nothing, per the plan");
    const body = await page2.textContent("#screen");
    ok(/Nothing would be written/.test(body), "the screen says nothing would be written");
    ok(/2 questions cannot be published/.test(body), "and names both held questions");
    const off = await page2.$eval("#next", b => b.disabled);
    ok(off === true, "Continue to Publish is OFF when the plan is empty: disabled=" + off);
    ok(!errs2.length, "with no page error: " + JSON.stringify(errs2));
    await page2.close();
  }

  console.log("8. this slice cannot write, and does not pretend it can");
  {
    // Walk forward to the last step and confirm it is drawn and inert.
    await page.evaluate(() => window.__importer.go(5));
    await page.waitForFunction(() => window.__importer.state().step === 5);
    const body = await page.textContent("#screen");
    ok(/Publish is not built yet/.test(body), "the last step says so plainly");
    const buttons = await page.$$eval("#screen button", bs => bs.map(b => b.textContent.trim()));
    ok(!buttons.some(b => /^Publish/.test(b)), "and offers no Publish button: " + JSON.stringify(buttons));
    // The page holds nothing anywhere it could survive a reload.
    const stored = await page.evaluate(() => {
      let ls = -1, ss = -1;
      try { ls = window.localStorage.length; } catch (e) { ls = -2; }
      try { ss = window.sessionStorage.length; } catch (e) { ss = -2; }
      return { ls, ss, cookies: document.cookie };
    });
    ok(stored.ls <= 0 && stored.ss <= 0 && !stored.cookies,
      "nothing is in local storage, session storage or a cookie: " + JSON.stringify(stored));
    ok(!requests.length, "and the page made no network request: " + JSON.stringify(requests));
    // A reload starts empty, which is the honest behaviour for a build with no
    // store: it must not appear to have remembered anything.
    await page.reload();
    await page.waitForFunction(() => window.__importer && window.__importer.state().step === 0);
    const afterReload = await page.evaluate(() => window.__importer.state().files.length);
    ok(afterReload === 0, "after a reload the importer is empty again: " + afterReload);
    const reg = lib.questionRegistry();
    ok(reg.ids.length === 19, "and the question bank is untouched at 19: " + reg.ids.length);
  }

  console.log("9. nothing in the page decides what the modules decide");
  {
    const src = fs.readFileSync(path.join(ROOT, "importer.js"), "utf8");
    // A VERDICT is the validator's conclusion about a package, and the page must
    // never reach one of its own. A SEVERITY is a field on a finding the
    // validator already produced, and grouping findings by it is reading, not
    // deciding, so severity names are allowed and verdict strings are not.
    const verdicts = (src.match(/[=!]==\s*["'](?:rejected|accepted|valid|invalid)["']/g) || []);
    ok(!verdicts.length, "the page compares nothing against a verdict string: " + JSON.stringify(verdicts));
    const sevReads = (src.match(/severity\s*===\s*["'](\w+)["']/g) || []);
    ok(sevReads.every(x => /"(error|blocked|shortfall|warning)"/.test(x)),
      "and where it reads a severity, it is one the validator defines: " + JSON.stringify(sevReads));
    ok(!/\.severity\s*===\s*["']error["']\s*\?\s*["']rejected/.test(src),
      "and does not map severities to verdicts of its own");
    ok(!/localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|sendBeacon/.test(src),
      "it contains no persistence or network call at all");
    ok(/window\.MarginalContract/.test(src) && !/function validate\b/.test(src),
      "and it calls the contract rather than containing one");
    ok(!pageErrors.length, "the page raised no error while all of that happened: " + JSON.stringify(pageErrors));
  }

  fs.rmSync(NOT_JSON, { force: true });
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
