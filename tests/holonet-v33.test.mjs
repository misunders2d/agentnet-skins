import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {pathToFileURL} from 'node:url';
const skin=path.join(process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..'),'skins/holonet'),entry=fs.readFileSync(process.env.AGENTNET_HOLONET_ENTRY||path.join(skin,'src/entry.mjs'),'utf8');
const shared=process.env.AGENTNET_SOURCE?path.resolve(process.env.AGENTNET_SOURCE,'internal/ui/skins/shared/native-activity.mjs'):path.join(skin,'src/native-activity.mjs');
const {nativeActivityDetail}=await import(pathToFileURL(shared));
function declaration(name){let start=entry.indexOf('function '+name+'(');assert(start>=0,name);if(entry.slice(start-6,start)==='async ')start-=6;let depth=0,end=entry.indexOf('{',start);for(;end<entry.length;end++){if(entry[end]==='{')depth++;else if(entry[end]==='}'&&!--depth){end++;break;}}assert(end>start);return entry.slice(start,end);}
function readFixture(extra={}){
 const messages=Array.from({length:20},(_,i)=>({id:'m'+i,kind:'message',dir:i%2?'out':'in',topic:'',unread:true,attention:{rev:1,writer:'self'}}));
 const host={},view={id:'chat',messages},visit={host,kind:'dm',id:'chat',scope:'exact',topic:'',entry:new Map(messages.map(m=>[m.id,JSON.stringify([m.id,1,'self'])])),pending:new Set(),done:new Set(),visibleIDs:new Set(['m3']),fresh:view,entering:false,loading:0};
 const calls=[],state={dm:'chat',dmData:view,readVisit:visit,messageOpening:null},context={state,currentHost:host,alive:true,topicFresh:{},topicSelections:{},nativeVisible:true,document:{visibilityState:'visible',hasFocus:()=>true},root:{classList:{contains:()=>true},querySelector:()=>null},narrowView:{matches:true},$:()=>({hidden:true}),dmVisitor:()=>false,api:async(p,b,h)=>{calls.push({p,b,h});},refetch(){},...extra};
 vm.createContext(context);vm.runInContext(declaration('attentionKey')+'\n'+declaration('attentionRows')+'\n'+(entry.includes('function readAllowed(')?declaration('readAllowed')+'\n':'')+declaration('markPersonalRead')+'\nthis.mark=markPersonalRead;',context);return{context,state,view,visit,calls,mark:()=>context.mark(view,'dm')};
}
test('Holonet only acknowledges current meaningfully visible canonical rows; generations remain exact',async()=>{const f=readFixture();await f.mark();assert.deepEqual(Array.from(f.calls[0].b.ids),['m3']);assert.equal(f.calls[0].b.attention.m3.rev,1);assert.equal(f.calls[0].h,f.context.currentHost);await f.mark();assert.equal(f.calls.length,1);});
test('Holonet hidden, unfocused, native-hidden, Review and modal views never ACK',async()=>{for(const mode of ['page','focus','native','review','modal']){const f=readFixture();if(mode==='page')f.context.document.visibilityState='hidden';if(mode==='focus')f.context.document.hasFocus=()=>false;if(mode==='native')f.context.nativeVisible=false;if(mode==='visitor')f.context.dmVisitor=()=>true;if(mode==='readonly')f.view.read_only=true;if(mode==='review')f.context.$=()=>({hidden:false});if(mode==='modal')f.context.root.querySelector=()=>({});await f.mark();assert.equal(f.calls.length,0,mode);}});
test('Holonet supports the current bounded Thinking grammar in the existing activity slot',()=>{const ctx={nativeActivityDetail,el:(tag,attrs,...children)=>({tag,attrs,children}),asDate:s=>new Date(s)};vm.createContext(ctx);vm.runInContext(declaration('nativeActivity')+'\nthis.render=nativeActivity;',ctx);assert.equal(ctx.render(),null,'absent optional detail has no activity node');assert.equal(ctx.render(''),null,'empty optional detail has no activity node');assert.equal(ctx.render(null),null,'null optional detail has no activity node');for(const text of ['Thinking: Checking local evidence','Thinking: Checking local evidence\nReported at 2026-10-16T19:00:00Z','Reading files'])assert(ctx.render(text),text);for(const text of ['Thinking: /private/path','Thinking: secret\nPRIVATE','Reading files PRIVATE'])assert.equal(ctx.render(text),null);});

const upstream=path.resolve(process.env.AGENTNET_SOURCE||path.join(import.meta.dirname,'../.cache/upstream'));
const model=await import(pathToFileURL(process.env.AGENTNET_SOURCE?path.join(upstream,'internal/ui/skins/shared/schedule-model.mjs'):path.join(skin,'src/schedule-model.mjs')));
test('Holonet exact unread landing uses physical direction, logical identity, original fingerprint and topic',()=>{
 const state={overview:{me:{fingerprint:'self-key'}}},ctx={state};vm.createContext(ctx);vm.runInContext(declaration('unreadMessage')+'\nthis.find=unreadMessage;',ctx);
 const row={kind:'chat',conv:'chat',id:'physical',lid:'logical',author:'original-fingerprint',dir:'in',topic:'topic'},message={id:'physical',lid:'logical',claimed_key:'original-fingerprint',from:'display/address',dir:'in',topic:'topic'},view={id:'chat',messages:[message,{...message,dir:'out'}]};
 assert.equal(ctx.find(view,row),message);
 for(const bad of [{author:'different'},{dir:'out',author:'wrong-key'},{topic:'another'},{lid:'different'},{conv:'different'},{id:'logical'}])assert.throws(()=>ctx.find(view,{...row,...bad}));
 assert.throws(()=>ctx.find({...view,messages:[{...message,deleted:true}]},row));
 const device={kind:'device',peer:'peer/device',thread:'root',id:'physical',lid:'physical',author:'key',dir:'in'},thread={id:'root',peer:'peer/device',messages:[{id:'physical',dir:'in',from_key:'key'}]};assert(ctx.find(thread,device));assert.throws(()=>ctx.find({...thread,peer:'wrong/device'},device));
});
test('Holonet frozen first unread includes outgoing marks and never advances during the visit',()=>{
 const outgoing={id:'out',kind:'message',dir:'out',unread:true},incoming={id:'in',kind:'message',dir:'in',unread:true},ctx={topicFresh:{},topicSelections:{}};vm.createContext(ctx);vm.runInContext(declaration('attentionKey')+'\n'+declaration('attentionRows')+'\n'+declaration('freezeReadEntry')+'\nthis.freeze=freezeReadEntry;',ctx);
 const read={entry:new Map()},view={id:'chat',messages:[outgoing,incoming]};ctx.freeze(read,view,'dm');assert.equal(read.firstUnread,'out');ctx.freeze(read,{...view,messages:[incoming]},'dm');assert.equal(read.firstUnread,'out');
});
test('Holonet schedule adapter captures actual Files/topic/quote and only clears unchanged draft parts',()=>{
 const conv='a'.repeat(64),file=new File(['original'],'same.txt'),replacement=new File(['different'],'same.txt'),nodes={body:{value:'original text'}},removed=[];
 const state={dm:conv,draftKey:'dm:'+conv,drafts:{},files:[{key:1,file,name:file.name,size:file.size,url:'blob:old'}],dmReply:{id:'quoted'},dmAgent:null,mentions:[],mentionText:'',typedFor:null};
 const ctx={state,topicSelections:{[conv]:'original-topic'},topicFresh:{},$:id=>nodes[id],kindValue:()=> 'message',validMentions:s=>s||[],URL:{revokeObjectURL:u=>removed.push(u)},discardStaged:()=>{},setDMReply:r=>{state.dmReply=r;},setDMAgent:a=>{state.dmAgent=a;},renderPending(){},grow(){},syncComposer(){}};vm.createContext(ctx);vm.runInContext(['keepDraft','scheduleDraft','applyScheduledDraft'].map(declaration).join('\n')+'\nthis.get=scheduleDraft;this.apply=applyScheduledDraft;',ctx);
 const captured=ctx.get(conv),a=model.captureSchedule('1'.repeat(32),conv,captured.text,captured,new Date(Date.now()+3600000).toISOString(),'UTC',{persons:['approved'],pids:[]});assert.equal(a.files[0].file,file);assert.equal(a.payload.topic,'original-topic');assert.equal(a.payload.reply_to,'quoted');assert.equal(a.payload.quote,'quoted');
 nodes.body.value='new typing';state.dmReply={id:'new quote'};state.files=[{key:1,file:replacement,name:file.name,size:replacement.size,url:'blob:new'}];ctx.apply(conv,model.clearScheduledDraft(ctx.get(conv),a));assert.equal(nodes.body.value,'new typing');assert.equal(state.dmReply.id,'new quote');assert.equal(state.files[0].file,replacement);assert.deepEqual(removed,[]);
 nodes.body.value='original text';state.dmReply={id:'quoted'};state.files=[{key:1,file,name:file.name,size:file.size,url:'blob:old'}];ctx.apply(conv,model.clearScheduledDraft(ctx.get(conv),a));assert.equal(nodes.body.value,'');assert.equal(state.dmReply,null);assert.equal(state.files.length,0);assert.deepEqual(removed,['blob:old']);
 nodes.body.value='original text';state.files=[{key:1,file,name:file.name,size:file.size}];ctx.topicSelections[conv]='new-topic';const current=ctx.get(conv);ctx.apply(conv,model.clearScheduledDraft(current,a));assert.equal(nodes.body.value,'original text');assert.equal(state.files[0].file,file);
});
test('Holonet schedule reload guard counts actual originals, including foreign workspaces, never cold metadata alone',()=>{
 const symbol=Symbol.for('agentnet.ui.scheduleSaves'),local={[symbol]:{slots:new Map([['a',{status:'uncertain',id:'cold'}]])}},other={[symbol]:{slots:new Map()}},ctx={scheduleUI:null,workspaceState:local,wsAPI:()=>({list:()=>[{id:'here'},{id:'other'}],state:id=>id==='here'?local:other})};vm.createContext(ctx);vm.runInContext(declaration('scheduleBlocks')+'\n'+declaration('anyScheduleOriginals')+'\nthis.block=anyScheduleOriginals;',ctx);assert.equal(ctx.block(),false);other[symbol].slots.set('x',{status:'uncertain',attempt:{files:[]},durable:false});assert.equal(ctx.block(),true);other[symbol].slots.get('x').status='confirmed';assert.equal(ctx.block(),false);local[symbol].slots.set('a',{status:'saving',attempt:{files:[]}});assert.equal(ctx.block(),true);
});
test('Holonet keeps signed mention encoding exact for scheduling',()=>{
 const a=entry.indexOf('const mentionAt ='),b=entry.indexOf('// shiftMentions',a),ctx={};assert(a>=0&&b>a);vm.createContext(ctx);vm.runInContext(entry.slice(a,b)+'\nthis.encode=encodeMentions;',ctx);
 const spans=[{start:0,name:'Casey',ref:{kind:'person',id:'verified-person'}}];assert.equal(ctx.encode('@Casey exact',spans),'[@Casey](agentnet:person/verified-person) exact');assert.equal(ctx.encode('@Other exact',spans),'@Other exact');
});

test('Holonet final shared module copies and exact CSS block remain bound; metadata stays release-owned',()=>{
 const upstreamShared=path.join(upstream,'internal/ui/skins/shared');for(const name of ['visible-rows.mjs','native-activity.mjs','unread-review.mjs','choices.mjs','video-file.mjs','schedule.mjs','schedule-model.mjs','schedule-saves.mjs','person-topics.mjs'])assert.deepEqual(fs.readFileSync(path.join(skin,'src',name)),fs.readFileSync(path.join(upstreamShared,name)),name);
 const css=fs.readFileSync(path.join(skin,'src/style.css'),'utf8'),canonical=fs.readFileSync(path.join(upstreamShared,'v33.css'),'utf8');assert.equal(css.split('/* agentnet-shared-v33 begin */').length,2);const at=css.indexOf('/* agentnet-shared-v33 begin */');assert.equal(css.slice(at,at+canonical.length),canonical);assert(css.includes('repeat(6, minmax(44px, 1fr))'));
 const manifest=JSON.parse(fs.readFileSync(path.join(skin,'skin.json')));assert.match(manifest.agentnet,/^v[0-9]+\.[0-9]+\.[0-9]+$/);for(const name of manifest.files)if(name!=='manifest.mjs')assert(fs.existsSync(path.join(skin,'src',name)),name);assert(fs.readFileSync(path.join(skin,'src/topics.mjs'),'utf8').includes('TOPIC ROUTING'));
});
test('Holonet notification preview is optional and changes only the explicit preview preference',async()=>{
 const calls=[],line={dataset:{},children:[],append(...kids){this.children.push(...kids);}},el=(tag,attrs,...kids)=>({tag,attrs,kids,append(...nodes){this.kids.push(...nodes);}}),ctx={$:()=>line,notifyPermission:()=> 'unsupported',navigator:{userAgent:''},window:{},fill:(parent,...kids)=>{parent.children=kids;},el,plural:(n,a,b)=>n+' '+(n===1?a:b),notifyDialog(){},notifyAct:(path,body)=>calls.push({path,body})};vm.createContext(ctx);vm.runInContext(declaration('renderNotify')+'\nthis.draw=renderNotify;',ctx);
 const nodes=n=>n&&typeof n==='object'?[n,...(n.kids||n.children||[]).flatMap(nodes)]:[];
 ctx.draw({available:true,native:true,enabled:false,allowed:[]});assert.equal(nodes(line).filter(n=>n.tag==='select').length,0);
 ctx.draw({available:true,native:true,enabled:false,allowed:[],preview_default:'hidden',preview:'sender'});const select=nodes(line).find(n=>n.tag==='select');assert(select);assert.equal(select.value,'sender');assert.deepEqual(Array.from(select.kids.slice(1),n=>n.attrs.value),['full','sender','hidden']);
 select.attrs.onchange({currentTarget:{value:'full'}});select.attrs.onchange({currentTarget:{value:''}});select.attrs.onchange({currentTarget:{value:'arbitrary'}});assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{path:'/api/notify/preview',body:{preview:'full'}},{path:'/api/notify/preview',body:{preview:''}}]);
 assert(JSON.stringify(line).includes('fixed activity, reminder, decision or security notices'));assert(JSON.stringify(line).includes('On macOS'));assert(!calls.some(c=>c.path.includes('enable')));
});
test('Holonet final shared T1 popup preserves all reviewed actual-module rename/reset controls',async()=>{
 const {topicControls}=await import(pathToFileURL(path.join(skin,'src/topics.mjs'))),source=fs.readFileSync(path.join(upstream,'internal/ui/testdata/shared_review_topics_check.mjs'),'utf8');
 const helpers=source.slice(source.indexOf('class Events {'),source.indexOf('assert.deepEqual(TOPIC_UI'));
 const cases=source.slice(source.indexOf('// T1: reuse the actual existing popup'));
 await Function('assert','topicControls','setImmediate','console','return(async()=>{'+helpers+'\n'+cases+'\n})();')(assert,topicControls,setImmediate,console);
 assert(!entry.includes('renameTopicDialog'));assert(!entry.includes('rename:renameTopicDialog'));
});
test('Holonet media retirement uses exact current view, physical id, index and direction before replacement',()=>{
 const gone=[],keep={controller:{destroy:()=>gone.push('kept')}},old={controller:{destroy:()=>gone.push('old')}},videoFiles=new Map([['scope:in:physical:7',keep],['scope:out:old:0',old]]),ctx={videoFiles,state:{readVisit:{scope:'scope'},dm:null},humanGroup:()=>false};vm.createContext(ctx);vm.runInContext(declaration('pruneVideos')+'\nthis.prune=pruneVideos;',ctx);ctx.prune([{id:'physical',dir:'in',files:[{name:'actual.webm',index:7}]}]);assert.deepEqual(gone,['old']);assert.equal(videoFiles.size,1);ctx.prune([{id:'physical',dir:'out',files:[{name:'actual.webm',index:7}]}]);assert.deepEqual(gone,['old','kept']);assert.equal(videoFiles.size,0);
});

