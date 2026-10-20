import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';

const root=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..'),base=process.env.AGENTNET_COLLECTION_BASE||root;
const require=createRequire(import.meta.url);
const source=(skin,file)=>fs.readFileSync(fs.existsSync(path.join(root,'skins',skin,'src',file))?path.join(root,'skins',skin,'src',file):path.join(base,'skins',skin,'src',file));

test('retained lists and actual Zoom message menus', {skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);
  if(!m){res.statusCode=404;res.end();return;}
  try{
   let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(base,'skins',m[1],'skin.json'),'utf8'):source(m[1],m[2]);
   if(m[2]==='entry.mjs'){
    const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';
    assert(data.toString().includes(needle));
    data=data.toString().replace(needle,'globalThis.fixture={state,teamHub'+(m[1]==='zoom'?',Zoom':'')+'};'+(m[1]==='zoom'?'':'const ready=Promise.resolve();'));
   }
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.statusCode=404;res.end(String(e));}
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  const setup=async(skin,width)=>{
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack));
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin);
   await page.evaluate(async skin=>{
    const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];
    const app=document.createElement('div');app.className='skin-root';shadow.append(app);
    const person={person:'atlas',label:'Atlas',state:'self',address:'atlas/desk',devices:[]},other={person:'briar',label:'Briar',state:'pinned',address:'briar/phone',devices:[]};
    window.calls=[];window.unexpected=[];window.responses={};window.teams={status:'available',current:true,tags:true,legacy_add:true,teams:[]};
    await(await import('/'+skin+'/entry.mjs')).mount(app,{version:1,workspace:{id:'fixture'},listen(){return()=>{}},onOpen(){},api:async(p,body)=>{
     calls.push({path:p,...body!==undefined?{body:structuredClone(body)}:{}});
     if(p==='/api/team')return {id:body.team,name:'Operations'};
     if(p==='/api/teams')return structuredClone(teams);
     if(p==='/api/workspace')return {can_rename:false};
     if(p==='/api/message/edit'){
      const m=responses.message; if(body.id!==m.id||body.dir!==m.dir)throw Error('Wrong message target');
      m.text=body.text;m.edited=true;return {note:'Saved fixture revision.'};
     }
     if(p.startsWith('/api/thread?id='))return structuredClone(responses.thread);
     if(p.startsWith('/api/dm?id='))return structuredClone(responses.dm);
     if(p.startsWith('/api/typing?'))return {enabled:false,people:[]};
     unexpected.push(p);throw Error('Unexpected fixture API '+p);
    }});
    for(const child of app.children)child.hidden=true;
    app.querySelector('#dialog').hidden=false;
    const view=document.createElement('section');view.id='contract-fixture';app.append(view);
    fixture.state.overview={me:{address:'atlas/desk',fingerprint:'atlas-key',agent:false},person,people:[other,{person:'listed',label:'Unverified',state:'listed'}],threads:[],dms:[],review:[],peers:[]};
    window.renderTeam=(overrides={},support={})=>{
     teams={status:'available',current:true,tags:true,legacy_add:true,teams:[],...support};fixture.state.teams=teams;
     const team={id:'original-legacy-list',name:'Operations',version:1,manager:true,member:true,managers:['atlas'],members:['atlas'],...overrides};teams.teams=[team];
     view.replaceChildren(...fixture.teamHub(team).flat(Infinity).filter(Boolean));
     return {text:view.textContent,buttons:[...view.querySelectorAll('button')].map(n=>n.textContent),fits:[...view.querySelectorAll('button')].every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;})};
    };
    window.renderMessage=(kind,overrides={})=>{
     const m={id:kind==='dm'?'d'.repeat(32):'e'.repeat(32),lid:'f'.repeat(32),dir:kind==='dm'?'out':'in',from:'briar/phone',kind:'message',body:'**Original title**\n\n- *Keep* `raw_*`\n- [Invoice](https://example.invalid/invoice)',topic:'topic-original',at:'2026-10-11T09:02:32Z',author:{label:'Briar',about:'Fixture author'},can:['edit'],actions:[],...overrides};
     responses.message=m;
     responses.thread={id:'thread-original',peer:'briar/phone',key:{pinned:'briar-key'},messages:[m]};
     responses.dm={id:'c'.repeat(64),kind:'dm',title:'Main',peer:other,members:[person,other],agents:[],guests:[],topics:[{id:m.topic,title:'Original topic',state:'active'}],messages:[m]};
     Object.assign(fixture.state,{data:structuredClone(responses.thread),dmData:kind==='dm'?structuredClone(responses.dm):null,dm:kind==='dm'?responses.dm.id:null,thread:kind==='dm'?null:'thread-original',draftKey:'fixture-draft',files:[]});
     Object.assign(fixture.Zoom,{level:3,msg:m.id,person:kind==='dm'?'briar':null,peer:kind==='dm'?null:'briar/phone',dm:kind==='dm'?responses.dm.id:null,thread:kind==='dm'?null:'thread-original'});
     view.replaceChildren(kind==='dm'?fixture.Zoom.dmMessage():fixture.Zoom.message());
     return {body:m.body,id:m.id,dir:m.dir,conv:kind==='dm'?responses.dm.id:undefined,topic:m.topic};
    };
   },skin);
   return {context,page,errors};
  };
  for(const skin of ['classic','holonet','zoom'])for(const width of [1120,390])await t.test(skin+' legacy lists '+width,async()=>{
   const {context,page,errors}=await setup(skin,width);
   try{
    const observations=[];
    for(const version of [1,3]){
     const result=await page.evaluate(version=>renderTeam({version}),version);observations.push({version,...result});
     if(!result.buttons.includes('Add person…'))continue;
     await page.getByRole('button',{name:'Add person…',exact:true}).click();
     const options=await page.getByRole('combobox',{name:'Person',exact:true}).locator('option').allTextContents();
     assert.deepEqual(options,['Choose a person','Briar']);
     await page.getByRole('combobox',{name:'Person',exact:true}).selectOption('briar');
     await page.locator('#dialog-ok').click();await page.waitForFunction(()=>!document.querySelector('#skin').shadowRoot.querySelector('#dialog').open);
    }
    console.log(JSON.stringify({skin,width,legacy:observations}));
    for(const r of observations){assert(r.buttons.includes('Add person…'),'V'+r.version+' manager Add person missing');assert(!r.buttons.includes('Add agent…'));assert(r.buttons.includes('Leave'));assert.match(r.text,/only manager/);assert.match(r.text,/Older apps keep their last readable copy/);assert(r.fits);}
    const writes=await page.evaluate(()=>calls.filter(c=>c.body));assert.deepEqual(writes,[1,3].map(()=>({path:'/api/team',body:{team:'original-legacy-list',op:'add',target:'briar'}})));
    for(const [overrides,support] of [[{manager:false},{}],[{archived:true},{}],[{conflict:true},{}],[{}, {legacy_add:false}],[{}, {legacy_add:undefined}],[{}, {current:false}]]){
     const r=await page.evaluate(([o,s])=>renderTeam({version:3,...o},s),[overrides,support]);assert(!r.buttons.includes('Add person…'));assert(!r.buttons.includes('Add agent…'));
    }
    const joined=await page.evaluate(()=>renderTeam({version:3,manager:false,member:false}));assert(joined.buttons.includes('Join'));
    const old=await page.evaluate(()=>renderTeam({version:3},{legacy_add:false}));assert.match(old.text,/Update the server/);
    const v2=await page.evaluate(()=>renderTeam({version:2},{legacy_add:false}));
    if(skin!=='holonet'){assert(v2.buttons.includes('Add person…'));assert(v2.buttons.includes('Add agent…'));assert(!v2.buttons.includes('Join'));assert(!v2.buttons.includes('Leave'));}
    assert.deepEqual(errors,[]);
    if(process.env.AGENTNET_SCREENSHOTS){await page.evaluate(()=>renderTeam({version:3}));fs.mkdirSync(process.env.AGENTNET_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,skin+'-legacy-'+width+'.png')});}
   }finally{await context.close();}
  });
  for(const width of [1120,390])for(const kind of ['thread','dm'])await t.test('Zoom actual '+kind+' menu '+width,async()=>{
   const {context,page,errors}=await setup('zoom',width);
   try{
    const original=await page.evaluate(kind=>renderMessage(kind),kind);
    await page.getByLabel('Message actions',{exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();
    const observed=await page.locator('.edit-box textarea').count();console.log(JSON.stringify({width,kind,editorCount:observed}));assert.equal(observed,1,'Actual menu did not open editor');
    assert.equal(await page.getByRole('textbox',{name:'New text'}).inputValue(),original.body);
    await page.getByRole('textbox',{name:'New text'}).fill('Discarded edit');await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.locator('#contract-fixture .body strong').textContent(),'Original title');assert.equal(await page.locator('#contract-fixture .body li').count(),2);assert.deepEqual(await page.evaluate(()=>calls),[]);
    await page.getByLabel('Message actions',{exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();
    const revised='**Revised title**\n\n- Keep `raw_*`\n- Exact destination';
    await page.getByRole('textbox',{name:'New text'}).fill(revised);await page.getByRole('button',{name:'Save',exact:true}).click();
    await page.waitForFunction(()=>calls.some(c=>c.path==='/api/message/edit')&&document.querySelector('#skin').shadowRoot.querySelector('#live').textContent==='Saved fixture revision.');
    await page.waitForFunction(revised=>(fixture.state.dmData||fixture.state.data).messages[0].text===revised,revised);
    const result=await page.evaluate(()=>({writes:calls.filter(c=>c.body),reads:calls.filter(c=>!c.body).map(c=>c.path),message:responses.message,topic:(fixture.state.dmData||fixture.state.data).messages[0].topic,unexpected,loadedText:(fixture.state.dmData||fixture.state.data).messages[0].text,formatted:document.querySelector('#skin').shadowRoot.querySelector('#zoom .body strong')?.textContent}));
    const expected={id:original.id,dir:original.dir,text:revised};if(kind==='dm')expected.conv=original.conv;
    assert.deepEqual(result.writes,[{path:'/api/message/edit',body:expected}]);assert.equal(result.message.body,original.body);assert.equal(result.message.text,revised);assert.equal(result.topic,original.topic);assert.equal(result.loadedText,revised);assert.deepEqual(result.unexpected,[]);if(kind==='dm')assert.equal(result.formatted,'Revised title');assert(result.reads.includes('/api/'+(kind==='dm'?'dm?id='+original.conv:'thread?id=thread-original')));
    for(const overrides of [{can:[]},{excerpt_pid:'forwarded'},{deleted:true}]){
     await page.evaluate(({kind,overrides})=>renderMessage(kind,overrides),{kind,overrides});assert.equal(await page.getByRole('button',{name:'Edit',exact:true}).count(),0);
    }
    assert.deepEqual(errors,[]);
    if(process.env.AGENTNET_SCREENSHOTS){await page.evaluate(kind=>renderMessage(kind),kind);fs.mkdirSync(process.env.AGENTNET_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,'zoom-'+kind+'-'+width+'.png')});}
   }finally{await context.close();}
  });
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});

