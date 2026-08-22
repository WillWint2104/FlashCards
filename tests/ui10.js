// the plain build on purpose: this suite tests the shipped defaults
const { chromium, P: T, OUT } = require('./env');
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,220)));
  let sent=null;
  await p.route(/workers\.dev/, async r=>{
    const s=JSON.parse(r.request().postData()||'{}');
    if (s.action==='coach') return r.fulfill({status:200,contentType:'application/json',body:'{"nudges":[]}'});
    sent=s;
    // target the SECOND sentence by id, to prove the id is followed and not the quote
    const target=(s.blocks||[])[1];
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      summary:'s',total:8,max:20,score:8,
      paragraphs:[{name:'Introduction',score:8,max:20,reasons:[],sentences:(s.blocks||[]).map(x=>({text:x.text,issues:[]}))}],
      rubric:[],
      focus:{area:'Explanation',paragraph:1,index:0,sentence:1,why:'The second line needs the reason.',
             quote:target?target.text:'',targetBlockId:target?target.id:''},
      credited:[],checks:{passes:2,sentences:2,sentencesVerified:2,grounded:1,focusQuoted:true,focusBlock:true},
      overall:{summary:'x'},criteria:[],next_steps:[],missing_vocabulary:[]})});
  });
  await p.goto(T+'?essaydemo=1&essaymark=1'); await p.waitForTimeout(700);
  await p.fill('#esq','Explain how target markets affect e-marketing.');
  await p.click('#esstart'); await p.waitForTimeout(450);

  console.log('--- blocks are durable and carry identity ---');
  await p.fill('#esline','Target markets are the groups a business aims at.');
  await p.click('#esaccept'); await p.waitForTimeout(300);
  await p.fill('#esline','This response examines each element in turn.');
  await p.click('#esaccept'); await p.waitForTimeout(300);
  let ids = await p.evaluate(()=>JSON.parse(localStorage.getItem('marginal.essay.v1')));
  let bag = Object.values(ids)[0].drafts[0].paras[0].blocks;
  ok(bag.length===2,'two blocks saved: '+bag.length);
  ok(bag[0].id && bag[1].id && bag[0].id!==bag[1].id,'each has its own id: '+bag.map(b=>b.id).join(','));
  ok(bag[0].slot && bag[1].slot,'and the job it did: '+bag.map(b=>b.slot).join(','));
  const firstId = bag[0].id;

  console.log('--- editing elsewhere does NOT destroy identity ---');
  await p.click('#esmodeswitch'); await p.waitForTimeout(400);
  const full = await p.$eval('#esfull',e=>e.value);
  await p.fill('#esfull', full.replace('groups a business aims at','groups a business directs its marketing at'));
  await p.waitForTimeout(250);
  await p.click('#esmodeswitch'); await p.waitForTimeout(450);
  ids = await p.evaluate(()=>JSON.parse(localStorage.getItem('marginal.essay.v1')));
  bag = Object.values(ids)[0].drafts[0].paras[0].blocks;
  ok(bag.length===2,'still two blocks after a full-attempt edit: '+bag.length);
  const survivor = bag.find(x=>/examines each element/.test(x.text));
  ok(!!survivor && survivor.slot,'the UNCHANGED sentence kept its id and job: '+(survivor&&survivor.id)+' / '+(survivor&&survivor.slot));
  const changed = bag.find(x=>/directs its marketing/.test(x.text));
  ok(!!changed,'the edited sentence is present: '+(changed&&changed.id));
  ok(changed.id!==survivor.id,'and the two are distinct blocks');

  console.log('--- marking receives the sentence list ---');
  await p.click('#esmodeswitch'); await p.waitForTimeout(400);
  await p.click('#essubmit'); await p.waitForTimeout(900);
  ok(sent && Array.isArray(sent.blocks) && sent.blocks.length===2,'blocks travel with the response: '+(sent&&(sent.blocks||[]).length));
  ok(sent.blocks[0].id && sent.blocks[0].text,'each carries id and text');

  console.log('--- revise opens the block the marker named, not the one it quoted first ---');
  await p.click('#esrevise'); await p.waitForTimeout(600);
  const open = await p.$('[data-esedit]');
  ok(!!open,'a sentence opened for editing');
  const v = await p.$eval('[data-esedit]',e=>e.value);
  ok(/examines each element/.test(v),'and it is the SECOND sentence, the one the id named: '+JSON.stringify(v.slice(0,45)));

  console.log('pageerrors:', errs.join(' | ')||'none');
  ok(errs.length===0,'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail?1:0);
})();