test('Holonet ordinary visitor and read-only visible ACKs remain available; deliberate unread stays restricted',async()=>{
 for(const flag of ['visitor','read_only','readOnly']){
  const f=readFixture();for(const m of f.view.messages)delete m.attention;
  if(flag==='visitor')f.context.dmVisitor=()=>true;else f.view[flag]=true;
  vm.runInContext(declaration('canMarkPersonal')+'\nthis.deliberate=canMarkPersonal;',f.context);
  await f.mark();await f.mark();assert.equal(f.calls.length,1,flag);assert.deepEqual(Array.from(f.calls[0].b.ids),['m3']);assert.equal(f.context.deliberate(f.view.messages[3],'chat'),false,flag);
 }
});
test('Holonet actual Review close resumes only displayed panes; actual chat commit reopens phone; navChats leaves visit',async()=>{
 for(const width of [1280,390]){
  const f=readFixture(),classes=new Set(['show-conv']),nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:id==='review',attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];},querySelector:()=>({focus(){}})});return nodes.get(id);};
  f.context.$=node;f.context.narrowView={matches:width<=760};f.context.root.classList={contains:n=>classes.has(n),add:n=>classes.add(n),remove:n=>classes.delete(n)};
  Object.assign(f.context,{unreadUI:{show(){}},deactivateVideos(){},releaseVideos(){},backPath:[],keepDraft(){},loadTeams(){},rerender(){},renderDMBody(){},renderBody(){}});
  vm.runInContext(['commitReadView','freezeReadEntry','toggleReview','commitConversation','leaveReadVisit','selectSection'].map(declaration).join('\n'),f.context);
  f.visit.entering=true;f.context.commitReadView(f.visit,f.view,'dm',true);f.context.commitConversation();assert(f.context.readAllowed(f.visit,f.view,'dm'));
  f.context.toggleReview(true);await f.mark();assert.equal(f.calls.length,0,'Review never ACKs');assert.equal(f.state.readVisit,f.visit);
  f.context.toggleReview(false);await f.mark();assert.equal(f.calls.length,width===1280?1:0,'wide resumes, phone list stays unread');assert.equal(f.state.readVisit,f.visit);
  f.context.commitConversation();assert(f.context.readAllowed(f.visit,f.view,'dm'));await f.mark();assert.equal(f.calls.length,1,'actual chat commit resumes exact generation without duplicate');
  f.context.selectSection('chats');assert.equal(f.state.readVisit,null,'navChats intentionally leaves visit');
 }
 assert.equal((entry.match(/matchMedia\('\(max-width: 760px\)'\)/g)||[]).length,1,'one cached MQL per mount');
});
test('Holonet unread counts use authoritative uncapped overview and DM summary fields, including hidden topics',()=>{
 let badge;const button={label:'Needs attention',querySelector:()=>({append:n=>{badge=n;}}),setAttribute(_k,v){this.label=v;},getAttribute:()=> 'Needs attention'},ctx={state:{dm:'chat',overview:{seq:4,dms:[{id:'chat',unread:263}]}},contentRevision:7,$:id=>id==='review-btn'?button:badge,el:(_tag,props)=>({...props})};vm.createContext(ctx);vm.runInContext(declaration('renderUnreadCount')+'\n'+declaration('topicMetadata')+'\nthis.draw=renderUnreadCount;this.meta=topicMetadata;',ctx);
 ctx.draw({unread_total:263,alert_total:259});assert.equal(badge.textContent,'263 unread');assert.equal(badge.title,'263 unread messages · 259 alerts');assert(button.label.includes('263 unread messages'));
 const meta=ctx.meta({id:'chat',main_topic:{unread:2},unread:999});assert.equal(meta.unreadTotal,263);assert.equal(meta.mainUnread,2);assert.equal(meta.revision,7);ctx.draw({});assert.equal(badge.hidden,true);assert.equal(badge.textContent,'');
});

