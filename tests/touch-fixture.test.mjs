import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fixtureCLI from './touch-fixture.cjs';
const {publicCLI,threadRecords,dmRecords,historyPrefix,renderedIDMatches,seedPublicHistory}=fixtureCLI;
const conv='a'.repeat(64),root='b'.repeat(32),otherConv='c'.repeat(64),otherRoot='d'.repeat(32);
const captured='agentnet: database is locked (5) (SQLITE_BUSY)\n';
const good={status:0,signal:null,stdout:'complete',stderr:''};
const busy={status:1,signal:null,stdout:'',stderr:captured};
const dm=['dm','show',conv],conversation=['conversation','--json','--limit','0',root];
function fixture(plan){
 let clock=10000;const calls=[],retries=[];
 const env={PATH:'/owned/world/bin:/usr/bin:/bin',HOME:'/owned/world/cli-home'};
 const native=publicCLI({binary:'fixture-agentnet',home:'/owned/world/sergey',cwd:'/owned/world/work',env,conv,thread:()=>root,now:()=>clock,onRetry:event=>retries.push(event),spawnSync:(binary,args,options)=>{
  assert(calls.length<plan.length,'Unexpected extra native invocation');const next=plan[calls.length];
  calls.push({binary,args,options});clock+=next.elapsed||0;
  const {elapsed,...result}=next;return result;
 }});
 return {native,calls,retries,now:()=>clock};
}
test('busy then success retries each bound pure read with identical arguments and one absolute default deadline',()=>{
 for(const args of [dm,conversation]){
  const f=fixture([{...busy,elapsed:5000},good]);assert.equal(f.native(args),'complete');
  assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0].args,f.calls[1].args);assert.deepEqual(f.calls[0].args,['--home','/owned/world/sergey',...args]);
  assert.deepEqual(f.calls.map(c=>c.options.timeout),[15000,10000]);assert.equal(f.retries.length,1);
  for(const c of f.calls){assert.equal(c.binary,'fixture-agentnet');assert.equal(c.options.cwd,'/owned/world/work');assert.equal(c.options.env.HOME,'/owned/world/cli-home');assert.equal(c.options.maxBuffer,1024*1024);}
 }
});
test('persistent busy fails after three attempts and never refreshes the deadline',()=>{
 const f=fixture(Array.from({length:3},()=>({...busy,elapsed:5000})));assert.throws(()=>f.native(dm),/SQLITE_BUSY/);
 assert.equal(f.calls.length,3);assert.deepEqual(f.calls.map(c=>c.options.timeout),[15000,10000,5000]);assert.equal(f.retries.length,2);assert.equal(f.now(),25000);
});
test('expiration before retry refuses it, and an already expired operation invokes nothing',()=>{
 const f=fixture([{...busy,elapsed:15000}]);assert.throws(()=>f.native(dm),/SQLITE_BUSY/);assert.equal(f.calls.length,1);assert.equal(f.retries.length,0);
 const expired=fixture([]);assert.throws(()=>expired.native(dm,expired.now()),/deadline expired/);assert.equal(expired.calls.length,0);
});
test('successive reads and retry attempts share the original explicit settlement deadline',()=>{
 const f=fixture([{...busy,elapsed:5000},{...good,elapsed:10},good]),settledBy=f.now()+60000;
 assert.equal(f.native(dm,settledBy),'complete');assert.equal(f.native(conversation,settledBy),'complete');
 assert.deepEqual(f.calls.map(c=>c.options.timeout),[60000,55000,54990]);assert.equal(f.retries.length,1);
});
test('other errors, exit classes, signal and timeout results never retry',()=>{
 for(const result of [{...busy,stderr:'agentnet: no such conversation\n'},{...busy,status:2},{...busy,signal:'SIGTERM',status:null},{...busy,error:Object.assign(new Error('spawn timeout'),{code:'ETIMEDOUT'})},{...busy,stderr:captured+'additional error\n'},{...busy,status:null}]){
  const f=fixture([result]);assert.throws(()=>f.native(dm));assert.equal(f.calls.length,1);assert.equal(f.retries.length,0);
 }
});
test('sends, status waits and unrecognized or broadened commands are always single-attempt',()=>{
 for(const args of [['dm','send',conv,'Long history 001'],['send','--wait','0','invented/desk','Device history 001'],['send','--wait','0','--reply-to',root,'invented/desk','Device history 002'],['status','--wait','10s',root],['unrecognized'],['dm','show',conv,'--unknown'],['conversation','--json','--limit','1',root]]){
  const f=fixture([busy]);assert.throws(()=>f.native(args),/SQLITE_BUSY/);assert.equal(f.calls.length,1);assert.equal(f.retries.length,0);
 }
});
test('different or malformed fixture identities cannot gain a read retry',()=>{
 for(const args of [['dm','show',otherConv],['dm','show','bad'],['conversation','--json','--limit','0',otherRoot],['conversation','--json','--limit','0','bad']]){
  const f=fixture([busy]);assert.throws(()=>f.native(args),/SQLITE_BUSY/);assert.equal(f.calls.length,1);assert.equal(f.retries.length,0);
 }
});
test('partial output on a busy failure and malformed success data never retry or become a pass',()=>{
 const partial=fixture([{...busy,stdout:'partial record'}]);assert.throws(()=>partial.native(dm),/SQLITE_BUSY/);assert.equal(partial.calls.length,1);assert.equal(partial.retries.length,0);
 const malformed=fixture([{...good,stdout:'not JSON'}]);assert.throws(()=>threadRecords(malformed.native(conversation),root,'invented/desk','invented/laptop'));assert.equal(malformed.calls.length,1);assert.equal(malformed.retries.length,0);
});
test('a changed bound thread refuses the next attempt before another CLI invocation',()=>{
 let current=root,calls=0;
 const native=publicCLI({binary:'fixture-agentnet',home:'/owned/world/sergey',cwd:'/owned/world/work',env:{},conv,thread:()=>current,now:()=>10000,onRetry:()=>{current=otherRoot;},spawnSync:()=>{calls++;return busy;}});
 assert.throws(()=>native(conversation),/Changed fixture thread/);assert.equal(calls,1);
});

