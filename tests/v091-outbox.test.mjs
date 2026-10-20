import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url);

// Exercise the actual adapter and exact discriminator without a browser. A
// ReminderView has no proven direction, including reminders on our own sends.
test('reminders resolve either stored direction through the actual entry adapter',async()=>{
 for(const skin of ['classic','holonet','zoom']){
  const source=fs.readFileSync(path.join(root,'skins',skin,'src/entry.mjs'),'utf8');
  const adapter=source.match(/async function openReminder\(r\) \{[\s\S]*?\n\}/)[0];
  const discriminator=source.match(/function messageTarget\(messages, ref\) \{[\s\S]*?\n\}/)[0];
  const open=new Function('openMessage',adapter+';return openReminder;')(ref=>ref),target=new Function(discriminator+';return messageTarget;')();
  for(const dir of ['out','in']){
   const original={id:dir==='out'?'a'.repeat(32):'b'.repeat(32),dir,topic:dir==='out'?'':'c'.repeat(32)},reminder={message:original.id,conv:'d'.repeat(64)};
   const ref=await open(reminder);assert.equal(ref.id,original.id);assert.equal(ref.conv,reminder.conv);assert.equal(target([original],ref),original,skin+' reminder opens exact '+dir+' original');
  }
 }
});

for(const skin of ['classic','holonet','zoom'])test(skin+' Outbox gets its own navigation slot',()=>{
 const source=fs.readFileSync(path.join(root,'skins',skin,'src/entry.mjs'),'utf8'),declaration=source.match(/function setupOutboxNav\(\) \{[\s\S]*?\n\}/)[0];
 const nodes=new Map();let placed,badges=0;
 const wrap={before(button){placed={before:this,button};nodes.set('nav-outbox',button);}},review={closest(selector){assert.equal(selector,'.review-wrap');return wrap;},before(button){placed={before:this,button};nodes.set('nav-outbox',button);}};
 nodes.set('review-btn',review);const setup=new Function('$','el','updateOutboxBadge',declaration+';return setupOutboxNav;')(id=>nodes.get(id),(tag,props,...children)=>({tag,props,children}),()=>badges++);
 setup();assert.equal(placed.before,wrap,'Outbox belongs beside the Activity wrapper, never inside its navigation slot');assert.equal(placed.button.props.id,'nav-outbox');assert.equal(badges,1);setup();assert.equal(badges,1,'mount setup remains idempotent');
});

