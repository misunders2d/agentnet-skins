import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT);

test('Zoom reveals the current pending send once, without moving other chats or topics',async()=>{
 const source=fs.readFileSync(process.env.AGENTNET_ZOOM_SEND_SOURCE||new URL('../skins/zoom/src/entry.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function startSend('),end=source.indexOf('\nfunction failSend(',start);
 const a=source.indexOf('  refresh() {',source.indexOf('const Zoom =')),b=source.indexOf('\n  // results is',a);
 assert(start>=0&&end>start&&a>=0&&b>a);
 const send=source.slice(start,end),refresh=source.slice(a,b).trim().replace(/^refresh\(\)/,'function refresh()').replace(/,$/,'');
 const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});
 try{for(const width of [390,1440])for(const mode of ['thread','dm']){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.setContent('<main id="root"><button id="send">Send</button><textarea id="body" aria-label="Message"></textarea><input aria-label="Unrelated draft"><div id="zoom"></div></main>');
  await page.addStyleTag({content:'.zoom-content{height:440px;overflow:auto;border:1px solid} .row{height:40px;margin:0;padding:4px;box-sizing:border-box}button{min-height:44px}'});
  await page.addScriptTag({content:`
 const root=document.getElementById('root'),$=id=>document.getElementById(id);let alive=true,currentHost={};
 const view={id:'chat',peer:'peer',messages:[]},dmLoadViews=new WeakMap([[view,{host:currentHost}]]),topicSelections={chat:'one'};
 const state={draftKey:'current',data:view,dm:${mode==='dm'?"'chat'":'null'},dmData:view,dmAgent:null,files:[],overview:{me:{address:'self/fixture'}},readVisit:null};
 const retireVisibleRead=()=>{},syncVisibleRead=()=>{},placeUnreadDivider=()=>{},focusZoomLayer=()=>{},groupContextWaiting=()=>false;
 const grow=()=>{},setDMReply=()=>{},setAnswering=()=>{},setDMAgent=()=>{},renderPending=()=>{},keepDraft=()=>{},syncComposer=()=>{};
 const fill=(node,child)=>node.replaceChildren(child);const rows=[];
 const Zoom={generation:1,navigating:null,level:2,person:${mode==='dm'?"'person'":'null'},dm:'chat',peer:'peer',revealEnd:false,query:'',layer(){const layer=document.createElement('div');layer.className='zoom-layer';const content=document.createElement('div');content.className='zoom-content';for(const value of rows){const p=document.createElement('p');p.className='row';p.textContent=value;content.append(p)}layer.append(content);return layer}};
 ${refresh};Zoom.refresh=refresh;
 const sends={begin(key,m){if(key==='current'&&(!state.dm||m.topic==='one'))rows.push(m.body);Zoom.refresh()}};
 ${send}
 const submit=(key='current',topic='one')=>startSend(key,$('body').value,[],null,null,view,'message',()=>{},'pending',topic);
 window.fixture={reset(count){rows.splice(0,rows.length,...Array.from({length:count},(_,i)=>'Earlier message '+i));Zoom.revealEnd=false;fill($('zoom'),Zoom.layer());const c=$('zoom').querySelector('.zoom-content');c.scrollTop=(c.scrollHeight-c.clientHeight)/2;$('body').value='Pending local message'},submit,refresh:()=>Zoom.refresh()};$('send').onclick=()=>submit();
 `});
  for(const count of [100,1000]){
   await page.evaluate(n=>fixture.reset(n),count);await page.getByRole('textbox',{name:'Unrelated draft'}).fill('Keep reading position');
   const start=Date.now();await page.getByRole('button',{name:'Send',exact:true}).click();
   await page.waitForFunction(()=>{const row=[...document.querySelectorAll('.row')].find(n=>n.textContent==='Pending local message'),c=document.querySelector('.zoom-content'),r=row?.getBoundingClientRect(),b=c.getBoundingClientRect();return r&&r.top>=b.top&&r.bottom<=b.bottom;},null,{timeout:500,polling:'raf'});assert(Date.now()-start<500);
   assert.equal(await page.locator('#body').inputValue(),'');
   await page.evaluate(()=>document.querySelector('.zoom-content').scrollTop=400);await page.evaluate(()=>fixture.refresh());assert.equal(await page.locator('.zoom-content').evaluate(c=>c.scrollTop),400,'later synchronization cannot repeat send scrolling');
   await page.evaluate(()=>fixture.submit('other'));assert.equal(await page.locator('.zoom-content').evaluate(c=>c.scrollTop),400,'another chat retry cannot move this reader');
   if(mode==='dm'){await page.evaluate(()=>fixture.submit('current','other-topic'));assert.equal(await page.locator('.zoom-content').evaluate(c=>c.scrollTop),400,'another topic retry cannot move this reader')}
   assert.equal(await page.getByRole('textbox',{name:'Unrelated draft'}).inputValue(),'Keep reading position');
  }
  console.log('Zoom '+mode+' '+width+': pending row in viewport under 500ms at 100/1000 rows; later sync and other targets retain scroll');await page.close();
 }}finally{await browser.close()}
});
