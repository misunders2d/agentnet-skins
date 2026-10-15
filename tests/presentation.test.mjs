import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const base=process.env.AGENTNET_COLLECTION_BASE||root;
const read=(skin,file)=>fs.readFileSync(fs.existsSync(path.join(root,'skins',skin,'src',file))?path.join(root,'skins',skin,'src',file):path.join(base,'skins',skin,'src',file));
test('private runtime targets and Zoom Markdown use the current presentation', {skip:!process.env.AGENTNET_CHROMIUM},async()=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);
  if(!m){res.statusCode=404;res.end();return;}
  try{
   let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(base,'skins',m[1],'skin.json'),'utf8'):read(m[1],m[2]);
   if(m[2]==='entry.mjs'){
    const expose='globalThis.fixture={state,firstLine,threadRow,bodyOf,ownModelReport,ownModelReports,renderAgentTarget,selectedModelReports,refreshModelReports,renderNamedAgents,inviteDialog,agentCard,editInPlace'+(m[1]==='zoom'?',Zoom':'')+'};';
    const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';
    assert(data.toString().includes(needle));data=data.toString().replace(needle,expose+(m[1]==='zoom'?'':'const ready=Promise.resolve();'));
   }
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':m[2].endsWith('.png')?'image/png':'text/javascript');res.end(data);
  }catch(e){res.statusCode=404;res.end(String(e));}
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of ['classic','holonet','zoom'])for(const width of [1120,390]){
   const context=await browser.newContext({viewport:{width,height:1000},locale:'en-US',timezoneId:'Europe/Kyiv'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack));await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin);
   const result=await page.evaluate(async({skin})=>{
    const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];
    const app=document.createElement('div');app.className='skin-root';shadow.append(app);let calls=0,writes=0,catalogView=null;
    await(await import('/'+skin+'/entry.mjs')).mount(app,{version:1,workspace:{id:'fixture'},listen(){return()=>{}},onOpen(){},api:async(p,body)=>{calls++;if(body!==undefined){writes++;throw Error('Presentation wrote to API');}if(catalogView&&p.startsWith('/api/agents'))return {...catalogView,local:p==='/api/agents'};throw Error('Unexpected presentation API call');}});
    for(const child of app.children)child.hidden=true;
    const view=document.createElement('section');view.className='presentation-fixture';app.append(view);
    const ids=['a'.repeat(32),'b'.repeat(32)],host='atlas/desk',key='current-key';
    const own={person:'atlas',label:'Atlas',address:host,state:'self',devices:[{address:host,fingerprint:key}]};
    const overview={agents:true,me:{address:host,fingerprint:key,agent:true},person:own,people:[],threads:[],dms:[],review:[],agent_devices:[host],model_reports:[{host,host_key:key,agent_id:'',model:'DEFAULT_ONLY',reasoning:'low',at:1791709352},...ids.map((id,i)=>({host,host_key:key,agent_id:id,model:i?'quill-model':'ledger-model',reasoning:i?'medium':'xhigh',at:1791709352})),{host:'outside/desk',host_key:'foreign-key',agent_id:'',model:'PRIVATE_FOREIGN',at:1791709352}]};
    fixture.state.overview=overview;
    const agents=ids.map((id,i)=>({pid:'pid-'+i,agent_id:id,host:own,label:i?'Quill':'Ledger',state:'active',can_ask:true,shared:[],missing:0,inviter:own,tasks_from:[]}));
    const d={id:'c'.repeat(64),kind:'group',role:'member',title:'Harbor team',members:[own],agents,guests:[],messages:[]};
    fixture.state.dm=d.id;fixture.state.dmData=d;fixture.state.dmAgent=agents[0].pid;
    const input=app.querySelector('#body');input.value='@Ledger @Quill ';
    fixture.state.mentions=[{start:0,name:'Ledger',ref:{kind:'agent',id:agents[0].pid}},{start:8,name:'Quill',ref:{kind:'agent',id:agents[1].pid}}];
    const targets=app.querySelector('#agent-target');view.append(targets);fixture.renderAgentTarget();
    const groupRows=[...targets.querySelectorAll('[data-agent-model]')].map(n=>n.textContent);
    if(skin==='holonet'){fixture.state.dmAgent=agents[1].pid;fixture.renderAgentTarget();}
    const secondSelected=targets.textContent;
    d.kind='dm';d.peer={person:'briar',label:'Briar',address:'briar/desk',devices:[]};fixture.renderAgentTarget();
    const dmRows=targets.querySelectorAll('[data-agent-model]').length;
    overview.model_reports.find(r=>r.agent_id===ids[1]).reasoning='high';fixture.refreshModelReports();
    const revised=targets.textContent;
    const unknown=fixture.ownModelReport(host,'e'.repeat(32)).textContent;
    overview.model_reports.find(r=>r.agent_id===ids[1]).host_key='old-key';fixture.refreshModelReports();const oldKey=targets.textContent;
    own.devices=[];fixture.refreshModelReports();const removed=targets.querySelectorAll('[data-agent-model]').length;
    own.devices=[{address:host,fingerprint:key}];overview.model_reports[2].host_key=key;
    const aggregate=fixture.ownModelReports();const privateText=aggregate.textContent;
    own.state='listed';const notSelf=fixture.ownModelReport(host,ids[0]);own.state='self';
    delete overview.model_reports[1].reasoning;const noEffort=fixture.ownModelReport(host,ids[0]).textContent;
    overview.model_reports[1].at=9007199254740991;const invalidTime=fixture.ownModelReport(host,ids[0]).textContent;
    fixture.state.dm=null;fixture.state.dmData=null;fixture.state.dmAgent=null;fixture.state.deviceAgentID=ids[0];
    fixture.state.targetCatalog={host,agents:ids.map((id,i)=>({id,host,host_key:key,label:i?'Quill':'Ledger'}))};
    const source='**Harbor order**\n\n- **Stock:** Ready\n- *Invoice:* Sent\n\n[Order](https://example.invalid/order) [unsafe](javascript:alert(1)) ![image](https://example.invalid/picture) `literal_*`\n\n<script>globalThis.BAD=1</script>';
    const m={id:'d'.repeat(32),dir:'in',from:host,kind:'answer',body:source,at:'2026-10-11T09:02:32Z',state:'answered',author:{label:'Atlas'},actions:[],can:['edit']};
    fixture.state.data={id:'f'.repeat(32),peer:host,key:{pinned:key},messages:[m]};
    const radio=app.querySelector('input[name=kind][value=question]');radio.checked=true;fixture.renderAgentTarget();
    const direct=targets.textContent;
    fixture.state.deviceAgentID='';fixture.renderAgentTarget();const defaultTarget=targets.textContent;
    fixture.state.deviceAgentID='e'.repeat(32);fixture.renderAgentTarget();const missingTarget=targets.textContent;
    const row=fixture.threadRow({id:'f'.repeat(32),title:'**Automatic title**',last_at:m.at,count:2},()=>{},false),renamed=fixture.threadRow({id:'f'.repeat(32),title:'**Literal custom title**',renamed:true,last_at:m.at,count:2},()=>{},false);
    view.append(row,renamed);const observed={groupRows,secondSelected,dmRows,revised,unknown,oldKey,removed,privateText,notSelf:!!notSelf,noEffort,invalidTime,direct,defaultTarget,missingTarget,preview:fixture.firstLine(source,120),autoTitle:row.textContent,renamedTitle:renamed.textContent,calls};
    // Actual target picker rows, including an unknown named selection.
    app.querySelector('#dialog').hidden=false;
    targets.querySelector('button').click();
    observed.pickerRows=app.querySelector('#dialog').querySelectorAll('[data-agent-model]').length;
    observed.nestedModel=!!app.querySelector('[data-agent-model]')?.closest('button,select');app.querySelector('#dialog').close();
    if(skin==='zoom'){
     const scene=fixture.Zoom.thread();view.append(scene);fixture.Zoom.msg=m.id;const full=fixture.Zoom.message();view.append(full);
     observed.bubbleStrong=scene.querySelectorAll('.mc-text strong').length;observed.bubbleLinks=scene.querySelectorAll('.mc-bubble a,.mc-bubble button').length;
     observed.strong=full.querySelectorAll('.body strong').length;observed.listItems=full.querySelectorAll('.body li').length;observed.code=full.querySelector('.body code').textContent;
     observed.active=full.querySelectorAll('.body script,.body img,.body [href^="javascript:"]').length;observed.href=full.querySelector('.body a').href;observed.literalHTML=full.querySelector('.body').textContent.includes('<script>');observed.copyText=fixture.state.data.messages[0].body;observed.original=source;
     fixture.editInPlace(m,'',full);observed.editorOriginal=full.querySelector('.edit-box textarea').value;
     [...full.querySelectorAll('.edit-box button')].find(n=>n.textContent==='Cancel').click();observed.restoredFormatted=full.querySelectorAll('.body strong').length;
     const literal=fixture.bodyOf({...m,body:'\\*literal\\* and `literal_*`\n\n```\nraw_* &amp;\n```'});view.append(literal);observed.literalCode=literal.querySelector('pre code').textContent;observed.literalText=literal.textContent;
     observed.bodyFits=full.querySelector('.body').getBoundingClientRect().right<=innerWidth+1;

    }
    catalogView={host,local:true,harnesses:[],agents:ids.map((id,i)=>({record:{id,host,host_key:key,label:i?'Quill':'Ledger'},enabled:true,responder:{harness:'fixture',dir:'/fixture',ready:true}}))};
    await fixture.renderNamedAgents();observed.detailsRows=app.querySelector('#named-agents').querySelectorAll('[data-agent-model]').length;
    fixture.state.dm=d.id;fixture.state.dmData=d;d.kind='group';fixture.inviteDialog(d);
    const pick=app.querySelector('input[name="agent-host"][value="atlas/desk"]');pick.checked=true;pick.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,0));const named=app.querySelector('#invite-agent');named.value=ids[1];named.dispatchEvent(new Event('change'));
    observed.inviteNamed=app.querySelector('#dialog').textContent;named.value='';named.dispatchEvent(new Event('change'));observed.inviteDefault=app.querySelector('#dialog').textContent;
    observed.inviteNested=!!app.querySelector('#dialog [data-agent-model]')?.closest('select,button');app.querySelector('#dialog').close();
    observed.writes=writes;observed.catalogReads=calls;
    // Leave the own targets visible for a bounded desktop/phone screenshot.
    fixture.state.dm=d.id;fixture.state.dmData=d;fixture.state.dmAgent=agents[0].pid;fixture.renderAgentTarget();
    observed.targetFits=[...targets.querySelectorAll('[data-agent-model]')].every(n=>{const b=n.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1;});
    return observed;
   },{skin});
   assert.equal(result.groupRows.length,skin==='holonet'?1:2,skin+' selected group targets');assert.match(result.groupRows[0],/ledger-model.*Reasoning: xhigh/);assert.match(result.secondSelected,/quill-model/);assert.equal(result.dmRows,skin==='holonet'?1:2);
   assert.match(result.revised,/quill-model.*Reasoning: high/);assert(!result.revised.includes('DEFAULT_ONLY'));assert.match(result.unknown,/not reported/);assert(!result.oldKey.includes('quill-model'));assert.equal(result.removed,0);assert(!result.privateText.includes('PRIVATE_FOREIGN'));assert.equal(result.notSelf,false);assert.match(result.noEffort,/Reasoning: not reported/);assert.match(result.invalidTime,/Timestamp unavailable/);
   assert.match(result.direct,/ledger-model/);assert(!result.direct.includes('DEFAULT_ONLY'));assert.match(result.defaultTarget,/DEFAULT_ONLY/);assert(!result.missingTarget.includes('DEFAULT_ONLY'));assert.equal(result.pickerRows,3);assert.equal(result.nestedModel,false);assert.equal(result.calls,0);assert.equal(result.targetFits,true);assert.equal(result.detailsRows,2);assert.match(result.inviteNamed,/quill-model.*Reasoning: high/);assert.match(result.inviteDefault,/DEFAULT_ONLY/);assert.equal(result.inviteNested,false);assert.equal(result.writes,0);assert.equal(result.catalogReads,2);
   assert.equal(result.preview,'Harbor order');assert.match(result.autoTitle,/Automatic title/);assert(!result.autoTitle.includes('**'));assert(result.renamedTitle.includes('**Literal custom title**'));
   if(skin==='zoom'){assert(result.bubbleStrong>=2);assert.equal(result.bubbleLinks,0);assert.equal(result.listItems,2);assert.equal(result.strong,2);assert.equal(result.code,'literal_*');assert.equal(result.active,0);assert.equal(result.href,'https://example.invalid/order');assert.equal(result.literalHTML,true);assert.equal(result.copyText,result.original);assert.equal(result.editorOriginal,result.original);assert.equal(result.restoredFormatted,2);assert.equal(result.literalCode,'raw_* &amp;');assert(result.literalText.includes('*literal*'));assert.equal(result.bodyFits,true);}
   assert.deepEqual(errors,[]);
   if(process.env.AGENTNET_SCREENSHOTS){fs.mkdirSync(process.env.AGENTNET_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,skin+'-presentation-'+width+'.png'),fullPage:true});}
   await context.close();
  }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