{
const conv='a'.repeat(64),from='admin/laptop',peer='anna/desk',id=n=>n.toString(16).padStart(32,'0');
const record=(n,body='Long history '+String(n).padStart(3,'0'),physical=id(n),logical=id(n+1000))=>'2026-10-15 03:15  out '+from+' [ui] message (delivered; admin/phone: delivered; anna/desk: delivered)  '+physical+' lid '+logical+'\n  '+body+'\n';
const parse=stdout=>dmRecords(stdout,conv,conv,from);
const clone=v=>JSON.parse(JSON.stringify(v));
const messages=Array.from({length:200},(_,i)=>({id:id(i+1),dir:'out',from,to:peer,kind:'message',body:'Device history '+String(i+1).padStart(3,'0'),state:'delivered',...(i?{reply_to:id(i)}:{})}));
const device={peer,total:messages.length,offset:0,messages};
const parseDevice=(view,root=id(1))=>threadRecords(JSON.stringify(view),root,peer,from);

test('DM records preserve exact distinct physical IDs and LIDs',()=>{
 const rows=parse(Array.from({length:10},(_,i)=>record(i+1)).join(''));assert.equal(rows.length,10);
 for(let i=0;i<rows.length;i++){assert.equal(rows[i].id,id(i+1));assert.equal(rows[i].lid,id(i+1001));assert.notEqual(rows[i].id,rows[i].lid);}
});
test('exact original-conversation command binding rejects a wrong conv',()=>{
 assert.throws(()=>dmRecords(record(1),'b'.repeat(64),conv,from),/Wrong original DM/);
 assert.throws(()=>dmRecords(record(1),'bad',conv,from));
});
test('complete prefix and current body records remain exact, never substrings',()=>{
 const body='Long history write abc123',rows=dmRecords(record(1)+record(2)+record(3,body),conv,conv,from,[body]);
 assert.equal(rows.length,3);assert.equal(historyPrefix(rows,'Long history ').length,2);
 assert.equal(dmRecords(record(1,'Long history write abc123 extra'),conv,conv,from,[body]).length,0);
});
test('malformed physical/logical IDs, header author, kind and state fail closed',()=>{
 for(const stdout of [record(1).replace(id(1),'z'.repeat(32)),record(1).replace(id(1001),'a'.repeat(31)),record(1).replace(from,'admin/phone'),record(1).replace('  out ','  in '),record(1).replace(' message ',' question '),record(1).replace('(delivered;','(invented;'),record(1).replace('anna/desk: delivered','anna/desk: invented'),record(1).replace('2026-10-15','not-a-date')])assert.throws(()=>parse(stdout));
});
test('malformed body indentation, trailing spaces, multiline records and ANSI fail',()=>{
 for(const stdout of [record(1).replace('\n  Long','\nLong'),record(1).replace('history 001\n','history 001 \n'),record(1).replace('\n  Long','\n  another line\n  Long'),record(1).replace('2026','\x1b[31m2026')])assert.throws(()=>parse(stdout));
});
test('duplicate body, physical ID or LID fails even when the other fields differ',()=>{
 for(const stdout of [record(1)+record(2,'Long history 001'),record(1)+record(2,'Long history 002',id(1)),record(1)+record(2,'Long history 002',id(2),id(1001))])assert.throws(()=>parse(stdout),/Duplicate/);
});
test('prefix gaps, zero/out-of-bound numbering and duplicate history fail',()=>{
 for(const rows of [parse(record(1)+record(3)),parse(record(1,'Long history 000')),parse(record(1,'Long history 201'))])assert.throws(()=>historyPrefix(rows,'Long history '));
 const rows=parse(record(1)+record(2));assert.throws(()=>historyPrefix([...rows,rows[1]],'Long history '));
});
test('200 unique history rows are accepted without dependence on output order',()=>{
 const stdout=Array.from({length:200},(_,i)=>record(i+1)).reverse().join('');assert.equal(historyPrefix(parse(stdout),'Long history ').length,200);
});
test('queued copy detection preserves settlement when main delivery is advanced',()=>{
 const rows=parse(record(1).replace('admin/phone: delivered','admin/phone: queued'));assert.equal(rows[0].queued,true);
});
test('exact public device membership accepts one 200-message predecessor chain',()=>{
 assert.equal(parseDevice(device).length,200);
 const extended=clone(device);extended.messages.push({id:id(300),dir:'out',from,to:peer,kind:'message',body:'Device history write abc123',state:'delivered',reply_to:id(1)});extended.total++;
 assert.equal(parseDevice(extended).length,201); // A later Write may attach to the root; exact membership still holds.
});
test('wrong root or same-title different root is rejected',()=>{
 assert.throws(()=>parseDevice(device,id(2)),/Wrong exact device root/);
 const changed=clone(device);changed.messages[0].id=id(500);changed.messages[1].reply_to=id(500);assert.throws(()=>parseDevice(changed),/Wrong exact device root/);
});
test('wrong peer, sender, recipient, kind, ID and duplicate IDs fail',()=>{
 for(const change of [v=>{v.peer='someone/else';},v=>{v.messages[0].from='admin/phone';},v=>{v.messages[0].to='someone/else';},v=>{v.messages[0].kind='question';},v=>{v.messages[0].id='bad';},v=>{v.messages[1].id=v.messages[0].id;}]){const v=clone(device);change(v);assert.throws(()=>parseDevice(v));}
});
test('truncated/paged/malformed membership and extra root ancestors fail',()=>{
 for(const change of [v=>{v.total++;},v=>{v.offset=1;},v=>{v.messages=v.messages.slice(1);v.total--;},v=>{v.messages[0].reply_to=id(700);},v=>{v.messages[2].reply_to=id(1);},v=>{v.messages[1].body='Device history 001';}]){const v=clone(device);change(v);assert.throws(()=>parseDevice(v));}
 assert.throws(()=>threadRecords('{',id(1),peer,from));
});
test('same parent body with a wrong physical ID cannot satisfy quote identity',()=>{
 const captured={id:id(100),body:'Long history 100'},wrongSameText={id:id(101),body:'Long history 100'};
 assert.equal(renderedIDMatches(captured.id,captured.id),true);assert.equal(renderedIDMatches(wrongSameText.id,captured.id),false);assert.throws(()=>renderedIDMatches('local-pending',captured.id));
});
}

