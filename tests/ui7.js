const { chromium, T, OUT, BASE, fileUrl } = require('./env');
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
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let sent=null;
  await p.route(/workers\.dev/, async r=>{
    const s=JSON.parse(r.request().postData()||'{}');
    if (s.action==='coach') return r.fulfill({status:200,contentType:'application/json',body:'{"nudges":[]}'});
    sent=s;
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SHORT(s.answer))});
  });
  await p.goto(T+'?review=1'); await p.waitForTimeout(900);

  console.log('--- sit only the short-answer section ---');
  await p.$$eval('.navtab',es=>{const t=es.find(x=>/Test mode/i.test(x.textContent)); t&&t.click();});
  await p.waitForTimeout(500);
  await p.$$eval('button, .area',es=>{const t=es.find(x=>/^Sit\b|Sit /i.test(x.textContent.trim())); t&&t.click();});
  await p.waitForTimeout(500);
  await p.click('text=Clear'); await p.waitForTimeout(200);
  await p.$$eval('.exam-pick, [data-exampick], label, button',es=>{
    const t=es.find(x=>/Short answer/i.test(x.textContent)); t&&t.click();
  });
  await p.waitForTimeout(250);
  await p.click('text=Start'); await p.waitForTimeout(500);
  // walk past the section intro
  const begin = await p.$('#exambegin'); if (begin) { await begin.click(); await p.waitForTimeout(500); }
  ok(!!(await p.$('#ans')),'a short-answer question is on screen');
  const marks = await p.$eval('.exam-qhead',e=>e.textContent.trim());
  console.log('    question:', marks);

  console.log('--- answer it: the checklist gives the mark ---');
  await p.fill('#ans','McDonalds uses mobile ordering.');
  await p.click('#check'); await p.waitForTimeout(700);
  ok(!!(await p.$('.sheet')),'it grades');
  const kind = await p.$eval('#sheet',e=>e.textContent);
  ok(/✓|✗/.test(kind) || /\d+\s*\/\s*\d+/.test(kind),'a mark is shown');
  const btn = await p.$eval('#examreview',e=>e.textContent.trim()).catch(()=>'none');
  ok(/mark this properly/i.test(btn),'the same review is offered on a short answer: '+btn);
  await p.screenshot({path:OUT+'shot-short-sheet.png'});

  console.log('--- ask for it: marked AS a short answer ---');
  await p.click('#examreview'); await p.waitForTimeout(900);
  ok(sent && sent.responseType==='short','the request says it is a short answer: '+(sent&&sent.responseType));
  ok(sent && sent.marks>0 && sent.marks<=10,'with its own mark value: '+(sent&&sent.marks));
  ok(sent && typeof sent.command==='string','the directive verb travels: '+JSON.stringify(sent&&sent.command));
  ok(!!(await p.$('.rv-scrim')),'the review opens');
  ok(!(await p.$('#rvtab-rubric')),'no band rubric tab on a short answer');
  ok(!(await p.$('.rv-scorehint')),'and no tap-the-score hint pointing at one');
  const tab = await p.$eval('#rvtab-paragraphs',e=>e.textContent.trim());
  ok(/your answer/i.test(tab),'the tab reads as one answer, not paragraphs: '+tab);
  ok(!!(await p.$('.rv-focus')),'the start-here strip is there');
  const go = await p.$eval('#rvfocusgo',e=>e.textContent.trim());
  ok(/revise/i.test(go),'and it offers to revise, because the box is reachable: '+go);
  await p.screenshot({path:OUT+'shot-short-review.png'});

  console.log('--- revise returns to the answer box with the line selected ---');
  await p.click('#rvfocusgo'); await p.waitForTimeout(600);
  ok(!(await p.$('.rv-scrim')),'the review closes');
  ok(!!(await p.$('#ans')),'the question is back');
  const box = await p.$eval('#ans',e=>({v:e.value,s:e.selectionStart,e:e.selectionEnd}));
  ok(box.v==='McDonalds uses mobile ordering.','the answer is restored: '+JSON.stringify(box.v));
  ok(box.e>box.s,'and the marker\'s line is selected: '+JSON.stringify([box.s,box.e]));

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
