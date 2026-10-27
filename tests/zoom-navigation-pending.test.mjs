import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT);
const source=fs.readFileSync(process.env.AGENTNET_ZOOM_NAVIGATION_SOURCE||new URL('../skins/zoom/src/entry.mjs',import.meta.url),'utf8');
const method=(a,b)=>{const start=source.indexOf(a,source.indexOf('const Zoom =')),end=source.indexOf(b,start);assert(start>=0&&end>start);return source.slice(start,end).trim().replace(/,$/,'')};
const go=method('  async go(', '\n  out()').replace(/^async go\(/,'async function go(');
const content=method('  content(views)', '\n  layer()').replace(/^content\(/,'function content(');
const refresh=method('  refresh()', '\n  // results is').replace(/^refresh\(/,'function refresh(');
test('Zoom replaces the old screen before held chat reads, with bound retry and cancellation',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});
 try{for(const width of [390,1440])for(const kind of ['dm','thread']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(5000);
  await page.setContent('<main id="root"><button id="open">Open selected chat</button><input aria-label="Unrelated draft"><div id="zoom"></div></main>');
  await page.addStyleTag({content:'.zoom-content{padding:20px}button,input{min-height:44px}button{margin:8px}'});
  await page.addScriptTag({content:`
 const root=document.getElementById('root'),$=id=>document.getElementById(id);let currentHost={},alive=true;
 const state={gen:1,readVisit:null,dm:null,data:null,dmData:null,overview:{dms:[{id:'one',title:'Exact chosen chat'}],threads:[{id:'one',title:'Exact chosen chat'}]}};
 const dmLoadViews=new WeakMap(),topicSelections={},topicFresh={},requests=[];
 const fill=(node,...children)=>{node.replaceChildren(...children.flat().filter(Boolean));return node};
 const el=(tag,attrs,...children)=>{const node=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k.startsWith('on'))node.addEventListener(k.slice(2),v);else if(v!==undefined)node.setAttribute(k==='class'?'class':k,v)}for(const c of children.flat())if(c!==false&&c!=null)node.append(c);return node};
 const retireVisibleRead=()=>{},retireViewMedia=()=>{},retireSchedule=()=>{},toggleReview=()=>{},motion=()=>false,syncVisibleRead=()=>{},syncScheduleControls=()=>{},placeUnreadDivider=()=>{},refreshThread=()=>{},groupContextWaiting=()=>false,personKey=p=>p.person,directChatKey=t=>t.peer;
 const focusZoomLayer=surface=>surface.querySelector('button')?.focus(),leaveReadVisit=()=>{state.readVisit=null};
 const begin=(kind,id)=>{state.dm=kind==='dm'?id:null;state.thread=kind==='thread'?id:null;state.dmData=null;state.data=null;state.readVisit={host:currentHost,id,loading:0};return true};
 const beginDM=id=>begin('dm',id),beginThread=id=>begin('thread',id);
 const load=kind=>{const visit=state.readVisit,host=currentHost,id=kind==='dm'?state.dm:state.thread;visit.loading++;if(kind==='dm')visit.opening=Zoom.generation;return new Promise(resolve=>requests.push({kind,id,visit,host,resolve}));};
 const loadDM=()=>load('dm'),loadThread=()=>load('thread'),api=()=>Promise.resolve({});
 ${go};${content};${refresh};
 const Zoom={generation:0,navigating:null,dirty:false,opening:null,level:0,origins:[],person:null,peer:null,dm:null,query:'',go,content,refresh,layer(){return el('div',{class:'zoom-layer'},el('div',{class:'zoom-content'},this.content([()=>el('p',{},'Everyone destination'),()=>el('p',{},'Contact destination'),()=>el('p',{},'Confirmed '+(state.dmData?.id||state.data?.id))])))}};
 fill($('zoom'),Zoom.layer());
 const open=(id='one')=>Zoom.go(2,{${kind}:id});$('open').onclick=e=>{fixture.input={trusted:e.isTrusted,at:performance.now()};void open()};
 window.fixture={state,Zoom,requests,open,finish(index,fail=false){const r=requests[index];r.visit.loading--;if(alive&&r.host===currentHost&&r.visit===state.readVisit&&!fail){const view={id:r.id,peer:${kind==='dm'?"{person:'fixture-person'}":"'fixture/device'"},messages:[]};if(r.kind==='dm'){state.dmData=view;dmLoadViews.set(view,{host:r.host})}else state.data=view;}r.resolve()},replaceHost(){currentHost={};state.dmData=null;state.data=null;state.readVisit=null},stop(){alive=false;}};
 `});
  const opening=page.getByRole('region',{name:'Opening conversation'});
  await page.getByRole('button',{name:'Open selected chat'}).click();await opening.waitFor({timeout:500});
  const input=await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{...fixture.input,atFeedback:performance.now()}});assert(input.trusted);assert(input.atFeedback-input.at<500);await opening.getByRole('heading',{name:'Exact chosen chat'}).waitFor();assert.equal(await page.getByText('Everyone destination',{exact:true}).count(),0);
  await page.getByRole('textbox',{name:'Unrelated draft'}).fill('Keep this draft');
  if(process.env.AGENTNET_ZOOM_NAVIGATION_EVIDENCE)await page.screenshot({path:process.env.AGENTNET_ZOOM_NAVIGATION_EVIDENCE+'-pending-'+kind+'-'+width+'.png'});
  await page.evaluate(()=>fixture.finish(0,true));await opening.getByRole('alert').waitFor();
  if(process.env.AGENTNET_ZOOM_NAVIGATION_EVIDENCE)await page.screenshot({path:process.env.AGENTNET_ZOOM_NAVIGATION_EVIDENCE+'-error-'+kind+'-'+width+'.png'});
  await opening.getByRole('button',{name:'Try again'}).click();await opening.getByRole('status').waitFor();assert.deepEqual(await page.evaluate(()=>fixture.requests.map(r=>r.id)),['one','one']);
  await opening.getByRole('button',{name:'Back to everyone'}).click();await page.getByText('Everyone destination',{exact:true}).waitFor();await page.evaluate(()=>fixture.finish(1));assert.equal(await opening.count(),0,'late successful read cannot reopen a backed-out chat');
  await page.getByRole('button',{name:'Open selected chat'}).click();await opening.waitFor();await page.evaluate(()=>void fixture.open('two'));await page.evaluate(()=>fixture.finish(2));await opening.waitFor();assert.equal(await page.getByText('Confirmed one',{exact:true}).count(),0);await page.evaluate(()=>fixture.finish(3));await page.getByText('Confirmed two',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Open selected chat'}).click();await opening.waitFor();await page.evaluate(()=>{fixture.replaceHost();fixture.finish(4)});assert.equal(await page.getByText('Confirmed one',{exact:true}).count(),0);
  assert.equal(await page.getByRole('textbox',{name:'Unrelated draft'}).inputValue(),'Keep this draft');assert.deepEqual(errors,[]);console.log(JSON.stringify({kind,width,feedbackMs:input.atFeedback-input.at,heldReads:5}));await page.close();
 }}finally{await browser.close()}
});
