import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const directory=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
 const m=/^\/(classic|zoom|holonet)\/([^/]+)$/.exec(u.pathname);if(!m){res.writeHead(404).end();return;}
 try{
  const base=path.join(directory,'skins',m[1]);
  let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(base,'skin.json'),'utf8')+';':fs.readFileSync(path.join(base,'src',m[2]));
  if(m[2]==='entry.mjs'){
   const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.toString().includes(needle));
   data=data.toString().replace(needle,'globalThis.fixture={state,showMentions,closeMentions,mentionKey,syncComposer,counts,threadFlag,renderReview,blockerWord,topicSelections'+(m[1]==='zoom'?',dmWriteDialog':'')+'};const ready=Promise.resolve();');
  }
  res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':m[2].endsWith('.svg')?'image/svg+xml':m[2].endsWith('.png')?'image/png':'text/javascript');res.end(data);
 }catch(e){res.writeHead(404).end(e.message);}
});
test('standalone attention labels and physical mention shortcut preserve existing picker and draft',{skip:!process.env.AGENTNET_CHROMIUM},async()=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of ['classic','holonet','zoom'])for(const width of [1280,390]){
   const platform=width===1280?'MacIntel':'Linux x86_64',context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack));await context.addInitScript(platform=>Object.defineProperty(navigator,'platform',{value:platform}),platform);
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin);
   await page.evaluate(async skin=>{
    const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];
    const root=document.createElement('div');root.className='skin-root';shadow.append(root);
    const me={address:'atlas/desk',fingerprint:'1'.repeat(32),agent:false},person={person:'atlas',label:'Atlas',state:'self',address:me.address,devices:[]},peer={person:'briar',label:'Briar',state:'pinned',address:'briar/phone',devices:[]};
    const agent={pid:'a'.repeat(32),agent_id:'b'.repeat(32),label:'Quill',host:{...person,fingerprint:me.fingerprint},host_here:true,state:'active',can_ask:true,can_task:true,tasks_from:[],shared:[],topic:null};
    window.dm={id:'c'.repeat(64),kind:'dm',role:'member',peer,members:[person,peer],agents:[agent],guests:[],topics:[],messages:[]};window.overview={me,person,people:[peer],peers:[],dms:[],threads:[],review:[],links:[],held:[],needs_you:[],agent_devices:[],agents:true,files:{max_file:1048576,max_count:8}};window.posts=[];
    const saved={},host={version:1,workspace:{id:'default',handle:'9'.repeat(32)},platform:'daemon',workspaces:{state:()=>saved},listen:()=>()=>{},onOpen:()=>{},api:async(p,body)=>{if(body!==undefined){posts.push({p,body});throw Error('Unexpected fixture write '+p);}if(p==='/api/teams')return{teams:[]};if(p==='/api/workspace')return{};throw Error('Unexpected fixture read '+p);}};
    await(await import('/'+skin+'/entry.mjs')).mount(root,host);for(const n of root.children)n.hidden=true;
    const area=document.createElement('section');root.append(area);area.append(root.querySelector('#composer'),root.querySelector('#dialog'));root.querySelector('#dialog').hidden=false;
    Object.assign(fixture.state,{overview,dm:dm.id,dmData:dm,draftKey:'dm:'+dm.id,files:[],dmReply:null,answering:null,data:null,thread:null,teams:[]});
    root.querySelector('#body').addEventListener('keydown',fixture.mentionKey);root.querySelector('#mention-button').addEventListener('click',()=>{fixture.showMentions(true);root.querySelector('#body').focus();});root.style.visibility='visible';fixture.syncComposer();
    window.labels=(()=>{const nodes=fixture.counts({review:2,unread:0,notices:0}).filter(Boolean);fixture.state.overview.needs_you=[{id:'d'.repeat(32),conv:dm.id,reason:'agent_needs_human',why:'A runtime prerequisite is unavailable.'}];fixture.renderReview([]);const result={badge:nodes[0].textContent,title:nodes[0].title,thread:fixture.threadFlag({review:2}).textContent,review:root.querySelector('#review-btn').getAttribute('aria-label'),n:root.querySelector('#review-count').textContent,word:fixture.blockerWord.needs_human,rows:root.querySelector('#review-list').textContent};fixture.state.overview.needs_you=[];return result;})();
    window.prepare=kind=>{root.querySelector('#dialog').close();fixture.closeMentions();dm.kind=kind==='dm'?'dm':'group';dm.title='Harbor';fixture.topicSelections[dm.id]=kind==='topic'?'e'.repeat(32):'';fixture.syncComposer();if(skin==='zoom')fixture.dmWriteDialog(dm);};
    window.snapshot=()=>{const input=root.querySelector(skin==='zoom'?'#write-body':'#body');return{text:input.value,start:input.selectionStart,end:input.selectionEnd,focus:shadow.activeElement===input,topic:fixture.topicSelections[dm.id]};};
   },skin);
   const field=page.locator(skin==='zoom'?'#write-body':'#body'),box=page.locator(skin==='zoom'?'#write-mentions':'#mentions');
   for(const kind of ['dm','group','topic']){
    await page.evaluate(kind=>prepare(kind),kind);await field.fill('keep selected text');await field.evaluate(el=>{el.setSelectionRange(5,13);el.focus();});const before=await page.evaluate(()=>snapshot());
    await page.locator(skin==='zoom'?'#write-agent-target button':'#mention-button').last().click();const options=await box.locator('button').allTextContents();assert(options.some(t=>t.includes('Briar')),skin+' existing candidates '+JSON.stringify(options));await field.press('Escape');
    for(const chord of ['Control+Digit2','Meta+Digit2']){await field.press(chord);assert.equal(await box.evaluate(el=>!el.hidden),true,skin+' '+kind+' '+width+' '+chord);assert.deepEqual(await box.locator('button').allTextContents(),options);assert.deepEqual(await page.evaluate(()=>snapshot()),before);await field.press('Escape');}
    const keys=await field.evaluate(el=>{
     const send=init=>{const e=new KeyboardEvent('keydown',{key:'2',code:'Digit2',bubbles:true,cancelable:true,...init});el.dispatchEvent(e);return e.defaultPrevented;};
     const ignored=[{}, {ctrlKey:true,altKey:true}, {ctrlKey:true,shiftKey:true}, {ctrlKey:true,code:'Numpad2'}, {ctrlKey:true,isComposing:true}, {ctrlKey:true,keyCode:229}].map(send);
     const layout=send({key:'і',ctrlKey:true});fixture.closeMentions();return{ignored,layout};
    });assert.deepEqual(keys,{ignored:[false,false,false,false,false,false],layout:true});assert.deepEqual(await page.evaluate(()=>snapshot()),before);
    await field.press('2');assert.equal(await field.inputValue(),'keep 2 text');assert.equal(await box.evaluate(el=>el.hidden),true);
   }
   const hint=await page.locator('#mention-button').evaluate(el=>({title:el.title,keys:el.getAttribute('aria-keyshortcuts')}));assert(hint.title.includes(width===1280?'⌘2':'Ctrl+2'));assert.equal(hint.keys,width===1280?'Meta+2':'Control+2');
   assert.deepEqual(await page.evaluate(()=>labels),{badge:'2 need attention',title:'Needs attention here',thread:'2 needs attention',review:'1 item needs attention',n:'1',word:'needs attention',rows:await page.evaluate(()=>labels.rows)});assert(!/needs your answer|needs your decision/.test(await page.evaluate(()=>labels.rows)));
   const guarded=await page.evaluate(skin=>{const input=document.querySelector('#skin').shadowRoot.querySelector(skin==='zoom'?'#write-body':'#body');const check=()=>{const e=new KeyboardEvent('keydown',{code:'Digit2',ctrlKey:true,bubbles:true,cancelable:true});input.dispatchEvent(e);return e.defaultPrevented;};fixture.state.sending=true;const sending=check();fixture.state.sending=false;fixture.state.dm=null;const noDM=check();fixture.state.dm=dm.id;dm.role='human_guest';fixture.syncComposer();const guest=check();return{sending,noDM,guest,posts:posts.length};},skin);assert.deepEqual(guarded,{sending:false,noDM:false,guest:false,posts:0});assert.deepEqual(errors,[]);await context.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
