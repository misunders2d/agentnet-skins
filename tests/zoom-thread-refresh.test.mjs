import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(process.env.AGENTNET_ZOOM_THREAD_SOURCE||new URL('../skins/zoom/src/entry.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function loadThread('),end=source.indexOf('// Zoom owns one presentation',start);
assert(start>=0&&end>start);
const code=source.slice(start,end);
function fixture(){
 const host={},visit={loading:0},state={thread:'thread-one',gen:1,dm:null,data:null,readVisit:visit,draftKey:'thread-one'};
 let reply,typing,paints=0;
 const nodes=new Map();
 const ctx={state,alive:true,currentHost:host,api:()=>new Promise(resolve=>reply=resolve),Zoom:{refresh(){paints++;ctx.displayed=state.data.messages.map(m=>m.body).join(' ')}},
  $:id=>{if(!nodes.has(id))nodes.set(id,{replaceWith(){}});return nodes.get(id)},fill(){},directBinding:()=>({}),who:x=>x,firstLine:x=>x,avatar:()=>({}),peerPresence:()=>'',renderPeerChips(){},renderNotice(){},showPane(){},setHubBack(){},topicUI:{update(){}},topicMetadata:()=>({}),commitReadView(){},restoreDraft(){throw Error('existing draft must not be restored')},syncComposer(){},syncVisibleRead(){},syncScheduleControls(){},refreshTyping:()=>new Promise(resolve=>typing=resolve),announce(){},openHub(){}};
 vm.createContext(ctx);vm.runInContext(code+'\nthis.load=loadThread;',ctx);
 return {ctx,state,load:()=>ctx.load(),reply:t=>reply(t),typing:()=>typing?.(),paints:()=>paints};
}
const view={id:'thread-one',peer:'fixture/device',messages:[{id:'thread-one',body:'Confirmed exact message'}]};
test('Zoom repaints a confirmed device-thread read before unrelated typing completes',async()=>{
 const f=fixture(),work=f.load();assert.equal(f.paints(),0);f.reply(view);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.ctx.displayed,'Confirmed exact message','confirmed message must replace its pending row without waiting for an overview push');assert.equal(f.paints(),1);f.typing();await work;
});
for(const scope of ['thread','host','visit','stopped'])test('Zoom ignores delayed thread reads after '+scope+' changes',async()=>{
 const f=fixture(),work=f.load();if(scope==='thread')f.state.thread='another-thread';if(scope==='host')f.ctx.currentHost={};if(scope==='visit')f.state.readVisit={loading:0};if(scope==='stopped')f.ctx.alive=false;f.reply(view);await work;assert.equal(f.paints(),0);assert.equal(f.state.data,null);
});
