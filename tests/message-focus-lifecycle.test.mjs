import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'skins/holonet/src/entry.mjs'),'utf8');
const extract=name=>{const start=source.indexOf(name),lineEnd=source.indexOf('\n',start),end=source.slice(start,lineEnd).trimEnd().endsWith('}')?lineEnd:source.indexOf('\n}',start)+2;assert(start>=0&&end>start);return source.slice(start,end);};
function fixture(){
 let release;const gate=new Promise(r=>release=r),effects=[],topics={},fresh={};
 const state={gen:1,dm:null,overview:{dms:[{id:'original'}]},dmData:{id:'original',messages:[{id:'target',kind:'message',dir:'in',topic:'original-topic'}]}};
 const ctx={alive:true,currentHost:{id:'original-host'},state,topicSelections:topics,topicFresh:fresh,
  root:{classList:{contains:name=>name==='show-conv'},querySelector:()=>null},nativeVisible:true,document:{visibilityState:'visible',hasFocus:()=>true},$:()=>({hidden:true}),releaseVideos(){},
  openDM:conv=>{state.dm=conv;const visit=ctx.enterReadVisit('dm',conv);ctx.commitReadView(visit,state.dmData,'dm',true);return gate;},
  renderDMBody:()=>{effects.push('render');return ctx.timeline.scrollHeight;},
  timeline:{scrollHeight:1000},flash:id=>effects.push('flash '+id),showList:msg=>effects.push(msg),
  api:async()=>({messages:[{id:'target',dir:'in'}]})};
 // Keep the production notification/visit guards inside the VM boundary.
 vm.runInNewContext(['function attentionKey(','function attentionRows(','function leaveReadVisit(','function enterReadVisit(','function commitReadView(','function readAllowed(','function freezeReadEntry(','async function markPersonalRead(','function selectReadTopic(','function markDMRead(','async function openDMMessage(','async function openMessage(','function focusDMMessage('].map(extract).join('\n'),ctx);
 return {ctx,state,effects,topics,release,open:()=>ctx.openMessage({id:'target',conv:'original',dir:'in'})};
}
test('Holonet original notification callback cannot focus after unmount or conversation navigation',async()=>{
 for(const change of ['unmount','navigation','workspace']){
  const f=fixture(),pending=f.open();
  if(change==='unmount'){f.ctx.alive=false;f.state.gen++;f.ctx.timeline=null;}
  if(change==='navigation'){f.state.dm='new-conversation';f.state.dmData={messages:[{id:'target',dir:'in',topic:'wrong-view-topic'}]};}
  if(change==='workspace')f.ctx.currentHost={id:'new-host'};
  f.release();await pending;assert.deepEqual(f.effects,[]);assert.deepEqual(f.topics,{});
 }
});
test('Holonet current notification still selects exact target topic, renders and flashes',async()=>{
 const f=fixture(),pending=f.open();f.release();await pending;
 assert.deepEqual(f.effects,['render','flash target']);assert.deepEqual(f.topics,{original:'original-topic'});
});