test('Holonet scoped human guests retain schedule eligibility; visitors remain denied',()=>{
 for(const role of ['member','human_guest','visitor']){
  const state={dm:'chat',dmData:{role,topics:[{id:'invited'}],messages:[]},dmReply:null,files:[],overview:{schedules:true},dmAgent:null,answering:null},ctx={state,topicSelections:{chat:'invited'},topicFresh:{},dmVisitor:d=>d.role==='visitor',dmHumanGuest:()=>{throw Error('Human guests are not visitors');},kindValue:()=> 'message'};
  vm.createContext(ctx);vm.runInContext(declaration('scheduleContext')+'\nthis.context=scheduleContext;',ctx);const value=ctx.context();assert.equal(value.visitor,role==='visitor');assert.equal(value.ordinary,true);assert.equal(value.missing,false);assert.equal(value.conv,'chat');assert.equal(value.newTopic,false);
 }
});
test('Holonet Review destroys slots and recreates idle media once only for a shown conversation; native callback is reversible',()=>{
 for(const narrow of [false,true]){
  const nodes=new Map(),classes=new Set(['show-conv']),calls=[],videoFiles=new Map([['old',{controller:{destroy:()=>calls.push('destroy')}}]]),host={},view={id:'chat'},read={host,kind:'dm',id:'chat',fresh:view,entering:false,loading:0,watcher:{evaluate:()=>calls.push('evaluate')}},state={dm:'chat',dmData:view,readVisit:read,contactView:'recent'},ctx={state,videoFiles,currentHost:host,alive:true,nativeVisible:true,narrowView:{matches:narrow},root:{classList:{contains:n=>classes.has(n),remove:n=>classes.delete(n)}},unreadUI:{show(){}},renderDMBody:()=>calls.push('render'),renderBody:()=>calls.push('wrong render')};
  ctx.$=id=>{if(!nodes.has(id))nodes.set(id,{hidden:id==='review',attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];},querySelector:()=>({focus(){}})});return nodes.get(id);};vm.createContext(ctx);vm.runInContext(declaration('releaseVideos')+'\n'+declaration('toggleReview'),ctx);
  ctx.toggleReview(true);assert.equal(videoFiles.size,0);assert.equal(calls.filter(c=>c==='destroy').length,1);ctx.toggleReview(false);ctx.toggleReview(false);assert.equal(calls.filter(c=>c==='render').length,narrow?0:1);assert(!calls.includes('wrong render'));
  const line=entry.split('\n').find(s=>s.includes('cleanups.push(host.android.onVisibility('));assert(line);assert(!line.includes('deactivateVideos'));const fn=line.slice(line.indexOf('visible=>'),line.lastIndexOf('));'));vm.runInContext('this.nativeChanged='+fn+';',ctx);ctx.nativeChanged(false);assert.equal(ctx.nativeVisible,false);ctx.nativeChanged(true);assert.equal(ctx.nativeVisible,true);assert.equal(calls.filter(c=>c==='destroy').length,1,'native parent does not permanently destroy/deactivate reversible child');
 }
 const slot=declaration('fileChips');assert(slot.includes("nativeVisible&&(root.classList.contains('show-conv')||!narrowView.matches)&&$('review').hidden"));
});