// Exercise the complete seeding order with injected public CLI results only.
function seedFixture(t,intercept=()=>null){
 let clock=10000;const calls=[],id=n=>n.toString(16).padStart(32,'0'),from='fixture/laptop',to='fixture/desk';
 const dms=Array.from({length:198},(_,i)=>({id:id(i+1),lid:id(i+1001),body:'Long history '+String(i+1).padStart(3,'0'),queued:false})),messages=[];
 t.mock.method(Date,'now',()=>clock);t.mock.method(fs,'existsSync',()=>false);t.mock.method(fs,'writeFileSync',()=>{});
 const run=()=>seedPublicHistory({world:'/owned/disposable-world',binary:'fixture-agentnet',conv,to,from,spawnSync:(binary,args,options)=>{
  const command=args.slice(2),call={command,timeout:options.timeout,at:clock};calls.push(call);
  const override=intercept({call,calls,dms,messages,advance:ms=>{clock+=ms;}});if(override)return override;
  let stdout='';
  if(command[0]==='dm'&&command[1]==='show')stdout=dms.map(m=>'2026-10-15 03:15  out '+from+' message (delivered; fixture/desk: '+(m.queued?'queued':'delivered')+')  '+m.id+' lid '+m.lid+'\n  '+m.body+'\n').join('');
  else if(command[0]==='dm'&&command[1]==='send'){const n=dms.length+1;dms.push({id:id(n),lid:id(n+1000),body:command[3],queued:true});}
  else if(command[0]==='send'){
   const n=messages.length+1,m={id:id(n+2000),dir:'out',from,to,kind:'message',body:command.at(-1),state:n===200?'queued':'delivered'};
   if(n>1)m.reply_to=command[4];messages.push(m);stdout=m.id+' queued\n';
  }else if(command[0]==='conversation')stdout=JSON.stringify({peer:to,offset:0,total:messages.length,messages});
  else if(command[0]==='status'){
   const stored=dms.find(m=>m.lid===command[3])||messages.find(m=>m.id===command[3]);assert(stored,'Status must use the exact stored LID or device ID');stored.queued=false;stored.state='delivered';stdout=command[3]+' delivered relay\n';
  }else assert.fail('Unexpected public command');
  return {...good,stdout};
 }});
 return {run,calls,dms,messages,id};
}
test('DM preflight uses exact queued-copy LIDs before legacy writes; both histories and final 60s budget stay intact',t=>{
 const f=seedFixture(t,({call,advance})=>{if(call.command[0]==='dm'&&call.command[1]==='show')advance(1000);if(call.command[0]==='status')advance(2000);});
 const result=f.run(),firstLegacy=f.calls.findIndex(c=>c.command[0]==='send'),before=f.calls.slice(0,firstLegacy),waits=before.filter(c=>c.command[0]==='status');
 assert.equal(result.thread,f.id(2001));assert.equal(f.dms.length,200);assert.equal(f.messages.length,200);
 assert.deepEqual(before.slice(0,4).map(c=>c.command.slice(0,2)),[['dm','show'],['dm','send'],['dm','send'],['dm','show']]);
 assert.deepEqual(waits.map(c=>c.command),[['status','--wait','14000ms',f.id(1199)],['status','--wait','12000ms',f.id(1200)]]);
 assert.deepEqual(before.slice(3).map(c=>c.timeout),[15000,14000,12000]);
 assert.equal(f.calls[firstLegacy].timeout,15000);assert(f.messages.every((m,i)=>i===0?!m.reply_to:m.reply_to===f.id(2000+i)));
 const finalRead=f.calls.findIndex((c,i)=>i>firstLegacy&&c.command[0]==='dm'&&c.command[1]==='show');
 assert.deepEqual(f.calls.slice(finalRead).map(c=>c.timeout),[60000,59000,59000,57000,56000]);
 assert.equal(f.calls[finalRead+2].command[3],f.id(2200));
});
test('an already settled DM phase adds one bound read and no status calls before the first legacy write',t=>{
 const f=seedFixture(t,({call,dms})=>{if(call.command[0]==='dm'&&call.command[1]==='show'&&dms.length===200)for(const m of dms)m.queued=false;});
 f.run();const firstLegacy=f.calls.findIndex(c=>c.command[0]==='send');assert.equal(f.calls.slice(0,firstLegacy).filter(c=>c.command[0]==='status').length,0);
 assert.equal(firstLegacy,4);assert.deepEqual(f.calls[firstLegacy-1].command,['dm','show',conv]);assert.equal(f.calls[firstLegacy-1].timeout,15000);
});
test('preflight bound read busy retry consumes the same 15s budget before status waits',t=>{
 let read=0;const f=seedFixture(t,({call,advance})=>{if(call.command[0]==='dm'&&call.command[1]==='show'&&++read===2){advance(5000);return busy;}});
 f.run();const firstLegacy=f.calls.findIndex(c=>c.command[0]==='send');assert.deepEqual(f.calls.slice(3,firstLegacy).map(c=>c.timeout),[15000,10000,10000,10000]);
 assert.deepEqual(f.calls[3].command,f.calls[4].command);
});
test('preflight expiry after the bound read refuses status and legacy writes',t=>{
 let read=0;const f=seedFixture(t,({call,advance})=>{if(call.command[0]==='dm'&&call.command[1]==='show'&&++read===2)advance(15000);});
 assert.throws(f.run,/DM fixture delivery did not settle in 15s/);assert.equal(f.calls.length,4);assert(!f.calls.some(c=>c.command[0]==='send'||c.command[0]==='status'));
});
test('a status wait exhausting the shared preflight budget prevents the next wait and legacy writes',t=>{
 const f=seedFixture(t,({call,advance})=>{if(call.command[0]==='status')advance(15000);});
 assert.throws(f.run,/DM fixture delivery did not settle in 15s/);assert.equal(f.calls.filter(c=>c.command[0]==='status').length,1);assert(!f.calls.some(c=>c.command[0]==='send'));
});
test('preflight status busy, timeout, empty, queued and local results fail without retry or legacy writes',t=>{
 for(const result of [busy,{...busy,error:new Error('spawn timeout')},{...good,stdout:''},{...good,stdout:'queued\n'},{...good,stdout:'delivered (local record)\n'}]){
  const f=seedFixture(t,({call})=>call.command[0]==='status'?result:null);
  assert.throws(f.run);assert.equal(f.calls.filter(c=>c.command[0]==='status').length,1);assert(!f.calls.some(c=>c.command[0]==='send'));
  t.mock.restoreAll();
 }
});
test('the first legacy write still fails once on busy after successful DM settlement',t=>{
 const f=seedFixture(t,({call})=>call.command[0]==='send'?busy:null);
 assert.throws(f.run,/SQLITE_BUSY/);assert.equal(f.calls.filter(c=>c.command[0]==='send').length,1);assert.equal(f.messages.length,0);
});

