import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const collection=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(collection,'scripts/previews.mjs'),'utf8');
function adapter(text){
 const start=text.indexOf(' comic:{'),end=text.indexOf('\n};',start);
 assert(start>=0&&end>start,'actual Comic preview adapter exists');
 return vm.runInThisContext('({'+text.slice(start,end)+'}).comic.theme');
}
const narrow="if(page.viewportSize().width<1024){await back.waitFor({state:'visible'});await back.click();}else if(await back.isVisible())await back.click();";
const current=adapter(source),baseline=adapter(source.replace(narrow,'if(await back.isVisible())await back.click();'));

test('Comic preview navigation waits for responsive Back before Settings',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||path.join(collection,'node_modules/playwright'));
 const browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
 async function scenario(mode){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(1500);page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!doctype html><title>Preview navigation precondition</title><div id="skin"></div>');
  await page.evaluate(mode=>{
   const root=document.querySelector('#skin').attachShadow({mode:'open'});window.trace=[];
   root.innerHTML='<style>nav{position:fixed;left:0;bottom:0;width:120px;height:48px}nav button{width:120px;height:48px}#card{position:fixed;left:120px;right:0;top:0;bottom:0;background:white}#send{position:absolute;bottom:0;right:0;width:120px;height:48px}#back{position:absolute;top:0;left:0;height:44px}#settings{position:fixed;top:100px;left:0}@media(max-width:1023px){nav{left:auto;right:0}#card{left:0}}</style><nav aria-label="Main"><button>Settings</button></nav><section id="card"><button id="send">Send</button></section><section id="settings" hidden><button>Appearance</button><button role="radio" aria-label="Light" hidden>Light</button></section>';
   root.querySelector('nav button').onclick=()=>{trace.push('Settings');root.querySelector('#settings').hidden=false;};
   root.querySelector('#settings>button').onclick=()=>{trace.push('Appearance');root.querySelector('[role=radio]').hidden=false;};
   root.querySelector('[role=radio]').onclick=()=>trace.push('Light');
   const commit=()=>{trace.push('commit');const back=document.createElement('button');back.id='back';back.setAttribute('aria-label','Back to chats');back.textContent='Chats';back.onclick=()=>{trace.push('Back');root.querySelector('#card').remove();};root.querySelector('#card').append(back);};
   if(mode==='wide-back')commit();
   matchMedia('(min-width:1024px)').addEventListener('change',event=>{if(!event.matches&&mode==='delayed')setTimeout(commit,500);});
  },mode);
  if(mode==='delayed'||mode==='missing')await page.setViewportSize({width:390,height:844});
  assert.equal(await page.title(),'Preview navigation precondition');
  return {page,context,errors,trace:()=>page.evaluate(()=>trace)};
 }
 try{
  await t.test('baseline snapshot skips delayed Back and Settings is intercepted',async()=>{
   const s=await scenario('delayed');try{
    await assert.rejects(baseline(s.page,'light'),/intercepts pointer events/);
    assert.deepEqual(await s.trace(),['commit']);assert.deepEqual(s.errors,[]);
   }finally{await s.context.close();}
  });
  await t.test('current adapter waits for delayed Back then uses natural Settings path',async()=>{
   const s=await scenario('delayed');try{
    await current(s.page,'light');assert.deepEqual(await s.trace(),['commit','Back','Settings','Appearance','Light']);assert.deepEqual(s.errors,[]);
   }finally{await s.context.close();}
  });
  await t.test('missing Back fails at bounded wait without advancing to Settings',async()=>{
   const s=await scenario('missing');try{
    await assert.rejects(current(s.page,'light'),/Back to chats/);assert.deepEqual(await s.trace(),[]);assert.deepEqual(s.errors,[]);
   }finally{await s.context.close();}
  });
  for(const mode of ['wide','wide-back'])await t.test(mode+' retains existing visibility path',async()=>{
   const s=await scenario(mode);try{
    await current(s.page,'light');assert.deepEqual(await s.trace(),mode==='wide'?['Settings','Appearance','Light']:['commit','Back','Settings','Appearance','Light']);assert.deepEqual(s.errors,[]);
   }finally{await s.context.close();}
  });
 }finally{await browser.close();}
});