test('Holonet Review close recreates only a matching committed current view; pending navigation stays untouched',()=>{
 for(const kind of ['dm','thread'])for(const fault of ['current','pending','foreign-host','foreign-id','wrong-kind','fresh-mismatch','loading','entering','opening','missing-view','dead','phone']){
  const host={},view={id:kind==='dm'?'chat':'thread-root',messages:[]},read={host,kind,id:view.id,fresh:view,entry:new Map(),entering:false,loading:0,watcher:{evaluate(){}}},state={dm:kind==='dm'?view.id:null,thread:kind==='thread'?'reply-physical':null,dmData:kind==='dm'?view:null,data:kind==='thread'?view:null,readVisit:read,contactView:'recent',messageOpening:null},renders=[],nodes=new Map(),ctx={state,currentHost:host,alive:true,narrowView:{matches:fault==='phone'},topicFresh:{},topicSelections:{},root:{classList:{contains:()=>false,remove(){}}},unreadUI:{show(){}},releaseVideos(){},renderDMBody:()=>renders.push('dm'),renderBody:()=>renders.push('thread'),api:()=>{throw Error('Review close must not fetch');}};
  ctx.$=id=>{if(!nodes.has(id))nodes.set(id,{hidden:id!=='review',attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];},querySelector:()=>({focus(){}})});return nodes.get(id);};
  if(fault==='pending'){read.id='next-destination';read.entering=true;read.loading=1;if(kind==='dm')state.dm='next-destination';else state.thread='next-destination';}
  if(fault==='foreign-host')read.host={};if(fault==='foreign-id')read.id='other';if(fault==='wrong-kind')read.kind=kind==='dm'?'thread':'dm';if(fault==='fresh-mismatch')read.fresh={...view};if(fault==='loading')read.loading=1;if(fault==='entering')read.entering=true;if(fault==='opening')state.messageOpening={conv:view.id};if(fault==='missing-view'){state.dmData=null;state.data=null;}if(fault==='dead')ctx.alive=false;
  vm.createContext(ctx);vm.runInContext(declaration('toggleReview'),ctx);ctx.toggleReview(false);ctx.toggleReview(false);assert.deepEqual(renders,fault==='current'?[kind]:[],kind+' '+fault);
  if(fault==='pending'){
   const committed={id:read.id,messages:[]};if(kind==='dm')state.dmData=committed;else state.data=committed;read.loading=0;state.messageOpening=null;
   vm.runInContext(['attentionKey','attentionRows','freezeReadEntry','commitReadView'].map(declaration).join('\n'),ctx);ctx.commitReadView(read,committed,kind,true);ctx.toggleReview(true);ctx.toggleReview(false);ctx.toggleReview(false);assert.deepEqual(renders,[kind],'next committed destination resumes normally');
  }
 }
});

