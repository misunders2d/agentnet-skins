import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT);
const collection=path.resolve(import.meta.dirname,'../dist');
/* Big received files wait for a tap, as on Telegram (owner, November 1, 2026; AgentNet FileView.fetch, docs/UI_SKINS.md host.file). The download runs in AgentNet; the skin shows progress at once on the tap, follows held progress answers (never a timer), offers Retry after a failure, and says when the relay no longer has the file. */
const boot = `
const id='c'.repeat(64),mid='d'.repeat(32),skin=new URL(location).searchParams.get('skin');
const me={person:'a'.repeat(32),label:'Atlas',address:'atlas/laptop',fingerprint:'11111111-11111111-11111111-11111111',state:'self',devices:[]};
const peer={person:'b'.repeat(32),label:'Briar',address:'briar/desk',fingerprint:'22222222-22222222-22222222-22222222',state:'pinned',devices:[]};
const MB=1<<20,files=[{index:0,name:'clip.mp4',size:12*MB,openable:true,fetch:'wait'},{index:1,name:'notes.pdf',size:5*MB,openable:true,fetch:'wait'},{index:2,name:'old.bin',size:4*MB,openable:true,fetch:'wait'}];
const message={id:mid,lid:mid,kind:'message',dir:'in',from:peer.address,to:me.address,author:peer.label,body:'Three big files',at:new Date().toISOString(),reactions:[],can:['react'],attachments:files};
const chat={id,kind:'group',title:'Files chat',peer,role:'member',members:[me,peer],agents:[],guests:[],topics:[],messages:[message]};
let opened,listener;const f=window.fixture={open:()=>opened(id,'conversation'),calls:[],held:null,failOnce:true,
 release(){const r=f.held;f.held=null;r();}};
const overview={version:'fixture',seq:1,topic_list:true,me,person:me,persons:true,groups:true,files:{max_file:64*MB,max_count:10},people:[peer],threads:[],topics:[],dms:[chat],directory:{current:true,members:[]},review:[],quarantine:[],links:[]};
const changed=()=>{overview.seq++;listener?.({type:'change',seq:overview.seq});};
const step=ms=>new Promise(r=>setTimeout(r,ms));
async function files_(p,body){
 const m=p.match(/^\\/api\\/files\\/([^/]+)\\/(\\d+)\\/(fetch|progress)\\?dir=(in|out)(?:&after=(-?\\d+))?$/);if(!m||m[1]!==mid||m[4]!=='in')throw new Error('Unknown request.');
 const i=Number(m[2]),file=files[i],total=file.size+1024;f.calls.push(m[3]+' '+i+(m[5]===undefined?'':' after '+m[5])+(body?' body':''));
 if(m[3]==='fetch'){
  if(i===0)await new Promise(r=>f.held=r);
  if(i===1&&f.failOnce){f.failOnce=false;throw new Error('relay unreachable');}
  return {have:0,total,fetching:true};
 }
 await step(80);
 if(i===2)return {have:0,total,gone:true,error:'this file is no longer on the relay'};
 const have=Math.min(total,Number(m[5])+Math.ceil(total/4));
 if(have<total)return {have,total,fetching:true};
 delete file.fetch;setTimeout(changed,0);return {have:total,total,done:true};
}
const host={version:1,platform:'daemon',workspace:{id:'files-fixture',name:'Files fixture',state:'enrolled',address:me.address},skins:[],onSkinsChange(){return()=>{}},onOpen:fn=>opened=fn,listen(fn){listener=fn;return()=>{listener=null}},
 file:async()=>({bytes:new Uint8Array(0)}),
 api:async(p,body)=>{if(p.startsWith('/api/files/'))return files_(p,body);if(p.startsWith('/api/overview'))return structuredClone(overview);if(p.startsWith('/api/dm?'))return structuredClone(chat);if(p.startsWith('/api/agents'))return{agents:[]};if(p.includes('/groups/invitations'))return[];if(p.startsWith('/api/typing/status'))return{send:false,scopes:[]};return{};}};
const base='/skin/'+skin+'/',manifest=await(await fetch(base+'skin.json')).json();
if(manifest.document){const style=new CSSStyleSheet();style.replaceSync((await(await fetch(base+manifest.document)).text()).replaceAll('url(m/','url('+base+'m/'));document.adoptedStyleSheets=[style]}
const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch(base+manifest.style)).text());shadow.adoptedStyleSheets=[style];const root=document.createElement('div');root.className='skin-root';shadow.append(root);
await(await import(base+manifest.entry)).mount(root,host);window.ready=true;
`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100dvh}</style><div id="skin"></div><script type="module" src="/boot.mjs"></script>');}
 if(url.pathname==='/boot.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(boot);}
 const match=url.pathname.match(/^\/skin\/(classic|holonet|zoom)\/(.+)$/);if(!match){res.writeHead(404);return res.end();}
 const root=path.join(collection,match[1]),file=path.resolve(root,match[2]);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
test('Classic, Holonet and Zoom offer big received files for download with progress, Retry and gone states',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});const failures=[];
 try{for(const skin of ['classic','holonet','zoom'])for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:850},isMobile:width===390,hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/?skin='+skin);await page.waitForFunction(()=>window.ready);await page.evaluate(()=>fixture.open());
   const tap=l=>width===390?l.tap():l.click();
   /* Zoom lists a message's files on its details screen, opened from the bubble. */
   if(skin==='zoom')await tap(page.locator('.mini-chat .mc-bubble').first());
   const scope=page.locator(skin==='zoom'?'.skin-root':'#timeline');
   const clip=scope.getByRole('button',{name:'Download clip.mp4, 12.0 MB'});await clip.waitFor();
   assert.equal(await clip.textContent(),'Download · 12.0 MB');
   assert.equal(await scope.getByRole('button',{name:'Play video clip.mp4'}).count(),0,'no Play before the video is here');
   assert.equal(await scope.getByRole('button',{name:'Open'}).count(),0,'no Open before a file is here');
   if(width===390){const box=await clip.boundingBox();assert(box.width>=44&&box.height>=44,'Download is '+box.width+'x'+box.height+', under 44px');}
   /* The tap shows progress before AgentNet answered the request (it is held). */
   const t0=Date.now();await tap(clip);
   const bar=scope.locator('progress[aria-label="Downloading clip.mp4"]');await bar.waitFor();const feedback=Date.now()-t0;
   assert(await page.evaluate(()=>!!fixture.held),'the request was still unanswered when progress showed');
   assert(feedback<1000,'feedback took '+feedback+' ms');
   await page.evaluate(()=>fixture.release());
   await scope.getByRole('button',{name:'Play video clip.mp4'}).waitFor();
   assert.equal(await scope.getByRole('button',{name:'Download clip.mp4, 12.0 MB'}).count(),0,'Download · size left once the video is here');
   const clipCalls=(await page.evaluate(()=>fixture.calls)).filter(c=>/ 0( |$)/.test(c));
   const q=Math.ceil((12*2**20+1024)/4);
   assert.deepEqual(clipCalls,['fetch 0 body',...[0,q,2*q,3*q].map(a=>'progress 0 after '+a)],'one held progress request per step, from the bytes shown');
   /* A failed start says why and retries; the retried download ends with Open. */
   await tap(scope.getByRole('button',{name:'Download notes.pdf, 5.0 MB'}));
   await scope.getByText('Couldn’t download: relay unreachable').waitFor();
   await tap(scope.getByRole('button',{name:'Retry download notes.pdf'}));
   await scope.locator('.file',{hasText:'notes.pdf'}).getByRole('button',{name:'Open'}).waitFor();
   /* A file an admin's cleanup removed from the relay says so instead of offering a download forever. */
   await tap(scope.getByRole('button',{name:'Download old.bin, 4.0 MB'}));
   await scope.getByText('This file is no longer on the relay.').waitFor();
   assert.deepEqual(errors,[],'page errors');
  }catch(e){failures.push(skin+' '+width+': '+e.message);}finally{await page.close();}
 }}finally{await browser.close();server.close();}
 assert.deepEqual(failures,[]);
});
