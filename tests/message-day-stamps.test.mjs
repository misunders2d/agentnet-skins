import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT);
const collection=path.resolve(import.meta.dirname,'../dist');
/* A message keeps its day once the conversation scrolls past its day line (owner, November 1, 2026): each day opens with a day line, and each time says the day too. */
const boot = `
const id='c'.repeat(64),skin=new URL(location).searchParams.get('skin');
const me={person:'a'.repeat(32),label:'Atlas',address:'atlas/laptop',fingerprint:'11111111-11111111-11111111-11111111',state:'self',devices:[]};
const peer={person:'b'.repeat(32),label:'Briar',address:'briar/desk',fingerprint:'22222222-22222222-22222222-22222222',state:'pinned',devices:[]};
const now=new Date(),Y=now.getFullYear(),M=now.getMonth(),D=now.getDate();
const T={hour:'numeric',minute:'2-digit'},F=o=>new Intl.DateTimeFormat([],o),clock=d=>d.toLocaleTimeString([],T);
const dayName=d=>d.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});
const later=d=>F({...(d.getFullYear()===Y?{}:{year:'numeric'}),month:'short',day:'numeric',...T}).format(d);
const rows=[
 {dir:'in',at:new Date(Y-2,5,15,9,30),stamp:later,line:dayName},
 {dir:'out',at:new Date(Y,M,D-20,8,0),stamp:later,line:dayName},
 {dir:'in',at:new Date(Y,M,D-3,18,13),stamp:d=>F({weekday:'short',...T}).format(d),line:dayName},
 {dir:'in',at:new Date(Y,M,D-1,23,58),stamp:d=>'Yesterday '+clock(d),line:()=>'Yesterday'},
 {dir:'in',at:new Date(Y,M,D,0,1),stamp:clock,line:()=>'Today'},
 {dir:'out',at:new Date(Y,M,D,0,2),sent:new Date(Y,M,D-1,21,14),stamp:d=>'Yesterday '+clock(d)},
];
const messages=rows.map((r,i)=>({id:String(i+1).repeat(32),lid:String(i+1).repeat(32),kind:'message',dir:r.dir,from:r.dir==='in'?peer.address:me.address,to:r.dir==='in'?me.address:peer.address,author:r.dir==='in'?peer.label:me.label,body:'Dated message '+i,at:r.at.toISOString(),...(r.sent?{sent_at:r.sent.toISOString()}:{}),reactions:[],can:['react']}));
window.expected={lines:rows.filter(r=>r.line).map(r=>r.line(r.at)),stamps:rows.map(r=>r.stamp(r.sent||r.at)),full:rows.map(r=>F({dateStyle:'full',timeStyle:'short'}).format(r.sent||r.at))};
const chat={id,kind:'group',title:'Dated chat',peer,role:'member',members:[me,peer],agents:[],guests:[],topics:[],messages};
let opened;const f=window.fixture={open:()=>opened(id,'conversation')};
const overview={version:'fixture',seq:1,topic_list:true,me,person:me,persons:true,groups:true,files:{max_file:1024,max_count:10},people:[peer],threads:[],topics:[],dms:[chat],directory:{current:true,members:[]},review:[],quarantine:[],links:[]};
const host={version:1,platform:'daemon',workspace:{id:'day-fixture',name:'Day fixture',state:'enrolled',address:me.address},skins:[],onSkinsChange(){return()=>{}},onOpen:fn=>opened=fn,listen(){return()=>{}},
 api:async p=>{if(p.startsWith('/api/overview'))return structuredClone(overview);if(p.startsWith('/api/dm?'))return structuredClone(chat);if(p.startsWith('/api/agents'))return{agents:[]};if(p.includes('/groups/invitations'))return[];if(p.startsWith('/api/typing/status'))return{send:false,scopes:[]};return{};}};
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
/* Today's real clock, and a fixed early-January clock whose last week and last month fall in the previous year. */
const clocks=[null,'2027-01-03T10:12:00+02:00'];
test('Classic, Holonet and Zoom open each day with a day line and date older message times',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});const failures=[];
 try{for(const skin of ['classic','holonet','zoom'])for(const fixed of clocks)for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:850},isMobile:width===390,hasTouch:true,reducedMotion:'reduce',timezoneId:'Europe/Kyiv'});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   if(fixed)await page.clock.setFixedTime(new Date(fixed));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?skin='+skin);await page.waitForFunction(()=>window.ready);await page.evaluate(()=>fixture.open());
   const scope=skin==='zoom'?'.mini-chat':'#timeline';await page.locator(scope+' .day-line').first().waitFor();
   const expected=await page.evaluate(()=>window.expected);
   assert.deepEqual(await page.locator(scope+' .day-line').allTextContents(),expected.lines,'one day line per day, in order');
   assert.deepEqual(await page.locator(scope+' .day-line').evaluateAll(n=>n.map(x=>x.getAttribute('role')+':'+x.getAttribute('aria-label'))),expected.lines.map(l=>'separator:'+l),'day lines are named separators');
   if(skin==='zoom'){
    const who=await page.locator('.mini-chat .mc-bubble > .mc-who:first-child').evaluateAll(n=>n.map(x=>({text:x.textContent.trim(),title:x.getAttribute('title')})));
    assert.equal(who.length,expected.stamps.length,'every message has its author line');
    who.forEach((w,i)=>{assert.ok(w.text.endsWith(' · '+expected.stamps[i]),'author line time '+i+': '+JSON.stringify(w.text)+' wants '+expected.stamps[i]);assert.equal(w.title,expected.full[i],'full date on hover '+i)});
   }else{
    const times=await page.locator('#timeline .msg time[datetime]').evaluateAll(n=>n.map(x=>({text:x.textContent,title:x.getAttribute('title')})));
    assert.deepEqual(times.map(t=>t.text),expected.stamps,'message times carry their day');
    assert.deepEqual(times.map(t=>t.title),expected.full,'full date on hover');
    const after=await page.locator('#timeline .day-line').last().evaluate(n=>n.nextElementSibling.className);
    assert.ok(!/\bcont\b/.test(after),'a message minutes after midnight starts its own group under the day line: '+after);
   }
   if(process.env.AGENTNET_SCREENSHOTS)await page.locator(scope+' .day-line').nth(-2).evaluate(n=>n.scrollIntoView({block:'start'}));
   if(process.env.AGENTNET_SCREENSHOTS)await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,'day-stamps-'+skin+'-'+(fixed?'january':'now')+'-'+width+'.png')});
   assert.deepEqual(errors,[]);
  }catch(e){failures.push(skin+' '+(fixed||'now')+' '+width+': '+(e.stack||e))}finally{await page.close()}
 }}finally{await browser.close();server.close()}
 assert.deepEqual(failures,[]);
});
