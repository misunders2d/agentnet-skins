// Production AgentNet loader + native provider. Disposable seeded company only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
const pkg=process.env.AGENTNET_SKIN_PACKAGE,m=JSON.parse(fs.readFileSync(path.join(pkg,'skin.json'))),world=process.env.AGENTNET_SKIN_WORLD,evidence=process.env.AGENTNET_SKINS_EVIDENCE;
// The skin's interaction family: its root class and controls (a renamed test copy keeps its family's).
const family=process.env.AGENTNET_SKIN_FAMILY||m.id,rootClass='.'+family+'-root';
const urls=JSON.parse(fs.readFileSync(path.join(world,'urls.json'))),seed=JSON.parse(fs.readFileSync(path.join(world,'seed.json'))),origin=new URL(urls.sergey.page).origin;
const runID=Date.now().toString(36);
const result={skin:m.id,family,pass:false,checks:[],failures:[],screenshots:[],limitations:['Viewport emulation, not physical phones or OS keyboard','No live Google account, real model or remote deployment','Classic-family and Zoom interaction adapters, not arbitrary skin certification']};
let browser,page;const errors=[];
// Measurements that leave the journey usable are collected, so one run names
// every failing check; any collected failure still fails the run.
const check=(ok,message)=>{if(!ok)result.failures.push(message);};
const delayedFileGate=()=>{let release,started;const gate=new Promise(r=>release=r),start=new Promise(r=>started=r);return {release,start,route:async route=>{started();await gate;await route.continue();}};};
// Classic family (Holonet, Classic and their scaffolds): conversation list, timeline and composer.
const classic={
 async list(){if(await page.locator('#back').isVisible())await page.locator('#back').click();await page.locator('#nav-chats').click();await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().waitFor();},
 async thread(){await this.list();await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().click();await page.locator('#conv-name').filter({hasText:'Vitalii'}).waitFor();await page.locator('#composer').waitFor();},
 name:n=>page.locator('#conv-list').getByText(n,{exact:true}).first(),
 search:()=>page.locator('#search'),
 searchHit:()=>page.locator('#conv-list').getByText(/Vitalii/).first(),
 async send(text,file){if(file)await page.locator('#file-input').setInputFiles(file);await page.locator('#body').fill(text);await page.locator('#composer').evaluate(f=>f.requestSubmit());},
 sent:text=>page.locator('#timeline').getByText(text,{exact:true}),
 async fileView(filename){return page.locator('#timeline .msg').filter({hasText:filename});},
 // Each round sends in the main flow; reselecting the pressed Main rerenders that same view.
 main:async()=>{const main=page.locator('.topics-bar').getByRole('button',{name:/^Main(?: flow)?$/});await main.click();await page.locator('.topics-bar').getByRole('button',{name:/^Main(?: flow)?$/,pressed:true}).waitFor();},
 rerender:()=>page.locator('.topics-bar').getByRole('button',{name:/^Main(?: flow)?$/,pressed:true}).click(),
 async keyboard(shot){await page.locator('#body').fill('Keyboard draft');await page.locator('#body').focus();await page.setViewportSize({width:390,height:480});const send=await page.locator('#send').evaluate(n=>{const b=n.getBoundingClientRect();return {height:b.height,bottom:b.bottom,viewport:innerHeight};});check(send.height>=44&&send.bottom<=send.viewport+1,'390 keyboard: composer/tap target below keyboard viewport or under 44px '+JSON.stringify(send));check(await page.locator('#timeline').evaluate(n=>n.clientHeight>=50),'390 keyboard: decorative frame must leave visible messages at keyboard height');check(await page.locator('#body').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=14),'390 keyboard: composer remains readable');await shot();await page.setViewportSize({width:390,height:844});await page.locator('#body').fill('');},
 async topic(text){await page.getByRole('button',{name:'New topic',exact:true}).click();await this.send(text);await this.sent(text).waitFor();},
 notified:target=>page.locator('#m-'+target.id),
};
// Zoom: Everyone → person → conversation → message, with a write dialog.
const z=()=>page.locator('#zoom'),writeButton=()=>z().getByRole('button',{name:'Write in this DM…',exact:true});
// A zoom step animates between two layers; act once one layer remains.
const settled=()=>page.waitForFunction(()=>document.querySelector('#skin')?.shadowRoot?.querySelectorAll('#zoom .zoom-layer').length===1);
const zoom={
 async list(){await page.locator('#nav-chats').click();await settled();await z().locator('.ladder .rung').nth(0).click();await z().locator('.person-card').filter({hasText:'Vitalii'}).waitFor();await settled();},
 // A person card opens their latest DM message; one step out is that DM.
 async thread(){await this.list();await z().locator('.person-card').filter({hasText:'Vitalii'}).click();await z().locator('.zoom-message').waitFor();await settled();const rungs=z().locator('.ladder .rung');await rungs.nth(await rungs.count()-2).click();await z().locator('.mini-chat').waitFor();await settled();},
 name:n=>z().locator('.person-card .node-name').getByText(n,{exact:true}).first(),
 search:()=>z().locator('.zoom-search'),
 searchHit:()=>z().getByText(/Vitalii/).first(),
 async send(text,file){await writeButton().click();await page.locator('#write-body').fill(text);if(file)await page.locator('#write-files').setInputFiles(file);await page.locator('#dialog-ok').click();await page.locator('#dialog').waitFor({state:'hidden'});},
 sent:text=>z().locator('.mini-chat').getByText(text,{exact:true}),
 async fileView(filename){await settled();await z().locator('button.mc-bubble').filter({hasText:filename}).click(); // the stored message, not its pending preview
 await z().locator('.zoom-message').waitFor();await settled();return z().locator('.zoom-message');},
 // A pushed change (a message arriving in this DM) redraws the open message.
 rerender:tag=>page.evaluate(([conv,body])=>window.agentnet.api('/api/dm/send',{conv,body}),[seed.dm_vitalii,'Arrived while a file opened '+tag+' '+runID]),
 async keyboard(shot){await this.thread();await writeButton().click();await page.locator('#write-body').fill('Keyboard draft');await page.locator('#write-body').focus();await page.setViewportSize({width:390,height:480});const send=await page.locator('#dialog-ok').evaluate(n=>{const b=n.getBoundingClientRect();return {height:b.height,bottom:b.bottom,viewport:innerHeight};});check(send.height>=44&&send.bottom<=send.viewport+1,'390 keyboard: write dialog Send below keyboard viewport or under 44px '+JSON.stringify(send));check(await page.locator('#write-body').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=14),'390 keyboard: composer remains readable');await shot();await page.locator('#write-body').fill('');await page.locator('#dialog-cancel').click();check(await z().locator('.zoom-layer').evaluate(n=>n.clientHeight>=50),'390 keyboard: frame must leave visible messages at keyboard height');await page.setViewportSize({width:390,height:844});},
 // Zoom's New topic opens the write dialog for the new flow.
 async topic(text){await this.thread();await page.getByRole('button',{name:'New topic',exact:true}).click();await page.locator('#write-body').fill(text);await page.locator('#dialog-ok').click();await page.locator('#dialog').waitFor({state:'hidden'});await this.sent(text).waitFor();},
 notified:target=>z().locator('.zoom-message').filter({hasText:target.body.split('\n')[0]}),
};
const ui=family==='zoom'?zoom:classic;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM||undefined});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 const shot=async(name)=>{const f=path.join(evidence,'screenshots',m.id+'-'+name+'.png');await page.screenshot({path:f});result.screenshots.push(f);};
 const mounted=()=>page.locator(rootClass).waitFor();
 await page.goto(urls.sergey.page);await page.goto(origin+'/?skin='+m.id);
 await page.getByRole('button',{name:'Use this skin',exact:true}).waitFor();assert.equal(await page.locator(rootClass).count(),0,'Untrusted code must not mount');await shot('trust');await page.getByRole('button',{name:'Use this skin',exact:true}).click();await mounted();
 result.checks.push('Installed package is listed by production catalog; exact-digest trust required before mount');
 for(const width of [1440,390])for(const theme of ['dark','light']){
  const tag=width+'-'+theme;await page.setViewportSize({width,height:width===390?844:1000});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  await ui.list();await page.locator('#profile-btn').click();await page.locator('#settings-tab-appearance').click();await page.locator('#theme-choice [data-theme="'+theme+'"]').click();await shot(tag+'-appearance');
  const contrast=await page.locator(rootClass).evaluate(root=>{
   const c=getComputedStyle(root),rgb=v=>{const x=document.createElement('span');x.style.color=v;root.append(x);const s=getComputedStyle(x).color;x.remove();return s.match(/[\d.]+/g).slice(0,3).map(Number);};
   const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   const ratio=(a,b)=>{const x=lum(rgb(c.getPropertyValue(a))),y=lum(rgb(c.getPropertyValue(b)));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
   return {text:ratio('--text','--surface'),muted:ratio('--muted','--surface'),signal:ratio('--signal','--surface'),action:ratio('--accent-ink','--accent'),focus:ratio('--focus','--surface')};
  });for(const[k,v]of Object.entries(contrast))check(v>=(k==='focus'?3:4.5),tag+' '+k+' contrast '+v.toFixed(2));
  for(const section of ['profile','notifications','device','storage']){await page.locator('#settings-tab-'+section).click();await page.locator('#settings-'+section).waitFor();await shot(tag+'-settings-'+section);}
  // Browser-native dialog stays within the owned shadow root and keeps focus.
  for(const key of ['Tab','Tab','Shift+Tab','Shift+Tab']){await page.keyboard.press(key);assert(await page.locator('#settings').evaluate(d=>d.contains(d.getRootNode().activeElement)),'Settings focus escaped');}
  await page.locator('#settings-close').click();await ui.list();await shot(tag+'-chats');
  for(const name of ['Vitalii','Anna','Bohdan'])assert(await ui.name(name).evaluate(n=>n.scrollWidth<=n.clientWidth+1),name+' truncated');
  await ui.search().fill('Vitalii');await ui.searchHit().waitFor();await ui.search().fill('');
  await page.locator('#nav-people').click();await page.getByText('Reading teams…',{exact:true}).waitFor({state:'hidden'});await shot(tag+'-people');await page.locator('#review-btn').click();await shot(tag+'-activity');await ui.thread();await ui.main?.();await shot(tag+'-thread');
  const text=m.name+' synthetic '+tag+' '+runID;await ui.send(text);await ui.sent(text).waitFor();
  const filename=m.id+'-'+tag+'-'+runID+'.txt',bytes='Synthetic attachment '+tag;await ui.send('File '+tag+' '+runID,{name:filename,mimeType:'text/plain',buffer:Buffer.from(bytes)});
  // Open's result must survive a view rerender while host.file is still delayed.
  const message=await ui.fileView(filename),delay=delayedFileGate();await page.route('**/api/files/**',delay.route);await message.getByRole('button',{name:'Open',exact:true}).click();await delay.start;
  await message.evaluate(n=>{window.__fileView=n;});await ui.rerender(tag);check(await page.waitForFunction(()=>!window.__fileView.isConnected,null,{timeout:10000}).then(()=>true,()=>false),tag+' the test did not rerender the file view');delay.release();
  const link=message.getByRole('link',{name:'Download '+filename,exact:true});
  try{await link.waitFor();const [file]=await Promise.all([page.waitForEvent('download'),link.click()]),save=path.join(evidence,filename);await file.saveAs(save);assert.equal(fs.readFileSync(save,'utf8'),bytes);fs.unlinkSync(save);}
  catch(e){check(false,tag+' Open result did not survive a view rerender during a delayed file: '+e.message.split('\n')[0]);}
  finally{await page.unroute('**/api/files/**',delay.route);}
  await shot(tag+'-files');
  const sizes=await page.locator(rootClass).evaluate(root=>({width:root.clientWidth,scroll:root.scrollWidth,height:root.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth}));assert(!sizes.overflow&&sizes.scroll<=sizes.width+1,tag+' horizontal overflow');assert(sizes.height>300,'Root collapsed');
  if(width===390)await ui.keyboard(()=>shot(tag+'-keyboard'));
  const topic='Operations topic '+tag+' '+runID;await ui.topic(topic);await page.getByRole('button',{name:/^(Mark done|Done)$/,exact:true}).click();await page.getByRole('button',{name:'Reopen',exact:true}).waitFor();await page.getByRole('button',{name:'Reopen',exact:true}).click();await shot(tag+'-topic');
  result.checks.push(tag+': all major navigation/settings, measured contrast, modal keyboard focus, search, send, exact downloaded bytes despite delayed-file/view rerender, topic Done/Reopen, root fit and reduced motion');
 }
 // Message-notification destination through the production host, no action.
 const dm=await page.evaluate(async id=>await window.agentnet.api('/api/dm?id='+id),seed.dm_vitalii),target=dm.messages.find(x=>x.dir==='out'&&!x.deleted);
 await page.goto(origin+'/?skin='+m.id+'#msg='+target.id+'&conv='+seed.dm_vitalii+'&dir=out');await mounted();await ui.notified(target).waitFor();await shot('message-notification');result.checks.push('Production message notification opens exact message without granting or running work');
 await page.reload();await mounted();assert.equal(await page.getByRole('button',{name:'Use this skin',exact:true}).count(),0,'Same digest keeps trust');
 // Host switcher remains outside skin stylesheet, imports exact same package.
 await ui.list();await page.getByRole('button',{name:/^Skin: /}).click();await page.getByRole('menuitem',{name:/Import or remove skins/}).click();await page.getByLabel('Import skin files',{exact:true}).filter({visible:true}).setInputFiles(['skin.json',...m.files].map(n=>path.join(pkg,n)));await page.getByText('Stored '+m.name,{exact:false}).waitFor();await shot('browser-import');await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:/^Skin: /}).click();await page.getByRole('menuitemradio',{name:new RegExp(m.name+'.*stored in this browser','i')}).click();await page.getByRole('button',{name:'Use this skin',exact:true}).click();await mounted();assert.equal(new URL(page.url()).searchParams.get('skin'),'local:'+m.id);await ui.thread();await shot('browser-local');
 await ui.list();await page.getByRole('button',{name:'Switch to Comic',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('#skin')?.shadowRoot?.querySelector('.an-root'));result.checks.push('Browser-local exact package import/trust/mount and independent host escape to Comic');
 assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[],m.id+': failed checks');result.pass=true;fs.writeFileSync(path.join(evidence,m.id+'-browser.json'),JSON.stringify(result,null,2),{mode:0o600});console.log('PASS '+m.id+' production browser: '+result.checks.length+' journeys, '+result.screenshots.length+' screenshots');
})().catch(async e=>{if(page)await page.screenshot({path:path.join(evidence,'screenshots',m.id+'-FAIL.png')}).catch(()=>{});fs.writeFileSync(path.join(evidence,m.id+'-browser.json'),JSON.stringify(result,null,2),{mode:0o600});console.error('FAIL production browser:',e.stack,'collected failures:',result.failures,'page errors:',errors);process.exitCode=1;}).finally(async()=>{await browser?.close();});