// Actual Holonet entry acceptance, using the existing family Chromium/provider pattern.
import http from 'node:http';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
test('Holonet actual entry Review, File scheduling, emoji and lazy video lifetimes',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright'),collection=path.dirname(path.dirname(skin)),sample=fs.readFileSync(process.env.AGENTNET_VIDEO_SAMPLE||path.join(upstream,'.agentnet/v33/video/implementation/sample.webm'));
 assert.equal(sample.length,22298);assert.equal(createHash('sha256').update(sample).digest('hex'),'e08c61a95e5360c254bab3689fb5530a852337029b384d5cc617f92a64e26066');
 const manifest=JSON.parse(fs.readFileSync(path.join(skin,'skin.json'))),assets=new Set(manifest.files),evidence=process.env.AGENTNET_STEERING_EVIDENCE;let browser,failed=false;
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://fixture');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  if(u.pathname==='/fixture.webm'){res.setHeader('Content-Type','video/webm');res.end(sample);return;}
  const m=/^\/holonet\/([^/]+)$/.exec(u.pathname);if(!m||!assets.has(m[1])){res.writeHead(404).end();return;}
  try{let data=fs.readFileSync(path.join(collection,'dist/holonet',m[1]));if(m[1]==='entry.mjs'){const needle='const ready = start();';assert(data.toString().includes(needle));data=data.toString().replace(needle,'globalThis.fixture={state,openDM,loadDM,loadOverview,renderDMBody,reactPicker,keepDraft,backOneLevel,updateSchedule,readAllowed,nativeVisible:()=>nativeVisible};\n'+needle);}res.setHeader('Content-Type',m[1].endsWith('.css')?'text/css':m[1].endsWith('.svg')?'image/svg+xml':'text/javascript');res.end(data);}catch(error){res.writeHead(404).end(error.message);}
 });
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const width of [1280,390]){
   if(failed)break;
   await t.test('holonet '+width,async()=>{
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];let stage='actual startup';const completed=[];
    page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    try{
     await page.goto(origin);await page.evaluate(async()=>{
      const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/holonet/style.css')).text());shadow.adoptedStyleSheets=[style];
      const root=document.createElement('div');root.className='skin-root';shadow.append(root);window.testRoot=root;window.fixtureRequests=[];window.posts=[];window.fileReads=[];window.stagedFiles=[];window.fixtureSchedules=[];window.revoked=[];window.created=[];window.listenCount=0;window.nativeIsVisible=true;window.visibilityListeners=new Set();window.setNativeVisible=value=>{nativeIsVisible=value;for(const fn of [...visibilityListeners])fn(value);};
      const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=create(b);created.push(u);return u;};URL.revokeObjectURL=u=>{revoked.push(u);revoke(u);};
      const peer={person:'verified-person',label:'Briar',address:'briar/desk',state:'pinned',devices:[]},id=i=>i.toString(16).padStart(32,'0');
      window.fixtureDM={id:'c'.repeat(64),kind:'dm',role:'member',peer,members:[],agents:[],guests:[],topics:[],created:'2026-10-16T09:00:00Z',mine:true,messages:[{id:id(8),lid:id(108),claimed_key:'verified-peer',from_key:'verified-peer',from:'briar/desk',dir:'in',kind:'message',body:'Exact unread target with retained local video.',at:'2026-10-16T09:00:00Z',author:{label:'Briar',agent:false},can:['react'],actions:[],reactions:[],unread:true,attention:{rev:1,writer:'verified-self'},attachments:[{name:'retained.webm',index:7,size:22298,openable:true},{name:'late.webm',index:8,size:22298,openable:true},{name:'oversize.webm',index:9,size:16777217,openable:true}]}]};
      window.fixtureUnread=[{key:'exact-one',kind:'chat',conv:fixtureDM.id,id:id(8),lid:id(108),author:'verified-peer',dir:'in',topic:'',topic_title:'Main flow',label:'Briar',preview:'Exact unread target with retained local video.',at:'2026-10-16T09:00:00Z'}];
      // Complete normal Overview DTO, copied from the reviewed ui.go/fixture.go model.
      window.overview={
       me:{address:'atlas/desk',fingerprint:'verified-self',responder:'',responder_dir:'',agent:false},
       person:{person:'atlas',label:'Atlas',address:'atlas/desk',state:'self',devices:[]},
       people:[peer],threads:[],dms:[],review:[],quarantine:[],needs_you:[],held:[],agent_devices:[],
       topic_list:true,seq:1,version:'v0.8.33',groups:false,reply_receivers:false,reply_sessions:false,
       demo:false,schedules:true,persons:true,agents:false,remind:false,
       directory:{status:'',current:true,truncated:false,members:[]},
       files:{max_count:8,max_file:1048576,max_message:8388608},
       links:[],reminders:[],peers:[],unread_total:1,alert_total:1
      };
      window.fixtureHost={version:1,platform:'browser',workspace:{id:'holonet-entry',name:'Contract check',endpoint:location.origin,address:'atlas/desk',realm:'',state:'enrolled',handle:{}},workspaces:null,skins:[{api:1,id:'comic',name:'Comic',builtin:true},{api:1,id:'holonet',name:'Holonet',digest:'0'.repeat(64)}],onSkinsChange(){return()=>{};},selectSkin(){throw Error('Switching is not part of this check');},listen(){listenCount++;return()=>{};},onOpen(){},android:{visible:()=>nativeIsVisible,onVisibility(fn){visibilityListeners.add(fn);return()=>visibilityListeners.delete(fn);}},stage:async file=>{stagedFiles.push(file);return 'staged-exact';},file:async(id,index,dir)=>{fileReads.push({id,index,dir});if(id!==fixtureDM.messages[0].id||dir!=='in'||![7,8].includes(index))throw Error('Unexpected file tuple');if(index===8)return new Promise(resolve=>{window.releaseLate=async()=>resolve({bytes:new Uint8Array(await(await fetch('/fixture.webm')).arrayBuffer())});});return{bytes:new Uint8Array(await(await fetch('/fixture.webm')).arrayBuffer())};},api:async(path,body)=>{
       fixtureRequests.push({path,...(body===undefined?{}:{body:structuredClone(body)})});
       if(body!==undefined){posts.push({path,body:structuredClone(body)});
        if(path==='/api/act'&&body.do==='read')return new Promise(()=>{}); // Retain the exact read in flight: no unrelated follow-on overview/DM refresh can be mistaken for destination navigation.
        if(['/api/notify/seen','/api/refresh','/api/upload/discard'].includes(path))return{};
        if(path==='/api/schedule/create'){
         const row={id:body.id,conv:body.conv,topic:body.topic||'',body:body.body,reply_to:body.reply_to,quote:body.quote,due:body.due,timezone:body.timezone,rev:1,state:'pending',audience:structuredClone(body.audience),files:stagedFiles.map(file=>({sha256:'f'.repeat(64),name:file.name,size:file.size}))};
         window.fixtureSchedules=[row];return new Promise(resolve=>{window.releaseSchedule=()=>resolve(row);});
        }
        throw Error('Unexpected write '+path);
       }
       if(path==='/api/overview')return structuredClone(overview);
       if(path==='/api/dm?id='+fixtureDM.id)return structuredClone(fixtureDM);
       if(path.startsWith('/api/unread?'))return{rows:structuredClone(fixtureUnread),total:fixtureUnread.length,content:1,seq:1};
       if(path.startsWith('/api/topics?'))return{topics:structuredClone(fixtureDM.topics),matched:fixtureDM.topics.length,next:'',content:1,seq:1};
       if(path.startsWith('/api/typing'))return{current:false,supported:false,send:false,scopes:[]};
       if(path.startsWith('/api/agents'))return{agents:[],sessions:[]};
       if(path==='/api/teams')return{teams:[]};
       if(path.startsWith('/api/schedule/audience?'))return{conv:fixtureDM.id,topic:'',persons:['verified-person'],pids:[]};
       if(path.startsWith('/api/schedules?'))return fixtureSchedules;
       throw Error('Unexpected read '+path);
      }};
      window.entryModule=await import('/holonet/entry.mjs');await entryModule.mount(root,fixtureHost);
      overview.dms=[{id:fixtureDM.id,kind:'dm',peer,created:fixtureDM.created,last_at:fixtureDM.created,unread:1,count:1,last:'Exact unread target'}];await fixture.loadOverview();
     });
     await page.waitForFunction(()=>document.querySelector('#skin').shadowRoot.querySelector('.schedule-tools'));
     assert.equal(await page.evaluate(()=>listenCount),1,'actual entry owns one push listener');assert.deepEqual(errors,[]);completed.push('startup');
     stage='exact Review landing and Back';await page.locator('#review-btn').click();const review=page.locator('.unread-review');await review.getByRole('button',{name:/Exact unread target/}).waitFor();
     assert.equal(await review.locator('[data-unread-key]').count(),1);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     assert.equal(await page.evaluate(()=>posts.filter(p=>p.path==='/api/act'&&p.body.do==='read').length),0,'Review cannot ACK chat');
     const before=await page.evaluate(()=>fixtureRequests.filter(p=>p.path==='/api/dm?id='+fixtureDM.id).length);
     await review.getByRole('button',{name:/Exact unread target/}).click();await page.locator('#m-'+(8).toString(16).padStart(32,'0')+'.flash').waitFor();
     assert.equal(await page.evaluate(()=>fixtureRequests.filter(p=>p.path==='/api/dm?id='+fixtureDM.id).length),before+1,'one exact destination GET');
     assert.deepEqual(await page.evaluate(()=>({conv:fixture.state.dm,physical:fixture.state.dmData.messages[0].id,lid:fixture.state.dmData.messages[0].lid,topic:fixture.state.readVisit.topic})),{conv:'c'.repeat(64),physical:(8).toString(16).padStart(32,'0'),lid:(108).toString(16).padStart(32,'0'),topic:''});
     if(width===390)await page.locator('#back').click();else await page.evaluate(()=>fixture.backOneLevel());await review.waitFor({state:'visible'});const underReview=await page.evaluate(()=>posts.filter(p=>p.path==='/api/act'&&p.body.do==='read').length);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>posts.filter(p=>p.path==='/api/act'&&p.body.do==='read').length),underReview,'Back to Review adds no chat read');completed.push('Review');
     await page.evaluate(()=>fixture.openDM(fixtureDM.id));await page.locator('#composer').waitFor({state:'visible'});
     stage='actual24 emoji grid';const row=page.locator('#m-'+(8).toString(16).padStart(32,'0'));await row.getByLabel('Add a reaction',{exact:true}).click();const picker=row.getByRole('group',{name:'Choose a reaction'});assert.equal(await picker.locator('.react-grid button').count(),24);
     const grid=await picker.locator('.react-grid').evaluate(n=>({columns:getComputedStyle(n).gridTemplateColumns.split(' ').length,rows:getComputedStyle(n).gridTemplateRows.split(' ').length,targets:[...n.children].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44;})}));assert.deepEqual(grid,{columns:6,rows:4,targets:true});await picker.getByRole('button',{name:'Close',exact:true}).click();completed.push('emoji');
     stage='actual File scheduling and scoped confirmed clear';await page.locator('#body').fill('Exact ordinary scheduled draft');await page.locator('#file-input').setInputFiles({name:'scheduled.txt',mimeType:'text/plain',buffer:Buffer.from('real file bytes')});
     await page.evaluate(()=>{window.actualScheduledFile=fixture.state.files[0].file;fixture.state.drafts['dm:unrelated']={text:'Unrelated draft survives',files:[]};});
     await page.getByRole('button',{name:'Schedule message…',exact:true}).click();const schedule=page.locator('dialog.an-schedule-dialog[open]');await schedule.getByRole('button',{name:'Save schedule',exact:true}).click();await page.waitForFunction(()=>typeof releaseSchedule==='function');
     await page.evaluate(()=>{const input=testRoot.querySelector('#body');input.value='New typing while save response pending';input.dispatchEvent(new Event('input',{bubbles:true}));releaseSchedule();});
     await page.waitForFunction(()=>fixture.state.files.length===0&&testRoot.querySelector('dialog.an-schedule-dialog[open] article'));
     const saved=await page.evaluate(()=>({creates:posts.filter(p=>p.path==='/api/schedule/create').map(p=>p.body),sameFile:stagedFiles.length===1&&stagedFiles[0]===actualScheduledFile,ordinary:posts.filter(p=>p.path==='/api/dm/send'||p.path==='/api/send').length,text:testRoot.querySelector('#body').value,other:fixture.state.drafts['dm:unrelated'].text,row:fixtureSchedules[0],blocking:localStorage.getItem('agentnet.messenger.schedule-save.holonet-entry')}));
     assert.equal(saved.creates.length,1);assert.match(saved.creates[0].id,/^[a-f0-9]{32}$/);assert.equal(saved.row.id,saved.creates[0].id);assert.equal(saved.creates[0].conv,'c'.repeat(64));assert.equal(saved.creates[0].body,'Exact ordinary scheduled draft');assert.equal(saved.creates[0].topic,'');assert.deepEqual(saved.creates[0].files,['staged-exact']);assert.equal(saved.sameFile,true);assert.equal(saved.ordinary,0);assert.equal(saved.text,'New typing while save response pending');assert.equal(saved.other,'Unrelated draft survives');assert.equal(saved.blocking,null);assert.deepEqual(saved.row.files,[{sha256:'f'.repeat(64),name:'scheduled.txt',size:15}]);
     assert((await schedule.getByRole('article',{name:'Scheduled message: Pending'}).innerText()).includes('Exact ordinary scheduled draft'));assert((await schedule.innerText()).includes('scheduled.txt'));await schedule.getByRole('button',{name:'Close',exact:true}).click();completed.push('schedule');
     stage='rename action skin grid';await page.evaluate(async()=>{fixtureDM.topics=[{id:'b'.repeat(32),title:'Named topic',auto_title:'Named topic',state:'active',count:1,unread:0,last:'Literal preview'}];await fixture.loadDM(false);});
     await page.locator('.topics-bar').getByRole('button',{name:/^All(?: topics)?(?:[ (]|$)/}).click();const topics=page.getByRole('dialog',{name:'All topics',exact:true});const rename=topics.getByRole('button',{name:'Rename topic Named topic…',exact:true});await rename.waitFor();const placement=await rename.evaluate(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return{column:getComputedStyle(n).gridColumnStart,width:r.width,height:r.height,left:r.left,right:r.right,parentLeft:p.left,parentRight:p.right};});assert.equal(placement.column,'2');assert(placement.width>=44&&placement.height>=44&&placement.left>=placement.parentLeft&&placement.right<=placement.parentRight+1);await topics.getByRole('button',{name:'Close',exact:true}).click();completed.push('topic grid');
     stage='lazy video native metadata and exact host tuple';assert.deepEqual(await page.evaluate(()=>fileReads),[],'no attachment read before explicit Play');const normal=page.getByRole('group',{name:'Video retained.webm',exact:true}),large=page.getByRole('group',{name:'Video oversize.webm',exact:true});assert.equal(await large.getByRole('button',{name:/Play/}).count(),0);assert.equal(await large.getByRole('button',{name:'Download oversize.webm',exact:true}).count(),1);assert((await large.innerText()).includes('16 MiB'));
     await normal.getByRole('button',{name:'Play video retained.webm',exact:true}).click();await page.waitForFunction(()=>{const v=testRoot.querySelector('video[aria-label="retained.webm"]');return v?.controls&&v.src.startsWith('blob:')&&v.readyState>=1&&v.videoWidth>0&&Number.isFinite(v.duration)&&v.duration>0;});
     const media=await page.evaluate(()=>{window.retiredVideo=testRoot.querySelector('video[aria-label="retained.webm"]');window.retiredURL=retiredVideo.src;return{src:retiredURL,controls:retiredVideo.controls,width:retiredVideo.videoWidth,height:retiredVideo.videoHeight,duration:retiredVideo.duration,readyState:retiredVideo.readyState,reads:fileReads};});assert.equal(media.controls,true);assert(media.width>0&&media.height>0&&media.duration>0);assert.deepEqual(media.reads,[{id:(8).toString(16).padStart(32,'0'),index:7,dir:'in'}]);completed.push('video metadata');
     stage='native hide/show retires reversibly';await page.evaluate(()=>setNativeVisible(false));await page.waitForFunction(()=>!retiredVideo.isConnected&&revoked.includes(retiredURL));await page.evaluate(()=>setNativeVisible(true));await normal.getByRole('button',{name:'Play video retained.webm',exact:true}).click();await page.waitForFunction(()=>testRoot.querySelector('video[aria-label="retained.webm"]')?.readyState>=1);await page.evaluate(()=>{retiredVideo=testRoot.querySelector('video[aria-label="retained.webm"]');retiredURL=retiredVideo.src;});completed.push('native visibility mock');
     if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'entry-video-holonet-'+width+'.png')});}
     stage='Review retires active video and late bytes';await page.getByRole('group',{name:'Video late.webm',exact:true}).getByRole('button',{name:'Play video late.webm',exact:true}).click();await page.waitForFunction(()=>typeof releaseLate==='function');await page.locator('#review-btn').click();await page.waitForFunction(()=>!retiredVideo.isConnected&&!retiredVideo.hasAttribute('src')&&revoked.includes(retiredURL));
     const count=await page.evaluate(()=>created.length);await page.evaluate(async()=>{await releaseLate();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});assert.equal(await page.evaluate(()=>created.length),count,'late bytes cannot create a new URL after Review');assert.equal(await page.locator('video[controls]').count(),0);assert.deepEqual(await page.evaluate(()=>fileReads),[{id:(8).toString(16).padStart(32,'0'),index:7,dir:'in'},{id:(8).toString(16).padStart(32,'0'),index:7,dir:'in'},{id:(8).toString(16).padStart(32,'0'),index:8,dir:'in'}]);assert.equal(await page.evaluate(()=>revoked.filter(u=>u===retiredURL).length),1);completed.push('video cleanup');
     stage='Review close restores a fresh idle player';await page.locator('#review-btn').click();if(width===390){assert.equal(await page.evaluate(()=>testRoot.classList.contains('show-conv')),false);await page.evaluate(()=>fixture.openDM(fixtureDM.id));}const resumed=page.getByRole('group',{name:'Video retained.webm',exact:true});assert.equal(await resumed.locator('video').count(),0,'Review return never autoplays');await resumed.getByRole('button',{name:'Play video retained.webm',exact:true}).click();await page.waitForFunction(()=>testRoot.querySelector('video[aria-label="retained.webm"]')?.readyState>=1);completed.push('Review video return');
     assert.deepEqual(errors,[]);const result=await page.evaluate(()=>({requests:fixtureRequests,posts,fileReads,created,revoked,rows:fixtureSchedules,readVisit:fixture.state.readVisit&&{scope:fixture.state.readVisit.scope,visible:[...fixture.state.readVisit.visibleIDs]}}));
     await page.evaluate(()=>entryModule.unmount(testRoot));assert.equal(await page.evaluate(()=>testRoot.childNodes.length),0);assert.equal(await page.evaluate(()=>visibilityListeners.size),0,'root and all child visibility listeners retired');completed.push('unmount');
     if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'entry-holonet-'+width+'.json'),JSON.stringify({width,completed,media,result,errors},null,2)+'\n');}
     console.log(JSON.stringify({skin:'holonet',width,completed,actualSampleBytes:sample.length,actualMetadata:media}));
    }catch(error){failed=true;if(evidence){fs.mkdirSync(evidence,{recursive:true});const raw=await page.evaluate(()=>{const r=globalThis.testRoot,f=globalThis.fixture,read=f?.state.readVisit;return{requests:globalThis.fixtureRequests,posts:globalThis.posts,fileReads:globalThis.fileReads,created:globalThis.created,revoked:globalThis.revoked,documentVisible:document.visibilityState,hasFocus:document.hasFocus(),nativeVisible:f?.nativeVisible(),reviewHidden:r?.querySelector('#review')?.hidden,showConversation:r?.classList.contains('show-conv'),freshSame:read?.fresh===f?.state.dmData,visit:read&&{scope:read.scope,entering:read.entering,loading:read.loading,firstUnread:read.firstUnread,visible:[...read.visibleIDs],pending:[...read.pending],done:[...read.done]},activeElement:r?.getRootNode().activeElement?.outerHTML,dialogs:[...(r?.querySelectorAll('dialog[open]')||[])].map(n=>({label:n.getAttribute('aria-label'),html:n.outerHTML})),dom:r?.outerHTML};}).catch(e=>({captureError:e.message}));fs.writeFileSync(path.join(evidence,'entry-failure-holonet-'+width+'.json'),JSON.stringify({width,stage,completed,errors,message:error.message,raw},null,2)+'\n');await page.screenshot({path:path.join(evidence,'entry-failure-holonet-'+width+'.png')}).catch(()=>{});}throw error;}
    finally{t.diagnostic('holonet '+width+' last stage: '+stage+'; completed: '+completed.join(', '));await page.evaluate(()=>globalThis.entryModule?.unmount(globalThis.testRoot)).catch(()=>{});await context.close();}
   });
  }
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
