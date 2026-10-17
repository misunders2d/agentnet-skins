// Focused source-mounted menu and visit regressions; reuses native-activity's fixture pattern.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {test} from 'node:test';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=path.resolve(import.meta.dirname,'..');

test('standalone personal unread uses atomic snapshots and explicit fresh visits',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://fixture');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Unread contract fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);if(!m){res.writeHead(404).end();return;}
  try{
   let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(collection,'skins',m[1],'skin.json'),'utf8')+';':fs.readFileSync(path.join(collection,'skins',m[1],'src',m[2]));
   if(m[2]==='entry.mjs'){
    const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.toString().includes(needle));
    // Expose the actual closure's predicates/cached readiness only for failure metadata.
    const probe='readProbe:()=>{const read=state.readVisit,view=state.dm?state.dmData:state.data,kind=state.dm?"dm":"thread";return {scroller:'+(m[1]==='holonet'?"$('timeline')":'messageScrollRoot()')+',reserveTop:'+(m[1]==='holonet'?'0':'messageTopReserve()')+',flags:{alive,visitPresent:!!read,hostCurrent:!!read&&read.host===currentHost,kindCurrent:read?.kind===kind,idCurrent:!!view&&read?.id===view.id,fresh:!!view&&read?.fresh===view,entering:read?.entering,loading:read?.loading,globalLoading:loading,nativeVisible,visible:document.visibilityState,focused:document.hasFocus(),messageOpening:!!state.messageOpening,dialogOpen:!!root.querySelector(\'dialog[open], [role="dialog"][aria-modal="true"]\'),shown:'+(m[1]==='holonet'?"root.classList.contains('show-conv')||!narrowView.matches":'currentReadViewShown()')+',reviewClosed:'+(m[1]==='holonet'?"$('review').hidden":'!state.reviewOpen')+',allowed:!!read&&!!view&&readAllowed(read,view,kind),ready:'+(m[1]==='holonet'?'true':'viewReadyForRead()')+',watcherPresent:'+(m[1]==='holonet'?'!!read?.watcher':'!!visibleRead')+(m[1]==='zoom'?',headerReady:zoomHeaderReady,headerReserve:zoomHeaderReserve,navigating:Zoom.navigating!==null,level:Zoom.level,queryActive:!!Zoom.query.trim()':'')+'}}}';
    const names='state,messageMenu,beginDM,beginThread,openDM,openThread,loadDM,loadThread,markDMRead,markPersonalRead,markPersonalUnread,canMarkPersonal,attentionRows,topicSelections,topicFresh,selectReadTopic,leaveReadVisit,restoreAfterReload,showList,openLinkTarget,openMessage,readReloadKey:()=>reloadKey,isLoading:()=>loading,'+probe+(m[1]==='zoom'?',Zoom':'');
    data=data.toString().replace(needle,'globalThis.fixture={'+names+'};'+(m[1]==='zoom'?'':'const ready=Promise.resolve();'));
   }
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(e.message);}
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of (process.env.AGENTNET_TEST_SKINS||'classic,holonet,zoom').split(','))for(const width of (process.env.AGENTNET_TEST_WIDTHS||'1280,390').split(',').map(Number))await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];let stage='mount',input=null,expectedRead=null,passed=false;
   page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const settle=()=>page.waitForFunction(()=>!fixture.isLoading()&&!(fixture.state.readVisit?.pending.size));
   // Positive completion is the exact read, not a momentarily empty pending set.
   const waitRead=async(ids,rev,writer='11111111-11111111-11111111-11111111',count,clear=true)=>{
    ids=ids.map(i=>i.toString(16).padStart(32,'0'));
    expectedRead={ids,attention:rev===null?null:Object.fromEntries(ids.map(id=>[id,{rev,writer}])),count,clear};
    await page.waitForFunction(expected=>{
     const reads=expected.clear?f.clears():f.reads(),body=reads.at(-1)?.body;
     if(!body||expected.count!==undefined&&reads.length!==expected.count||JSON.stringify(body.ids)!==JSON.stringify(expected.ids))return false;
     if(expected.attention===null)return body.attention===undefined;
     const actual=body.attention;
     return !!actual&&Object.keys(actual).length===expected.ids.length&&expected.ids.every(id=>actual[id]?.rev===expected.attention[id].rev&&actual[id]?.writer===expected.attention[id].writer);
    },expectedRead);
   };
   const captureFailure=async()=>{
    const snapshot=await page.evaluate(({skin,width,stage,input,expectedRead})=>{
     if(!globalThis.fixture||!globalThis.f)return {skin,width,stage,input,fixturePresent:!!globalThis.fixture};
     const read=fixture.state.readVisit,view=fixture.state.dm?fixture.state.dmData:fixture.state.data,kind=fixture.state.dm?'dm':'thread',probe=fixture.readProbe(),scroller=probe.scroller;
     const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return {top:r.top,right:r.right,bottom:r.bottom,left:r.left,width:r.width,height:r.height};};
     const viewport=rect(scroller),top=viewport?Math.min(viewport.bottom,viewport.top+Math.max(0,probe.reserveTop)):null;
     const ids=(expectedRead?.ids||[read?.firstUnread,...(read?.entry?.keys()||[])]).filter(Boolean).slice(0,8);
     const rows=ids.map(id=>{const row=scroller?.querySelector('[data-mid="'+CSS.escape(id)+'"], #'+CSS.escape('m-'+id)),r=rect(row);return {id,rect:r,connected:row?.isConnected??false,intersection:r&&viewport?{width:Math.min(r.right,viewport.right)-Math.max(r.left,viewport.left),height:Math.min(r.bottom,viewport.bottom)-Math.max(r.top,top),requiredHeight:Math.min(r.height/2,(viewport.bottom-top)/2)}:null};});
     const canonical=view?fixture.attentionRows(view,kind).map(m=>m.id):[];
     return {skin,width,stage,input,expectedRead,flags:probe.flags,scroller:{rect:viewport,connected:scroller?.isConnected??false,scrollTop:scroller?.scrollTop,scrollHeight:scroller?.scrollHeight,clientHeight:scroller?.clientHeight},cachedTopReserve:probe.reserveTop,effectiveViewport:viewport?{...viewport,top,height:viewport.bottom-top}:null,canonicalIDs:canonical.slice(0,256),canonicalCount:canonical.length,visibleIDs:[...(read?.visible||read?.visibleIDs||[])].slice(0,256),expectedRows:rows,reads:f.reads().slice(0,64).map(p=>({path:p.p,ids:p.body.ids.slice(0,256),attention:p.body.attention||null})),readCount:f.reads().length};
    },{skin,width,stage,input,expectedRead});
    console.log('UNREAD_FAILURE '+JSON.stringify(snapshot));
   };
   try{
    await page.goto(origin);
    await page.evaluate(async skin=>{
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];const root=document.createElement('div');root.className='skin-root';shadow.append(root);
     const fp='11111111-11111111-11111111-11111111',other='22222222-22222222-22222222-22222222',conv='c'.repeat(64),topic='b'.repeat(32),id=i=>i.toString(16).padStart(32,'0');
     const me={address:'atlas/desk',fingerprint:fp,agent:false},peer={person:'briar',label:'Briar',address:'briar/desk',devices:[]};
     const row=(i,extra={})=>({id:id(i),lid:id(i),dir:'in',kind:'message',body:'Admitted '+i,topic:'',from:peer.address,from_key:other,to:me.address,at:'2026-10-16T09:00:00Z',author:{label:'Briar',agent:false},can:[],actions:[],attachments:[],unread:false,...extra});
     const rows=Array.from({length:132},(_,i)=>row(i+1));rows[1].dir='out';rows[1].from=me.address;rows[1].from_key=fp;rows[2].body='';rows[2].attachments=[{name:'held.txt',size:9,openable:false}];rows[3].excerpt_pid='e'.repeat(32);rows[4].verified_agent=true;rows[4].kind='answer';
     rows.push(row(200,{topic}),row(201,{deleted:true}),row(202,{hidden:true}),row(203,{_local:true}),row(204,{sub:'read-sync'}),row(205,{topic_event:{action:'create'}}));
     const original={id:conv,kind:'dm',role:'member',peer,members:[],agents:[],guests:[],topics:[{id:topic,title:'Named topic',count:1}],messages:rows,created:'2026-10-16T09:00:00Z'};
     const overview={version:'fixture',me,person:{person:'atlas',label:'Atlas',state:'self',address:me.address,devices:[]},people:[peer],threads:[],dms:[],review:[],quarantine:[],needs_you:[],held:[],links:[],reminders:[],peers:[],agent_devices:[],files:{max_file:1048576,max_count:8}};
     const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
     window.f={fp,other,conv,topic,id,original,dm:structuredClone(original),thread:{id:id(301),peer:peer.address,key:{pinned:other,pending:false},messages:[row(301,{dir:'out',from:me.address,from_key:fp})]},posts:[],gets:0,gates:[],held:[],readGate:null,overview};
     const host={version:1,workspace:{id:'unread-contract'},listen(){return()=>{}},onOpen(){},api:async(p,body)=>{
      if(body!==undefined){f.posts.push({p,body:structuredClone(body)});if(p==='/api/act'){
       const all=[...f.dm.messages,...f.thread.messages];
       if(body.do==='unread')for(const id of body.ids){const m=all.find(m=>m.id===id);if(m){m.unread=true;m.attention={rev:(m.attention?.rev||0)+1,writer:fp};}}
       if(body.do==='read'){const gate=f.readGate;f.readGate=null;if(gate)await gate.promise;for(const id of body.ids){const m=all.find(m=>m.id===id);if(!m)continue;const g=body.attention?.[id];if(m.attention){if(g?.rev===m.attention.rev&&g.writer===m.attention.writer){m.unread=false;delete m.attention;}}else m.unread=false;}}
      }return{note:'Personal attention updated'};}
      if(p.startsWith('/api/dm?id=')){f.gets++;return f.gates.length?f.gates.shift().promise:structuredClone(f.dm);}
      if(p.startsWith('/api/thread?id='))return structuredClone(f.thread);
      if(p.startsWith('/api/overview'))return structuredClone(overview);
      if(p.startsWith('/api/typing'))return{enabled:false,supported:false,scopes:[],people:[]};
      if(p.startsWith('/api/agents'))return{agents:[],sessions:[]};if(p==='/api/teams')return{teams:[]};if(p.startsWith('/api/topics'))return{topics:[]};throw Error('Unexpected fixture read '+p);
     }};
     const module=await import('/'+skin+'/entry.mjs');await module.mount(root,host);window.stopSkin=()=>module.unmount(root);
     for(const child of root.children)child.hidden=true;
     const probe=document.createElement('section');probe.id='unread-probe';probe.style.cssText='position:fixed;top:180px;right:20px;z-index:80;width:min(300px,calc(100vw - 40px));text-align:right';
     if(skin==='zoom'){
      // Preserve the production root/workspace/stack flex allocation and real zoom-space.
      const workspace=root.querySelector('.workspace'),stack=workspace.querySelector('.view-stack'),zoom=root.querySelector('#zoom');
      workspace.hidden=false;
      for(const child of workspace.children)child.hidden=child!==stack;
      for(const child of stack.children)child.hidden=child!==zoom;
      zoom.hidden=false;root.querySelector('#dialog').hidden=false;root.append(probe);root.style.visibility='visible';
      // The legacy composer/timeline remain inside the original hidden draft-state.
     }else{
      const area=document.createElement('section');area.style.cssText='height:100%;overflow:auto';root.append(area);
      for(const id of ['composer','timeline','dialog']){const n=root.querySelector('#'+id);n.hidden=false;area.append(n);}
      area.prepend(probe);root.style.cssText='display:block;height:100%;visibility:visible';
     }
     f.hold=()=>{const d=deferred();f.gates.push(d);f.held.push(d);return f.held.length-1;};
     f.mark=(i,rev,writer=fp,kind='dm')=>{const m=(kind==='dm'?f.dm:f.thread).messages.find(m=>m.id===id(i));m.unread=true;m.attention={rev,writer};};
     f.reads=()=>f.posts.filter(x=>x.p==='/api/act'&&x.body.do==='read');f.clears=()=>f.reads().filter(x=>x.body.attention);
     f.reset=()=>{
      fixture.leaveReadVisit();Object.assign(fixture.state,{overview,dm:null,dmData:null,thread:null,data:null,draftKey:null,messageOpening:null,files:[]});f.dm=structuredClone(f.original);f.thread={id:id(301),peer:peer.address,key:{pinned:other,pending:false},messages:[row(301,{dir:'out',from:me.address,from_key:fp})]};f.posts=[];f.gets=0;f.gates=[];f.held=[];f.readGate=null;fixture.topicSelections[conv]='';fixture.topicFresh[conv]=false;root.classList.add('show-conv');f.overview.dms=[];if(skin==='zoom')Object.assign(fixture.Zoom,{level:2,dm:conv,person:peer.person,query:'',navigating:null});fixture.beginDM(conv,false);
     };
     f.menu=(m,conv=f.conv)=>{const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=m.body||'File-only message';const menu=fixture.messageMenu(m,conv,bubble);probe.replaceChildren(bubble,...(menu?[menu]:[]));};
     f.reset();
    },skin);
    stage='ordinary visitor and read-only normal views';input=null;expectedRead=null;
    for(const gate of [{role:'visitor'},{read_only:true},{readOnly:true}]){
     input=gate;
     await page.evaluate(async gate=>{f.reset();Object.assign(f.dm,gate);f.dm.messages[0].unread=true;f.dm.messages[2].unread=true;await fixture.openDM(f.conv);},gate);await settle();
     await waitRead([1,3],null,null,1,false);
     assert.equal(await page.evaluate(()=>f.reads().length),1,'normal visitor/read-only open acknowledges once');assert.deepEqual(await page.evaluate(()=>f.reads()[0].body.ids),['1'.padStart(32,'0'),'3'.padStart(32,'0')]);assert.equal(await page.evaluate(()=>f.reads()[0].body.attention),undefined);
     await page.evaluate(()=>fixture.loadDM(false));await settle();assert.equal(await page.evaluate(()=>f.reads().length),1,'same-view reload does not duplicate the normal read');
     await page.evaluate(()=>f.menu(fixture.state.dmData.messages[0]));assert.equal(await page.locator('#unread-probe').getByRole('button',{name:/^Mark unread/}).count(),0,'personal marking stays unavailable');
     await page.evaluate(async()=>{const m=fixture.state.dmData.messages[0];await fixture.markPersonalUnread(m,f.conv,false);await fixture.markPersonalUnread(m,f.conv,true);});assert.equal(await page.evaluate(()=>f.posts.filter(p=>p.body.do==='unread').length),0,'direct personal mark is refused');
    }
    await page.evaluate(()=>f.reset());
    stage='bootstrap does not arm';input=null;expectedRead=null;
    await page.evaluate(async()=>{f.mark(1,1);await fixture.loadDM(false);});await settle();assert.equal(await page.evaluate(()=>f.clears().length),0);
    stage='atomic132 and menu eligibility';input=null;expectedRead=null;
    await page.evaluate(async()=>{f.reset();await fixture.loadDM(false);});await settle();
    await page.evaluate(()=>f.menu(fixture.state.dmData.messages[0]));await page.locator('#unread-probe summary').click();await page.locator('#unread-probe').getByRole('button',{name:'Mark unread from here',exact:true}).click();await settle();
    assert.equal(await page.evaluate(()=>f.posts.filter(p=>p.body.do==='unread').length),1);assert.deepEqual(await page.evaluate(()=>f.posts.find(p=>p.body.do==='unread').body.ids),Array.from({length:132},(_,i)=>(i+1).toString(16).padStart(32,'0')));assert.equal(await page.evaluate(()=>f.posts.find(p=>p.body.do==='unread').body.ids.includes(f.id(200))),false);assert.equal(await page.evaluate(()=>f.clears().length),0,'marks created in this visit survive refresh');
    await page.evaluate(()=>f.menu(fixture.state.dmData.messages[1]));await page.locator('#unread-probe summary').click();await page.locator('#unread-probe').getByRole('button',{name:'Mark unread',exact:true}).click();await settle();assert.deepEqual(await page.evaluate(()=>f.posts.filter(p=>p.body.do==='unread').at(-1).body.ids),['2'.padStart(32,'0')]);
    assert.equal(await page.evaluate(()=>{const view=fixture.state.dmData;return [2,3,4,5].every(i=>fixture.canMarkPersonal(view.messages.find(m=>m.id===f.id(i)),f.conv))&&[201,202,203,204,205].every(i=>!fixture.canMarkPersonal(view.messages.find(m=>m.id===f.id(i)),f.conv));}),true,'sent/file/excerpt/agent admitted; hidden/control/optimistic excluded');
    await page.evaluate(()=>{fixture.state.dmData.read_only=true;f.menu(fixture.state.dmData.messages[0]);});assert.equal(await page.locator('#unread-probe').getByRole('button',{name:'Mark unread',exact:true}).count(),0);await page.evaluate(()=>fixture.state.dmData.read_only=false);
    stage='current visit same scope and restored';input=null;expectedRead=null;
    await page.evaluate(async()=>{f.reset();await fixture.loadDM(false);f.mark(1,4);await fixture.loadDM(false);fixture.beginDM(f.conv);await fixture.loadDM(false);});await settle();assert.equal(await page.evaluate(()=>f.clears().length),0);
    await page.evaluate(async()=>{fixture.leaveReadVisit();sessionStorage.setItem(fixture.readReloadKey(),JSON.stringify({dm:f.conv,drafts:{}}));await fixture.restoreAfterReload();});await settle();assert.equal(await page.evaluate(()=>f.clears().length),0,'restore must not arm current marks');
    stage='first fresh cached reopen and replacement';input=null;expectedRead=null;
    await page.evaluate(()=>{fixture.leaveReadVisit();f.mark(1,5,f.other);f.hold();f.opening=fixture.openDM(f.conv);fixture.markDMRead();});assert.equal(await page.evaluate(()=>f.clears().length),0,'cache cannot arm');
    await page.evaluate(async()=>{f.held[0].resolve(structuredClone(f.dm));await f.opening;});await settle();await waitRead([1],5,'22222222-22222222-22222222-22222222',1);assert.deepEqual(await page.evaluate(()=>f.clears().at(-1).body.attention),{['1'.padStart(32,'0')]:{rev:5,writer:'22222222-22222222-22222222-22222222'}});
    await page.evaluate(async()=>{f.mark(1,6);await fixture.loadDM(false);});await settle();assert.equal(await page.evaluate(()=>f.clears().length),1,'replacement in same visit survives');
    stage='superseded close reopen';input=null;expectedRead=null;
    await page.evaluate(()=>{fixture.leaveReadVisit();f.hold();f.oldView=structuredClone(f.dm);f.oldOpen=fixture.openDM(f.conv);fixture.leaveReadVisit();f.mark(1,7,f.other);f.hold();f.newOpen=fixture.openDM(f.conv);});
    await page.evaluate(async()=>{f.held[1].resolve(f.oldView);await f.oldOpen;});assert.equal(await page.evaluate(()=>f.clears().length),1,'superseded response cannot seed newer entry');
    await page.evaluate(async()=>{f.held[2].resolve(structuredClone(f.dm));await f.newOpen;});await settle();await waitRead([1],7,'22222222-22222222-22222222-22222222',2);assert.equal(await page.evaluate(()=>f.clears().length),2);assert.equal(await page.evaluate(()=>f.clears().at(-1).body.attention[f.id(1)].rev),7);
    stage='failed fresh same scope retry';input=null;expectedRead=null;
    await page.evaluate(()=>{fixture.leaveReadVisit();f.mark(1,8);f.hold();f.failedOpen=fixture.openDM(f.conv);});await page.evaluate(async()=>{f.held[3].reject(Error('Synthetic first load failure'));await f.failedOpen;await fixture.openDM(f.conv);});await settle();await waitRead([1],8);assert.equal(await page.evaluate(()=>f.clears().at(-1).body.attention[f.id(1)].rev),8);
    stage='pending topic reuses single GET';input=null;expectedRead=null;
    await page.evaluate(()=>{f.reset();f.mark(1,2);f.mark(200,9,f.other);f.hold();f.pendingOpen=fixture.openDM(f.conv);fixture.topicSelections[f.conv]=f.topic;fixture.selectReadTopic();});assert.equal(await page.evaluate(()=>f.gets),1);
    await page.evaluate(async()=>{f.held[0].resolve(structuredClone(f.dm));await f.pendingOpen;});await settle();await waitRead([200],9,'22222222-22222222-22222222-22222222',1);assert.equal(await page.evaluate(()=>f.clears().length),1);assert.deepEqual(await page.evaluate(()=>Object.keys(f.clears()[0].body.attention)),['c8'.padStart(32,'0')]);
    stage='new-topic Main snapshot';input=null;expectedRead=null;
    await page.evaluate(()=>{fixture.topicFresh[f.conv]=true;fixture.selectReadTopic();f.posts=[];f.menu(fixture.state.dmData.messages[0]);});await page.locator('#unread-probe summary').click();await page.locator('#unread-probe').getByRole('button',{name:'Mark unread from here',exact:true}).click();await settle();assert.equal(await page.evaluate(()=>f.posts.find(p=>p.body.do==='unread').body.ids.length),132);assert.equal(await page.evaluate(()=>f.posts.find(p=>p.body.do==='unread').body.ids.includes(f.id(200))),false);
    stage='validated link fresh entry and same destination';input=null;expectedRead=null;
    await page.evaluate(async()=>{f.reset();f.mark(200,11,f.other);fixture.leaveReadVisit();await fixture.openLinkTarget(f.conv,'topic',{topic:f.topic});});await settle();await waitRead([200],11,'22222222-22222222-22222222-22222222');assert.equal(await page.evaluate(()=>f.clears().at(-1).body.attention[f.id(200)].rev),11);
    await page.evaluate(async()=>{f.mark(200,12);await fixture.openLinkTarget(f.conv,'topic',{topic:f.topic});});await settle();assert.equal(await page.evaluate(()=>f.clears().length),1,'same linked destination cannot rearm');
    stage='notification selects its named topic';input=null;expectedRead=null;
    await page.evaluate(async()=>{f.reset();f.mark(1,13);f.mark(200,13,f.other);f.overview.dms=[{id:f.conv,peer:f.original.peer,kind:'dm',unread:2}];fixture.leaveReadVisit();await fixture.openMessage({conv:f.conv,id:f.id(200)});});await settle();await waitRead([200],13,'22222222-22222222-22222222-22222222',1);assert.deepEqual(await page.evaluate(()=>f.clears().flatMap(p=>Object.keys(p.body.attention))),['c8'.padStart(32,'0')],'notification clears only its selected topic');
    if(skin==='zoom'){stage='Zoom detail selection stays same visit';await page.evaluate(async()=>{f.mark(200,14);await fixture.loadDM(false);f.detailVisit=fixture.state.readVisit;await fixture.Zoom.go(3,{msg:f.id(200)});await fixture.Zoom.go(2,{});});await settle();assert.equal(await page.evaluate(()=>fixture.state.readVisit===f.detailVisit&&f.clears().length===1),true);}
    stage='delayed ACK equal revision other writer';input=null;expectedRead=null;
    await page.evaluate(()=>{f.reset();f.mark(1,4);fixture.leaveReadVisit();f.readGate={};f.readGate.promise=new Promise(r=>f.releaseRead=r);f.delayedOpen=fixture.openDM(f.conv);});await waitRead([1],4,'11111111-11111111-11111111-11111111',1);
    await page.evaluate(async()=>{f.mark(1,4,f.other);await fixture.loadDM(false);f.releaseRead();await f.delayedOpen;});await settle();assert.equal(await page.evaluate(()=>f.dm.messages[0].unread),true);assert.equal(await page.evaluate(()=>f.clears().length),1,'stale full generation cannot clear replacement');
    stage='sent clear remembers plain ID';input=null;expectedRead=null;
    await page.evaluate(async()=>{await f.reset();f.mark(301,10,f.fp,'thread');fixture.leaveReadVisit();await fixture.openThread(f.id(301));});await settle();
    if(skin==='zoom')assert.deepEqual(await page.evaluate(()=>{
     const scroller=fixture.readProbe().scroller,canonical=new Set(fixture.attentionRows(fixture.state.data,'thread').map(m=>m.id));
     return {rowFound:!!scroller.querySelector('#m-'+f.id(301)),selectedIDs:[...scroller.querySelectorAll('[id^="m-"], [data-mid]')].map(n=>n.dataset.mid||n.id.slice(2)).filter(id=>canonical.has(id))};
    }),{rowFound:true,selectedIDs:['12d'.padStart(32,'0')]},'normal device row carries the identity selected by the actual canonical watcher');
    await waitRead([301],10,'11111111-11111111-11111111-11111111',1);const sentReads=await page.evaluate(()=>f.reads().filter(p=>p.body.ids.includes(f.id(301))).length);assert.equal(sentReads,1);
    await page.evaluate(async()=>{await fixture.loadThread(false);await fixture.loadThread(false);});await settle();assert.equal(await page.evaluate(()=>f.reads().filter(p=>p.body.ids.includes(f.id(301))).length),1,'sent tombstone does not trigger a duplicate plain-ID read');
    assert.deepEqual(errors,[]);assert.equal(await page.title(),'Unread contract fixture');assert.equal(page.url(),origin+'/');
    if(process.env.AGENTNET_STEERING_EVIDENCE){fs.mkdirSync(process.env.AGENTNET_STEERING_EVIDENCE,{recursive:true});await page.evaluate(()=>f.menu(fixture.state.data.messages[0],''));await page.locator('#unread-probe summary').click();await page.screenshot({path:path.join(process.env.AGENTNET_STEERING_EVIDENCE,'unread-'+skin+'-'+width+'.png')});}
    console.log(JSON.stringify({skin,width,atomic132:true,single:true,scope:true,sentFilesAgentExcerpt:true,readOnly:true,ordinaryVisitorRead:true,currentVisit:true,restored:true,bootstrap:true,validatedLink:true,notificationTopic:true,zoomSameVisit:skin==='zoom',firstFresh:true,superseded:true,failedRetry:true,pendingTopicSameGET:true,Main:true,fullGenerationDelayed:true,sentPlainDedup:true}));
    passed=true;
   }finally{if(!passed)await captureFailure().catch(error=>console.log('UNREAD_CAPTURE_ERROR '+error.name));t.diagnostic(skin+' '+width+' last stage: '+stage);await page.evaluate(()=>window.stopSkin?.()).catch(()=>{});await context.close();}
  });
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
