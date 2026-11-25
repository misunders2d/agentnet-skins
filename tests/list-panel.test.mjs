import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT);
const collection=path.resolve(import.meta.dirname,'../dist'),shots=process.env.AGENTNET_SCREENSHOTS;
/* MEL-824/822 (next release after v0.11.9) in the standalone skins: the active Chats or People rail item hides and
   shows the desktop list column, a separator resizes it by keyboard and mouse within bounds, the open chat keeps its
   mounted composer, draft and staged file, width and hidden state stay in this browser only (no Host API call), and
   the phone is unchanged. QA Orbit is Holonet's code under its own manifest identity (npm run new-skin --standalone). */
const boot = `
const params=new URL(location).searchParams,skin=params.get('skin'),id='c'.repeat(64);
const me={person:'a'.repeat(32),label:'Atlas',address:'atlas/laptop',fingerprint:'11111111-11111111-11111111-11111111',state:'self',devices:[]};
const peers=['Briar','Cedar','Dune','Ember','Fjord','Grove','Heath','Iris','Juniper','Kestrel','Linden','Moss'].map((label,i)=>({person:String.fromCharCode(98+i).repeat(32),label,address:label.toLowerCase()+'/desk',fingerprint:'22222222-22222222-22222222-2222222'+i.toString(16),state:'pinned',devices:[]}));
const at=i=>new Date(Date.now()-i*3600e3).toISOString();
const chats=peers.map((peer,i)=>({id:i?String.fromCharCode(100+i).repeat(64):id,kind:'dm',title:peer.label,peer,role:'member',members:[me,peer],agents:[],guests:[],topics:[],last:'Note number '+i+' about the kiln schedule',last_at:at(i),
 messages:[{id:String(i+1).padStart(32,'0'),lid:String(i+1).padStart(32,'0'),kind:'message',dir:'in',from:peer.address,to:me.address,author:peer.label,body:'Hello from '+peer.label,at:at(i),reactions:[],can:['react']}]}));
let opened;window.fixture={open:()=>opened(id,'conversation')};const calls=window.calls=[];
const overview={version:'fixture',seq:1,topic_list:true,me,person:me,persons:true,groups:true,files:{max_file:1024,max_count:10},people:peers,threads:[],topics:[],dms:chats,directory:{current:true,members:[]},review:[],quarantine:[],links:[]};
const host={version:1,platform:'daemon',workspace:{id:'list-fixture',name:'List fixture',state:'enrolled',address:me.address},skins:[],onSkinsChange(){return()=>{}},onOpen:fn=>opened=fn,listen(){return()=>{}},
 api:async(p,b)=>{calls.push(b===undefined?'GET '+p:'POST '+p);if(p.startsWith('/api/overview'))return structuredClone(overview);if(p.startsWith('/api/dm?')){const c=chats.find(c=>p.includes(c.id));return structuredClone(c||chats[0]);}if(p.startsWith('/api/agents'))return{agents:[]};if(p.includes('/groups/invitations'))return[];if(p.startsWith('/api/typing/status'))return{send:false,scopes:[]};return{};}};
const base='/skin/'+skin+'/',manifest=await(await fetch(base+'skin.json')).json();
const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch(base+manifest.style)).text());shadow.adoptedStyleSheets=[style];const root=document.createElement('div');root.className='skin-root';shadow.append(root);
await(await import(base+manifest.entry)).mount(root,host);window.ready=true;
`;
// qa-orbit: Holonet's files under its own manifest (as new-skin --standalone writes it).
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100dvh}</style><div id="skin"></div><script type="module" src="/boot.mjs"></script>');}
 if(url.pathname==='/boot.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(boot);}
 const match=url.pathname.match(/^\/skin\/(classic|holonet|zoom|qa-orbit)\/(.+)$/);if(!match){res.writeHead(404);return res.end();}
 const dir=path.join(collection,match[1]==='qa-orbit'?'holonet':match[1]),file=path.resolve(dir,match[2]);if(!file.startsWith(dir+path.sep)){res.writeHead(403);return res.end();}
 try{
  let data=fs.readFileSync(file);
  if(match[1]==='qa-orbit'&&(match[2]==='skin.json'||match[2]==='manifest.mjs')){const m={...JSON.parse(fs.readFileSync(path.join(dir,'skin.json'))),id:'qa-orbit',name:'QA Orbit'};data=match[2]==='skin.json'?JSON.stringify(m):'export default '+JSON.stringify(m)+';';}
  res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
const ui=page=>{const shadow=page.locator('#skin');return{
 chats:shadow.locator('#nav-chats'),people:shadow.locator('#nav-people'),review:shadow.locator('#review-btn'),side:shadow.locator('.side'),
 sep:shadow.getByRole('separator',{name:'Resize the list'}),body:shadow.locator('#body'),search:shadow.locator('#search'),list:shadow.locator('#conv-list')};};
const width=async loc=>Math.round((await loc.boundingBox())?.width||0);
// Each local change is measured to its next frame in the page.
async function timed(page,label,act,ok,timings){const t0=await page.evaluate(()=>performance.now());await act();const ms=await page.evaluate(async t0=>{await new Promise(r=>requestAnimationFrame(r));return performance.now()-t0;},t0);assert.ok(await ok(),label);assert.ok(ms<1100,label+' took '+ms+' ms');timings.push(label+' '+ms.toFixed(0)+'ms');}

test('Classic, Holonet and QA Orbit hide, show and resize the desktop list column; Zoom and phones keep their layout',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});const timings=[],ran=[];
 try{
  for(const skin of ['classic','holonet','qa-orbit'])for(const [vw,vh,scheme] of [[1280,720,'light'],[1024,700,'dark'],[1920,1080,'light']]){
   const tag=skin+' '+vw,context=await browser.newContext({viewport:{width:vw,height:vh},colorScheme:scheme,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(String(e.stack)));
   await page.goto(origin+'/?skin='+skin);await page.waitForFunction(()=>window.ready);
   const u=ui(page);await page.evaluate(()=>fixture.open());await u.body.waitFor();
   await u.body.fill('Draft kept while the list hides');
   await page.locator('#skin #file-input').setInputFiles({name:'panel-note.txt',mimeType:'text/plain',buffer:Buffer.from('kept')});
   await page.locator('#skin #attach-list').getByText('panel-note.txt').waitFor();
   await u.body.evaluate(el=>{el.__mel824=true;});
   // Scroll the list a little so its kept scroll can be checked.
   await u.list.evaluate(el=>{el.scrollTop=40;});const scroll=await u.list.evaluate(el=>el.scrollTop);
   const initial=await width(u.side),defaultWidth=skin==='classic'?320:vw>1150?260:240;
   assert.equal(initial,defaultWidth,tag+': skin default width');
   assert.equal(await u.sep.getAttribute('aria-valuenow'),String(initial));assert.equal(await u.sep.getAttribute('aria-valuemin'),'240');
   assert.equal(await u.sep.getAttribute('aria-controls'),await u.side.getAttribute('id'));
   assert.equal(await u.side.getAttribute('data-part'),'list-panel');
   // MEL-822 compact rows and search, same readable type: names and previews keep their size, search text is at least 14px.
   const type=await page.locator('#skin .conv-item').first().evaluate(el=>{const s=n=>parseFloat(getComputedStyle(n).fontSize),q=el.getRootNode().querySelector('#search');return{name:s(el.querySelector('.conv-name')),last:s(el.querySelector('.conv-last')),search:s(q),searchHeight:q.getBoundingClientRect().height,row:el.getBoundingClientRect().height,avatar:el.querySelector('.avatar').getBoundingClientRect().width};});
   assert.ok(type.name>=14&&type.last>=13.5&&type.search>=14,tag+': readable type '+JSON.stringify(type));
   assert.ok(type.searchHeight<=37&&type.avatar<=32,tag+': compact search and avatars '+JSON.stringify(type));
   timings.push(tag+' type '+JSON.stringify(type));
   assert.equal(await u.chats.getAttribute('aria-expanded'),'true',tag+': active Chats is a toggle');assert.equal(await u.people.getAttribute('aria-expanded'),null,tag+': inactive People is not');
   if(shots)await page.screenshot({path:path.join(shots,'list-'+skin+'-'+vw+'-shown.png')});
   const callsBefore=await page.evaluate(()=>calls.length);
   const convBefore=await width(page.locator('#skin #conv'));

   await timed(page,tag+' hide',()=>u.chats.click(),async()=>(await u.chats.getAttribute('aria-expanded'))==='false'&&(await u.side.getAttribute('data-hidden'))===''&&(await u.side.getAttribute('aria-hidden'))==='true'&&await u.side.evaluate(el=>el.inert),timings);
   assert.ok(await width(page.locator('#skin #conv'))>=convBefore+initial-2,tag+': conversation takes the room');
   assert.equal(await u.side.evaluate(el=>getComputedStyle(el).visibility),'hidden');
   assert.equal(await u.chats.getAttribute('aria-current'),'page',tag+': still in Chats');
   assert.equal(await u.body.evaluate(el=>el.__mel824===true&&el.isConnected),true,tag+': same composer');
   assert.equal(await u.body.inputValue(),'Draft kept while the list hides');
   assert.equal(await page.locator('#skin #attach-list').getByText('panel-note.txt').count(),1,tag+': file kept');
   if(shots)await page.screenshot({path:path.join(shots,'list-'+skin+'-'+vw+'-hidden.png')});
   await timed(page,tag+' show',()=>u.chats.click(),async()=>(await u.chats.getAttribute('aria-expanded'))==='true'&&(await width(u.side))===initial&&!(await u.side.evaluate(el=>el.inert)),timings);
   assert.equal(await u.list.evaluate(el=>el.scrollTop),scroll,tag+': list scroll kept');

   // Keyboard: 16px, Shift 48px, Home/End bounds; the conversation keeps 440px.
   await u.sep.focus();
   await timed(page,tag+' key-right',()=>page.keyboard.press('ArrowRight'),async()=>(await u.sep.getAttribute('aria-valuenow'))===String(initial+16)&&(await width(u.side))===initial+16,timings);
   await timed(page,tag+' shift-left',()=>page.keyboard.press('Shift+ArrowLeft'),async()=>(await u.sep.getAttribute('aria-valuenow'))===String(Math.max(240,initial-32)),timings);
   await timed(page,tag+' home',()=>page.keyboard.press('Home'),async()=>(await u.sep.getAttribute('aria-valuenow'))==='240'&&(await width(u.side))===240,timings);
   const max=Number(await u.sep.getAttribute('aria-valuemax'));
   assert.ok(max>=240&&max<=480,tag+': max in bounds '+max);
   await timed(page,tag+' end',()=>page.keyboard.press('End'),async()=>Number(await u.sep.getAttribute('aria-valuenow'))===max&&(await width(u.side))===max,timings);
   assert.ok(await width(page.locator('#skin #conv'))>=440,tag+': conversation keeps 440px');
   // Mouse: drag left 100px, then past the lower bound.
   const box=await u.sep.boundingBox(),x=box.x+box.width/2,y=box.y+200;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-100,y,{steps:5});
   assert.ok(Math.abs(await width(u.side)-(max-100))<=2,tag+': follows the pointer');
   await page.mouse.move(x-600,y,{steps:3});await page.mouse.up();
   assert.equal(await width(u.side),240,tag+': stops at the lower bound');assert.equal(await u.sep.getAttribute('aria-valuenow'),'240');
   await timed(page,tag+' double-click reset',()=>u.sep.dblclick(),async()=>(await width(u.side))===initial&&(await u.sep.getAttribute('aria-valuenow'))===String(initial),timings);
   assert.equal(await u.body.evaluate(el=>el.__mel824===true&&el.isConnected),true,tag+': resizing kept the composer');

   // People: the other item opens its list; its active press hides it; Chats shows it again.
   await u.people.click();assert.equal(await u.people.getAttribute('aria-expanded'),'true');assert.equal(await u.chats.getAttribute('aria-expanded'),null);
   await u.people.click();assert.equal(await u.people.getAttribute('aria-expanded'),'false');assert.equal(await u.side.getAttribute('data-hidden'),'');
   await u.chats.click();assert.equal(await u.side.getAttribute('data-hidden'),null,tag+': the other rail item shows the list');assert.equal(await u.chats.getAttribute('aria-current'),'page');
   // Activity shows a hidden list (it lives in the column).
   await u.chats.click();await u.review.click();assert.equal(await u.side.getAttribute('data-hidden'),null,tag+': Activity shows the list');assert.equal(await page.locator('#skin #review').isVisible(),true);
   await u.review.click();
   // "/" focuses search even when the list was hidden.
   await u.chats.click();assert.equal(await u.side.getAttribute('data-hidden'),'');
   await page.locator('#skin #timeline').focus();await page.keyboard.press('/');
   assert.equal(await u.side.getAttribute('data-hidden'),null,tag+': / shows the list');
   assert.equal(await u.search.evaluate(el=>el.getRootNode().activeElement===el),true,tag+': / focuses search');
   assert.equal(await u.body.inputValue(),'Draft kept while the list hides',tag+': draft kept across sections');
   assert.deepEqual(await page.evaluate(n=>calls.slice(n).filter(c=>c.startsWith('POST')),callsBefore),[],tag+': no Host API writes');

   // Remembered in this browser only, under this skin's own key.
   await u.sep.focus();await page.keyboard.press('ArrowRight');await u.chats.click();
   const stored=await page.evaluate(k=>localStorage.getItem(k),skin+'.listPanel');
   assert.deepEqual(JSON.parse(stored),{width:initial+16,hidden:true},tag+': stored locally');
   for(const other of ['classic','holonet','qa-orbit'].filter(s=>s!==skin))if(await page.evaluate(k=>localStorage.getItem(k),other+'.listPanel')!==null&&other!==skin)assert.fail(tag+': wrote '+other);
   await page.reload();await page.waitForFunction(()=>window.ready);
   assert.equal(await u.side.getAttribute('data-hidden'),'',tag+': hidden remembered');
   assert.deepEqual(await page.evaluate(()=>calls.filter(c=>/list|panel|preferences/i.test(c))),[],tag+': no Host API load for the column');
   await u.chats.click();assert.equal(await width(u.side),initial+16,tag+': width remembered');
   await page.evaluate(k=>localStorage.removeItem(k),skin+'.listPanel');
   assert.deepEqual(errors,[],tag+': page errors');ran.push(tag);await context.close();
  }
  // Phones: tabs unchanged, no separator, a stored hidden state never hides the phone list.
  for(const skin of ['classic','holonet','qa-orbit','zoom']){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await context.addInitScript(k=>{try{localStorage.setItem(k,JSON.stringify({width:400,hidden:true}));}catch{}},skin+'.listPanel');
   await page.goto(origin+'/?skin='+skin);await page.waitForFunction(()=>window.ready);const u=ui(page);
   await u.chats.tap();await u.chats.tap();
   assert.equal(await u.sep.count(),0,skin+' phone: no separator');
   assert.equal(await u.chats.getAttribute('aria-expanded'),null,skin+' phone: Chats is not a toggle');
   if(skin!=='zoom'){assert.equal(await u.side.getAttribute('data-hidden'),null,skin+' phone: list shown');assert.equal(await u.side.evaluate(el=>el.inert),false);assert.ok(await width(u.side)>=380,skin+' phone: full width list');}
   if(shots)await page.screenshot({path:path.join(shots,'list-'+skin+'-390.png')});
   assert.deepEqual(errors,[]);ran.push(skin+' 390');await context.close();
  }
  // Zoom has no desktop list column (its Chats item steps out to the top level); compact rows only.
  {const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(origin+'/?skin=zoom');await page.waitForFunction(()=>window.ready);const u=ui(page);
   await u.chats.click();await u.chats.click();
   assert.equal(await u.sep.count(),0,'zoom: no separator');assert.equal(await u.chats.getAttribute('aria-expanded'),null,'zoom: Chats is not a toggle');
   assert.equal(await page.evaluate(()=>localStorage.getItem('zoom.listPanel')),null,'zoom: nothing stored');
   const zs=await page.locator('#skin .zoom-search').evaluate(el=>({h:el.getBoundingClientRect().height,f:parseFloat(getComputedStyle(el).fontSize)}));
   assert.ok(zs.h<=37&&zs.f>=14,'zoom: compact search, same type '+JSON.stringify(zs));
   await page.locator('#skin .zoom-search').fill('Briar');await page.locator('#skin .zoom-results button').first().waitFor();
   const zr=await page.locator('#skin .zoom-results button').first().evaluate(el=>({h:el.getBoundingClientRect().height,f:parseFloat(getComputedStyle(el.querySelector('.conv-name')||el).fontSize),cls:el.className}));
   assert.ok(zr.f>=14,'zoom: result name size '+JSON.stringify(zr));timings.push('zoom search '+JSON.stringify(zs)+' result '+JSON.stringify(zr));
   if(shots)await page.screenshot({path:path.join(shots,'list-zoom-1280-search.png')});
   if(shots)await page.screenshot({path:path.join(shots,'list-zoom-1280.png')});
   assert.deepEqual(errors,[]);ran.push('zoom 1280');await context.close();}
 }finally{await browser.close();await new Promise(r=>server.close(r));}
 console.log(timings.join('\n'));console.log('list panel rendered PASS: '+ran.join(', '));
});
