import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT);
const collection=path.resolve(import.meta.dirname,'../dist');
const boot = `
const source='c'.repeat(64),other='d'.repeat(64),skin=new URL(location).searchParams.get('skin'),nativeMode=new URL(location).searchParams.has('native'),nativeListeners=new Set();
const me={person:'a'.repeat(32),label:'Atlas',address:'atlas/laptop',fingerprint:'11111111-11111111-11111111-11111111',state:'self',devices:[]};
const peer={person:'b'.repeat(32),label:'Briar',address:'briar/desk',fingerprint:'22222222-22222222-22222222-22222222',state:'pinned',devices:[]};
const chat=id=>({id,kind:'group',title:id===source?'Drop fixture':'Other chat',peer,role:'member',members:[me,peer],agents:[],guests:[],topics:[],messages:[{id:'1'.repeat(32),lid:'1'.repeat(32),kind:'message',dir:'in',from:peer.address,to:me.address,author:peer.label,body:'Exact reaction target',at:'2026-10-28T10:00:00Z',reactions:[],can:['react']}]});
const threads={[source]:chat(source),[other]:chat(other)};
let opened,changed;const f=window.fixture={uploads:[],writes:[],reads:[],discards:[],open:id=>opened(id,'conversation')};
f.nativeDrop=(names,point)=>{const files=names.map(name=>({name,read:()=>new Promise((resolve,reject)=>f.reads.push({name,resolve,reject})),discard:()=>f.discards.push(name)}));for(const fn of [...nativeListeners].reverse())if(fn({...point,files}))return true;return false};
f.finishRead=(index,fail=false)=>{const read=f.reads[index];if(fail)read.reject(Error('Invented native read failure'));else read.resolve(new File([new Uint8Array([4,5,6])],read.name,{type:'text/plain'}))};
const overview={version:'fixture',seq:1,topic_list:true,me,person:me,persons:true,groups:true,files:{max_file:1024,max_count:10},people:[peer],threads:[],topics:[],dms:[threads[source],threads[other]],directory:{current:true,members:[]},review:[],quarantine:[],links:[]};
f.refresh=()=>{overview.seq++;changed({type:'change',seq:overview.seq})};
f.disable=()=>{overview.files=null;overview.seq++;changed({type:'change',seq:overview.seq})};
f.enable=()=>{overview.files={max_file:1024,max_count:10};overview.seq++;changed({type:'change',seq:overview.seq})};
const host={version:1,platform:'daemon',workspace:{id:'drop-fixture',name:'Drop fixture',state:'enrolled',address:me.address},skins:[],onSkinsChange(){return()=>{}},onOpen:fn=>opened=fn,listen(fn){changed=fn;return()=>{}},
 onFileDrop:nativeMode?fn=>{nativeListeners.add(fn);return()=>nativeListeners.delete(fn)}:undefined,
 stage:async file=>{f.uploads.push({name:file.name,size:file.size,bytes:[...new Uint8Array(await file.arrayBuffer())]});return 'staged-'+f.uploads.length},
 api:async(p,b)=>{if(p.startsWith('/api/overview'))return structuredClone(overview);if(p.startsWith('/api/dm?')){f.dmReads=(f.dmReads||0)+1;return structuredClone(threads[new URL(p,location).searchParams.get('id')]);}if(p==='/api/dm/send')return new Promise((resolve,reject)=>f.writes.push({body:b,resolve,reject}));if(p.startsWith('/api/agents'))return{agents:[]};if(p.includes('/groups/invitations'))return[];if(p.startsWith('/api/typing/status'))return{send:false,scopes:[]};return{};}};
const base='/skin/'+skin+'/',manifest=await(await fetch(base+'skin.json')).json();
if(manifest.document){const style=new CSSStyleSheet();style.replaceSync((await(await fetch(base+manifest.document)).text()).replaceAll('url(m/','url('+base+'m/'));document.adoptedStyleSheets=[style]}
const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch(base+manifest.style)).text());shadow.adoptedStyleSheets=[style];const root=document.createElement('div');root.className='skin-root';shadow.append(root);
await(await import(base+manifest.entry)).mount(root,host);window.ready=true;
`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100dvh}</style><div id="skin"></div><script type="module" src="/boot.mjs"></script>');}
 if(url.pathname==='/boot.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(boot);}
 const match=url.pathname.match(/^\/skin\/(classic|holonet)\/(.+)$/);if(!match){res.writeHead(404);return res.end();}
 const root=path.join(collection,match[1]),file=path.resolve(root,match[2]);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
test('same-host same-conversation background refresh retains open reaction picker and usable Close',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});const failures=[];
 try{for(const skin of ['classic','holonet'])for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:850},isMobile:width===390,hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/?skin='+skin);await page.waitForFunction(()=>window.ready);await page.evaluate(()=>fixture.open('c'.repeat(64)));
   const row=page.locator('#timeline .msg.in').filter({hasText:'Exact reaction target'}),picker=row.locator('.react-pick');await row.waitFor();
   await picker.locator('summary').tap();await picker.locator('.react-grid').waitFor();assert(await picker.evaluate(d=>d.open),'picker opened');
   const reads=await page.evaluate(()=>fixture.dmReads);await page.evaluate(()=>fixture.refresh());await page.waitForFunction(n=>fixture.dmReads>n,reads);
   assert(await picker.evaluate(d=>d.open),'same-conversation refresh discarded open reaction picker');
   const refresh=async()=>{const reads=await page.evaluate(()=>fixture.dmReads);await page.evaluate(()=>fixture.refresh());await page.waitForFunction(n=>fixture.dmReads>n,reads);};
   await picker.locator('.react-close').tap();assert.equal(await picker.evaluate(d=>d.open),false,'Close remains usable');
   await refresh();assert.equal(await picker.evaluate(d=>d.open),false,'closed picker reopened after refresh');
   await picker.locator('summary').tap();await picker.locator('.react-grid').waitFor();await refresh();
   await page.keyboard.press('Escape');assert.equal(await picker.evaluate(d=>d.open),false,'Escape closes refreshed picker');
   await picker.locator('summary').tap();await picker.locator('.react-grid').waitFor();
   const draft=page.locator('#body');await draft.fill('Unrelated draft remains focused');await refresh();
   assert(await picker.evaluate(d=>d.open),'refresh discarded picker while draft focused');
   assert(await draft.evaluate(n=>n===n.getRootNode().activeElement),'refresh stole unrelated draft focus');
   assert.equal(await draft.inputValue(),'Unrelated draft remains focused');
   const priorReads=await page.evaluate(()=>fixture.dmReads);await page.evaluate(()=>fixture.open('d'.repeat(64)));await page.waitForFunction(n=>fixture.dmReads>n,priorReads);
   await row.waitFor();assert.equal(await picker.evaluate(d=>d.open),false,'another conversation inherited picker for reused message ID');
   assert.deepEqual(errors,[]);console.log('PASS reaction picker '+skin+' '+width);
  }catch(e){failures.push(skin+' '+width+': '+e.message);}finally{await page.close();}
 }assert.deepEqual(failures,[]);}finally{await browser.close();await new Promise(r=>server.close(r));}
});
