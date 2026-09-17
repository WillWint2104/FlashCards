const { chromium, T, OUT, BASE, fileUrl } = require('./env');

// Waits that name their condition. This app fetches nothing and renders
// synchronously, so the effect of a click is present on the next frame:
// settled() is that frame, not a shorter guess at a duration.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const here = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

// A SHORT-ANSWER review: one paragraph, NO rubric, focus pointing at a real line.
const SHORT = ans => ({
  summary:"You name the strategy but do not say what it does for the objective.",
  total:2,max:4,score:2,
  paragraphs:[{name:"Your answer",score:2,max:4,reasons:[{kind:'weak',text:'Names it without explaining it'}],sentences:[
    {text:"McDonalds uses mobile ordering.",issues:[
      {kind:'fix',severity:'critical',head:'Say what it achieves',why:'You name mobile ordering but do not say what it does for the objective the question asks about.',
       ladder:[{level:'Clear',text:'Mobile ordering cuts waiting time, which improves speed.'},{level:'Better',text:'Mobile ordering shortens the queue, improving speed of service.'},{level:'Band 6',text:'By moving ordering off the counter, mobile ordering removes the queue as a constraint on speed.'}]}]}]}],
  rubric:[],
  focus:{area:'Explanation',paragraph:1,index:0,sentence:0,why:'You name mobile ordering but never say what it achieves.',quote:'McDonalds uses mobile ordering.'},
  credited:[],checks:{passes:2,sentences:1,sentencesVerified:1,grounded:1,focusQuoted:true},
  overall:{summary:'x'},criteria:[],next_steps:[],missing_vocabulary:[],
});

(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let sent=null;
  await p.route(/workers\.dev/, async r=>{
    const s=JSON.parse(r.request().postData()||'{}');
    if (s.action==='coach') return r.fulfill({status:200,contentType:'application/json',body:'{"nudges":[]}'});
    sent=s;
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SHORT(s.answer))});
  });
  await p.goto(T+'?review=1'); await settled(p);

  console.log('--- sit only the short-answer section ---');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Test mode/i.test(x.textContent)); t&&t.click();});
  await settled(p);
  await p.$$eval('button, .area',es=>{const t=es.find(x=>/^Sit\b|Sit /i.test(x.textContent.trim())); t&&t.click();});
  await settled(p);
  await p.click('text=Clear'); await settled(p);
  await p.$$eval('.exam-pick, [data-exampick], label, button',es=>{
    const t=es.find(x=>/Short answer/i.test(x.textContent)); t&&t.click();
  });
  await settled(p);
  await p.click('text=Start'); await settled(p);
  // walk past the section intro
  const begin = await p.$('#exambegin'); if (begin) { await begin.click(); await settled(p); }
  ok(!!(await p.$('#ans')),'a short-answer question is on screen');
  const marks = await p.$eval('.exam-qhead',e=>e.textContent.trim());
  console.log('    question:', marks);

  console.log('--- answer it: the checklist gives the mark ---');
  await p.fill('#ans','McDonalds uses mobile ordering.');
  await p.click('#check'); await settled(p);
  ok(!!(await p.$('.sheet')),'it grades');
  const kind = await p.$eval('#sheet',e=>e.textContent);
  ok(/✓|✗/.test(kind) || /\d+\s*\/\s*\d+/.test(kind),'a mark is shown');
  const btn = await p.$eval('#examreview',e=>e.textContent.trim()).catch(()=>'none');
  // Renamed. "Mark this properly" implied the checklist had marked it improperly,
  // which is the opposite of what a deterministic points mark is. The door is the
  // same door: what the authored points cannot say, the marker can.
  ok(/what would make this stronger/i.test(btn),'the same review is offered on a short answer: '+btn);
  await p.screenshot({path:OUT+'shot-short-sheet.png'});

  console.log('--- ask for it: marked AS a short answer ---');
  await p.click('#examreview'); await settled(p);
  ok(sent && sent.responseType==='short','the request says it is a short answer: '+(sent&&sent.responseType));
  ok(sent && sent.marks>0 && sent.marks<=10,'with its own mark value: '+(sent&&sent.marks));
  ok(sent && typeof sent.command==='string','the directive verb travels: '+JSON.stringify(sent&&sent.command));
  // TEST MODE DOES NOT OPEN THE REWRITE WORKSPACE, AND THIS IS WHERE IT USED TO.
  //
  // What this half of the suite asserted until now: clicking through from a
  // marked short answer opened `.rv-scrim` - the Essay Practice review - with a
  // "revise" action that reopened the answer box with the marker's line
  // selected, "ready to be rewritten". That workspace renders the Clear /
  // Better / Band 6 rungs as pickable model sentences, a rewrite box, and, on an
  // extended response, criterion score pills and band descriptors. Every one of
  // those is on the list of things a marked paper must not show.
  //
  // The workspace is not gone. It is Essay Practice's and it is where revision
  // is taught. What is gone is the door out of an exam into it. The marker's
  // words now come back into the sheet the student is already looking at.
  ok(!(await p.$('.rv-scrim')),'NO review workspace opens from a marked paper');
  ok(!(await p.$('#rvtab-paragraphs')) && !(await p.$('#rvtab-rubric')),'no review tabs');
  ok(!(await p.$('.rv-focus')),'no start-here strip, and so no revise action');
  const sheet2 = await p.$eval('#sheet',e=>e.textContent);
  ok(/do not say what it does for the objective/.test(sheet2),
     "the marker's own summary renders into the sheet instead");
  ok(/try again/i.test(sheet2),'and Try again is still the way back to the answer');
  await p.screenshot({path:OUT+'shot-short-sheet-marked.png'});

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