test('phone group details hands off to an editable shared-links dialog', {skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://fixture').pathname;
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'");
  if(p==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><link rel="icon" href="data:,"><div id="skin"></div>');return;}
  if(p==='/fixture.css'){res.setHeader('Content-Type','text/css');res.end('html,body{margin:0;height:100%}#skin{height:100vh}.skin-root{height:100%}');return;}
  const m=/^\/(classic|zoom|holonet)\/([^/]+)$/.exec(p);
  if(!m){res.writeHead(404).end();return;}
  try{
   const bytes=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(root,'skins',m[1],'skin.json'),'utf8')+';':source(m[1],m[2]);
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':m[2].endsWith('.png')?'image/png':m[2].endsWith('.svg')?'image/svg+xml':'text/javascript');res.end(bytes);
  }catch{res.writeHead(404).end();}
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of ['classic','zoom','holonet'])await t.test(skin,async()=>{
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(origin);
    await page.evaluate(async skin=>{
     window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.violatedDirective));
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),sheet=new CSSStyleSheet();
     sheet.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[sheet];
     const app=document.createElement('div');app.className='skin-root';shadow.append(app);
     const me={address:'atlas/desk',fingerprint:'1'.repeat(64),agent:false},person={person:'atlas',label:'Atlas',address:me.address,state:'self',devices:[]},peer={person:'briar',label:'Briar',address:'briar/phone',state:'pinned',devices:[]};
     const dm={id:'c'.repeat(64),kind:'group',role:'member',title:'Shared notebook',peer,members:[person,peer],agents:[],guests:[],topics:[],messages:[],created:'2026-10-19T10:00:00Z',resources:{links:[{name:'Notebook',url:'https://example.invalid/notebook'}],rev:4,writer:'verified-writer',lid:'4'.repeat(32)}};
     const overview={me,person,people:[peer],peers:[],dms:[dm],threads:[],review:[],quarantine:[],needs_you:[],held:[],agent_devices:[],agents:false,files:{max_file:1048576,max_count:8},notify:{available:false},groups:true,group_invitations:[],links:[],schedules:true,topic_list:true,seq:1,version:'v0.9.0-working-tree'};
     let open;
     const host={version:1,platform:'daemon',workspace:{id:'fixture',handle:'9'.repeat(32)},workspaces:null,skins:[],onSkinsChange:()=>()=>{},listen:()=>()=>{},onOpen:fn=>{open=fn;},api:async(p,b)=>{
      if(b!==undefined){if(['/api/refresh','/api/typing','/api/act'].includes(p))return{};throw Error('Unexpected write '+p);}
      if(p.startsWith('/api/overview'))return structuredClone(overview);
      if(p.startsWith('/api/dm?id='))return structuredClone(dm);
      if(p.startsWith('/api/schedules'))return[{id:'5'.repeat(32),rev:7,conv:dm.id,topic:'',body:'Scheduled reference '.repeat(20),due:'2030-04-05T15:30:00Z',timezone:'UTC',state:'pending',audience:{conv:dm.id,topic:'',persons:['atlas','briar'],pids:[]},files:[]}];
      if(p.startsWith('/api/agents'))return{host:me.address,agents:[]};
      if(p.startsWith('/api/typing'))return{enabled:false,people:[]};
      if(p==='/api/workspace')return{can_rename:false};
      if(p==='/api/teams')return{status:'available',current:true,teams:[]};
      throw Error('Unexpected read '+p);
     }};
     window.skinModule=await import('/'+skin+'/entry.mjs');await skinModule.mount(app,host);await open(dm.id,'conversation');
    },skin);
    await page.getByRole('button',{name:'Conversation details',exact:true}).click();
    await page.locator('#dialog').getByRole('button',{name:'Shared links · 1',exact:true}).click();
    const field=page.getByRole('textbox',{name:'Link name',exact:true});
    await field.fill('Local draft stays editable');
    assert.equal(await field.inputValue(),'Local draft stays editable');
    assert.equal(await page.getByRole('button',{name:'Save links',exact:true}).isVisible(),true);
    const box=await field.boundingBox();assert(box.x>=0&&box.x+box.width<=390);
    await page.keyboard.press('Escape');
    if(skin==='classic')await page.getByRole('button',{name:'Back to conversations',exact:true}).click();
    await page.getByRole('button',{name:/^Outbox(?:,|$)/}).click();
    const outbox=page.getByRole('dialog',{name:'Outbox',exact:true});
    await outbox.getByRole('button',{name:'Scheduled',exact:true}).click();
    assert.equal(await outbox.getByRole('button',{name:'Edit schedule',exact:true}).count(),0,'Compact rows do not expose edit actions before selection');
    await outbox.getByRole('button',{name:/^View scheduled message:/}).click();
    await outbox.getByRole('button',{name:'Edit schedule',exact:true}).click();
    const date=page.getByLabel('Reschedule date',{exact:true}),time=page.getByLabel('Reschedule time',{exact:true});
    const originalDate=await date.inputValue();
    await time.fill('14:45');
    assert.equal(await date.inputValue(),originalDate,'Time-only editing must not change the date');
    assert.equal(await time.inputValue(),'14:45');
    for(const field of [date,time,page.getByRole('textbox',{name:'Scheduled message text',exact:true})]){
     const bounds=await field.boundingBox();
     assert(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.height>=44,'Scheduled fields must fit the phone and remain touch-sized under CSP');
    }
    assert.deepEqual(await page.evaluate(()=>violations),[]);assert.deepEqual(errors,[]);
   }finally{
    await page.evaluate(async()=>{const app=document.querySelector('#skin')?.shadowRoot?.querySelector('.skin-root');if(app&&window.skinModule)await skinModule.unmount(app);}).catch(()=>{});
    await context.close();
   }
  });
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