test('standalone global Outbox keeps compact schedules, exact drafts and personal reminders',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const match=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);if(!match){res.writeHead(404).end();return;}
  try{const [,skin,file]=match;let data=file==='manifest.mjs'?'export default '+fs.readFileSync(path.join(root,'skins',skin,'skin.json'),'utf8'):fs.readFileSync(path.join(root,'skins',skin,'src',file));
   if(file==='entry.mjs'){data=data.toString();const needle=skin==='zoom'?'\nstart();':'const ready = start();';assert(data.includes(needle));data=data.replace(needle,'globalThis.fixture={'+(skin==='classic'?'showList,':'')+'state,setupOutboxNav,outboxDrafts,resumeOutboxDraft,keepDraft,openDM,openThread,openReminder,loadOverview,topicSelections,topicFresh,syncComposer,renderPending,push:()=>{for(const fn of '+(skin==='holonet'?'schedulePush':'contentSubscribers')+')fn();},setup:()=>{'+(skin==='holonet'?'if(!scheduleUI)setupSchedule();':'state.scheduleReady=true;syncScheduleControls();')+'setupOutboxNav();},schedule:()=>scheduleUI};'+(skin==='zoom'?'':'const ready=Promise.resolve();'));}
   res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(String(e));}
 });let browser;
 try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM,args:['--disable-gpu']});
  for(const skin of process.env.AGENTNET_OUTBOX_SKIN?[process.env.AGENTNET_OUTBOX_SKIN]:['classic','holonet','zoom'])for(const width of process.env.AGENTNET_OUTBOX_WIDTH?[Number(process.env.AGENTNET_OUTBOX_WIDTH)]:[1280,390])await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.stack));
   try{await page.goto(origin);await page.evaluate(async skin=>{
    const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),sheet=new CSSStyleSheet();sheet.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[sheet];const app=document.createElement('div');app.className='skin-root';shadow.append(app);window.app=app;
    const fp='11111111-11111111-11111111-11111111',key='22222222-22222222-22222222-22222222',person={person:'atlas',label:'Atlas',state:'self',address:'atlas/desk',devices:[]},peer={person:'briar',label:'Briar',address:'briar/desk',devices:[]};
    const conv='c'.repeat(64),second='d'.repeat(64),topic='e'.repeat(32),threadID='f'.repeat(32),agentID='a'.repeat(32),a={id:agentID,host:peer.address,host_key:key,label:'Build',harness:'pi'};
    const message=(id,body,t='')=>({id,dir:'in',kind:'message',body,topic:t,from:peer.address,from_key:key,to:person.address,at:'2026-10-20T09:00:00Z',actions:[],can:[],attachments:[],author:{label:'Briar'}});
    const dm={id:conv,kind:'dm',peer,members:[],agents:[],guests:[],topics:[{id:topic,title:'Invoice review',state:'active'}],messages:[message('1'.repeat(32),'Reminder exact original',topic)],created:'2026-10-20T09:00:00Z'};
    dm.messages.push({...message((19).toString(16).padStart(32,'0'),'Own sent reminder original'),dir:'out',from:person.address,from_key:fp,to:peer.address,author:{label:person.label}},{...message((20).toString(16).padStart(32,'0'),'Incoming reminder original',topic)});
    const thread={id:threadID,peer:peer.address,key:{pinned:key},topic:{id:threadID,title:'Pi exact thread',state:'active',agent_host:peer.address,agent_key:key,agent_id:agentID},messages:[{...message(threadID,'Original Pi task'),dir:'out',kind:'task',target:{address:peer.address,fingerprint:key,agent_id:agentID},from:person.address,from_key:fp,to:peer.address}]};
    const reminders=Array.from({length:20},(_,n)=>({message:(n+1).toString(16).padStart(32,'0'),conv,from:n===18?person.address:peer.address,title:'Personal reminder '+n,due:new Date(Date.now()+(n<3?-3600000:3600000)+n*1000).toISOString(),overdue:n<3}));
    window.f={conv,second,topic,threadID,agentID,dm,thread,agent:a,calls:[],subscribers:[],records:Array.from({length:220},(_,n)=>({id:(n+100).toString(16).padStart(32,'0'),conv:n%2?second:conv,topic:'',body:(n<20?'Pending message ':'History message ')+n,due:new Date(Date.now()+3600000+n*1000).toISOString(),timezone:'UTC',rev:1,state:n<20?'pending':'sent',audience:{persons:['briar'],pids:[]},files:[{name:'original.txt',size:3}]}))};
    f.overview={version:'fixture',me:{address:person.address,fingerprint:fp,agent:false},person,people:[peer],threads:[{id:threadID,peer:peer.address,title:'Pi exact thread',count:1,agent_host:peer.address,agent_key:key,agent_id:agentID}],dms:[{id:conv,peer,title:'Briar DM'},{id:second,peer:{...peer,label:'Other person'},title:'Other DM'}],review:[],quarantine:[],needs_you:[],held:[],links:[],reminders,remind:true,schedules:true,peers:[],agent_devices:[peer.address],files:{max_file:1048576,max_count:8}};
    const host={version:1,workspace:{id:'outbox-'+skin,handle:'fixed'},onOpen(){},listen(fn){f.subscribers.push(fn);return()=>{f.subscribers=f.subscribers.filter(x=>x!==fn);};},stage:async file=>{f.staged=file;return'opaque';},api:async(path,body)=>{
     f.calls.push({path,...body===undefined?{}:{body:structuredClone(body)}});const u=new URL(path,'http://fixture');
     if(body!==undefined){
      if(path==='/api/schedule/edit'){const r=f.records.find(x=>x.id===body.id);if(r.rev!==body.rev)throw Error('revision changed');Object.assign(r,body,{rev:r.rev+1});return structuredClone(r);}
      if(path==='/api/schedule/create'){const r={...body,rev:1,state:'pending'};f.records.push(r);return structuredClone(r);}
      if(path==='/api/remind/done'||path==='/api/remind/cancel'){f.overview.reminders=f.overview.reminders.filter(x=>x.message!==body.id);return{note:'Reminder updated'};}
      if(path==='/api/act'||path==='/api/refresh')return{};throw Error('Unexpected write '+path);
     }
     if(u.pathname==='/api/schedules')return structuredClone(u.searchParams.has('id')?f.records.find(x=>x.id===u.searchParams.get('id')):f.records.filter(r=>u.searchParams.get('all')==='1'||!['sent','cancelled'].includes(r.state)));
     if(u.pathname==='/api/schedule/audience')return{persons:['briar'],pids:[]};
     if(u.pathname==='/api/dm')return structuredClone(f.dm);
     if(u.pathname==='/api/thread')return structuredClone(f.thread);
     if(u.pathname==='/api/overview')return structuredClone(f.overview);
     if(u.pathname==='/api/agents')return{host:peer.address,agents:[{record:a,enabled:true}]};
     if(u.pathname==='/api/topics')return{topics:[thread.topic]};if(u.pathname==='/api/typing')return{enabled:false,supported:false,people:[]};if(path==='/api/teams')return{teams:[]};throw Error('Unexpected read '+path);
    }};
    const module=await import('/'+skin+'/entry.mjs');await module.mount(app,host);window.stopOutbox=()=>module.unmount(app);fixture.state.overview=structuredClone(f.overview);fixture.state.dmNames={[peer.address]:[a]};app.style.visibility='visible';fixture.setup();
    // Create two drafts through the actual keepDraft path, retaining File identity.
    await fixture.openThread(threadID,undefined,structuredClone(thread),true,true);app.querySelector('#body').value='Exact Pi draft';fixture.state.files=[{key:'thread-file',name:'pi.txt',size:2,file:new File(['pi'],'pi.txt')}];fixture.keepDraft();f.threadDraft=fixture.state.drafts[threadID];f.threadFile=f.threadDraft.files[0].file;
    await fixture.openDM(conv,structuredClone(dm),true,true);fixture.topicSelections[conv]=topic;fixture.topicFresh[conv]=false;app.querySelector('#body').value='Exact named-topic draft';fixture.state.files=[{key:'dm-file',name:'kept.txt',size:4,file:new File(['keep'],'kept.txt')}];fixture.keepDraft();f.dmDraft=fixture.state.drafts['dm:'+conv];f.dmFile=f.dmDraft.files[0].file;fixture.state.drafts['meta']={text:'',files:[],agent_id:agentID};fixture.setup();await fixture.loadOverview();f.calls=[];
   },skin);
   const open=async()=>{if(skin==='classic'&&width===390)await page.evaluate(()=>fixture.showList());await page.locator('#nav-outbox').click();await page.getByRole('dialog',{name:'Outbox',exact:true}).waitFor();};
   await open();const dialog=page.getByRole('dialog',{name:'Outbox',exact:true});
   if(width===390){
    const nav=await page.locator('#nav-outbox').evaluate(outbox=>{
     const root=outbox.closest('.command-nav,.nav-rail'),activity=root.querySelector('#review-btn'),wrap=activity.closest('.review-wrap');
     return{siblings:outbox.parentElement===root&&wrap.parentElement===root&&outbox.nextElementSibling===wrap,targets:[...root.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{id:b.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}).filter(r=>r.width&&r.height)};
    });assert(nav.siblings,skin+' Outbox and Activity must have separate navigation slots');assert.equal(nav.targets.length,6);
    // Match the existing keyboard geometry check's one-pixel border rounding.
    for(const r of nav.targets)assert(r.width>=44&&r.height>=44&&r.x>=-1&&r.right<=width+1&&r.y>=-1&&r.bottom<=844+1,skin+' visible44px navigation target '+JSON.stringify(r));
    for(let i=0;i<nav.targets.length;i++)for(let j=i+1;j<nav.targets.length;j++){const a=nav.targets[i],b=nav.targets[j];assert(Math.min(a.right,b.right)-Math.max(a.x,b.x)<=.5||Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<=.5,skin+' navigation targets overlap');}
   }
   const geometry=await dialog.evaluate(d=>{const r=d.getBoundingClientRect();return{x:r.x,right:r.right,height:r.height,scrollWidth:d.scrollWidth,width:d.clientWidth};});assert(geometry.x>=0&&geometry.right<=width+1&&geometry.height<=844&&geometry.scrollWidth<=geometry.width+1,JSON.stringify(geometry));
   assert.equal(await dialog.locator('[data-schedule-id]').count(),20);if(process.env.AGENTNET_OUTBOX_SHOTS){fs.mkdirSync(process.env.AGENTNET_OUTBOX_SHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_OUTBOX_SHOTS,skin+'-'+width+'.png')});}assert.equal(await dialog.getByRole('button',{name:'Edit schedule',exact:true}).count(),0);assert.equal(await dialog.getByText('History message 20',{exact:true}).count(),0);assert.equal(await page.locator('#outbox-due').textContent(),'3');
   const first=dialog.locator('[data-schedule-id]').first();const rh=await first.boundingBox();assert(rh.height<150,'compact schedule row '+rh.height);await page.evaluate(()=>fixture.push());await page.waitForFunction(()=>f.calls.filter(c=>c.path.startsWith('/api/schedules?')).length>=2);assert(!await page.evaluate(()=>f.calls.some(c=>c.path==='/api/schedules?all=1')));
   await dialog.getByRole('button',{name:'Show history',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#skin').shadowRoot.querySelectorAll('[data-schedule-id]').length===220);await dialog.getByRole('button',{name:'Hide history',exact:true}).click();assert.equal(await dialog.locator('[data-schedule-id]').count(),20);
   await first.click();await dialog.getByRole('button',{name:'Edit schedule',exact:true}).click();const field=dialog.getByRole('textbox',{name:'Scheduled message text',exact:true});await field.fill('Editing while pushed');await field.evaluate(e=>window.originalEdit=e);await page.evaluate(()=>{f.records[0].rev=2;fixture.push();});assert(await field.evaluate(e=>e===window.originalEdit));assert.equal(await field.inputValue(),'Editing while pushed');await dialog.getByRole('button',{name:'Save schedule changes',exact:true}).click();await dialog.getByRole('status').filter({hasText:'revision changed'}).waitFor();assert.equal(await page.evaluate(()=>f.calls.find(c=>c.path==='/api/schedule/edit').body.rev),1);
   await dialog.getByRole('button',{name:'Drafts',exact:true}).click();assert.equal(await dialog.getByRole('button',{name:/^Resume draft:/}).count(),2);await page.evaluate(()=>{f.thread.topic.agent_id='b'.repeat(32);});await dialog.getByRole('button',{name:'Resume draft: Pi exact thread',exact:true}).click();await dialog.getByRole('status').filter({hasText:'original destination'}).waitFor();assert(await page.evaluate(()=>fixture.state.drafts[f.threadID].files[0].file===f.threadFile));await page.evaluate(()=>{f.thread.topic.agent_id=f.agentID;});await dialog.getByRole('button',{name:'Resume draft: Pi exact thread',exact:true}).click();await dialog.waitFor({state:'hidden'});const pi=await page.evaluate(()=>({id:fixture.state.thread,agent:fixture.state.deviceAgentID,text:app.querySelector('#body').value,file:fixture.state.files[0]?.file===f.threadFile}));assert.deepEqual(pi,{id:'f'.repeat(32),agent:'a'.repeat(32),text:'Exact Pi draft',file:true});
   await open();await dialog.getByRole('button',{name:'Drafts',exact:true}).click();await page.evaluate(()=>{f.savedTopics=f.dm.topics;f.dm.topics=[];});await dialog.getByRole('button',{name:'Resume draft: Briar DM',exact:true}).click();await dialog.getByRole('status').filter({hasText:'original destination'}).waitFor();assert(await page.evaluate(()=>fixture.state.drafts['dm:'+f.conv].files[0].file===f.dmFile));await page.evaluate(()=>{f.dm.topics=f.savedTopics;});await dialog.getByRole('button',{name:'Resume draft: Briar DM',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(await page.evaluate(()=>({id:fixture.state.dm,topic:fixture.topicSelections[f.conv],text:app.querySelector('#body').value,file:fixture.state.files[0]?.file===f.dmFile})),{id:'c'.repeat(64),topic:'e'.repeat(32),text:'Exact named-topic draft',file:true});
   await open();await dialog.getByRole('button',{name:'Reminders',exact:true}).click();assert.equal(await dialog.getByRole('button',{name:/^View reminder:/}).count(),20);assert.equal(await dialog.getByRole('button',{name:'Done',exact:true}).count(),0);assert(!/briar\/desk|atlas\/desk/.test(await dialog.innerText()),'reminder rows use friendly people/device words');assert.match(await dialog.getByRole('button',{name:'View reminder: Personal reminder 18',exact:true}).innerText(),/From You/);assert.match(await dialog.getByRole('button',{name:'View reminder: Personal reminder 19',exact:true}).innerText(),/From Briar/);
   await dialog.getByRole('button',{name:'View reminder: Personal reminder 19',exact:true}).click();await dialog.getByRole('button',{name:'Change reminder',exact:true}).click();const change=page.getByRole('dialog',{name:'Move the reminder',exact:true});await change.waitFor();await page.keyboard.press('Escape');await change.waitFor({state:'hidden'});assert(await dialog.isVisible(),'existing reminder editor returns to Outbox');
   for(let n=0;n<3;n++){await dialog.getByRole('button',{name:'View reminder: Personal reminder '+n,exact:true}).click();await dialog.getByRole('button',{name:'Done',exact:true}).click();await page.waitForFunction(n=>document.querySelector('#skin').shadowRoot.querySelectorAll('button[aria-label^="View reminder:"]').length===19-n,n);assert.equal(await page.locator('#outbox-due').textContent(),String(2-n));assert.equal(await page.locator('#outbox-due').isVisible(),n<2);await page.evaluate(()=>fixture.push());}
   assert.equal(await page.locator('#activity-extra .reminders, #threads .reminders').count(),0);assert(!await page.evaluate(()=>f.calls.some(c=>['/api/send','/api/request/followup'].includes(c.path))));
   // Both own-sent and incoming reminders land on the exact stored ID/topic,
   // without inventing a direction absent from ReminderView.
   for(const [index,topic,body]of [[18,'','Own sent reminder original'],[19,'e'.repeat(32),'Incoming reminder original']]){
    await dialog.getByRole('button',{name:'View reminder: Personal reminder '+index,exact:true}).click();await dialog.getByRole('button',{name:'Open message',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>fixture.topicSelections[f.conv]),topic);const exact=page.locator(skin==='zoom'?'article[data-mid="'+(index+1).toString(16).padStart(32,'0')+'"]':'#m-'+(index+1).toString(16).padStart(32,'0'));await exact.waitFor({state:'visible'});assert((await exact.innerText()).includes(body),'exact '+skin+' original text is visible');assert.equal(await page.getByRole('button',{name:'Retry message',exact:true}).count(),0);assert.equal(await page.locator('#body').inputValue(),'Exact named-topic draft');assert(await page.evaluate(()=>fixture.state.files[0]?.file===f.dmFile));await open();await dialog.getByRole('button',{name:'Reminders',exact:true}).click();
   }
   // Dedicated view closes with native Escape and returns focus to its nav opener.
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await page.locator('#nav-outbox').evaluate(b=>b.getRootNode().activeElement===b));
   if(skin==='holonet'&&width===390){
    // Match the real backend's ordinary active-assistant DM at keyboard height.
    await page.evaluate(async()=>{
     const me=f.overview.me,record={...f.agent,host:me.address,host_key:me.fingerprint};fixture.state.dmNames[record.host]=[record];
     f.dm.agents=[{pid:'7'.repeat(32),agent_id:record.id,host_here:true,host:{address:record.host,fingerprint:record.host_key,label:'Atlas',state:'self'},state:'active',tasks_from:[],shared:[],can_ask:true}];
     f.dm.topics[0].state='done';fixture.topicSelections[f.conv]=f.topic;await fixture.openDM(f.conv,structuredClone(f.dm),true,true);fixture.state.files=[];fixture.renderPending();app.querySelector('#body').value='Keyboard draft';fixture.syncComposer();app.querySelector('#body').focus();
    });await page.setViewportSize({width:390,height:480});await page.waitForFunction(()=>Math.abs(app.getBoundingClientRect().height-innerHeight)<2);
    const keyboard=await page.evaluate(()=>{
     const nav=app.querySelector('.command-nav'),outbox=app.querySelector('#nav-outbox'),activity=app.querySelector('#review-btn'),rect=n=>{const r=n.getBoundingClientRect();return{id:n.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     return{siblings:outbox.parentElement===nav&&activity.closest('.review-wrap').parentElement===nav&&outbox.nextElementSibling===activity.closest('.review-wrap'),targets:[...nav.querySelectorAll('button')].map(rect),timeline:app.querySelector('#timeline').clientHeight,send:rect(app.querySelector('#send')),font:parseFloat(getComputedStyle(app.querySelector('#body')).fontSize),active:fixture.state.dmData.agents.some(a=>a.state==='active'),overflow:document.documentElement.scrollWidth>innerWidth};
    });assert(keyboard.active);assert(keyboard.siblings,'Outbox and Activity wrapper are sibling nav items');assert.equal(keyboard.targets.length,6);for(const r of keyboard.targets)assert(r.width>=44&&r.height>=44,'44px nav target '+JSON.stringify(r));
    for(let i=0;i<keyboard.targets.length;i++)for(let j=i+1;j<keyboard.targets.length;j++){const a=keyboard.targets[i],b=keyboard.targets[j];assert(Math.min(a.right,b.right)-Math.max(a.x,b.x)<=.5||Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<=.5,'navigation targets overlap');}
    assert(keyboard.timeline>=50,'keyboard leaves at least50px of messages: '+JSON.stringify(keyboard));assert(keyboard.send.height>=44&&keyboard.send.bottom<=480+1);assert(keyboard.font>=14);assert(!keyboard.overflow);console.log('HOLONET_KEYBOARD '+JSON.stringify(keyboard));
    if(process.env.AGENTNET_OUTBOX_SHOTS)await page.screenshot({path:path.join(process.env.AGENTNET_OUTBOX_SHOTS,'holonet-keyboard-390x480.png')});
   }
   await page.evaluate(()=>stopOutbox());assert.equal(await page.locator('dialog.an-outbox-view').count(),0);assert.deepEqual(errors,[]);console.log(JSON.stringify({skin,width,compact20:true,history200Deferred:true,CAS1:true,exactPiAndNamedDraftFiles:true,reminders20:true,incomingAndOwnSentReminder:true,friendlyPeople:true,dueBadge:'3→2→1→none',noSend:true,nativeFocusCleanup:true}));
   }catch(e){console.error('OUTBOX_FAILURE',skin,width,await page.evaluate(()=>({errors:window.f?.calls.slice(-12),html:window.app?.innerHTML.slice(-5000)})));throw e;}finally{await context.close();}
  });
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
