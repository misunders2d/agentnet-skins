import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');

test('standalone topic guests invite only their own agents with admitted context',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||path.join(collection,'node_modules/playwright'));
 const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://fixture').pathname;
  if(p==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guest own-agent fixture</title><link rel="icon" href="data:,"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(p);if(!m){res.writeHead(404).end();return;}
  try{
   let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(collection,'skins',m[1],'skin.json'),'utf8'):fs.readFileSync(path.join(collection,'skins',m[1],'src',m[2]));
   if(m[2]==='entry.mjs'){
    if(process.env.AGENTNET_UI_BASELINE)data=fs.readFileSync(path.join(process.env.AGENTNET_UI_BASELINE,m[1]+'-entry-before.mjs'));
    const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.toString().includes(needle));
    data=data.toString().replace(needle,'globalThis.fixture={state,inviteRights,participantsDialog,inviteDialog,mentionInvites,topicSelections,topicFresh};'+(m[1]==='zoom'?'':'const ready=Promise.resolve();'));
   }
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(e.message);}
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of (process.env.AGENTNET_TEST_SKINS||'classic,holonet,zoom').split(','))for(const width of (process.env.AGENTNET_TEST_WIDTHS||'1280,390').split(',').map(Number))for(const group of [false,true])await t.test(skin+' '+width+' '+(group?'group':'DM'),async()=>{
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin);
   try{
    await page.evaluate(async({skin,group})=>{
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];
     const root=document.createElement('div');root.className='skin-root';shadow.append(root);
     const keys={'atlas/browser':'11111111-11111111-11111111-11111111','atlas/host':'22222222-22222222-22222222-22222222','atlas/phone':'33333333-33333333-33333333-33333333','briar/host':'44444444-44444444-44444444-44444444'};
     const me={person:'atlas',label:'Atlas',state:'self',address:'atlas/browser',fingerprint:keys['atlas/browser'],devices:[{address:'atlas/browser',fingerprint:keys['atlas/browser']},{address:'atlas/host',fingerprint:keys['atlas/host']},{address:'atlas/phone',fingerprint:keys['atlas/phone']}]},peer={person:'briar',label:'Briar',state:'pinned',address:'briar/host',fingerprint:keys['briar/host'],devices:[]};
     window.topic='a'.repeat(32);window.agentID='b'.repeat(32);window.posts=[];window.reads=[];window.failPost=false;
     window.view={id:'c'.repeat(64),kind:group?'group':'dm',title:'Topic guests',peer,role:'human_guest',guests:[{pid:'parent-guest',host:me,inviter:peer,host_here:true,state:'active',can_send:true,topic,shared:['excerpt']}],agents:[],members:[peer],topics:[],messages:[{id:'excerpt',lid:'original',excerpt_pid:'parent-guest',from:peer.address,kind:'message',body:'Selected admitted excerpt',topic,attachments:[{name:'selected.txt',size:5}]},{id:'live',from:peer.address,kind:'message',body:'Current topic message',topic},{id:'other',from:peer.address,body:'Other topic',topic:'d'.repeat(32)},{id:'deleted',body:'Deleted',topic,deleted:true},{id:'main',body:'Main history',topic:''}]};
     window.overview={me:{address:me.address,fingerprint:me.fingerprint,agent:false},person:me,agents:true,agent_devices:['atlas/host','briar/host'],people:[peer],peers:[],dms:[],threads:[],review:[],links:[],needs_you:[],held:[],reminders:[],device:{},directory:{current:true,members:[{address:'outsider/host'}]}};
     const host={version:1,platform:'browser',workspace:{id:'default'},listen:()=>()=>{},onOpen(){},api:async(p,body)=>{
      if(body!==undefined){posts.push({p,body:structuredClone(body)});if(failPost){failPost=false;throw Error('Synthetic response uncertain');}return {};}
      reads.push(p);if(p.startsWith('/api/dm?'))return structuredClone(view);if(p.startsWith('/api/overview'))return structuredClone(overview);if(p.startsWith('/api/agents')){const address=new URL('http://fixture'+p).searchParams.get('host')||'atlas/host';return {host:address,agents:[{enabled:true,record:{v:1,host:address,host_key:keys[address],id:agentID,label:'Pi',harness:'pi'}}]};}if(p.startsWith('/api/typing'))return {current:false,supported:false,send:false,scopes:[]};if(p==='/api/teams')return {teams:[]};if(p==='/api/workspace')return {};throw Error('Unexpected read '+p);
     }};
     window.fixtureHost=host;await(await import('/'+skin+'/entry.mjs')).mount(root,host);
     for(const child of root.children)child.hidden=true;root.querySelector('#dialog').hidden=false;root.style.visibility='visible';
     Object.assign(fixture.state,{overview,dm:view.id,dmData:structuredClone(view)});fixture.topicSelections[view.id]=topic;
     window.reset=()=>{root.querySelector('#dialog').close();fixture.state.dm=view.id;fixture.state.dmData=structuredClone(view);fixture.topicSelections[view.id]=topic;fixture.topicFresh[view.id]=false;posts=[];};
    },{skin,group});
    assert.equal(await page.title(),'Guest own-agent fixture');assert.equal(new URL(page.url()).origin,origin);
    assert.deepEqual(await page.evaluate(()=>fixture.inviteRights(fixture.state.dmData)),{assistants:true,people:false});
    assert.deepEqual(await page.evaluate(()=>fixture.mentionInvites(fixture.state.dmData,'').map(x=>x.kind)),['invite-assistant']);
    await page.evaluate(()=>fixture.participantsDialog(fixture.state.dmData));
    assert.equal(await page.locator('#dialog').getByRole('button',{name:/Invite an assistant/}).isEnabled(),true);
    assert.equal(await page.locator('#dialog').getByRole('button',{name:/human|person|permanent member/}).filter({visible:true}).count()>0&&await page.locator('#dialog').getByRole('button',{name:/human|person|permanent member/}).filter({visible:true}).first().isEnabled(),false);
    await page.locator('#dialog').getByRole('button',{name:/Invite an assistant/}).click();
    assert.deepEqual(await page.locator('input[name="agent-host"]').evaluateAll(ns=>ns.map(n=>n.value)),['atlas/host']);
    assert.deepEqual(await page.locator('input[name="agent-share"]').evaluateAll(ns=>ns.map(n=>n.value)),['excerpt','live']);
    assert.equal(await page.locator('input[name="agent-tasks"]').count(),0);
    const chooseAgent=async()=>{await page.waitForFunction(()=>!document.querySelector('#skin').shadowRoot.querySelector('#invite-agent').disabled);await page.locator('#invite-agent').selectOption('b'.repeat(32));assert.equal(await page.locator('#invite-agent').inputValue(),'b'.repeat(32));};
    await page.locator('input[name="agent-host"]').check();await chooseAgent();
    await page.locator('input[name="agent-share"][value="excerpt"]').check();await page.locator('#dialog-ok').click();await page.locator('#dialog-error').filter({hasText:'Confirm file access'}).waitFor();assert.equal(await page.evaluate(()=>posts.length),0);
    await page.locator('input[name="agent-file-consent"]').check();
    const box=await page.locator('#dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,'dialog fits viewport');
    if(process.env.AGENTNET_SCREENSHOTS)await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,`guest-agent-${skin}-${width}-${group?'group':'dm'}.png`)});
    await page.evaluate(()=>failPost=true);await page.locator('#dialog-ok').click();await page.locator('#dialog-error').filter({hasText:'Synthetic response uncertain'}).waitFor();await page.locator('#dialog-ok').click();await page.waitForFunction(()=>posts.length===2);
    const posts=await page.evaluate(()=>window.posts);assert.deepEqual(posts[1],posts[0],'retry preserves producer payload');assert.deepEqual(posts[0],{p:'/api/dm/agent/invite',body:{conv:'c'.repeat(64),host:'atlas/host',agent_id:'b'.repeat(32),topic:'a'.repeat(32),share:['excerpt'],tasks_from:[],note:''}});
    for(const bad of ['ended','wrong-topic','Main','fresh','frozen','ambiguous']){
     await page.evaluate(bad=>{reset();const t=fixture.state.dmData;if(bad==='ended')t.guests[0].state='dismissed';if(bad==='wrong-topic')fixture.topicSelections[t.id]='e'.repeat(32);if(bad==='Main')fixture.topicSelections[t.id]='';if(bad==='fresh')fixture.topicFresh[t.id]=true;if(bad==='frozen')t.frozen='Unavailable';if(bad==='ambiguous')t.guests.push({...t.guests[0],pid:'other-parent'});},bad);
     assert.equal(await page.evaluate(()=>fixture.inviteRights(fixture.state.dmData).assistants),false,bad);
     await page.evaluate(()=>fixture.inviteDialog(fixture.state.dmData));assert.equal(await page.evaluate(()=>posts.length),0,bad);
    }
    for(const bad of ['navigation','workspace','ended','owner','key','capable','topic','deleted']){
     await page.evaluate(()=>{reset();fixture.inviteDialog(fixture.state.dmData);});await page.locator('input[name="agent-host"]').check();await chooseAgent();
     await page.evaluate(bad=>{window.restore={view:structuredClone(view),overview:structuredClone(overview)};if(bad==='navigation')fixture.state.dm='other';if(bad==='workspace')fixtureHost.workspace.id='other-workspace';if(bad==='ended')view.guests[0].can_send=false;if(bad==='owner')overview.person.devices=[];if(bad==='key')overview.person.devices.find(d=>d.address==='atlas/host').fingerprint='changed-key';if(bad==='capable')overview.agent_devices=[];if(bad==='topic')view.guests[0].topic='e'.repeat(32);if(bad==='deleted')view.messages.find(m=>m.id==='live').deleted=true;},bad);
     if(bad==='deleted')await page.locator('input[name="agent-share"][value="live"]').check();await page.locator('#dialog-ok').click();await page.waitForFunction(()=>!document.querySelector('#skin').shadowRoot.querySelector('#dialog-ok').disabled);assert.match(await page.locator('#dialog-error').textContent(),/Reopen|reopen|no longer/,bad);assert.equal(await page.evaluate(()=>posts.length),0,bad);
     await page.evaluate(()=>{window.view=restore.view;window.overview=restore.overview;fixture.state.overview=overview;fixtureHost.workspace.id='default';});
    }
    await page.evaluate(()=>{reset();fixture.state.dmData.role='member';fixture.state.dmData.guests=[];fixture.state.dmData.members.push(overview.person);fixture.inviteDialog(fixture.state.dmData);});
    assert.ok(await page.locator('input[name="agent-host"]').count()>1,'member retains other-host choices');assert.ok(await page.locator('input[name="agent-tasks"]').count()>0,'member retains task choices');
    const selectedHost=await page.locator('input[name="agent-host"]').first().inputValue();await page.locator('input[name="agent-host"]').first().check();await chooseAgent();await page.locator('#dialog-ok').click();await page.waitForFunction(()=>posts.length===1);
    assert.deepEqual(await page.evaluate(()=>({host:posts[0].body.host,agent_id:posts[0].body.agent_id})),{host:selectedHost,agent_id:'b'.repeat(32)},'member invitation retains exact configured agent');
    assert.equal(await page.evaluate(()=>Object.hasOwn(posts[0].body,'topic')),false,'ordinary member payload unchanged');
    assert.deepEqual(errors,[]);await page.evaluate(()=>reset());
   }finally{await context.close();}
  });
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
