// Real production-loader motion, focus and crew lifecycle in the disposable company.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
const pkg=process.env.AGENTNET_SKIN_PACKAGE,m=JSON.parse(fs.readFileSync(path.join(pkg,'skin.json'))),world=process.env.AGENTNET_SKIN_WORLD;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM||undefined});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const urls=JSON.parse(fs.readFileSync(path.join(world,'urls.json'))),entry=urls.sergey.page.match(/https?:\/\/[^\s]+/)[0],origin=new URL(entry).origin;
  await page.goto(entry);await page.goto(origin+'/?skin='+m.id);await page.getByRole('button',{name:'Use this skin',exact:true}).click();await page.locator('.holonet-root').waitFor();
  await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().click();await page.locator('#composer').waitFor();
  if(!await page.locator('.topic-chip').count()){await page.getByRole('button',{name:'New topic',exact:true}).click();await page.locator('#body').fill('Motion fixture topic');await page.locator('#composer').evaluate(f=>f.requestSubmit());await page.locator('.topic-chip').first().waitFor();}
  const main=()=>page.locator('.topics-bar').getByRole('button',{name:/^Main(?: flow)?$/,exact:true});
  await page.locator('#body').fill('Unsent motion draft');await main().click();
  assert.equal(await page.locator('.holonet-root').evaluate(r=>{r.__motionPrevious=r.querySelector('.instrument-sweep').getAnimations()[0];return r.__motionPrevious?.playState;}),'running');
  await page.locator('.topic-chip').first().click();
  assert(await page.locator('.holonet-root').evaluate(r=>r.__motionPrevious.playState==='idle'&&r.querySelector('.instrument-sweep').getAnimations().length===1),'Repeated selection cancels the previous sweep');
  assert.equal(await page.locator('#body').inputValue(),'Unsent motion draft');
  assert(await page.locator('.topics-bar').evaluate(bar=>bar.contains(bar.getRootNode().activeElement)),'Topic rerender preserves keyboard focus');
  await page.locator('#profile-btn').click();assert.equal(await page.locator('#settings .panel-shutter').count(),2,'Panel has actual split shutters');
  assert(await page.locator('#settings').evaluate(d=>d.contains(d.getRootNode().activeElement)),'Panel motion does not steal native dialog focus');
  await page.locator('#settings-close').click();assert.equal(await page.locator('.panel-shutter').count(),0,'Closing interrupts and removes shutters');
  await page.locator('#profile-btn').click();
  const reopened=await page.locator('.holonet-root').evaluate(async r=>{
   const old=[...r.querySelector('#settings').getAnimations({subtree:true})];
   r.querySelector('#settings-close').click();r.querySelector('#profile-btn').click();
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   return {cancelled:old.every(a=>a.playState==='idle'),layers:r.querySelectorAll('#settings .panel-shutter').length};
  });
  assert(reopened.cancelled,'Same-tick close cancels prior panel animations');assert.equal(reopened.layers,2,'Queued close does not clear reopened shutters');
  await page.locator('#settings-close').click();
  await page.emulateMedia({reducedMotion:'reduce'});await main().click();
  assert.equal(await page.locator('.instrument-sweep').evaluate(n=>n.getAnimations().length),0,'Reduced motion skips acquisition');
  await page.locator('#profile-btn').click();assert.equal(await page.locator('.panel-shutter').count(),0,'Reduced motion opens stable panel immediately');await page.locator('#settings-close').click();
  await page.locator('#crew-toggle').click();assert.equal(await page.locator('#crew-drawer-slot #agents').count(),1);await page.setViewportSize({width:390,height:844});
  for(const key of ['Tab','Shift+Tab']){await page.keyboard.press(key);assert(await page.locator('#crew-drawer').evaluate(d=>d.contains(d.getRootNode().activeElement)),'Crew drawer traps native modal focus');}
  await page.locator('#crew-close').click();assert.equal(await page.locator('#crew-slot #agents').count(),1,'Crew restored after resize/close');
  assert(await page.locator('#crew-toggle').evaluate(n=>n===n.getRootNode().activeElement),'Crew trigger regains focus');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#crew-toggle').click();
  assert.equal(await page.locator('#crew-drawer .panel-shutter').count(),2);
  await page.locator('.holonet-root').evaluate(r=>{r.__pendingMotion=[...r.getAnimations({subtree:true})].filter(a=>a.effect?.target?.matches('.instrument-sweep,.panel-shutter'));delete r.__motionPrevious;});
  // Same public module lifecycle as the host, retaining references to prove cancellation.
  const moduleURL=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname.endsWith('/entry.mjs')).at(-1)?.name);assert(moduleURL,'Production loader loaded the public package entry');
  const stopped=await page.locator('.holonet-root').evaluate(async(r,url)=>{const animations=r.__pendingMotion;delete r.__pendingMotion;await (await import(url)).unmount(r);return {children:r.childElementCount,cancelled:animations.every(a=>a.playState==='idle')};},moduleURL);
  assert.equal(stopped.children,0);assert(stopped.cancelled,'Unmount cancels live panel motion');assert.deepEqual(errors,[]);
  console.log('PASS '+m.id+' motion: interruption, immediate reduced motion, draft/focus, crew resize/close and live-animation teardown');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
