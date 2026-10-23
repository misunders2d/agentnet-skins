import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {test} from 'node:test';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
test('standalone actual group loads retain verified state through typed verification wait',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://fixture');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);if(!m){res.writeHead(404).end();return;}
  try{let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(collection,'skins',m[1],'skin.json'),'utf8'):fs.readFileSync(path.join(collection,'skins',m[1],'src',m[2]));
   if(m[2]==='entry.mjs'){const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.toString().includes(needle));
    const expose='globalThis.fixture={state,loadDM,beginDM,enterReadVisit,leaveReadVisit,commitReadView,readAllowed,markPersonalRead,inviteRights,sendDM,syncComposer,renderPending,listen,setHost:h=>{currentHost=h;},'+(m[1]==='zoom'?'Zoom,':'')+'};';
    data=data.toString().replace(needle,expose+(m[1]==='zoom'?'':'const ready=Promise.resolve();'));
   }res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(e.message);}
 });let browser;
 try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of (process.env.AGENTNET_GROUP_PENDING_SKINS||'classic,holonet,zoom').split(','))for(const width of (process.env.AGENTNET_GROUP_PENDING_WIDTHS||'390,1280').split(',').map(Number))await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin);
   try{
    const report=await page.evaluate(async skin=>{
     const check=(v,why)=>{if(!v)throw Error(why);},clone=v=>structuredClone(v),wait=ms=>new Promise(r=>setTimeout(r,ms));
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];const root=document.createElement('div');root.className='skin-root';shadow.append(root);
     const id='a'.repeat(64),cold='b'.repeat(64),me={person:'atlas',label:'Atlas',address:'atlas/desk',state:'self',devices:[]},peer={person:'briar',label:'Briar',address:'briar/desk',state:'pinned',devices:[]};
     const overview={role:'person',person:me,me:{address:me.address,fingerprint:'11111111-11111111-11111111-11111111'},people:[peer],threads:[],dms:[],review:[],needs_you:[],quarantine:[],held:[],links:[],reminders:[],peers:[],notify:{enabled:false},agents:true,persons:true,groups:true,files:{max_count:8,max_file:104857600,max_message:104857600}};
     const view=(title='Verified original',conv=id)=>({id:conv,kind:'group',role:'member',title,peer,key:{pinned:'22222222-22222222-22222222-22222222'},members:[{...me,admin:true},peer],agents:[],guests:[],topics:[],messages:[{id:'c'.repeat(32),lid:'c'.repeat(32),body:'Exact retained original message',dir:'in',from:peer.address,kind:'message',at:'2026-10-15T20:00:00Z',state:'delivered',delivery:'delivered',can:[],actions:[],reactions:[],unread:false}]});
     overview.dms=[{...view(),count:1,last:'Exact retained original message',last_at:'2026-10-15T20:00:00Z',unread:0}];
     const calls=[],queue=[],held=new Map(),listeners=new Map();
     const pendingError=()=>Object.assign(Error('Updating verified group details. Sending is paused until verification finishes.'),{code:'group_context_pending',status:503});
     const host={version:1,platform:'daemon',workspace:{id:'group-pending-fixture'},listen(fn){listeners.set(this,fn);return()=>listeners.delete(this);},onOpen(){return()=>{};},onBack(){return()=>{};},linkTo:()=>'',api:async function(p,body){calls.push({p,body,workspace:this.workspace.id});
      if(p.startsWith('/api/dm?')){const next=queue.shift();check(next,'Unexpected DM request '+p);if(next.hold)return new Promise((resolve,reject)=>held.set(next.hold,{resolve,reject}));if(next.error)throw next.error;return clone(next.view);}
      if(p.startsWith('/api/overview'))return clone(overview);if(body)return{};return{};
     }};
     const module=await import('/'+skin+'/entry.mjs');await module.mount(root,host);fixture.state.overview=clone(overview);fixture.state.seq=1;
     const node=id=>root.querySelector('#'+id),live=()=>node('live').textContent;
     const setup=async(conv=id,title='Verified original')=>{fixture.beginDM(conv);if(skin==='zoom'){fixture.Zoom.level=2;fixture.Zoom.dm=conv;fixture.Zoom.person='briar';fixture.Zoom.peer=null;node('zoom').hidden=false;}queue.push({view:view(title,conv)});await fixture.loadDM(true);};
     await setup();check(fixture.state.dmData.title==='Verified original'&&!node('send').disabled,'healthy actual loader/composer baseline');
     const originalMessages=JSON.stringify(fixture.state.dmData.messages),originalTitle=fixture.state.dmData.title,file=new File([new Uint8Array([11,22,33,44])],'Retained note.txt',{type:'text/plain'}),draft='Exact retained draft';
     node('body').value=draft;fixture.state.files=[{key:'retained-file',name:file.name,size:file.size,type:file.type,file}];fixture.renderPending();
     const files=fixture.state.files,entry=JSON.stringify([...fixture.state.readVisit.entry]),readVisit=fixture.state.readVisit,beforeWrites=calls.filter(c=>c.body).length;
     queue.push({error:pendingError()});await fixture.loadDM(false);
     check(!!fixture.state.dmData.frozen&&node('send').disabled,'typed pending must pause cached authority and send');
     check(JSON.stringify(fixture.state.dmData.messages)===originalMessages&&fixture.state.dmData.title===originalTitle,'pending lost full verified messages/title');
     check(node('body').value===draft&&fixture.state.files===files&&fixture.state.files[0].file===file,'pending changed exact draft/File objects');
     check(fixture.state.readVisit===readVisit&&JSON.stringify([...readVisit.entry])===entry&&!fixture.readAllowed(readVisit,fixture.state.dmData,'dm'),'pending view armed a fresh read baseline');
     check(!fixture.inviteRights(fixture.state.dmData).people&&!fixture.inviteRights(fixture.state.dmData).assistants,'pending kept invitation authority');
     await fixture.sendDM();check(calls.filter(c=>c.body).length===beforeWrites,'pending issued an authority/send/read write');
     const status=skin==='zoom'?node('zoom').querySelector('[role="status"]'):node('notice');check(status&&status.textContent.includes('Updating verified group details.'),'pending updating status missing');
     const rect=status.getBoundingClientRect();check(rect.width>0&&rect.top>=0&&rect.bottom<=innerHeight+1,'pending status not literally visible '+JSON.stringify({rect:rect.toJSON(),root:root.getBoundingClientRect().toJSON(),classes:root.className}));
     const pendingView=fixture.state.dmData;fixture.leaveReadVisit();fixture.enterReadVisit('dm',id,true);await fixture.loadDM(false,pendingView,true);
     check(fixture.state.readVisit.entering&&!fixture.state.readVisit.fresh&&fixture.state.readVisit.entry.size===0,'cached pending freshEntryView fabricated read entry');
     queue.push({view:view('Verified recovered')});await fixture.loadDM(false);check(!fixture.state.dmData.frozen&&!node('send').disabled&&fixture.state.dmData.title==='Verified recovered','complete verified response did not restore sending');
     check(node('body').value===draft&&fixture.state.files[0].file===file,'successful refresh changed retained draft/files');
     const originalEntry=fixture.state.readVisit.entry,readWrites=calls.filter(c=>c.body?.do==='read').length,newer=view('Verified recovered');newer.messages[0].attention={rev:8,writer:'3'.repeat(64)};newer.messages[0].unread=true;
     queue.push({view:newer});await fixture.loadDM(false);check(fixture.state.readVisit.entry===originalEntry&&originalEntry.size===0&&fixture.state.dmData.messages[0].unread,'later unread generation replaced the current entry baseline');
     check(fixture.readAllowed(fixture.state.readVisit,fixture.state.dmData,'dm'),'healthy control must permit the current visible read path');await fixture.markPersonalRead(fixture.state.dmData,'dm');check(calls.filter(c=>c.body?.do==='read').length===readWrites,'newer unseen attention generation was acknowledged by an old entry');
     fixture.leaveReadVisit();fixture.enterReadVisit('dm',id,true);const completeLocal=view('Verified recovered');await fixture.loadDM(false,completeLocal,true);check(fixture.state.readVisit.fresh===completeLocal&&!fixture.state.readVisit.entering,'successful complete local freshEntryView no longer commits its exact baseline');
     queue.push({error:Object.assign(Error('Updating verified group details. Sending is paused until verification finishes.'),{code:'permission_denied',status:403})});await fixture.loadDM(false);check(live().includes('Updating verified group details.')&&!fixture.state.dmData.frozen,'ordinary error was swallowed or classified from prose');
     for(const [code,status,message]of [['key_changed',409,'Exact key conflict remains explicit'],['native_permission',403,'Native permission requires owner input']]){queue.push({error:Object.assign(Error(message),{code,status})});await fixture.loadDM(false);check(live()===message&&!fixture.state.dmData.frozen,'ordinary '+code+' error was suppressed or classified as pending');}
     queue.push({view:{...view('Verified former member'),role:'former_member',frozen:'You are no longer a member of this group.'}});await fixture.loadDM(false);check(node('send').disabled&&fixture.state.dmData.role==='former_member'&&root.textContent.includes('You are no longer a member'),'actual former-member DTO lost readable frozen behavior');
     await setup();
     // Same-ID older responses/errors cannot overwrite the newer verified view.
     for(const oldError of [true,false]){queue.push({hold:'older'});const older=fixture.loadDM(false);queue.push({view:view('Newer verified '+oldError)});await fixture.loadDM(false);const latest=fixture.state.dmData,liveBefore=live();if(oldError)held.get('older').reject(pendingError());else held.get('older').resolve(view('Older successful response'));await older;check(fixture.state.dmData===latest&&!latest.frozen&&live()===liveBefore,'older same-ID result changed current verified view');}
     for(const changed of ['host','workspace','chat','visit','focus','generation']){
      await setup();queue.push({hold:'stale'});if(changed==='focus')fixture.state.messageOpening={conv:id,waiting:true};const stale=fixture.loadDM(false),oldView=fixture.state.dmData,liveBefore=live();
      if(changed==='host')fixture.setHost({...host});if(changed==='workspace')fixture.setHost({...host,workspace:{id:'other-fixture'}});if(changed==='chat')fixture.state.dm=cold;if(changed==='visit'){fixture.leaveReadVisit();fixture.enterReadVisit('dm',id,true);}if(changed==='focus')fixture.state.messageOpening={conv:id,waiting:true};if(changed==='generation')fixture.state.gen++;
      held.get('stale').reject(pendingError());await stale;check(fixture.state.dmData===oldView&&live()===liveBefore&&!oldView.frozen,'stale '+changed+' pending changed current view');fixture.setHost(host);fixture.state.messageOpening=null;fixture.state.gen++;
     }
     // Cold pending does not borrow another chat or invent a membership DTO.
     fixture.beginDM(cold);root.classList.remove('show-conv');if(skin==='zoom'){fixture.Zoom.level=2;fixture.Zoom.dm=cold;fixture.Zoom.person='briar';}fixture.state.drafts['dm:'+cold]={text:'Cold retained draft',files,kind:'message'};queue.push({error:pendingError()});await fixture.loadDM(true);
     const coldStatus=skin==='zoom'?node('zoom').querySelector('[role="status"]'):node('notice'),coldRect=coldStatus?.getBoundingClientRect();check(coldRect&&coldRect.width>0&&coldRect.top>=0&&coldRect.bottom<=innerHeight+1,'cold pending status not visible '+JSON.stringify(coldRect?.toJSON()));
     check(fixture.state.dmData===null&&node('send').disabled,'cold pending fabricated a successful membership DTO');check(root.textContent.includes('Updating verified group details.'),'cold pending missing honest waiting status');check(node('body').value==='Cold retained draft'&&fixture.state.files[0].file===file,'cold pending did not retain selected-chat draft/files');check(fixture.state.readVisit.entering&&!fixture.state.readVisit.fresh,'cold pending armed reading');
     queue.push({view:view('Cold verified',cold)});await fixture.loadDM(false);check(fixture.state.dmData.title==='Cold verified'&&!node('send').disabled,'cold pending could not recover explicitly');
     // Actual registered normal push refresh, with no polling/retry timer.
     fixture.listen();queue.push({error:pendingError()});await fixture.loadDM(false);const readsBeforePush=calls.filter(c=>c.p.startsWith('/api/dm?')).length;queue.push({view:view('Complete after push',cold)});listeners.get(host)({type:'change',seq:2});
     for(let n=0;n<100&&fixture.state.dmData?.title!=='Complete after push';n++)await wait(10);check(fixture.state.dmData?.title==='Complete after push'&&!fixture.state.dmData.frozen,'registered normal push did not clear typed pause');
     await wait(60);check(calls.filter(c=>c.p.startsWith('/api/dm?')).length===readsBeforePush+1,'typed pending added an automatic refetch loop');
     check(fixture.state.files[0].file===file&&Array.from(new Uint8Array(await file.arrayBuffer())).join(',')==='11,22,33,44','retained original bytes changed');const fileSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
     queue.push({hold:'unmounted'});const late=fixture.loadDM(false);await module.unmount(root);held.get('unmounted').reject(pendingError());await late;check(root.childElementCount===0,'late pending rendered after unmount');
     return{typedOnly:true,cachedFullView:true,exactDraftFileObjects:true,pendingReadUnarmed:true,cachedPendingFreshEntryDenied:true,ordinary403Explicit:true,formerMemberReadable:true,sameIDOlderResultsInert:2,staleOwnershipVectors:6,coldNoDTO:true,registeredPushRecovery:true,pendingAutoRefetches:0,pendingStatusRect:rect.toJSON(),coldStatusRect:coldRect.toJSON(),newerAttentionRetained:true,successfulLocalFreshEntryRetained:true,fileSHA256,nativeAuthorityProved:false,actualZoomLevel:skin==='zoom'?2:null};
    },skin);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({skin,width,...report,pageErrors:errors}));
   }finally{await context.close();}
  });
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
