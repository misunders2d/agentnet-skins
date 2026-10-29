import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),skins=['classic','holonet','zoom'];
const fp='11111111-11111111-11111111-11111111',other='22222222-22222222-22222222-22222222';
test('configured labels, immutable direct chat tuples, exact topic list scope and selected recovery',async()=>{
 for(const skin of skins){
  const m=await import('../skins/'+skin+'/src/composer-followup.mjs');
  const a={id:'a'.repeat(32),host:'briar/desk',host_key:other,label:'Build',harness:'claude'},b={...a,id:'b'.repeat(32),harness:'pi'};
  assert.equal(m.concreteAgentLabel(a,[a,b]),'Build · Claude');assert.equal(m.concreteAgentLabel(b,[a,b]),'Build · Pi');assert.match(m.concreteAgentLabel({...a,harness:''}),/program unavailable/);
  const summary={peer:a.host,agent_host:a.host,agent_key:other,agent_id:a.id},legacy={...summary,agent_id:'',agent_legacy:true},human={...summary,agent_id:''};
  assert.notEqual(m.directChatKey(summary),m.directChatKey({...summary,agent_id:b.id}));assert.notEqual(m.directChatKey(legacy),m.directChatKey(human));
  const view={id:'c'.repeat(32),peer:'atlas/phone',key:{pinned:fp},agent_host_key:{pinned:other},topic:{...summary,id:'c'.repeat(32)},messages:[{id:'d'.repeat(32),dir:'out',kind:'task',from:'atlas/desk',from_key:fp,to:a.host,target:{address:a.host,fingerprint:other,agent_id:a.id},exec:{state:'running',host:a.host,attempt:2}}]};
  assert.equal(m.directBinding(view).host,a.host);assert.equal(m.directAgentKey(view).pinned,other);
  assert.equal(m.currentDirectComposerFollowup(view,a.id,{}).target.address,a.host);
  assert.throws(()=>m.currentDirectComposerFollowup({...view,agent_host_key:undefined},a.id,{}),m.ComposerRecovery);
  const foreign=structuredClone(view.messages[0]);foreign.target.agent_id=b.id;foreign.exec.stale=true;assert.equal(m.currentDirectComposerFollowup({...view,messages:[foreign,...view.messages]},a.id,{}).attempt,2);
  assert.deepEqual(Object.fromEntries(m.directTopicQuery(view,{limit:'50'})),{peer:'atlas/phone',agent_host:a.host,agent_key:other,agent_id:a.id,limit:'50'});
  assert.equal(m.directTopicQuery({peer:a.host,topic:legacy}).get('agent_id'),'');assert.equal(m.directTopicQuery({peer:a.host,topic:human}).has('agent_host'),false);
 }
});

