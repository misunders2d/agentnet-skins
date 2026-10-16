import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
const me={address:'atlas/desk',fingerprint:'11111111-11111111-11111111-11111111'};
const pid='a'.repeat(32),agent_id='b'.repeat(32);
const source={id:'c'.repeat(64),lid:'d'.repeat(32),dir:'out',origin:'ui',kind:'task',pid,from:me.address,body:'Exact original objective',target:{...me,agent_id},exec:{state:'running',stale:false,host:me.address,attempt:7}};
const agent={pid,agent_id,state:'active',can_ask:true,host:{...me}};
test('ordinary corrections require exact active human request and target',async()=>{
let bytes;
for(const skin of ['classic','zoom','holonet']){
 const file=new URL('../skins/'+skin+'/src/composer-followup.mjs',import.meta.url);
 const contents=await readFile(file,'utf8');if(bytes)assert.equal(contents,bytes);bytes=contents;
 const {composerFollowup:choose,activeComposerFollowups:pool,sameFollowup,currentComposerFollowup:current,composerReplyFollowup:reply}=await import(file);
 const dm={id:'e'.repeat(64),agents:[agent],messages:[source]},chosen=choose(source,pid,'',dm,me);
 assert(chosen);assert.equal(chosen.kind,'task');assert.equal(chosen.ref.id,source.lid);assert.equal(chosen.ref.fingerprint,me.fingerprint);assert.equal(sameFollowup(chosen,structuredClone(chosen)),true);
 const cases=[
  ['peer author',m=>m.dir='in'],['ordinary message',m=>m.kind='message'],['agent origin',m=>m.origin='agent:codex'],['verified agent',m=>m.verified_agent=true],
  ['local preview',m=>m._local=true],['deleted source',m=>m.deleted=true],['stale work',m=>m.exec.stale=true],['finished work',m=>m.exec.state='completed'],['missing attempt',m=>delete m.exec.attempt],['zero attempt',m=>m.exec.attempt=0],['fractional attempt',m=>m.exec.attempt=1.5],['wrong execution host',m=>m.exec.host='foreign/desk'],
  ['wrong topic',m=>m.topic='f'.repeat(32)],['wrong PID',m=>m.pid='f'.repeat(32)],['changed host',m=>m.target.address='foreign/desk'],
  ['changed host key',m=>m.target.fingerprint='22222222-22222222-22222222-22222222'],['changed AgentID',m=>m.target.agent_id='f'.repeat(32)],
  ['invalid reference',m=>m.lid='D'.repeat(32)],['invalid author key',m=>m.claimed_key='invalid'],['frozen view',(_m,d)=>d.frozen=true],
  ['ask unavailable',(_m,d)=>d.agents[0].can_ask=false],['participation topic',(_m,d)=>d.agents[0].topic='f'.repeat(32)],['dismissed participation',(_m,d)=>d.agents[0].state='dismissed'],
 ];
 for(const [label,change]of cases){const d=structuredClone(dm);change(d.messages[0],d);assert.equal(choose(d.messages[0],pid,'',d,me),null,label);assert.equal(pool(d,me,'').size,0,label);}
 const explicitKey='33333333-33333333-33333333-33333333';
 assert.equal(choose({...source,claimed_key:explicitKey},pid,'',dm,me).ref.fingerprint,explicitKey);
 assert.equal(choose({...source,claimed_key:explicitKey,send_group_author:me.fingerprint},pid,'',dm,me).ref.fingerprint,me.fingerprint);
 assert.equal(chosen.attempt,7);
 for(const state of ['queued','part_waiting','pending','accepted','completed']){const d=structuredClone(dm);d.messages[0].exec.state=state;assert.equal(choose(d.messages[0],pid,'',d,me),null);assert.equal(current(d,pid,'',me),undefined);}
 const duplicate={...source,id:'9'.repeat(64)};assert.equal(pool({...dm,messages:[source,duplicate]},me,'').get(pid).length,1);
 const other={...source,id:'8'.repeat(64),lid:'7'.repeat(32)};
 const multiple={...dm,messages:[source,other,{id:'6'.repeat(64),kind:'answer',dir:'in',reply_to:other.id}]};
 assert.throws(()=>current(multiple,pid,'',me),/2 distinct running requests/);
 assert.equal(current(multiple,pid,'',me,'6'.repeat(64)).ref.id,other.lid);
 assert.equal(reply({...multiple,messages:[...multiple.messages,{id:'5'.repeat(64),reply_to:'5'.repeat(64)}]},pid,'',me,'5'.repeat(64)),undefined);
 assert.throws(()=>current({...dm,messages:[source,{...duplicate,exec:{...source.exec,attempt:8}}]},pid,'',me),/cannot be verified/);
 for(const state of ['deleted','stale','attempt']){const d=structuredClone(dm);if(state==='deleted')d.messages[0].deleted=true;if(state==='stale')d.messages[0].exec.stale=true;if(state==='attempt')delete d.messages[0].exec.attempt;assert.throws(()=>current(d,pid,'',me),/cannot be verified/);}

 for(const key of ['pid','topic','kind','attempt'])assert.equal(sameFollowup(chosen,{...chosen,[key]:'changed'}),false);
 assert.equal(sameFollowup(chosen,{...chosen,ref:{...chosen.ref,id:'f'.repeat(32)}}),false);
 assert.equal(sameFollowup(chosen,{...chosen,target:{...chosen.target,agent_id:'f'.repeat(32)}}),false);
 console.log(JSON.stringify({skin,identicalPureModule:true,negativeVectors:cases.length,nonRunningStates:5,naturalCurrent:true,replyAncestry:true,deduplicatedRoots:true,authorKeyPrecedence:true,exactCapturedTuple:true}));
}
});

