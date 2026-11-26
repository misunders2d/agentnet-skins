import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(process.env.AGENTNET_TOUCH_SOURCE||path.join(collection,'tests/touch.cjs'),'utf8');
const code=source.slice(source.indexOf('async function tap('),source.indexOf('// inReach:'));
test('phone tap measures its center after scroll-triggered layout, and rejects real occlusion',{skip:!process.env.AGENTNET_CHROMIUM},async()=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
 try{
  for(const covered of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage();page.setDefaultTimeout(1200);
   await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#view{height:600px;overflow:auto}.gap{height:900px}.mc-stack{height:160px;width:300px;background:#eee;position:relative}button{display:block;border:0;padding:0;width:256px;height:128px}#cover{position:absolute;inset:0;background:white}</style><div id="view"><div class="gap"></div><div class="mc-stack"><button>Long history 100</button></div><div class="gap"></div></div>');
   await page.evaluate(covered=>{window.clicked=0;window.reflowed=0;const button=document.querySelector('button'),view=document.querySelector('#view');button.onclick=()=>clicked++;view.addEventListener('scroll',()=>{button.style.height='44px';reflowed++;},{once:true});if(covered){const cover=document.createElement('div');cover.id='cover';button.parentNode.append(cover);}},covered);
   const result={taps:[],failures:[]},ctx={page,result,check:(ok,msg)=>{if(!ok)result.failures.push(msg);}};vm.createContext(ctx);vm.runInContext(code,ctx);
   const work=vm.runInContext("tap(page.getByRole('button',{name:'Long history 100'}),'Mid-history message')",ctx);
   if(covered){await assert.rejects(work,/intercepts pointer events/);assert.equal(await page.evaluate(()=>clicked),0);}
   else {await work;assert.deepEqual(result.failures,[]);assert.equal(await page.evaluate(()=>clicked),1);assert.equal(await page.evaluate(()=>reflowed),1);assert.match(result.taps[0],/256x44/);}
   await context.close();
  }
 }finally{await browser.close();}
});

test('touch formatting stays tappable when a redraw moves its editor offscreen', async () => {
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const browser=await chromium.launch({executablePath:process.env.AGENTNET_CHROMIUM||undefined});
 try {
  const page=await browser.newPage({viewport:{width:390,height:620},hasTouch:true,isMobile:true});
  for(const id of ['classic','holonet','zoom']){
   const css=fs.readFileSync(path.join(collection,'skins',id,'src','style.css'),'utf8');
   await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>${css}</style><main style="position:fixed;inset:0;overflow:auto">
    <div style="height:1400px"></div><div class="format-field"><textarea>Selected text</textarea>
    <div class="format-menu" popover="manual" role="menu"><button role="menuitem">Bold</button></div></div></main>`);
   const geometry=await page.evaluate(async () => {
    const timeline=document.querySelector('main'),field=document.querySelector('.format-field');
    const menu=field.querySelector('.format-menu'),button=menu.querySelector('button');
    button.addEventListener('click',event=>{if(event.isTrusted)button.dataset.tapped='true';});
    timeline.scrollTop=timeline.scrollHeight;
    menu.showPopover();
    // Reattach the existing editor and restore its open menu as the skins do.
    field.remove();
    timeline.append(field);
    timeline.scrollTop=0;
    menu.showPopover();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {fieldTop:field.getBoundingClientRect().top,height:innerHeight,button:button.getBoundingClientRect().toJSON()};
   });
   assert(geometry.fieldTop>=geometry.height, id+' fixture moves the editor below the viewport');
   assert(geometry.button.top>=0 && geometry.button.bottom<=geometry.height && geometry.button.height>=44,
    id+' has no tappable Bold action after redraw: '+JSON.stringify(geometry));
   await page.getByRole('menuitem',{name:'Bold',exact:true}).tap({timeout:1100});
   assert.equal(await page.getByRole('menuitem',{name:'Bold',exact:true}).getAttribute('data-tapped'),'true');
  }
 } finally {await browser.close();}
});
