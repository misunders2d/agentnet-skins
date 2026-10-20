import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'skins/holonet/src/entry.mjs'),'utf8');
const extract=name=>{const start=source.indexOf(name),lineEnd=source.indexOf('\n',start),end=source.slice(start,lineEnd).trimEnd().endsWith('}')?lineEnd:source.indexOf('\n}',start)+2;assert(start>=0&&end>start,'production declaration: '+name);return source.slice(start,end);};
function fixture({deferOpen=true,fetchView=false}={}){
 let release;const gate=new Promise(r=>release=r),effects=[],requests=[],topics={},fresh={};
 const view={id:'original',messages:[{id:'target',kind:'message',dir:'in',topic:'original-topic',unread:true,attention:{rev:13,writer:'original-writer'}}]};
 const state={gen:1,dm:null,overview:{dms:[{id:'original'}]},dmData:fetchView?null:view};
 const ctx={alive:true,currentHost:{id:'original-host'},state,topicSelections:topics,topicFresh:fresh,
  root:{classList:{contains:name=>name==='show-conv'},querySelector:()=>null},nativeVisible:true,document:{visibilityState:'visible',hasFocus:()=>true},$:()=>({hidden:true}),releaseVideos(){},
  openDM:(conv,view,readEntry,freshEntryView=false)=>{assert.equal(view.id,conv);state.dm=conv;state.dmData=view;const visit=ctx.enterReadVisit('dm',conv,readEntry);ctx.commitReadView(visit,view,'dm',freshEntryView);return deferOpen?gate:Promise.resolve();},
  renderDMBody:()=>{effects.push('render');return ctx.timeline.scrollHeight;},
  timeline:{scrollHeight:1000},flash:id=>effects.push('flash '+id),showList:msg=>effects.push(msg),
  api:async(route)=>{requests.push(route);if(fetchView&&route==='/api/dm?id=original')return view;throw Error('Unexpected notification request '+route);}};
 // Keep the production notification/visit guards inside the VM boundary.
 vm.runInNewContext(['function attentionKey(','function attentionRows(','function leaveReadVisit(','function enterReadVisit(','function commitReadView(','function readAllowed(','function freezeReadEntry(','async function markPersonalRead(','function selectReadTopic(','function markDMRead(','function messageTarget(','function clearNotificationStatus(','function notificationMissing(','async function openDMMessage(','async function openMessage('].map(extract).join('\n'),ctx);
 if(!fetchView){state.dm='original';const visit=ctx.enterReadVisit('dm','original');ctx.commitReadView(visit,view,'dm',true);}
 return {ctx,state,view,effects,requests,topics,release,open:()=>ctx.openMessage({id:'target',conv:'original',dir:'in'})};
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

// Even with no overview conversation to scan and no working network, the
// current exact cached view supplies the target. Hidden rows remain unread.
test('Holonet current cached notification needs no DM or overview request',async()=>{
 const f=fixture({deferOpen:false});
 f.state.overview.dms=[];
 f.state.dmData.messages.unshift({id:'target',kind:'message',dir:'out',topic:'other-direction-topic'});
 await f.open();
 assert.deepEqual(f.effects,['render','flash target']);
 assert.deepEqual(f.topics,{original:'original-topic'});
 assert.deepEqual(f.requests,[],'cached landing performs no request or unseen ACK');
 assert.equal(f.state.messageOpening,null);
});

// The route obtains a current exact view before it hands it to openDM. The
// real read helpers must retain that provenance through named-topic selection.
test('Holonet fetched notification completes the real fresh read entry',async()=>{
 for(const viaLegacyScan of [false,true]){
  const f=fixture({deferOpen:false,fetchView:true});
  if(viaLegacyScan)await f.ctx.openDMMessage('original',{id:'target',dir:'in'},true,f.view);
  else await f.open();
  assert.deepEqual(f.effects,['render','flash target']);
  assert.deepEqual(f.topics,{original:'original-topic'});
  assert.deepEqual(f.requests,viaLegacyScan?[]:['/api/dm?id=original']);
  const read=f.state.readVisit;
  assert.equal(read.fresh,f.state.dmData,'entry retains its actual current GET view');
  assert.equal(read.entering,false,'the fresh named-topic entry completes');
  assert.equal(read.entry.get('target'),f.ctx.attentionKey(f.view.messages[0]),'freeze only the selected original generation');
  assert.equal(read.id,'original');assert.equal(read.host,f.ctx.currentHost);
 }
});