test('direct corrections bind default/named current work and linked original author',async()=>{
 for(const skin of ['classic','holonet','zoom']){
  const {currentDirectComposerFollowup:current,sameFollowup}=await import('../skins/'+skin+'/src/composer-followup.mjs');
  assert.equal(typeof current,'function','direct selector is missing in '+skin);
  for(const selected of ['',agent_id]){
   const host='briar/host',fp='22222222-22222222-22222222-22222222',author='33333333-33333333-33333333-33333333';
   const request={id:'8'.repeat(32),dir:'out',kind:'task',from:'atlas/linked',from_key:author,to:host,author:{agent:false},exec:{state:'running',host,attempt:7,stale:false},...(selected?{target:{address:host,fingerprint:fp,agent_id:selected}}:{})};
   const thread={id:request.id,peer:host,key:{pinned:fp,pending:false},messages:[request]};
   const captured=current(thread,selected,me);assert(captured);assert.equal(captured.ref.id,request.id);assert.equal(captured.ref.fingerprint,author);assert.equal(captured.attempt,7);assert.equal(captured.kind,'task');assert.equal(sameFollowup(captured,structuredClone(captured)),true);
   for(const [label,change]of [['pending',t=>t.key.pending=fp],['missing pin',t=>delete t.key.pinned],['stale',t=>t.messages[0].exec.stale=true],['missing attempt',t=>delete t.messages[0].exec.attempt],['zero attempt',t=>t.messages[0].exec.attempt=0],['wrong host',t=>t.messages[0].exec.host='other/host'],['wrong selected agent',t=>t.messages[0].target={address:host,fingerprint:fp,agent_id:'9'.repeat(32)}],['wrong target key',t=>t.messages[0].target={address:host,fingerprint:me.fingerprint,agent_id:selected}],['deleted',t=>t.messages[0].deleted=true]]){
    const t=structuredClone(thread);change(t);assert.throws(()=>current(t,selected,me),/cannot be verified/,skin+' '+label);
   }
   for(const state of ['completed','queued','pending']){const t=structuredClone(thread);t.messages[0].exec.state=state;assert.equal(current(t,selected,me),undefined);}
   const multiple=structuredClone(thread);multiple.messages.push({...request,id:'7'.repeat(32)},{id:'6'.repeat(32),dir:'in',kind:'answer',reply_to:'7'.repeat(32)});
   assert.throws(()=>current(multiple,selected,me),/multiple running requests/);assert.equal(current(multiple,selected,me,'6'.repeat(32)).ref.id,'7'.repeat(32));
   assert.equal(current({...thread,messages:[{...request,author:{agent:true}}]},selected,me),undefined);
  }
 }
});
