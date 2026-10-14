import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const directory=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..'),mode='full';
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
 const m=/^\/(classic|zoom|holonet)\/([^/]+)$/.exec(u.pathname);if(!m){res.writeHead(404).end();return;}
 try{
  const base=path.join(directory,'skins',m[1]);
  let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(base,'skin.json'),'utf8')+';':fs.readFileSync(path.join(base,'src',m[2]));
  if(m[2]==='entry.mjs'){
   const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.toString().includes(needle));
   data=data.toString().replace(needle,'globalThis.fixture={state,setDMAgent,syncComposer,renderDMBody,sendDM,send,sends,renderPending,topicSelections,topicFresh'+(m[1]==='zoom'?',dmWriteDialog,Zoom':'')+'};const ready=Promise.resolve();');
  }
  if(m[2]==='composer-followup.mjs')data=data.toString().replace('const rows=new Map();','globalThis.candidateScans=(globalThis.candidateScans||0)+1;const rows=new Map();');
  res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':m[2].endsWith('.svg')?'image/svg+xml':m[2].endsWith('.png')?'image/png':'text/javascript');res.end(data);
 }catch(e){res.writeHead(404).end(e.message);}
});
let browser,latest;
test('standalone ordinary corrections preserve exact work, files and independent choices',{skip:!process.env.AGENTNET_CHROMIUM},async()=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM||'/usr/bin/chromium'});
 for(const skin of (process.env.AGENTNET_TEST_SKINS||'classic,zoom,holonet').split(','))for(const width of (process.env.AGENTNET_TEST_WIDTHS||'1280,390').split(',').map(Number)){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  latest=page;
  page.on('pageerror',e=>errors.push(e.stack));
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin);
  await page.evaluate(async skin=>{
   const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];
   const root=document.createElement('div');root.className='skin-root';shadow.append(root);
   const fp='11111111-11111111-11111111-11111111',conv='c'.repeat(64),pid='a'.repeat(32),agentID='b'.repeat(32),me={address:'atlas/desk',fingerprint:fp,agent:false};
   const person={person:'atlas',label:'Atlas',state:'self',address:me.address,devices:[]},peer={person:'briar',label:'Briar',state:'pinned',address:'briar/phone',devices:[]};
   const a={pid,agent_id:agentID,host:{...person,fingerprint:fp},host_here:true,state:'active',can_ask:true,can_task:true,tasks_from:[],shared:[],topic:null};
   const source={id:'d'.repeat(64),lid:'4'.repeat(32),dir:'out',from:me.address,origin:'ui',verified_agent:false,kind:'task',pid,body:'Original objective',at:'2026-10-14T10:00:00Z',state:'delivered',actions:[],can:[],target:{address:me.address,fingerprint:fp,agent_id:agentID},exec:{state:'running',stale:false}};
   window.calls=[];window.posts=[];window.failNext=false;window.hold=false;window.release=null;
   window.dm={id:conv,kind:'dm',role:'member',peer,members:[],agents:[a],guests:[],topics:[],messages:[source]};window.overview={me,person,people:[peer],peers:[],dms:[],threads:[],review:[],agent_devices:[],agents:true,files:{max_file:1048576,max_count:8}};
   const saved={},host={version:1,workspace:{id:'default',handle:'9'.repeat(32)},platform:'daemon',workspaces:{state:()=>saved},listen:()=>()=>{},onOpen:()=>{},
    stage:async f=>{calls.push({path:'stage',name:f.name,bytes:await f.text()});return 'staged-'+calls.filter(c=>c.path==='stage').length;},
    api:async(p,body)=>{
     calls.push({path:p,...body===undefined?{}:{body:structuredClone(body)}});
     if(body!==undefined){posts.push({path:p,body:structuredClone(body)});if(p==='/api/request/followup'){if(hold)await new Promise(r=>release=r);if(failNext){failNext=false;throw Error('Response uncertain');}return{note:window.note||'Accepted into the current native run; completion unconfirmed.'};}if(p==='/api/dm/agent/ask'||p==='/api/dm/send'||p==='/api/send')return{id:body.id,lid:body.id,state:'queued'};if(p==='/api/upload/discard'||p==='/api/typing')return{};throw Error('Unexpected fixture post '+p);}
     if(p.startsWith('/api/dm?id='))return structuredClone(dm);
     if(p.startsWith('/api/overview'))return structuredClone(overview);
     if(p.startsWith('/api/agents'))return{host:me.address,agents:[]};
     if(p.startsWith('/api/typing'))return{enabled:false,people:[]};
     if(p==='/api/workspace')return{can_rename:false};
     throw Error('Unexpected fixture read '+p);
    }};
   window.unmount=()=>import('/'+skin+'/entry.mjs').then(m=>m.unmount(root));window.initialDM=structuredClone(dm);
   await(await import('/'+skin+'/entry.mjs')).mount(root,host);
   for(const n of root.children)n.hidden=true;
   const area=document.createElement('section');area.id='source-fixture';root.append(area);area.append(root.querySelector('#composer'),root.querySelector('#timeline'));
   Object.assign(fixture.state,{overview,dm:conv,dmData:structuredClone(dm),draftKey:'dm:'+conv,files:[],dmReply:null,answering:null,data:null,thread:null});
   if(skin==='zoom'){Object.assign(fixture.Zoom,{level:2,dm:conv,person:peer.person});root.querySelector('#dialog').hidden=false;area.append(root.querySelector('#zoom'));root.querySelector('#zoom').hidden=false;root.querySelector('#composer').style.display='none';root.querySelector('#timeline').style.display='none';Object.assign(area.style,{height:'100vh',display:'flex',flexDirection:'column'});}
   root.querySelector('#composer').addEventListener('submit',fixture.send);root.style.visibility='visible';fixture.setDMAgent(a);fixture.syncComposer();
   window.selectAgent=()=>fixture.setDMAgent(fixture.state.dmData.agents[0]);
   window.reset=(change={})=>{
    root.querySelector('#dialog').close();fixture.state.dialogRestore=null;
    fixture.sends.merge('dm:'+conv,[]).forEach(m=>fixture.sends.remove(m.id));
    fixture.state.dmAgent=null;fixture.state.mentions=[];fixture.state.mentionText='';root.querySelector('#body').value='';fixture.syncComposer();
    window.dm=structuredClone(initialDM);Object.assign(dm,change);
    Object.assign(fixture.state,{dm:conv,dmData:structuredClone(dm),draftKey:'dm:'+conv,files:[],dmReply:null,answering:null,typedFor:null});
    fixture.topicSelections[conv]='';fixture.topicFresh[conv]=false;window.calls=[];window.posts=[];window.hold=false;window.failNext=false;window.note='Accepted into the current native run; completion unconfirmed.';
    fixture.setDMAgent(fixture.state.dmData.agents[0]);fixture.syncComposer();fixture.renderPending();
    if(skin==='zoom')fixture.dmWriteDialog(fixture.state.dmData);
   };
  },skin);
  const field=skin==='zoom'?page.locator('#write-body'):page.locator('#body'),choices=page.locator(skin==='zoom'?'#write-request-target':'#request-target');
  if(skin==='zoom')await page.evaluate(()=>fixture.dmWriteDialog(fixture.state.dmData));
  if(mode==='repro'){
   await field.fill((await field.inputValue())+' Correction to original objective');
   assert.equal(await choices.getByRole('combobox',{name:/Request for /}).count(),0);
   if(skin==='zoom')await page.locator('#dialog-ok').click();else await page.locator('#composer').evaluate(f=>f.requestSubmit());
   await page.waitForFunction(()=>posts.some(p=>p.path==='/api/dm/agent/ask'));
   console.log(JSON.stringify({skin,width,missingFollowup:true,path:'/api/dm/agent/ask'}));
  }else{
   await choices.getByRole('combobox',{name:/Request for /}).waitFor();
   await field.fill((await field.inputValue())+' Correction to original objective');
   if(skin==='zoom')await page.locator('#dialog-ok').click();else await page.locator('#composer').evaluate(f=>f.requestSubmit());
   await page.waitForFunction(()=>posts.some(p=>p.path==='/api/request/followup'));
   const sent=await page.evaluate(()=>posts.find(p=>p.path==='/api/request/followup'));
   assert.equal(sent.body.ref.id,'4'.repeat(32));assert.equal(sent.body.ref.fingerprint,'11111111-11111111-11111111-11111111');
   await page.waitForFunction(()=>document.getElementById('skin').shadowRoot.querySelector('#live').textContent.includes('Accepted into the current native run'));
   assert.equal(await page.evaluate(id=>fixture.sends.merge('dm:'+dm.id,[]).find(m=>m.id===id)?.kind,sent.body.id),'task','original request kind preserved');
   console.log(JSON.stringify({skin,width,soleRoot:true,ref:sent.body.ref.id}));
   const selectors=()=>choices.getByRole('combobox',{name:/Request for /}),submit=async()=>{if(skin==='zoom')await page.locator('#dialog-ok').click();else await page.locator('#composer').evaluate(f=>f.requestSubmit());};
   const reset=async()=>{await page.evaluate(()=>window.reset());await selectors().waitFor();};
   const type=async text=>field.fill((await field.inputValue())+' '+text);
   await reset();await selectors().selectOption('new');await type('independent objective');await submit();
   await page.waitForFunction(()=>posts.some(p=>p.path==='/api/dm/agent/ask'));
   assert.equal(await page.evaluate(()=>posts.some(p=>p.path==='/api/request/followup')),false);
   await reset();
   await page.evaluate(()=>{const another={...dm.messages[0],id:'e'.repeat(64),lid:'5'.repeat(32),body:'Second active objective'};dm.messages.push(another);fixture.state.dmData=structuredClone(dm);fixture.syncComposer();});
   assert.equal(await selectors().inputValue(),'');assert.equal(await page.locator(skin==='zoom'?'#dialog-ok':'#send').isDisabled(),true);
   await type('ambiguous correction');await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>posts.length),0);
   await selectors().selectOption('e'.repeat(64));await submit();await page.waitForFunction(()=>posts.some(p=>p.path==='/api/request/followup'));
   assert.equal(await page.evaluate(()=>posts.find(p=>p.path==='/api/request/followup').body.ref.id),'5'.repeat(32));
   // Eligibility from actual admitted rows, never display-name or last-bubble guesses.
   for(const bad of ['pid','host','key','agent','topic','peer','agent-author','deleted','stale']){
    await reset();await page.evaluate(bad=>{const m=dm.messages[0];if(bad==='pid')m.pid='f'.repeat(32);if(bad==='host')m.target.address='foreign/desk';if(bad==='key')m.target.fingerprint='22222222-22222222-22222222-22222222';if(bad==='agent')m.target.agent_id='f'.repeat(32);if(bad==='topic')m.topic='f'.repeat(32);if(bad==='peer')m.dir='in';if(bad==='agent-author')m.verified_agent=true;if(bad==='deleted')m.deleted=true;if(bad==='stale')m.exec.stale=true;fixture.state.dmData=structuredClone(dm);fixture.syncComposer();},bad);
    assert.equal(await selectors().locator('option').filter({hasText:'Continue:'}).count(),0,bad+': no eligible root');assert.equal(await selectors().inputValue(),'d'.repeat(64),bad+': selected unavailable root is not silently replaced');assert.equal(await selectors().locator('option[value="new"]').count(),1);
    assert.equal(await page.evaluate(()=>posts.length),0);
   }
   // Fresh exact reads reject source/participant/ref changes after display.
   for(const bad of ['removed','deleted','stale','key','pid','agent','topic','ref','dismissed']){
    await reset();await page.evaluate(bad=>{const m=dm.messages[0];if(bad==='removed')dm.messages=[];if(bad==='deleted')m.deleted=true;if(bad==='stale')m.exec.stale=true;if(bad==='key')m.target.fingerprint='2'.repeat(8)+'-'+['2'.repeat(8),'2'.repeat(8),'2'.repeat(8)].join('-');if(bad==='pid')m.pid='f'.repeat(32);if(bad==='agent')m.target.agent_id='f'.repeat(32);if(bad==='topic')m.topic='f'.repeat(32);if(bad==='ref')m.lid='f'.repeat(32);if(bad==='dismissed')dm.agents[0].state='dismissed';},bad);
    await type('changed while drafting');await submit();
    await page.waitForFunction(()=>document.getElementById('skin').shadowRoot.querySelector('#compose-error').textContent.includes('exact request'));
    assert.equal(await page.evaluate(()=>posts.length),0,bad+': no post');assert.equal(await page.evaluate(()=>calls.some(c=>c.path==='stage')),false,bad+': no file stage');
   }
   // No complete candidate rescan per typed character; real controls stay reachable.
   await reset();const scans=await page.evaluate(()=>candidateScans);await field.pressSequentially(' thirty characters of correction');
   assert.equal(await page.evaluate(()=>candidateScans),scans);
   await page.evaluate(async()=>{await Promise.all(document.getElementById('skin').shadowRoot.querySelector('#dialog').getAnimations().map(a=>a.finished));});
   const choiceRect=await selectors().boundingBox();assert(choiceRect.height>=44,skin+' '+width+' request choice target '+JSON.stringify(choiceRect));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   // An uncertain response keeps the captured ref/ID/files while a newer target/draft lives.
   await reset();await type('captured correction');
   await page.evaluate(()=>{const old=new File(['captured bytes'],'old.txt',{type:'text/plain'});fixture.state.files=[{key:'old',name:old.name,size:old.size,type:old.type,file:old}];fixture.renderPending();window.hold=true;window.failNext=true;});
   await submit();await page.waitForFunction(()=>posts.some(p=>p.path==='/api/request/followup'));
   const first=await page.evaluate(()=>structuredClone(posts.find(p=>p.path==='/api/request/followup')));
   await page.evaluate(()=>{const newer={...dm.agents[0],pid:'6'.repeat(32),agent_id:'7'.repeat(32)};dm.agents.push(newer);fixture.state.dmData=structuredClone(dm);fixture.setDMAgent(newer);const root=document.getElementById('skin').shadowRoot;root.querySelector('#body').value+=' newer draft';const file=new File(['newer bytes'],'newer.txt');fixture.state.files=[{key:'newer',name:file.name,size:file.size,file}];fixture.renderPending();fixture.syncComposer();window.newerSnapshot={text:root.querySelector('#body').value,pid:fixture.state.dmAgent,file:fixture.state.files[0]};window.hold=false;window.release();});
   await page.waitForFunction(()=>document.getElementById('skin').shadowRoot.querySelector('#compose-error').textContent.includes('exact follow-up'));
   assert.equal(await page.evaluate(()=>{const root=document.getElementById('skin').shadowRoot;return root.querySelector('#body').value===newerSnapshot.text&&fixture.state.dmAgent===newerSnapshot.pid&&fixture.state.files[0]===newerSnapshot.file;}),true);
   const retry=page.locator(skin==='zoom'?'#zoom':'#timeline').getByRole('button',{name:'Retry',exact:true});await retry.waitFor();
   await page.evaluate(()=>window.note='Queued continuation; native intake is uncertain.');await retry.click();
   await page.waitForFunction(()=>posts.filter(p=>p.path==='/api/request/followup').length===2);
   const again=await page.evaluate(()=>posts.filter(p=>p.path==='/api/request/followup')[1]);
   assert.equal(again.body.id,first.body.id);assert.deepEqual(again.body.ref,first.body.ref);assert.equal(again.body.body,first.body.body);assert.equal(again.body.conv,first.body.conv);
   assert.deepEqual(await page.evaluate(()=>calls.filter(c=>c.path==='stage').map(c=>[c.name,c.bytes])),[['old.txt','captured bytes'],['old.txt','captured bytes']]);
   await page.waitForFunction(()=>document.getElementById('skin').shadowRoot.querySelector('#live').textContent==='Queued continuation; native intake is uncertain.');
   assert.equal(await page.evaluate(()=>{const root=document.getElementById('skin').shadowRoot;return root.querySelector('#body').value===newerSnapshot.text&&fixture.state.dmAgent===newerSnapshot.pid&&fixture.state.files[0]===newerSnapshot.file;}),true);
   if(skin!=='holonet'){
    await reset();await selectors().selectOption('d'.repeat(64));
    await page.evaluate(()=>{
     const b={...dm.agents[0],pid:'6'.repeat(32),agent_id:'7'.repeat(32)};dm.agents.push(b);
     for(const [id,lid]of[['e','5'],['f','6']])dm.messages.push({...dm.messages[0],id:id.repeat(64),lid:lid.repeat(32),pid:b.pid,kind:'question',body:'Beta '+id,target:{...dm.messages[0].target,agent_id:b.agent_id}});
     fixture.state.dmData=structuredClone(dm);const text='@Alpha @Beta mixed captured correction';fixture.state.mentions=[{start:0,name:'Alpha',ref:{kind:'agent',id:dm.agents[0].pid}},{start:7,name:'Beta',ref:{kind:'agent',id:b.pid}}];fixture.state.mentionText=text;
     const root=document.getElementById('skin').shadowRoot;root.querySelector('#body').value=text;if(root.querySelector('#write-body'))root.querySelector('#write-body').value=text;
     const file=new File(['fanout bytes'],'fanout.txt');fixture.state.files=[{key:'fanout',name:file.name,size:file.size,file}];fixture.renderPending();fixture.syncComposer();window.sharedSnapshot={text,files:fixture.state.files,mentions:fixture.state.mentions};
    });
    assert.equal(await selectors().count(),2);assert.equal(await selectors().nth(0).inputValue(),'d'.repeat(64));assert.equal(await selectors().nth(1).inputValue(),'');
    assert.equal(await page.locator(skin==='zoom'?'#dialog-ok':'#send').isDisabled(),true);
    // Even direct invocation of the shared gesture must preflight all plans.
    await page.evaluate(()=>fixture.sendDM());assert.equal(await page.evaluate(()=>posts.length),0);
    assert.equal(await page.evaluate(()=>{const root=document.getElementById('skin').shadowRoot;return root.querySelector('#body').value===sharedSnapshot.text&&fixture.state.files===sharedSnapshot.files&&fixture.state.mentions===sharedSnapshot.mentions;}),true);
    await selectors().nth(1).selectOption('new');assert.equal(await selectors().nth(0).inputValue(),'d'.repeat(64));
    await submit();await page.waitForFunction(()=>posts.filter(p=>['/api/request/followup','/api/dm/agent/ask'].includes(p.path)).length===2);
    const fanout=await page.evaluate(()=>posts.filter(p=>['/api/request/followup','/api/dm/agent/ask'].includes(p.path)));
    assert.equal(fanout.find(p=>p.path==='/api/request/followup').body.ref.id,'4'.repeat(32));assert.equal(fanout.find(p=>p.path==='/api/dm/agent/ask').body.pid,'6'.repeat(32));assert.equal(fanout.find(p=>p.path==='/api/dm/agent/ask').body.kind,'question');
    assert.deepEqual(await page.evaluate(()=>calls.filter(c=>c.path==='stage').map(c=>[c.name,c.bytes])),[['fanout.txt','fanout bytes'],['fanout.txt','fanout bytes']]);
   }
   // Ordinary human DM sends still use their existing endpoint.
   await reset();await page.evaluate(()=>{fixture.setDMAgent(null);const root=document.getElementById('skin').shadowRoot;root.querySelector('#body').value='ordinary human message';if(root.querySelector('#write-body'))root.querySelector('#write-body').value='ordinary human message';fixture.syncComposer();});
   await submit();await page.waitForFunction(()=>posts.some(p=>p.path==='/api/dm/send'));
   assert.equal(await page.evaluate(()=>posts.some(p=>p.path==='/api/request/followup'||p.path==='/api/dm/agent/ask')),false);
   if(skin==='zoom'){
    await reset();await type('cancelled correction');await selectors().selectOption('new');await page.locator('#dialog-cancel').click();await page.waitForTimeout(20);assert.equal(await page.evaluate(()=>posts.length),0);
    await reset();await type('closed correction');await field.press('Escape');await page.waitForTimeout(20);assert.equal(await page.evaluate(()=>posts.length),0);
   }
   // The actual device sender remains the ordinary send path, with its files.
   await reset();await page.evaluate(async()=>{
    const root=document.getElementById('skin').shadowRoot;root.querySelector('#dialog').close();fixture.state.dialogRestore=null;
    fixture.setDMAgent(null);const id='8'.repeat(64),source={id,dir:'in',kind:'message',from:'briar/phone',to:'atlas/desk',body:'Existing device conversation',author:{label:'Briar',about:'Fixture human'},at:'2026-10-14T10:00:00Z',actions:[],can:[],attachments:[]};
    Object.assign(fixture.state,{dm:null,dmData:null,thread:null,data:{id,peer:'briar/phone',key:{pending:false},messages:[source]},draftKey:id,deviceAgentID:'',dmReply:null,answering:null});root.querySelector('#body').value='Device unchanged';root.querySelector('#kind').value='message';
    const file=new File(['device bytes'],'device.txt');fixture.state.files=[{key:'device',name:file.name,size:file.size,file}];fixture.syncComposer();await fixture.send();
   });
   const device=await page.evaluate(()=>posts.find(p=>p.path==='/api/send'));assert(device);assert.equal(device.body.to,'briar/phone');assert.equal(device.body.body,'Device unchanged');assert.equal(device.body.kind,'message');assert.equal(device.body.reply_to,'8'.repeat(64));assert.equal(device.body.files.length,1);
   assert.equal(await page.evaluate(()=>posts.some(p=>p.path==='/api/request/followup'||p.path==='/api/dm/agent/ask')),false);
   assert.deepEqual(await page.evaluate(()=>calls.filter(c=>c.path==='stage').map(c=>[c.name,c.bytes])),[['device.txt','device bytes']]);
   console.log(JSON.stringify({skin,width,independent:true,multiple:true,identityNegatives:9,freshNegatives:9,noTypingScan:true,capturedRetry:true,nativeNotes:true,sharedFanout:skin!=='holonet',ordinaryDM:true,deviceSender:true,cancelClose:skin==='zoom'}));
  }
  assert.deepEqual(errors,[]);await page.evaluate(()=>window.unmount());await context.close();
 }
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
