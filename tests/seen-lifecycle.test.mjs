import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
for(const skin of ['classic','holonet','zoom']) {
 const source=fs.readFileSync(path.join(root,'skins',skin,'src/entry.mjs'),'utf8');
 const start=source.indexOf('function reportSeen() {'),end=source.indexOf('\n}',start)+2;
 const callback=source.slice(start,end);
 const helper=source.split('\n').find(line=>line.startsWith('const on = (target, kind, handler) =>'));
 const registration=source.split('\n').find(line=>/(?:addEventListener|on\().*"scroll", reportSeen/.test(line));
 assert(start>=0&&end>start&&helper&&registration);
 assert(source.includes('abort.abort();'),'teardown aborts shared listeners');
 function fixture() {
  const errors=[],calls=[],abort=new AbortController();
  class Timeline extends EventTarget {
   scrollHeight=1000;scrollTop=900;clientHeight=100;
   addEventListener(type,handler,options) {
    super.addEventListener(type,event=>{try{handler(event);}catch(error){errors.push(error.message);}},options);
   }
  }
  const old=new Timeline();let current=old;
  vm.runInNewContext(helper+'\n'+callback+'\n'+registration,{
   abort,$:()=>current,
   document:{visibilityState:'visible',hasFocus:()=>true},
   state:{dmData:{id:'original-dm',messages:[{id:'original-message',dir:'in'}]},overview:{notify:{enabled:true}},seenReported:{}},
   api:(route,body)=>{calls.push({route,body:JSON.parse(JSON.stringify(body))});return Promise.resolve({});}
  });
  return {old,errors,calls,retire(){abort.abort();current=null;},remount(){current=new Timeline();}};
 }
 test(skin+': queued timeline scroll cannot outlive unmount',async()=>{
  const f=fixture(),queued=Promise.resolve().then(()=>f.old.dispatchEvent(new Event('scroll')));
  f.retire();await queued;
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.calls,[]);
 });
 test(skin+': stale timeline cannot report old DM through remounted root',()=>{
  const f=fixture();f.retire();f.remount();f.old.dispatchEvent(new Event('scroll'));
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.calls,[]);
 });
 test(skin+': current timeline still reports only visible bottom once',()=>{
  const f=fixture();f.old.scrollTop=0;f.old.dispatchEvent(new Event('scroll'));assert.deepEqual(f.calls,[]);
  f.old.scrollTop=900;f.old.dispatchEvent(new Event('scroll'));f.old.dispatchEvent(new Event('scroll'));
  assert.deepEqual(f.errors,[]);
  assert.deepEqual(f.calls,[{route:'/api/notify/seen',body:{conv:'original-dm',ids:['original-message']}}]);
 });
}
