import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT);
for(const skin of ['classic','holonet','zoom'])test(skin+' immediately projects mute, retaining truthful confirmation and recovery',async()=>{
 const source=fs.readFileSync(process.env.AGENTNET_MUTE_BASELINE?'/tmp/agentnet-'+skin+'-mute-before.mjs':new URL('../skins/'+skin+'/src/entry.mjs',import.meta.url),'utf8');
 const a=source.indexOf('const muteIntents'),start=a>=0?a:source.indexOf('async function notifyAct('),end=source.indexOf('// notifyDialog',start),b=source.indexOf('function dmNotifyChips('),c=source.indexOf('// reportSeen',b);assert(start>=0&&end>start&&b>=0&&c>b);
 const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(5000);
  await page.setContent('<main id="root"><div id="peer-chips"></div><div id="conversation"></div><input aria-label="Unrelated draft"><p id="announced"></p></main>');
  await page.addStyleTag({content:'button,input{min-height:44px;margin:6px} .hint{display:block}'});
  await page.addScriptTag({content:`
 const root=document.getElementById('root'),$=id=>document.getElementById(id);let alive=true,currentHost={};
 const state={gen:1,overview:{notify:{available:true,enabled:true,mutes:[],allowed:[]}},dmData:{id:'one',peer:{address:'fixture/peer'}}},writes=[],reads=[];
 const el=(tag,attrs,...children)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(k==='disabled')n.disabled=v;else if(v!==undefined)n.setAttribute(k,v)}for(const c of children.flat())if(c!=null&&c!==false)n.append(c);return n},fill=(n,...children)=>n.replaceChildren(...children.flat().filter(Boolean)),resourceMember=()=>false;
 const renderDMBody=()=>fill($('conversation'),...dmNotifyChips(state.dmData)),announce=t=>$('announced').textContent=t;
 const api=(p,b,h)=>new Promise((resolve,reject)=>writes.push({p,b,h,resolve,reject}));
 const loadOverview=()=>new Promise((resolve,reject)=>reads.push({resolve:()=>{renderDMBody();resolve(state.overview)},reject}));
 ${source.slice(start,end)}
 ${source.slice(b,c)}
 renderDMBody();
 window.fixture={state,writes,reads,duplicate:()=>notifyAct('/api/notify/mute',{conv:'one',muted:true}),finish(i,fail=false){const w=writes[i];fail?w.reject(Error('Invented mute refusal')):w.resolve({})},read(i,muted){state.overview.notify={...state.overview.notify,mutes:muted?['one']:[]};reads[i].resolve()},sync(muted){state.overview.notify={...state.overview.notify,mutes:muted?['one']:[]};renderDMBody()},navigate(id){state.dmData={id,peer:{address:'fixture/peer'}};renderDMBody()},replaceHost(){currentHost={};state.gen++;state.overview.notify={...state.overview.notify,mutes:[]};renderDMBody()},stop(){alive=false;state.gen++}};
 `});
  const controls=page.locator('#conversation'),mute=()=>controls.getByRole('button',{name:'Mute chat',exact:true}),unmute=()=>controls.getByRole('button',{name:'Unmute chat',exact:true});
  await mute().evaluate(b=>b.addEventListener('click',e=>fixture.input={at:performance.now(),trusted:e.isTrusted},{once:true,capture:true}));await mute().click();await unmute().waitFor({timeout:500});await controls.getByRole('status').waitFor();const timing=await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{...fixture.input,feedback:performance.now()-fixture.input.at}});assert(timing.trusted);assert(timing.feedback<500);assert(await unmute().isDisabled());assert.deepEqual(await page.evaluate(()=>fixture.state.overview.notify.mutes),[],'local mute is never presented as confirmed preference state');
  await page.evaluate(()=>{void fixture.duplicate();void fixture.duplicate()});assert.equal(await page.evaluate(()=>fixture.writes.length),1);await page.getByRole('textbox',{name:'Unrelated draft'}).fill('Keep while muting');
  await page.evaluate(()=>fixture.finish(0,true));await controls.getByRole('alert').waitFor();await mute().waitFor();assert.match(await controls.getByRole('alert').textContent(),/Invented mute refusal/);
  await controls.getByRole('button',{name:'Retry mute choice',exact:true}).click();await unmute().waitFor();await page.evaluate(()=>fixture.finish(1));await controls.getByText('Mute choice saved; checking current state…',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>fixture.reads.length),1);
  await page.evaluate(()=>fixture.read(0,false));await controls.getByRole('alert').waitFor();await mute().waitFor();await controls.getByRole('button',{name:'Check current state',exact:true}).click();assert.equal(await page.evaluate(()=>fixture.writes.length),2,'read-only retry cannot replay an acknowledged mute');await page.evaluate(()=>fixture.read(1,true));await unmute().waitFor();assert.equal(await controls.getByRole('status').count(),0);assert.equal(await controls.getByRole('alert').count(),0);assert.equal(await unmute().isEnabled(),true);
  await unmute().click();await mute().waitFor();await page.evaluate(()=>fixture.sync(false));await page.evaluate(()=>fixture.finish(2,true));await controls.getByRole('alert').waitFor();await mute().waitFor();assert.equal(await unmute().count(),0,'failure cannot restore an older mute over newer synchronized state');await controls.getByRole('button',{name:'Dismiss mute error',exact:true}).click();
  await mute().click();await page.evaluate(()=>fixture.navigate('two'));await mute().waitFor();assert.equal(await controls.getByRole('status').count(),0);await page.evaluate(()=>fixture.finish(3));await page.waitForFunction(()=>fixture.reads.length===3);await page.evaluate(()=>fixture.read(2,true));await mute().waitFor();await page.evaluate(()=>fixture.navigate('one'));await unmute().waitFor();assert.equal(await controls.getByRole('status').count(),0,'background success stays bound to the original chat');
  await unmute().click();await page.evaluate(()=>{fixture.replaceHost();fixture.finish(4,true)});await page.waitForTimeout(30);await mute().waitFor();assert.equal(await controls.getByRole('alert').count(),0,'old workspace failure stays out of the new workspace');
  await mute().click();const before=await controls.innerHTML();await page.evaluate(()=>{fixture.stop();fixture.finish(5)});await page.waitForTimeout(30);assert.equal(await controls.innerHTML(),before);assert.equal(await page.evaluate(()=>fixture.reads.length),3,'stopped view cannot start confirmation reads');
  assert.equal(await page.getByRole('textbox',{name:'Unrelated draft'}).inputValue(),'Keep while muting');assert.equal(await page.evaluate(()=>fixture.state.overview.notify.enabled),true);assert.deepEqual(errors,[]);console.log(JSON.stringify({skin,width,feedbackMs:timing.feedback,writes:6,confirmationReads:3}));await page.close();
 }}finally{await browser.close()}
});
