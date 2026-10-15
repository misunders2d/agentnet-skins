import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const directory=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(process.env.AGENTNET_TOUCH_SOURCE||path.join(directory,'tests/touch.cjs'),'utf8');
const muteBlock=source.slice(source.indexOf('  const mute=async()=>'),source.indexOf("  await shot('chat');",source.indexOf('  const mute=async()=>')));
assert(muteBlock.includes('Mute from Conversation details changes the chat'));
const tapCode=source.slice(source.indexOf('async function tap('),source.indexOf('// inReach:'));
const waitCode=source.slice(source.indexOf('async function rootWait('),source.indexOf('const settled='));
const server=http.createServer((req,res)=>{
 const file=new URL(req.url,'http://fixture').pathname.slice(1);
 if(!file){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="skin"></div>');return;}
 if(!/^[a-z0-9.-]+$/.test(file)){res.writeHead(404).end();return;}
 try{
  const dir=path.join(directory,'skins/holonet');let bytes=file==='manifest.mjs'?'export default '+JSON.stringify({...JSON.parse(fs.readFileSync(path.join(dir,'skin.json'))),id:'qa-orbit',name:'QA Orbit'})+';':fs.readFileSync(path.join(dir,'src',file));
  if(file==='entry.mjs'){
   let text=bytes.toString(),start=text.indexOf('  $("conversation-details").addEventListener("click", () => {')+'  $("conversation-details").addEventListener("click", () => {'.length,end=text.indexOf('\n  });\n  $("nav-chats")',start);assert(start>0&&end>start);
   const body=text.slice(start,end);text=text.replace('const ready = start();','globalThis.fixture={state,renderHeader:()=>fill($("peer-chips"),...dmNotifyChips(state.dmData)),openDetails:()=>{'+body+'},reads:(overview,dm)=>{loadOverview=overview;loadDM=dm;}};const ready=Promise.resolve();');bytes=text;
  }
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/javascript');res.end(bytes);
 }catch(e){res.writeHead(404).end(e.message);}
});
let browser,origin;
async function scenario(mode){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await page.evaluate(async mode=>{
  const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),sheet=new CSSStyleSheet();sheet.replaceSync(await(await fetch('/style.css')).text());shadow.adoptedStyleSheets=[sheet];const root=document.createElement('div');root.className='skin-root';shadow.append(root);
  const me={address:'atlas/desk',fingerprint:'1'.repeat(32)},person={person:'atlas',label:'Atlas',state:'self',address:me.address,devices:[]},peer={person:'briar',label:'Briar',state:'pinned',address:'briar/phone',devices:[]};
  window.trace=[];window.calls=[];let mutes=[];
  const dm={id:'c'.repeat(64),kind:'dm',role:'member',peer,agents:[],guests:[],topics:[],messages:[]},overview={me,person,people:[peer],peers:[],dms:[],threads:[],review:[],links:[],held:[],agent_devices:[],files:{max_file:1024,max_count:1},notify:{available:true,mutes:[],allowed:[peer.address]}};
  const host={version:1,workspace:{id:'fixture',handle:'9'.repeat(32)},platform:'daemon',workspaces:{state:()=>({})},listen:()=>()=>{},onOpen:()=>{},api:async(p,b)=>{if(p!=='/api/notify/mute'||b.conv!==dm.id)throw Error('Unexpected fixture request');calls.push({...b});trace.push({event:'post',muted:b.muted,at:performance.now()});if(mode==='late'&&calls.length===1)await new Promise(r=>setTimeout(r,1400));if(mode!=='none')mutes=b.muted?[mode==='wrong'?'d'.repeat(64):dm.id]:[];trace.push({event:'accepted',muted:b.muted,at:performance.now()});return{};}};
  await(await import('/entry.mjs')).mount(root,host);for(const n of root.children)n.hidden=true;const area=document.createElement('section');root.append(area);area.append(root.querySelector('#conversation-details'),root.querySelector('#peer-chips'),root.querySelector('#dialog'));root.querySelector('#dialog').hidden=false;root.style.visibility='visible';
  Object.assign(fixture.state,{overview,dm:dm.id,dmData:dm,data:null,thread:null,files:[],draftKey:'dm:'+dm.id});fixture.reads(async()=>{overview.notify.mutes=[...mutes];trace.push({event:'overview',muted:mutes.includes(dm.id),at:performance.now()});},async()=>{fixture.renderHeader();trace.push({event:'header',label:root.querySelector('#peer-chips button')?.textContent,at:performance.now()});});fixture.renderHeader();root.querySelector('#conversation-details').addEventListener('click',fixture.openDetails);
 },mode);
 const result={taps:[],failures:[]},check=(ok,message)=>{if(!ok)result.failures.push(message);};const ctx={page,result,check,rootClass:'.holonet-root',assert};vm.createContext(ctx);vm.runInContext(tapCode+'\n'+waitCode,ctx);return{page,context,result,errors,run:()=>vm.runInContext('(async()=>{'+muteBlock+'})()',ctx)};
}
test('mute wait observes delayed real source state and restores inverse; missing or wrong state fails original bound',{skip:!process.env.AGENTNET_CHROMIUM},async()=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
 try{
  const late=await scenario('late');await late.run();assert.deepEqual(late.result.failures,[]);assert.deepEqual(await late.page.evaluate(()=>calls.map(c=>c.muted)),[true,false]);assert.deepEqual(await late.page.evaluate(()=>fixture.state.overview.notify.mutes),[]);assert.deepEqual(late.errors,[]);console.log('PASS delayed1400ms update: visible inverse dialog and restored current header; real touch/hit/44px checks');await late.context.close();
  for(const mode of ['none','wrong']){const s=await scenario(mode);await assert.rejects(s.run(),/15000ms exceeded/);assert.deepEqual(await s.page.evaluate(()=>calls.map(c=>c.muted)),[true]);assert.deepEqual(s.errors,[]);console.log('PASS '+mode+' target update refuses within original15000ms rootWait bound');await s.context.close();}
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
