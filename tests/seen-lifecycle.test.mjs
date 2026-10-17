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
 const registration=source.split('\n').find(line=>/on\(\$\("timeline"\), "scroll",/.test(line));
 assert(start>=0&&end>start&&helper&&registration);
 assert(source.includes('abort.abort();'),'teardown aborts shared listeners');
 function fixture() {
  const errors=[],calls=[],abort=new AbortController();
  class Timeline extends EventTarget {
   scrollHeight=1000;scrollTop=900;clientHeight=100;
   addEventListener(type,handler,options) {
    super.addEventListener(type,event=>{try{handler(event);}catch(error){errors.push(error.message);}},options);
   }
   querySelector(){return null;}
   querySelectorAll(){return [{id:'m-original-message',dataset:{mid:'original-message'}}];}
  }
  const old=new Timeline();let current=old;
  const document={visibilityState:'visible',hasFocus:()=>true,defaultView:{matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}disconnect(){}}}},host={};
  const state={dm:'original-dm',dmData:{id:'original-dm',messages:[{id:'original-message',dir:'in',kind:'message'}]},overview:{notify:{enabled:true}},seenReported:{}};
  state.readVisit={host,kind:'dm',id:'original-dm',scope:'exact',fresh:state.dmData,entering:false,loading:0,visible:new Set(),entry:new Map(),pending:new Set(),done:new Set(),landed:true,firstUnread:''};
  const ctx={abort,$:id=>id==='zoom'?{hidden:false}:current,document,state,alive:true,currentHost:host,nativeVisible:true,visibleRead:null,videoFiles:new Map(),topicFresh:{},topicSelections:{},root:{ownerDocument:document,classList:{contains:()=>true},querySelector:()=>null,contains:()=>true},messageScrollRoot:()=>old,messageTopReserve:()=>0,viewReadyForRead:()=>true,dmVisitor:()=>false,refetch(){},api:(route,body)=>{calls.push({route,body:JSON.parse(JSON.stringify(body))});return Promise.resolve({});}};
  const extract=name=>{const start=source.indexOf(name),lineEnd=source.indexOf('\n',start),end=source.slice(start,lineEnd).trimEnd().endsWith('}')?lineEnd:source.indexOf('\n}',start)+2;assert(start>=0&&end>start);return source.slice(start,end);};
  let extra='';
  if(skin!=='holonet'){
   // Execute the production wrapper and onChange, with only observer geometry stubbed.
   ctx.watchVisibleRows=(_root,options)=>{let live=true,ids=new Set(),last='';return {update(_nodes,canonical){ids=new Set(canonical);},evaluate(){if(!live)return;const shown=options.allowed()&&old.scrollHeight-old.scrollTop-old.clientHeight<=40?[...ids]:[],key=JSON.stringify(shown);if(key!==last){last=key;options.onChange(new Set(shown));}},destroy(){live=false;}};};
   extra=['function attentionKey(','function attentionRows(','function readAllowed(','function currentReadViewShown(','async function markPersonalRead(','function syncVisibleRead(','function retireVisibleRead(',...(skin==='zoom'?['function cancelHeaderSync(','function placeUnreadDivider(']:[])].map(extract).join('\n');
  }
  vm.runInNewContext(helper+'\n'+(skin==='zoom'?'let zoomHeaderFrame;\n':'')+extra+'\n'+callback+'\n'+registration,ctx);
  if(skin!=='holonet')ctx.syncVisibleRead();
  return {old,errors,calls,retire(){ctx.alive=false;if(skin!=='holonet')ctx.retireVisibleRead();abort.abort();current=null;},remount(){current=new Timeline();}};
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


