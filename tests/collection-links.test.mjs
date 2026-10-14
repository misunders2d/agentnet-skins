import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const root=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url);

test('standalone portable links preserve exact local destinations and drafts',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);if(!m){res.statusCode=404;res.end();return;}
  try{
   let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(root,'skins',m[1],'skin.json'),'utf8'):fs.readFileSync(path.join(root,'skins',m[1],'src',m[2]));
   if(m[2]==='entry.mjs'){
    data=data.toString();const start=data.indexOf('function start() {')+'function start() {'.length,end=data.indexOf('  $("nav-chats").addEventListener',start);
    assert(end>start);const wiring=data.slice(start,end),needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.includes(needle));
    data=data.replace(needle,'globalThis.fixture={state,topicSelections,topicFresh,bodyOf'+(m[1]==='zoom'?',Zoom':'')+'};'+wiring+(m[1]==='zoom'?'':'const ready=Promise.resolve();'));
   }
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.statusCode=404;res.end(String(e));}
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of ['classic','holonet','zoom'].filter(s=>!process.env.AGENTNET_LINK_SKIN||s===process.env.AGENTNET_LINK_SKIN))for(const width of [1120,390])await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(4000);
   page.on('pageerror',e=>errors.push(e.stack));await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin);
   try{
    await page.evaluate(async skin=>{
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];
     const app=document.createElement('div');app.className='skin-root';shadow.append(app);
     const me={person:'atlas',label:'Atlas',state:'self',address:'atlas/desk',devices:[]},peer={person:'briar',label:'Briar',state:'pinned',address:'briar/phone',devices:[]};
     window.ids={realm:'1'.repeat(32),old:'a'.repeat(64),conv:'c'.repeat(64),topic:'b'.repeat(32),root:'d'.repeat(32),later:'e'.repeat(32)};
     window.calls=[];window.copies=[];window.linkTargets=[];window.opened=[];window.revoked=[];window.failOpen=false;
     Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>copies.push(text)}});
     URL.revokeObjectURL=url=>revoked.push(url);
     const message=(id,body,topic='')=>({id,dir:'in',from:peer.address,body,kind:'message',topic,at:'2026-10-11T09:02:32Z',actions:[],can:[],author:{label:'Briar',about:'Fixture author'}});
     const uri=target=>'agentnet://open#realm='+ids.realm+('&'+new URLSearchParams(target));
     window.overview={me:{address:me.address,fingerprint:'atlas-key',agent:false},person:me,people:[peer],threads:[],dms:[],review:[],peers:[]};
     window.views={};
     const host={version:1,workspace:{id:'fixture',realm:ids.realm},listen(){return()=>{}},onOpen(fn,kinds){window.handler=fn;window.kinds=kinds;},linkTo(target){linkTargets.push(structuredClone(target));return uri(target);},async openLink(value){opened.push(value);if(failOpen)throw Error('Exact destination unavailable.');const q=new URLSearchParams(value.split('#')[1]);return q.has('thread')?handler(q.get('thread'),'thread',{}):handler(q.get('conv'),'topic',{topic:q.get('topic')});},api:async(p,body)=>{
      calls.push({path:p,...body===undefined?{}:{body:structuredClone(body)}});
      if(body!==undefined)throw Error('Unexpected mutation '+p);
      if(p==='/api/overview')return structuredClone(overview);
      if(p.startsWith('/api/dm?id=')||p.startsWith('/api/thread?id=')){const id=new URLSearchParams(p.split('?')[1]).get('id');if(!views[id])throw Error('Not available on this device.');return structuredClone(views[id]);}
      if(p.startsWith('/api/typing?'))return {current:false,supported:false};
      if(p.startsWith('/api/agents'))return {agents:[]};
      throw Error('Unexpected read '+p);
     }};
     window.testHost=host;await(await import('/'+skin+'/entry.mjs')).mount(app,host);
     window.prepare=(options={})=>{
      views[ids.old]={id:ids.old,kind:'dm',peer,members:[me,peer],agents:[],guests:[],topics:[],messages:[message('f'.repeat(32),'Old chat')]};
      views[ids.conv]={id:ids.conv,kind:options.kind||'group',title:'Harbor group',peer,members:[me,peer],agents:[],guests:[],topics:[{id:ids.topic,title:'Invoice topic',state:'active'}],messages:[message(ids.topic,'**Named destination**',ids.topic),message('9'.repeat(32),'Main destination')],...options};
      views[ids.root]={id:ids.root,peer:peer.address,key:{pinned:'briar-key'},topic:{id:ids.root,title:'Legacy exact root',state:'active'},messages:[message(ids.root,'Legacy root'),message(ids.later,'Later reply')]};
      const file=new File(['keep these bytes'],'keep.txt',{type:'text/plain'}),files=[{file,name:file.name,size:file.size,url:'blob:fixture-kept',staged:'opaque-fixture-stage'}],reply=views[ids.old].messages[0];
      Object.assign(fixture.state,{overview:options.cold?null:structuredClone(overview),dm:ids.old,dmData:views[ids.old],thread:null,data:null,draftKey:'dm:'+ids.old,drafts:{},files,messageOpening:null,dmAgent:'selected-agent',deviceAgentID:'chosen-agent-id',dmReply:reply,answering:null});
      fixture.topicSelections[ids.old]='';fixture.topicSelections[ids.conv]='';fixture.topicFresh[ids.conv]=false;
      if(options.pending)fixture.state.messageOpening={conv:ids.conv,own:false,waiting:true,ref:{id:'9'.repeat(32),dir:'in'}};
      app.querySelector('#body').value='Unsent **literal** draft';app.querySelector('#dialog').close();
      if(fixture.Zoom){Object.assign(fixture.Zoom,{level:2,dm:ids.old,person:'briar',peer:null,navigating:null,query:''});app.querySelector('#zoom').replaceChildren(...(options.cold?[]:[fixture.Zoom.layer()]));}
      const detail=app.querySelector('#conversation-details');if(!fixture.Zoom)for(let n=detail;n&&n!==app;n=n.parentElement)n.hidden=false;detail.disabled=false;app.classList.add('show-conv');
      const panel=app.querySelector('#link-fixture')||app.appendChild(Object.assign(document.createElement('section'),{id:'link-fixture'}));
      const link=uri({conv:ids.conv,topic:ids.topic});panel.replaceChildren(fixture.bodyOf(message('8'.repeat(32),'[Open exact topic]('+link+')\n\n`[Code]('+link+')`\n\n\\[Escaped]('+link+')\n\n[Unsafe](javascript:alert(1)) <script>globalThis.BAD=1</script>\n\nhttps://example.invalid/external?payload='+('keep'.repeat(30)))));
      window.kept={files,file,reply,view:fixture.state.dmData,drafts:fixture.state.drafts,overview:fixture.state.overview,body:app.querySelector('#body').value};
      calls.length=0;copies.length=0;linkTargets.length=0;opened.length=0;revoked.length=0;
     };
     window.same=()=>{const s=fixture.state;return s.files===kept.files&&s.files[0].file===kept.file&&s.files[0].staged==='opaque-fixture-stage'&&s.dmReply===kept.reply&&s.dmData===kept.view&&s.drafts===kept.drafts&&s.overview===kept.overview&&s.dm===ids.old&&s.thread===null&&s.dmAgent==='selected-agent'&&s.deviceAgentID==='chosen-agent-id'&&fixture.topicSelections[ids.old]===''&&fixture.topicSelections[ids.conv]===''&&fixture.topicFresh[ids.conv]===false&&app.querySelector('#body').value===kept.body&&!revoked.length;};
     window.land=async(id,kind,context)=>{const promise=handler(id,kind,context);if(!(promise instanceof Promise))throw Error('Handler did not return a promise');await promise;};
     window.copiedTargets=()=>linkTargets;
     prepare();
    },skin);
    await page.evaluate(()=>document.querySelector('#skin').shadowRoot.querySelector('#conversation-details').click());
    const before=await page.evaluate(()=>({kinds,copyButtons:[...document.querySelector('#skin').shadowRoot.querySelectorAll('button')].filter(n=>/^Copy (chat|topic) link$/.test(n.textContent)).map(n=>n.textContent),portable:document.querySelector('#skin').shadowRoot.querySelectorAll('a[href^="agentnet://open#"]').length}));
    console.log(JSON.stringify({skin,width,...before}));
    assert(before.kinds.includes('topic'));assert(before.kinds.includes('thread'));assert.deepEqual(before.copyButtons,['Copy chat link','Copy topic link']);assert.equal(before.portable,1);
    await page.locator('#dialog-ok').click();
    // Invalid exact destinations reject before any view/draft/selection/File mutation.
    const failures=await page.evaluate(async()=>{
     const results=[];
     for(const options of [{missing:true},{wrongID:true},{topic:'7'.repeat(32)},{role:'visitor',main:true},{role:'human_guest',main:true},{frozen:'Removed from chat'}]){
      prepare(options);if(options.missing)delete views[ids.conv];if(options.wrongID)views[ids.conv].id=ids.old;
      let error='';try{await land(ids.conv,'topic',{topic:options.main?'main':options.topic||ids.topic});}catch(e){error=e.message;}
      results.push({error,kept:same(),writes:calls.filter(c=>c.body).length});
     }
     for(const root of [ids.later,'6'.repeat(32)]){prepare();views[root]={...views[ids.root],id:root};let error='';try{await land(root,'thread',{});}catch(e){error=e.message;}results.push({error,kept:same(),writes:calls.filter(c=>c.body).length});}
     return results;
    });
    for(const result of failures){assert(result.error);assert(result.kept);assert.equal(result.writes,0);}
    // Both warm and cold, and group, human DM and named assistant DM identities.
    for(const options of [{},{pending:true},{cold:true},{kind:'dm'},{kind:'dm',agent_id:'2'.repeat(32)},{role:'visitor',main_topic:true},{role:'human_guest',main_topic:true}]){
     const result=await page.evaluate(async options=>{prepare(options);const topic=options.main_topic?'main':ids.topic;await land(ids.conv,'topic',{topic});const s=fixture.state,d=s.drafts['dm:'+ids.old];return {id:s.dm,topic:fixture.topicSelections[s.dm],body:s.dmData.messages.map(m=>m.body),draft:d.text,fileSame:d.files===kept.files&&d.files[0].file===kept.file&&d.files[0].staged==='opaque-fixture-stage',replySame:d.reply===kept.reply,agent:d.agent,revoked,paths:calls.map(c=>c.path)};},options);
     assert.equal(result.id,'c'.repeat(64));assert.equal(result.topic,options.main_topic?'':'b'.repeat(32));assert.equal(result.draft,'Unsent **literal** draft');assert(result.fileSame);assert(result.replySame);assert.equal(result.agent,'selected-agent');assert.deepEqual(result.revoked,[]);assert(!result.paths.some(p=>/refresh|history|notify\/resolve/.test(p)));
    }
    const namedScoped=await page.evaluate(async()=>{const out=[];for(const role of ['visitor','human_guest']){prepare({role});await land(ids.conv,'topic',{topic:ids.topic});out.push(fixture.topicSelections[ids.conv]);}return out;});assert.deepEqual(namedScoped,['b'.repeat(32),'b'.repeat(32)]);
    const legacy=await page.evaluate(async()=>{prepare();await land(ids.root,'thread',{});return {id:fixture.state.thread,dm:fixture.state.dm,paths:calls.map(c=>c.path)};});assert.equal(legacy.id,'d'.repeat(32));assert.equal(legacy.dm,null);assert(!legacy.paths.some(p=>/refresh|history|notify\/resolve/.test(p)));
    // Reachable existing details menu uses the selected exact identities.
    for(const type of ['group','dm','agent','legacy']){
     await page.evaluate(async type=>{prepare({kind:type==='group'?'group':'dm'});await land(type==='legacy'?ids.root:ids.conv,type==='legacy'?'thread':'topic',{topic:ids.topic});},type);
     await page.getByRole('button',{name:'Conversation details',exact:true}).click();await page.getByRole('button',{name:'Copy chat link',exact:true}).click();
     if(type!=='legacy')await page.getByRole('button',{name:'Copy topic link',exact:true}).click();
     const targets=await page.evaluate(()=>({targets:copiedTargets(),copies}));
     assert.deepEqual(targets.targets,type==='legacy'?[{thread:'d'.repeat(32)}]:[{conv:'c'.repeat(64),topic:'main'},{conv:'c'.repeat(64),topic:'b'.repeat(32)}]);assert(targets.copies.every(x=>x.startsWith('agentnet://open#realm='+'1'.repeat(32)+'&')));
     await page.locator('#dialog-ok').click();
    }
    await page.evaluate(async()=>{prepare();await land(ids.conv,'topic',{topic:ids.topic});fixture.topicFresh[ids.conv]=true;});
    await page.getByRole('button',{name:'Conversation details',exact:true}).click();assert(await page.getByRole('button',{name:'Copy topic link',exact:true}).isDisabled());assert(!(await page.getByRole('button',{name:'Copy chat link',exact:true}).isDisabled()));await page.locator('#dialog-ok').click();
    await page.evaluate(async()=>{prepare({role:'visitor'});await land(ids.conv,'topic',{topic:ids.topic});});
    await page.getByRole('button',{name:'Conversation details',exact:true}).click();assert(await page.getByRole('button',{name:'Copy chat link',exact:true}).isDisabled());assert(!(await page.getByRole('button',{name:'Copy topic link',exact:true}).isDisabled()));await page.locator('#dialog-ok').click();
    await page.evaluate(()=>{prepare();window.savedLinkTo=testHost.linkTo;delete testHost.linkTo;});await page.getByRole('button',{name:'Conversation details',exact:true}).click();assert.equal(await page.getByRole('button',{name:/^Copy (chat|topic) link$/}).count(),0);await page.locator('#dialog-ok').click();await page.evaluate(()=>{testHost.linkTo=savedLinkTo;});
    await page.evaluate(()=>prepare());await page.locator('#link-fixture a[href^="agentnet://open#"]').click();await page.waitForFunction(()=>fixture.state.dm===ids.conv);
    assert.deepEqual(await page.evaluate(()=>opened),['agentnet://open#realm='+'1'.repeat(32)+'&conv='+'c'.repeat(64)+'&topic='+'b'.repeat(32)]);
    await page.evaluate(()=>{prepare();failOpen=true;});await page.locator('#link-fixture a[href^="agentnet://open#"]').click();await page.waitForFunction(()=>document.querySelector('#skin').shadowRoot.querySelector('#live').textContent==='Exact destination unavailable.');assert(await page.evaluate(()=>same()));
    const external=await page.evaluate(()=>{const root=document.querySelector('#skin').shadowRoot;const a=root.querySelector('#link-fixture a[href^="https://example.invalid/external"]');if(!a)throw Error('Rendered external link missing');let prevented;root.querySelector('.skin-root').addEventListener('click',e=>{prevented=e.defaultPrevented;e.preventDefault();},{once:true});a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return {prevented,href:a.href,target:a.target,bad:globalThis.BAD};});assert.equal(external.prevented,false);assert.equal(external.href,'https://example.invalid/external?payload='+('keep'.repeat(30)));assert.equal(external.target,'_blank');assert.equal(external.bad,undefined);assert.deepEqual(errors,[]);
    if(process.env.AGENTNET_SCREENSHOTS){await page.evaluate(async()=>{prepare();await land(ids.conv,'topic',{topic:ids.topic});failOpen=false;});await page.getByRole('button',{name:'Conversation details',exact:true}).click();fs.mkdirSync(process.env.AGENTNET_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,skin+'-links-'+width+'.png'),fullPage:true});}
   }finally{await context.close();}
  });
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
