// Focused source-mounted menu and visit regressions; reuses native-activity's fixture pattern.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {test} from 'node:test';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=path.resolve(import.meta.dirname,'..');

test('ordinary entry anchors tall unread or newest and releases on navigation',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
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
    const restore=m[1]==='classic'?data.toString().slice(data.toString().indexOf('    const saved = wsAPI()?.state(wsNow())[skinKey];'),data.toString().indexOf('    if (await restoreAfterReload())')):'';
    const names='state,messageMenu,beginDM,beginThread,openDM,openThread,loadDM,loadThread,markDMRead,markPersonalRead,markPersonalUnread,canMarkPersonal,attentionRows,topicSelections,topicFresh,selectReadTopic,leaveReadVisit,restoreAfterReload,showList,openLinkTarget,openMessage,readReloadKey:()=>reloadKey,isLoading:()=>loading,'+probe+(m[1]==='classic'?',restoreWorkspace:async()=>{'+restore+'}':'')+(m[1]==='zoom'?',Zoom':'');
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
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const settle=()=>page.waitForFunction(()=>!fixture.isLoading()&&!(fixture.state.readVisit?.pending.size));
   const captureFailure=async()=>console.log('ENTRY_FAILURE '+JSON.stringify(await page.evaluate(({skin,width,stage})=>{const p=fixture.readProbe(),box=p.scroller,bar=box?.querySelector('[data-unread-divider],.unread-divider');return{skin,width,stage,feedback:f.feedback,result:f.result,flags:p.flags,first:fixture.state.readVisit?.firstUnread,pinned:fixture.state.readVisit?.entryPinned,scroll:box&&{top:box.scrollTop,height:box.scrollHeight,client:box.clientHeight},bar:bar?.getBoundingClientRect().toJSON()};},{skin,width,stage})));

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
     const host={version:1,workspace:{id:'unread-contract'},workspaces:{state:()=>f.workspaceState||{}},listen(){return()=>{}},onOpen(){},api:async(p,body)=>{
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
    for(const count of [240,2400])for(const none of [false,true]){
     stage='entry '+count+' unread='+!none;
     await page.evaluate(({count,none,skin})=>{
      f.reset();fixture.leaveReadVisit();fixture.state.dm=null;f.readGate={promise:new Promise(()=>{})};f.count=count;f.first=count-40;
      const sample=f.original.messages[0];f.dm.messages=Array.from({length:count},(_,i)=>({...structuredClone(sample),id:f.id(i+1),lid:f.id(i+1),body:i+1===f.first?Array.from({length:90},(_,n)=>'Tall first unread paragraph '+n).join('\n\n'):'Message '+(i+1),unread:!none&&i+1>=f.first}));
      f.dm.topics=[];f.overview.dms=[{id:f.conv,peer:f.original.peer,kind:'dm',unread:none?0:41}];fixture.state.overview=f.overview;
      const root=document.querySelector('#skin').shadowRoot.querySelector('.skin-root');root.querySelector('#unread-probe').hidden=true;
      if(skin!=='zoom')root.querySelector('#timeline').style.cssText='height:calc(100% - 100px);overflow:auto';
      let button=document.getElementById('entry-open');if(!button){button=document.createElement('button');button.id='entry-open';button.textContent='Open entry';button.style.cssText='position:fixed;top:0;right:0;z-index:9999';document.body.append(button);}
      let tallStyle=root.querySelector('#entry-tall-style');if(!tallStyle){tallStyle=document.createElement('style');tallStyle.id='entry-tall-style';root.append(tallStyle);}tallStyle.textContent=skin==='zoom'?'#m-'+f.id(f.first)+'{min-height:1200px}':'';
      f.feedback=null;f.result=null;
      button.onclick=()=>{f.input=performance.now();f.opening=fixture.openDM(f.conv);requestAnimationFrame(function measure(){const p=fixture.readProbe(),box=p.scroller,bar=box?.querySelector('[data-unread-divider],.unread-divider');if(f.feedback===null&&root.querySelector('[data-entry-opening],[aria-label="Opening conversation"]'))f.feedback=performance.now()-f.input;if(fixture.state.dmData&&fixture.state.readVisit?.fresh===fixture.state.dmData&&box&&(none?box.scrollHeight-box.scrollTop-box.clientHeight<2:bar&&Math.abs(bar.getBoundingClientRect().top-box.getBoundingClientRect().top-p.reserveTop-box.clientTop)<2)){f.result=performance.now()-f.input;if(f.feedback===null)f.feedback=f.result;}else requestAnimationFrame(measure);});};
     },{count,none,skin});
     await page.locator('#entry-open').click();await page.waitForFunction(()=>f.feedback!==null,{},{timeout:5000});
     const feedback=await page.evaluate(()=>f.feedback);assert(feedback<1000,JSON.stringify({skin,width,count,none,feedback}));await page.waitForFunction(()=>f.result!==null,undefined,{timeout:30000});const confirmed=await page.evaluate(()=>f.result);
     const aligned=()=>page.waitForFunction(()=>{const p=fixture.readProbe(),box=p.scroller,bar=box?.querySelector('[data-unread-divider],.unread-divider');return bar&&Math.abs(bar.getBoundingClientRect().top-box.getBoundingClientRect().top-p.reserveTop-box.clientTop)<2;});
     if(process.env.AGENTNET_READ_SCROLL_EVIDENCE){fs.mkdirSync(process.env.AGENTNET_READ_SCROLL_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_READ_SCROLL_EVIDENCE,'entry-'+skin+'-'+width+'-'+count+'-'+none+'.png')});}
     let wheelFeedback;
     if(!none){
      stage="geometry "+count;await aligned();const geometry=await page.evaluate(()=>{const p=fixture.readProbe(),box=p.scroller,row=box.querySelector('[data-mid="'+f.id(f.first)+'"]');return{row:row.getBoundingClientRect().height,viewport:box.clientHeight};});assert(geometry.row>geometry.viewport,JSON.stringify(geometry));
      stage='image '+count;await page.evaluate(()=>{const box=fixture.readProbe().scroller,bar=box.querySelector('[data-unread-divider],.unread-divider'),img=document.createElement('img');img.id='entry-image';box.querySelector('[data-mid="'+f.id(f.first-1)+'"]').append(img);img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="220"/>');});
      await page.evaluate(()=>fixture.readProbe().scroller.querySelector('#entry-image').decode());await aligned();
      stage='history '+count;await page.evaluate(async()=>{f.dm.messages.unshift({...f.dm.messages[0],id:'older-history',body:'Older history',unread:false});await fixture.loadDM(false);});await aligned();
      stage='wheel '+count;const point=await page.evaluate(()=>{const b=fixture.readProbe().scroller.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2};});await page.mouse.move(point.x,point.y);
      await page.evaluate(()=>{const box=fixture.readProbe().scroller;box.addEventListener('wheel',()=>{const input=performance.now();f.wheelFeedback=null;requestAnimationFrame(function measure(){const p=fixture.readProbe(),bar=box.querySelector('[data-unread-divider],.unread-divider');if(bar.getBoundingClientRect().top<box.getBoundingClientRect().top+p.reserveTop-100)f.wheelFeedback=performance.now()-input;else requestAnimationFrame(measure);});},{once:true});});await page.mouse.wheel(0,400);
      await page.waitForFunction(()=>{const p=fixture.readProbe(),bar=p.scroller.querySelector('[data-unread-divider],.unread-divider');return bar.getBoundingClientRect().top<p.scroller.getBoundingClientRect().top+p.reserveTop-100;});
      await page.waitForFunction(()=>f.wheelFeedback!==null);wheelFeedback=await page.evaluate(()=>f.wheelFeedback);assert(wheelFeedback<1000);
      stage='release '+count;await page.evaluate(()=>fixture.readProbe().scroller.style.paddingTop='80px');
      await page.waitForFunction(()=>{const p=fixture.readProbe(),bar=p.scroller.querySelector('[data-unread-divider],.unread-divider');return bar.getBoundingClientRect().top<p.scroller.getBoundingClientRect().top+p.reserveTop-100;});
     }
     console.log(JSON.stringify({skin,width,count,none,feedbackMs:feedback,confirmedMs:confirmed,wheelFeedbackMs:wheelFeedback,checks:none?['newest']:['tall-unread','image','older-history','user-scroll']}));
     if(process.env.AGENTNET_READ_SCROLL_EVIDENCE){fs.mkdirSync(process.env.AGENTNET_READ_SCROLL_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_READ_SCROLL_EVIDENCE,skin+'-'+width+'-'+count+'-'+none+'.png')});}
    }
    if(skin==='classic'){
     stage='saved workspace restores unread entry, not old pixels';
     await page.evaluate(async()=>{f.reset();fixture.leaveReadVisit();fixture.state.dm=null;f.dm.messages=f.original.messages.slice(0,30).map((m,i)=>({...m,unread:i>=10}));f.workspaceState={classic:{dm:f.conv,scroll:42}};await fixture.restoreWorkspace();});
     await page.waitForFunction(()=>{const p=fixture.readProbe(),bar=p.scroller.querySelector('[data-unread-divider]');return bar&&Math.abs(bar.getBoundingClientRect().top-p.scroller.getBoundingClientRect().top-p.scroller.clientTop)<2;});
     console.log(JSON.stringify({skin,width,savedWorkspaceEntry:true}));
    }
    assert.deepEqual(errors,[]);passed=true;
   }finally{if(!passed)await captureFailure().catch(error=>console.log('UNREAD_CAPTURE_ERROR '+error.name));t.diagnostic(skin+' '+width+' last stage: '+stage);await page.evaluate(()=>window.stopSkin?.()).catch(()=>{});await context.close();}
  });
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
