import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT);
test('person devices open and close before animation callbacks, leaving exact controls usable',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});
 try{for(const skin of ['classic','holonet','zoom'])for(const width of [390,1440]){
  const source=fs.readFileSync(new URL('../skins/'+skin+'/src/entry.mjs',import.meta.url),'utf8');
  const dom=source.slice(source.indexOf('const present ='),source.indexOf('// Every operation keeps'));
  const start=source.indexOf('function deviceDisclosure('),end=source.indexOf('\nfunction ',start+1);
  assert(start>=0&&end>start);const disclosure=source.slice(start,end);

  const page=await browser.newPage({viewport:{width,height:844}});
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({content:'body{margin:0}main{height:700px;overflow:auto}summary,button{min-height:44px} .device-disclosure-body{overflow:hidden}'});
  await page.addScriptTag({content:`${dom}
   const original=Element.prototype.animate;Element.prototype.animate=function(...args){const a=original.apply(this,args);a.pause();a.currentTime=0;return a;};
   const devicesOf=p=>p.devices,personKey=p=>p.label,plural=(n,one,many)=>n+' '+(n===1?one:many),motion=()=>true;
   const identityDetails=()=>el('p',{},'Verified fixture device'),deviceList=(p,open)=>el('button',{onclick:()=>open('anna/desk')},'Device conversations');
   ${disclosure}
   window.selected=[];document.getElementById('root').append(deviceDisclosure({label:'Anna',devices:[{}]},id=>selected.push(id)));`});
  await page.locator('summary').click();
  await page.waitForFunction(()=>{const b=document.querySelector('.device-disclosure-body')||document.querySelector('details button');return document.querySelector('details').open&&b.clientHeight>=b.scrollHeight&&getComputedStyle(b).opacity==='1';},null,{polling:10,timeout:500});
  await page.getByRole('button',{name:'Device conversations'}).click();assert.deepEqual(await page.evaluate(()=>selected),['anna/desk']);
  await page.locator('summary').click();assert.equal(await page.locator('details').evaluate(n=>n.open),false);
  console.log(skin+' '+width+': immediate native disclosure and exact device action');await page.close();
 }}finally{await browser.close();}
});