// Execute the actual legacy device-thread loader, with only its UI dependencies stubbed.
for(const skin of ['classic','holonet','zoom']) {
 const source=fs.readFileSync(path.join(root,'skins',skin,'src/entry.mjs'),'utf8');
 const start=source.indexOf('async function loadThread(scrollToEnd, localView, freshEntryView = false) {'),end=source.indexOf('\n}',start)+2;
 assert(start>=0&&end>start);
 const extract=name=>{const start=source.indexOf(name),lineEnd=source.indexOf('\n',start),end=source.slice(start,lineEnd).trimEnd().endsWith('}')?lineEnd:source.indexOf('\n}',start)+2;assert(start>=0&&end>start);return source.slice(start,end);};
 const optionalReadHelpers=['function readAllowed(',...(skin==='holonet'?['function freezeReadEntry(']:['function currentReadViewShown('])].map(extract).join('\n'),loader=source.slice(start,end),readHelpers=['function attentionKey(','function attentionRows(','function leaveReadVisit(','function enterReadVisit(','function commitReadView(','async function markPersonalRead('].map(extract).join('\n'),tick=()=>new Promise(r=>setImmediate(r));
 function fixture() {
  const originalHost={id:'original-host'},writes=[],reads=[],node={replaceWith(){},scrollTop:0,scrollHeight:1000,hidden:true};
  let releaseTopics,releaseRead,failRead=false,holdTopics=false,holdRead=false;
  const messages=[{id:'question',dir:'out',kind:'question',body:'What CPU?'},{id:'answer',dir:'in',kind:'answer',unread:true}];
  const state={thread:'current-topic',gen:1,dm:null,draftKey:'current-topic',deviceAgentID:null};
  const ctx={alive:true,currentHost:originalHost,state,topicSelections:{},topicFresh:{},topicUI:{update(){}},
   $:id=>id==='review'?{hidden:true}:id==='zoom'?{hidden:false}:node,fill(){},who:x=>x,firstLine:x=>x,avatar:()=>({}),peerPresence:()=>'',
   renderPeerChips(){},renderNotice(){},showPane(){},setHubBack(){},renderBody(){if(state.readVisit){const ids=new Set(messages.slice(0,2).map(m=>m.id));state.readVisit.visibleIDs=ids;state.readVisit.visible=ids;}},restoreDraft(){},
   syncComposer(){},commitConversation(){},refreshTyping:async()=>{},announce(){},
   api:async(route,body,host=ctx.currentHost)=>{
    if(route.startsWith('/api/thread?')){reads.push({route,host});return {id:state.thread,peer:'owner/linux',topic:{id:state.thread},messages};}
    if(route.startsWith('/api/topics?')){reads.push({route,host});if(holdTopics)await new Promise(r=>releaseTopics=r);return {topics:[]};}
    assert.equal(route,'/api/act');assert.equal(body.do,'read');writes.push({ids:[...body.ids],host});
    if(holdRead){holdRead=false;await new Promise(r=>releaseRead=r);}
    if(failRead)throw Error('synthetic retry');return {};
   }};
  const document={visibilityState:'visible',hasFocus:()=>true,defaultView:{matchMedia:()=>({matches:false})}};Object.assign(ctx,{unreadRequest:0,contentRevision:0,nativeVisible:true,document,root:{ownerDocument:document,classList:{contains:()=>true},querySelector:()=>null},releaseVideos(){},retireVisibleRead(){},retireViewMedia(){},retireSchedule(){},topicMetadata:()=>({}),syncScheduleControls(){},dmVisitor:()=>false,syncVisibleRead(){if(state.readVisit){const ids=new Set(messages.slice(0,2).map(m=>m.id));state.readVisit.visible=ids;state.readVisit.visibleIDs=ids;void ctx.markPersonalRead(state.data,'thread');}}});
  vm.runInNewContext(readHelpers+'\n'+optionalReadHelpers+'\n'+loader,ctx);
  return {ctx,state,writes,reads,messages,originalHost,load:()=>{ctx.enterReadVisit('thread',state.thread);return ctx.loadThread(false);},
   fail(value){failRead=value;},holdTopics(){holdTopics=true;},releaseTopics(){releaseTopics();},
   holdRead(){holdRead=true;},releaseRead(){holdRead=false;releaseRead();}};
 }
 test(skin+': viewed device question and answer acknowledge once, without another topic',async()=>{
  const f=fixture();f.state.otherTopic={messages:[{id:'unseen-sibling',unread:true}]};
  await f.load();await tick();await f.load();await tick();
  assert.deepEqual(f.writes,[{ids:['question','answer'],host:f.originalHost}]);
  assert(f.reads.every(r=>r.host===f.originalHost),'loads keep the captured host');
 });
 test(skin+': failed exact read retries and overlapping loads stay deduplicated',async()=>{
  const f=fixture();f.fail(true);await f.load();await tick();
  f.fail(false);f.holdRead();await f.load();await f.load();
  assert.equal(f.writes.length,2);f.releaseRead();await tick();await f.load();await tick();
  assert.deepEqual(f.writes.map(w=>w.ids),[['question','answer'],['question','answer']]);
 });
 test(skin+': pending device load cannot read after navigation, workspace change or unmount',async()=>{
  for(const change of ['thread','dm','generation','workspace','unmount']){
   const f=fixture();f.holdTopics();const loading=f.load();await tick();
   if(change==='thread')f.state.thread='different-topic';
   if(change==='dm')f.state.dm='different-dm';
   if(change==='generation')f.state.gen++;
   if(change==='workspace')f.ctx.currentHost={id:'new-host'};
   if(change==='unmount')f.ctx.alive=false;
   f.releaseTopics();await loading;await tick();assert.deepEqual(f.writes,[],change);
  }
 });
 test(skin+': old read completion cannot acknowledge a new host or retain all prior threads',async()=>{
  const f=fixture();f.holdRead();await f.load();
  const old=f.state.readVisit;
  f.ctx.currentHost={id:'new-host'};f.state.gen++;f.state.thread='new-topic';
  // The new-host read resolves first; its exact IDs differ from the pending old read.
  f.messages[0]={...f.messages[0],id:'new-question'};f.messages[1]={...f.messages[1],id:'new-answer'};
  await f.load();await tick();
  assert.equal(f.writes.length,2);assert.equal(f.writes[0].host,f.originalHost);assert.equal(f.writes[1].host,f.ctx.currentHost);
  const current=f.state.readVisit;assert.notEqual(current,old);
  f.releaseRead();await tick();
  assert.equal(f.state.readVisit,current);assert(!current.done.has('question'));assert(!current.done.has('answer'));
  await f.load();await tick();assert.equal(f.writes.length,2,'old completion never dirties the current success set');
  f.ctx.alive=false;await f.load();assert.equal(f.writes.length,2,'unmounted closure stays inert');
  const remounted=fixture();await remounted.load();await tick();assert.equal(remounted.writes.length,1,'remount starts with its own read scope');
 });
}
