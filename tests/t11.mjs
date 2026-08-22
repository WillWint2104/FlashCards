import { esSplitBlocks, esNewBlock, esNormLine, esReconcileBlocks } from './blocks.mjs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('  FAIL:',m);} };

console.log('--- the splitter, on text that used to break it ---');
const sp = t => esSplitBlocks(t);
ok(sp("Costs rose 3.5 per cent. Profit fell.").length===2,'a decimal is not a sentence end: '+JSON.stringify(sp("Costs rose 3.5 per cent. Profit fell.")));
ok(sp("Dr. Smith advised the owner. She agreed.").length===2,'an abbreviation is not: '+JSON.stringify(sp("Dr. Smith advised the owner. She agreed.")));
ok(sp("Channels include e.g. social media. This suits them.").length===2,'e.g. is not: '+JSON.stringify(sp("Channels include e.g. social media. This suits them.")));
ok(sp("The U.S. market differs. Australia is smaller.").length===2,'initials are not: '+JSON.stringify(sp("The U.S. market differs. Australia is smaller.")));
ok(sp("Revenue hit $1,200.50 in May. That is a record.").length===2,'a price is not: '+JSON.stringify(sp("Revenue hit $1,200.50 in May. That is a record.")));
ok(sp('She said "it works." Then she left.').length===2,'a closing quote goes with its sentence: '+JSON.stringify(sp('She said "it works." Then she left.')));
ok(sp("Is it effective? Yes. Mostly!").length===3,'question and exclamation marks split: '+JSON.stringify(sp("Is it effective? Yes. Mostly!")));
ok(sp("").length===0 && sp("No full stop here").length===1,'empty and unterminated text');
ok(sp("The firm uses AI. It helps.").length===2,'a trailing acronym still ends a sentence: '+JSON.stringify(sp("The firm uses AI. It helps.")));
ok(esSplitBlocks("One. Two. Three.").join("|")==="One.|Two.|Three.",'joins back losslessly');

console.log('--- reconciliation: the cases that actually bite ---');
const D = () => ({ seq: 0 });
function mk(d, rows){ return rows.map(r=>{ const b=esNewBlock(d, r[0], r[1], "written"); b.evidenceIds=[r[1]+"-ev"]; return b; }); }
function recon(rows, newText){
  const d=D(); const p={ blocks: mk(d, rows), text: newText };
  return esReconcileBlocks(d, p);
}
const base=[["Target markets shape the mix.","point"],["Mobile ordering suits them.","evidence"],["This shows the link.","link"]];

let r=recon(base,"Target markets shape the mix. Mobile ordering suits them. This shows the link.");
ok(r.length===3 && r.every(b=>b.slot),'no change keeps everything: '+r.map(b=>b.id+':'+b.slot).join(' '));

r=recon(base,"Target markets shape the mix! Mobile ordering suits them. This shows the link.");
ok(r[0].slot==='point' && r[0].id==='b1','a punctuation-only edit keeps identity: '+r[0].id+':'+r[0].slot);

r=recon(base,"Target markets shape the marketing mix. Mobile ordering suits them. This shows the link.");
ok(r.length===3,'one word changed mid-sentence still gives three: '+r.length);
ok(r[1].id==='b2' && r[2].id==='b3','the untouched sentences keep their ids: '+r.map(b=>b.id).join(','));
ok(!r[0].slot,'and the changed one loses its slot rather than keeping a wrong one: '+JSON.stringify(r[0].slot));

r=recon(base,"Mobile ordering suits them. This shows the link.");
ok(r.length===2 && r[0].id==='b2','deleting the FIRST sentence keeps the rest: '+r.map(b=>b.id).join(','));

r=recon(base,"Target markets shape the mix. A new sentence sits between. Mobile ordering suits them. This shows the link.");
ok(r.length===4 && r[0].id==='b1' && r[2].id==='b2','inserting between keeps both neighbours: '+r.map(b=>b.id).join(','));
ok(!r[1].slot,'and the inserted one carries no borrowed slot');

r=recon(base,"Target markets shape the mix. Mobile ordering suits them because it is fast. It saves time. This shows the link.");
ok(r.length===4 && r[0].id==='b1' && r[3].id==='b3','splitting one sentence into two keeps the others: '+r.map(b=>b.id).join(','));

r=recon(base,"Target markets shape the mix. Mobile ordering suits them and this shows the link.");
ok(r.length===2 && r[0].id==='b1','merging two into one keeps the untouched one: '+r.map(b=>b.id).join(','));
ok(!r[1].slot,'and the merged sentence has no slot');

r=recon(base,"This shows the link. Target markets shape the mix. Mobile ordering suits them.");
ok(r.length===3,'moving a sentence still yields three: '+r.length);
ok(r.filter(b=>b.slot).length>=1,'and at least the sentences that stayed in order keep identity: '+r.map(b=>b.id+':'+b.slot).join(' '));

console.log('--- duplicates: lose the metadata rather than guess ---');
const dup=[["The same sentence.","point"],["Something else.","evidence"],["The same sentence.","link"]];
r=recon(dup,"The same sentence. Something else.");
ok(r.length===2,'two remain: '+r.length);
const survivor=r.find(b=>/same sentence/i.test(b.text));
ok(survivor && !survivor.slot && survivor.ambiguous===true,
   'the duplicated survivor is flagged and stripped rather than given one of the two slots: '+JSON.stringify({slot:survivor&&survivor.slot,amb:survivor&&survivor.ambiguous}));
ok(r.find(b=>/Something else/.test(b.text)).slot==='evidence','the unambiguous sentence is untouched');
r=recon(dup,"The same sentence. Something else. The same sentence.");
ok(r.filter(b=>b.ambiguous).length===0,'unchanged duplicates are NOT disturbed: '+r.map(b=>b.id+':'+b.slot).join(' '));

console.log('--- several edits at once ---');
r=recon(base,"Target markets shape the mix. A brand new line. This shows the link. And a final line.");
ok(r.length===4,'four blocks: '+r.length);
ok(r[0].id==='b1' && r[2].id==='b3','both surviving sentences keep their ids: '+r.map(b=>b.id).join(','));
ok(r.filter(b=>b.slot).length===2,'exactly the two survivors keep a slot');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
