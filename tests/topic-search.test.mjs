import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');

test('standalone topic search crosses statuses in its existing scope',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://fixture');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Topic search fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const match=/^\/(classic|holonet|zoom)\/(topics\.mjs|person-topics\.mjs|style\.css)$/.exec(u.pathname);
  if(!match){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',match[2].endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(path.join(collection,'skins',match[1],'src',match[2])));
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of (process.env.AGENTNET_TEST_SKINS||'classic,holonet,zoom').split(','))for(const width of (process.env.AGENTNET_TEST_WIDTHS||'1280,390').split(',').map(Number))await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];let stage='mount';
   page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   try{
    await page.goto(origin);
    await page.evaluate(async skin=>{
     const root=document.querySelector('#skin'),shadow=root.attachShadow({mode:'open'}),css=new CSSStyleSheet();css.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[css];
     const inner=document.createElement('div');inner.className='skin-root '+skin+'-root';inner.style.cssText='height:100%;display:block;visibility:visible';shadow.append(inner);
     const {topicControls}=await import('/'+skin+'/topics.mjs'),states=['active','done','archived'];
     const topics=Array.from({length:52},(_,i)=>({id:(i+1).toString(16).padStart(32,'0'),title:'Needle '+String(i+1).padStart(2,'0'),state:states[i%3],count:i+1,last:'Exact authorized topic '+i,unread:i===1?2:0}));
     window.fixture={root:inner,topics,calls:[],chosen:[],roots:[],views:{},held:[],scope:{},module:topicControls};
     fixture.mount=(scope,person=null)=>{
      fixture.controls?.stop();inner.replaceChildren();const head=document.createElement('header');head.className='conv-head';head.textContent='Authorized conversation';inner.append(head);fixture.scope=scope;fixture.calls=[];fixture.chosen=[];fixture.held=[];
      const api=async(p,body)=>{
       if(body!==undefined)throw Error('Unexpected action '+p);const u=new URL(p,'http://host');fixture.calls.push(p);
       if(u.pathname==='/api/dm'&&person){const id=u.searchParams.get('id');if(!person.roots.some(r=>r.id===id))throw Error('Broader person scope');return structuredClone(fixture.views[id]);}
       if(u.pathname!=='/api/topics')throw Error('Unexpected endpoint '+p);
       const allowed=['state','q','limit','before',...Object.keys(scope)];for(const key of u.searchParams.keys())if(!allowed.includes(key))throw Error('Unexpected query '+key);for(const [key,value]of Object.entries(scope))if(u.searchParams.get(key)!==value)throw Error('Scope changed');
       if(u.searchParams.get('q')==='Old'){return new Promise(resolve=>fixture.held.push(()=>resolve({topics:[{id:'f'.repeat(32),title:'Stale old response',state:'active'}],next:''})));}
       const state=u.searchParams.get('state'),query=(u.searchParams.get('q')||'').trim().toLowerCase(),matches=topics.filter(t=>(!state||t.state===state)&&(t.title+' '+t.last).toLowerCase().includes(query));
       const offset=Number(u.searchParams.get('before')||0),limit=Number(u.searchParams.get('limit'));if(limit!==50)throw Error('Pagination changed');return{topics:matches.slice(offset,offset+limit),next:matches.length>offset+limit?String(offset+limit):''};
      };
      const controls=topicControls(inner,{api,choose:id=>fixture.chosen.push({id}),chooseRoot:(conv,topic)=>fixture.chosen.push({conv,topic}),fresh:()=>{},changed:()=>{},announce:()=>{}});fixture.controls=controls;controls.update(scope,topics,'',person);
     };
     fixture.mount({conv:'c'.repeat(64)});
    },skin);
    const dialog=page.getByRole('dialog',{name:'All topics'}),search=page.getByRole('searchbox',{name:'Search topics'}),rows=dialog.locator('.topic-row');
    const open=async()=>{await page.locator('.topics-bar').getByRole('button',{name:/^All(?: topics)?(?:[ (]|$)/}).click();await page.waitForFunction(()=>document.querySelector('#skin').shadowRoot.querySelector('.topics-list [role="status"]').textContent!=='Loading…');};
    const loaded=()=>page.waitForFunction(()=>document.querySelector('#skin').shadowRoot.querySelector('.topics-list [role="status"]').textContent!=='Loading…');
    stage='all-state baseline';await open();await search.fill('Needle');await loaded();
    assert.equal(await page.evaluate(()=>new URL(fixture.calls.at(-1),'http://host').searchParams.get('state')),'','search must use existing all-state query');
    assert.equal(await rows.count(),50);for(const state of ['active','done','archived'])assert(await rows.getByRole('button',{name:new RegExp(' · '+state+'$')}).count()>0);
    stage='paging and category toggles';await dialog.getByRole('button',{name:'Show more',exact:true}).click();await loaded();assert.equal(await rows.count(),52);assert.deepEqual(await page.evaluate(()=>fixture.calls.slice(-2).map(p=>{const q=new URL(p,'http://host').searchParams;return[q.get('state'),q.get('before')];})),[['',null],['','50']]);
    for(const name of ['Done','Archived']){await dialog.getByRole('button',{name,exact:true}).click();await loaded();assert.equal(await rows.count(),50);assert.equal(await page.evaluate(()=>new URL(fixture.calls.at(-1),'http://host').searchParams.get('state')),'');}
    await search.fill('   ');await loaded();assert.equal(await page.evaluate(()=>new URL(fixture.calls.at(-1),'http://host').searchParams.get('state')),'archived');assert.equal(await rows.count(),17);assert.equal(await rows.getByRole('button',{name:/ · archived$/}).count(),17);
    await search.fill('No such topic');await loaded();assert.match(await dialog.locator('.topics-rows').textContent(),/No topics match/i);assert.doesNotMatch(await dialog.textContent(),/No archived topics|try another status/i);
    stage='stale query response';await search.fill('Old');await page.waitForFunction(()=>fixture.held.length===1);await search.fill('Needle');await loaded();await page.evaluate(async()=>{fixture.held.shift()();await new Promise(requestAnimationFrame);});assert.equal(await rows.count(),50);assert.equal(await dialog.getByRole('button',{name:/Stale old response/}).count(),0);
    stage='selection and focus';await rows.getByRole('button',{name:'Needle 02 · done',exact:true}).click();await page.waitForFunction(()=>fixture.chosen.length===1);assert.equal(await dialog.count(),0);assert.deepEqual(await page.evaluate(()=>fixture.chosen),[{id:'2'.padStart(32,'0')}]);assert.equal(await page.evaluate(()=>{const r=document.querySelector('#skin').shadowRoot;return r.querySelector('.topics-bar').contains(r.activeElement);}),true);
    stage='DM group and direct scope';for(const scope of [{conv:'c'.repeat(64)},{conv:'d'.repeat(64)},{peer:'briar/agent-host'}]){await page.evaluate(scope=>fixture.mount(scope),scope);await open();await search.fill('Needle');await loaded();assert.equal(await rows.count(),50);assert.equal(await page.evaluate(()=>new URL(fixture.calls.at(-1),'http://host').searchParams.get('state')),'');await dialog.getByRole('button',{name:'Close',exact:true}).click();}
    if(skin!=='holonet'){
     stage='flat person all statuses';await page.evaluate(()=>{
      const a='a'.repeat(64),b='b'.repeat(64),roots=[{id:a,created:'2026-01-01',count:1,peer:{person:'briar'}},{id:b,created:'2026-01-02',count:3,peer:{person:'briar'}}];fixture.views={[a]:{id:a,messages:[{body:'Main'}],topics:fixture.topics.slice(0,3)},[b]:{id:b,messages:[{body:'Needle root',unread:true}],main_topic:{state:'archived'},topics:[]}};fixture.mount({conv:a},{roots,main:a,view:fixture.views[a]});
     });await open();await search.fill('Needle');await loaded();assert.equal(await rows.count(),4);for(const state of ['active','done','archived'])assert(await rows.getByRole('button',{name:new RegExp(' · '+state+'$')}).count()>0);await dialog.getByRole('button',{name:'Done',exact:true}).click();await loaded();assert.equal(await rows.count(),4);await search.fill('');await loaded();assert.equal(await rows.count(),1);assert.equal(await rows.getByRole('button',{name:/ · done$/}).count(),1);await search.fill('Needle');await loaded();await rows.getByRole('button',{name:'Needle 03 · archived',exact:true}).click();assert.deepEqual(await page.evaluate(()=>fixture.chosen.at(-1)),{conv:'a'.repeat(64),topic:'3'.padStart(32,'0')});
    }
    stage='close pending and cleanup';await page.evaluate(()=>fixture.mount({conv:'c'.repeat(64)}));await open();await search.fill('Old');await page.waitForFunction(()=>fixture.held.length===1);await search.press('Escape');assert.equal(await dialog.count(),0);await page.evaluate(async()=>{fixture.held.shift()();await new Promise(requestAnimationFrame);});assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>fixture.root.querySelector('.conv-head').inert||fixture.root.querySelector('.topics-bar').inert),false);
    await open();await search.fill('Needle');await loaded();
    assert.deepEqual(errors,[]);console.log(JSON.stringify({skin,width,allState:true,pagination:true,categoryWhileSearching:true,clearWhitespace:true,stale:true,scope:true,flatPerson:skin!=='holonet',selectionFocus:true,closePending:true}));
   }finally{t.diagnostic(skin+' '+width+' last stage: '+stage);if(process.env.AGENTNET_STEERING_EVIDENCE){fs.mkdirSync(process.env.AGENTNET_STEERING_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_STEERING_EVIDENCE,'topics-'+skin+'-'+width+'.png')});}await page.evaluate(()=>fixture.controls?.stop()).catch(()=>{});await context.close();}
  });
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