// A legacy fixture write waits in its original CLI invocation; it never retries.
test('legacy history sends wait 5s once per exact chained ID within the original 15s CLI budget',t=>{
 const f=seedFixture(t);f.run();const writes=f.calls.filter(c=>c.command[0]==='send');
 assert.equal(writes.length,200);assert.equal(new Set(writes.map(c=>c.command.at(-1))).size,200);
 for(const [i,c]of writes.entries()){
  assert.deepEqual(c.command.slice(0,3),['send','--wait','5s']);assert.equal(c.timeout,15000);
  assert.equal(c.command.at(-1),'Device history '+String(i+1).padStart(3,'0'));
  if(i)assert.deepEqual(c.command.slice(3,5),['--reply-to',f.id(2000+i)]);
 }
 const first=f.calls.indexOf(writes[0]),last=f.calls.indexOf(writes.at(-1));
 assert(!f.calls.slice(first,last+1).some(c=>c.command[0]==='status'),'No second status process per legacy send');
});
test('a receipt-wait legacy send error is not retried or converted into a new chain',t=>{
 let sends=0;const f=seedFixture(t,({call})=>call.command[0]==='send'&&++sends===2?busy:null);
 assert.throws(f.run,/SQLITE_BUSY/);const writes=f.calls.filter(c=>c.command[0]==='send');
 assert.equal(writes.length,2);assert.equal(f.messages.length,1);assert.deepEqual(writes[1].command.slice(0,5),['send','--wait','5s','--reply-to',f.id(2001)]);
});