test('standalone rendered concrete choices, same-target recovery and exact cached landing',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="skin"></div>');return;}
  const match=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);if(!match){res.writeHead(404).end();return;}
  try{const [_,skin,file]=match;let data=file==='manifest.mjs'?'export default '+fs.readFileSync(path.join(root,'skins',skin,'skin.json'),'utf8'):fs.readFileSync(file==='entry.mjs'&&process.env.AGENTNET_V091_ENTRY_BASE?path.join(process.env.AGENTNET_V091_ENTRY_BASE,skin,file):path.join(root,'skins',skin,'src',file));
   if(file==='entry.mjs'){data=data.toString();const needle=skin==='zoom'?'\nstart();':'const ready = start();';assert(data.includes(needle));data=data.replace(needle,'globalThis.fixture={state,contactsOf,newConversationDialog,send,openMessage,loadDM,loadThread,beginDM,topicSelections,topicFresh,syncComposer,keepDraft,selectSection'+(skin==='zoom'?',Zoom':',personRow')+'};'+(skin==='zoom'?'':'const ready=Promise.resolve();'));}
   res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(String(e));}
 });let browser;
 try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of skins)for(const width of [1280,390])await t.test(skin+' '+width,async t=>{
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.stack));
   try{await page.goto(origin);await page.evaluate(async({skin,fp,other})=>{
    const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];const app=document.createElement('div');app.className='skin-root';shadow.append(app);window.app=app;
    const person={person:'atlas',label:'Atlas',state:'self',address:'atlas/desk',devices:[]},peer={person:'briar',label:'Briar',address:'briar/desk',devices:[]};
    const a={id:'a'.repeat(32),host:peer.address,host_key:other,label:'Build',harness:'claude'},b={...a,id:'b'.repeat(32),harness:'pi'};
    const row=(id,body,topic='')=>({id,dir:'in',kind:'message',body,topic,from:peer.address,from_key:other,to:person.address,at:'2026-10-20T09:00:00Z',author:{label:'Briar'},actions:[],can:[],attachments:[]});
    const conv='c'.repeat(64),topic='e'.repeat(32),wanted='f'.repeat(32),request='d'.repeat(32),binding={agent_host:a.host,agent_key:other,agent_id:a.id};
    window.f={a,b,conv,topic,wanted,request,calls:[],catalog:[a,b],mode:'completed',gate:false,releases:[],dm:{id:conv,kind:'dm',peer,members:[],agents:[],guests:[],topics:[{id:topic,title:'Invoice review',state:'active'}],messages:[row(wanted,'Exact notified original',topic),row('9'.repeat(32),'Main original')],created:'2026-10-20T09:00:00Z'},thread:{id:request,peer:a.host,key:{pinned:other},topic:{id:request,title:'Bound task',state:'active',...binding},messages:[{...row(request,'Original task'),dir:'out',kind:'task',from:person.address,from_key:fp,to:a.host,target:{address:a.host,fingerprint:other,agent_id:a.id},exec:{state:'running',host:a.host,attempt:4,stale:true}}]}};
    f.overview={version:'fixture',me:{address:person.address,fingerprint:fp,agent:false},person,people:[peer],threads:[],dms:[],review:[],quarantine:[],needs_you:[],held:[],links:[],reminders:[],peers:[],agent_devices:[peer.address],files:{max_file:1048576,max_count:8}};
    const host={version:1,workspace:{id:'v091-fixture'},onOpen(){},listen(){return()=>{}},api:async(path,body)=>{
     f.calls.push({path,...body===undefined?{}:{body:structuredClone(body)}});
     if(body!==undefined){if(path==='/api/send')return{id:body.id||f.request,state:'stored'};if(path==='/api/request/followup')return{note:'Exact steering saved'};if(path==='/api/act'||path==='/api/refresh')return{note:'Read'};throw Error('Unexpected write '+path);}
     if(path.startsWith('/api/agents'))return{host:peer.address,agents:f.catalog.map(record=>({record,enabled:true}))};
     if(path.startsWith('/api/thread?id=')){const fresh=structuredClone(f.thread);fresh.messages[0].exec={state:f.mode,host:a.host,attempt:4,stale:f.mode==='uncertain'};if(f.mode==='uncertain')fresh.messages[0].exec.state='running';return fresh;}
     if(path.startsWith('/api/dm?id=')){if(f.gate)await new Promise(resolve=>f.releases.push(resolve));return structuredClone(f.dm);}
     if(path==='/api/overview'){if(f.gate)await new Promise(resolve=>f.releases.push(resolve));return structuredClone(f.overview);}
     if(path.startsWith('/api/topics'))return{topics:[f.thread.topic]};if(path.startsWith('/api/typing'))return{enabled:false,supported:false,people:[]};if(path==='/api/teams')return{teams:[]};throw Error('Unexpected read '+path);
    }};
    await(await import('/'+skin+'/entry.mjs')).mount(app,host);window.stop=()=>import('/'+skin+'/entry.mjs').then(m=>m.unmount(app));
    fixture.state.overview=f.overview;fixture.state.dmNames={[a.host]:f.catalog};app.style.visibility='visible';
    // Keep production layout and source functions; only startup/network data are fixtures.
    if(!fixture.Zoom){for(let n=app.querySelector('#timeline');n&&n!==app;n=n.parentElement)n.hidden=false;}
    app.querySelector('#dialog').hidden=false;app.querySelector('#review').hidden=true;app.classList.add('show-conv');
    f.draft=()=>{const file=new File(['retained bytes'],'keep.txt',{type:'text/plain'});return[{file,name:file.name,size:file.size,staged:'opaque-staged'}];};
    f.prepareSend=()=>{Object.assign(fixture.state,{data:structuredClone(f.thread),thread:request,dm:null,dmData:null,draftKey:request,drafts:{},files:[],targetCatalog:{host:a.host,agents:f.catalog},deviceAgentID:a.id,replyReceiver:null,answering:null});app.querySelector('#body').value='Keep my exact correction';for(const r of app.querySelectorAll('input[name="kind"]'))r.checked=r.value==='question';f.calls=[];};
    f.prepareLanding=()=>{fixture.beginDM(conv);fixture.state.dmData=structuredClone(f.dm);fixture.state.draftKey='dm:'+conv;fixture.state.files=f.draft();app.querySelector('#body').value='Unsent notification draft';fixture.topicSelections[conv]='';fixture.topicFresh[conv]=false;f.files=fixture.state.files;f.file=f.files[0].file;f.calls=[];};
   },{skin,fp,other});
   if(process.env.AGENTNET_NOTIFICATION_COMPARE){
    const result=await page.evaluate(async()=>{f.prepareLanding();f.overview.dms=[{id:f.conv,peer:f.dm.peer}];f.gate=true;const started=performance.now(),opening=fixture.openMessage({id:f.wanted,conv:f.conv,dir:'in'});await new Promise(r=>setTimeout(r,150));const beforeRelease=fixture.topicSelections[f.conv]===f.topic&&!fixture.state.messageOpening;f.gate=false;f.releases.splice(0).forEach(r=>r());await opening;return{beforeRelease,elapsedMs:Math.round(performance.now()-started),topic:fixture.topicSelections[f.conv]};});
    assert.equal(result.topic,'e'.repeat(32));if(!process.env.AGENTNET_V091_ENTRY_BASE)assert(result.beforeRelease);console.log('NOTIFICATION_COMPARE '+JSON.stringify({skin,width,...result}));return;
   }
   await t.test('person card opens Main while the latest message is still syncing',async()=>{
    await page.evaluate(()=>{
     const summary={id:f.conv,kind:'dm',peer:f.dm.peer,count:2,unread:0,held:0,last_id:'7'.repeat(32),last:'Not synced yet',last_at:'2026-10-20',created:f.dm.created};
     f.overview.persons=true;f.overview.dms=[summary];
     const card=document.createElement('div');card.id='person-navigation-fixture';
     card.append(fixture.Zoom?fixture.Zoom.people():fixture.personRow(f.dm.peer,[summary]));app.append(card);
    });
    await page.locator('#person-navigation-fixture button').filter({hasText:'Briar'}).first().click();
    await page.waitForFunction(()=>fixture.state.dmData?.id===f.conv);
    assert.equal(await page.locator('[data-notification-landing]').count(),0,'ordinary person navigation does not wait for an exact message');
    await page.locator(skin==='zoom'?'#zoom .mini-chat':'#timeline').getByText('Main original',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>fixture.topicSelections[f.conv]||''),'');
    assert.equal(await page.evaluate(()=>!!fixture.state.messageOpening),false);
    await page.evaluate(()=>fixture.selectSection('chats'));
    await page.locator('#person-navigation-fixture button').filter({hasText:'Briar'}).first().click();
    await page.locator(skin==='zoom'?'#zoom .mini-chat':'#timeline').getByText('Main original',{exact:true}).waitFor();
   });
   await page.evaluate(()=>{app.querySelector('#person-navigation-fixture').remove();f.overview.dms=[];});
   const groups=await page.evaluate(()=>fixture.contactsOf([{peer:f.a.host,agent_host:f.a.host,agent_key:f.a.host_key,agent_id:f.a.id,last_at:'2026-10-20',count:1},{peer:f.a.host,agent_host:f.a.host,agent_key:f.a.host_key,agent_id:f.b.id,last_at:'2026-10-20',count:1},{peer:f.a.host,agent_host:f.a.host,agent_key:f.a.host_key,agent_legacy:true,last_at:'2026-10-20',count:1},{peer:f.a.host,agent_host:f.a.host,agent_key:f.a.host_key,last_at:'2026-10-20',count:1}]).length);assert.equal(groups,4);
   await page.evaluate(()=>fixture.newConversationDialog({host:f.a.host,id:f.a.id}));await page.waitForFunction(()=>document.querySelector('#skin').shadowRoot.querySelector('#new-agent').options.length===3);
   const bounds=await page.locator('#dialog').evaluate(n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,width:innerWidth};});assert(bounds.left>=0&&bounds.right<=bounds.width+1,'configured-agent dialog fits the viewport');
   const labels=await page.locator('#new-agent option').allTextContents();assert.deepEqual(labels,['Choose a configured agent','Build · Claude · Desk','Build · Pi · Desk']);assert(!labels.some(x=>/default|Your agent/.test(x)));
   // AgentNet v0.10.0 (MEL-713): an old device conversation takes no new turn,
   // neither a new one from this dialog nor a message or correction in one.
   await page.locator('#new-body').fill('Concrete new request');await page.evaluate(()=>{f.calls=[];});await page.locator('#dialog-ok').click();await page.locator('#dialog-error').getByText(/read only/).waitFor();assert(!await page.evaluate(()=>f.calls.some(c=>c.body!==undefined)),'the new conversation dialog sends nothing');
   await page.evaluate(()=>app.querySelector('#dialog').close());
   for(const mode of ['completed','running','uncertain','normal']){
    const result=await page.evaluate(async mode=>{f.mode=mode;f.prepareSend();fixture.state.files=f.draft();const kept=fixture.state.files;await fixture.send();return{calls:f.calls,text:app.querySelector('#body').value,error:app.querySelector('#compose-error').textContent,fileSame:fixture.state.files===kept&&fixture.state.files[0].staged==='opaque-staged'};},mode);
    assert.deepEqual(result.calls,[],mode+': a read-only device conversation reads and writes nothing');assert.equal(result.text,'Keep my exact correction');assert.match(result.error,/read only/);assert(result.fileSame,mode+' keeps the exact File and its staging');
   }
   const cached=await page.evaluate(async()=>{f.prepareLanding();f.gate=true;await fixture.openMessage({id:f.wanted,conv:f.conv,dir:'in'});return{topic:fixture.topicSelections[f.conv],draft:app.querySelector('#body').value,same:fixture.state.files===f.files&&fixture.state.files[0].file===f.file&&fixture.state.files[0].staged==='opaque-staged',reads:f.calls.filter(c=>!c.body).map(c=>c.path),pending:!!fixture.state.messageOpening};});
   assert.equal(cached.topic,'e'.repeat(32));assert.equal(cached.draft,'Unsent notification draft');assert(cached.same);assert(!cached.reads.some(x=>/overview|\/api\/dm\?/.test(x)));assert(!cached.pending);
   // Missing exact target never substitutes the current topic or acknowledges unseen rows.
   await page.evaluate(async()=>{f.gate=false;f.prepareLanding();fixture.topicSelections[f.conv]=f.topic;await fixture.openMessage({id:'7'.repeat(32),conv:f.conv,dir:'in'});});
   assert(await page.getByRole('button',{name:'Retry message',exact:true}).isVisible());const missing=await page.evaluate(()=>({topic:fixture.topicSelections[f.conv],pending:fixture.state.messageOpening.waiting,acks:f.calls.filter(c=>c.path==='/api/act')}));assert.equal(missing.topic,'e'.repeat(32));assert(missing.pending);assert.deepEqual(missing.acks,[]);
   await page.evaluate(()=>{f.dm.messages.push({...f.dm.messages[0],id:'7'.repeat(32),body:'Arrived exact original'});});await page.getByRole('button',{name:'Retry message',exact:true}).click();await page.waitForFunction(()=>!fixture.state.messageOpening);assert.equal(await page.getByRole('button',{name:'Retry message',exact:true}).count(),0);
   const wrong=await page.evaluate(async()=>{const original=f.dm.id;f.dm.id='8'.repeat(64);fixture.state.dmData=null;await fixture.openMessage({id:f.wanted,conv:f.conv,dir:'in'});const result={view:fixture.state.dmData,pending:fixture.state.messageOpening?.conv};f.dm.id=original;return result;});assert.equal(wrong.view,null);assert.equal(wrong.pending,'c'.repeat(64));
   const legacy=await page.evaluate(async()=>{f.calls=[];await fixture.openMessage({id:'6'.repeat(32),dir:'in'});return{pending:fixture.state.messageOpening?.waiting,conv:fixture.state.dm,acks:f.calls.filter(c=>c.path==='/api/act')};});assert(legacy.pending);assert.equal(legacy.conv,'c'.repeat(64));assert.deepEqual(legacy.acks,[]);assert(await page.getByRole('button',{name:'Retry message',exact:true}).isVisible());
   assert.deepEqual(errors,[]);console.log(JSON.stringify({skin,width,groups,concreteChoices:true,terminalNewOne:true,currentFollowupOne:true,uncertainZero:true,cachedNoOverviewOrDMRead:true,draftAndFile:true,missingExactRetry:true}));
   }finally{await page.close();await context.close();}
  });
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});

test('all standalone skins vendor the shared schedule editor and focused DOM behavior',()=>{
 for(const file of ['schedule.mjs','schedule-model.mjs','schedule-saves.mjs'])for(const skin of ['holonet','zoom'])assert.equal(fs.readFileSync(path.join(root,'skins',skin,'src',file),'utf8'),fs.readFileSync(path.join(root,'skins/classic/src',file),'utf8'));
 for(const skin of skins)assert.match(fs.readFileSync(path.join(root,'skins',skin,'src/entry.mjs'),'utf8'),/topicText:id=>.*?title\|\|'Named topic'/);
 const output=execFileSync(process.execPath,[path.join(root,'tests/v091-schedule-dom.mjs')],{encoding:'utf8'});assert.match(output,/PASS shared schedule DOM: \d+ groups/);console.log(output.trim());
});
