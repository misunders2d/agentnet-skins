// Phone touch journey (v0.8.26 owner report): every action a person needs on
// a phone is reached by real touch taps (hasTouch, isMobile, 390x844), is at
// least 44px in both directions, is the top element where it is tapped, and
// does what it says. Production loader + disposable seeded company only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
const pkg=process.env.AGENTNET_SKIN_PACKAGE,m=JSON.parse(fs.readFileSync(path.join(pkg,'skin.json'))),world=process.env.AGENTNET_SKIN_WORLD,evidence=process.env.AGENTNET_SKINS_EVIDENCE;
const family=process.env.AGENTNET_SKIN_FAMILY||m.id,rootClass='.'+family+'-root';
const urls=JSON.parse(fs.readFileSync(path.join(world,'urls.json'))),origin=new URL(urls.sergey.page).origin;
const result={skin:m.id,checks:[],taps:[],failures:[]};let browser,page;const errors=[];
const check=(ok,msg)=>{if(!ok)result.failures.push(msg);};
// tap: the control is visible, 44px or more both ways, on top at its centre, then touched.
// A view may redraw under the finger (a pushed change); the same control is
// then found again, never a different one.
async function tap(loc,label){
 for(let attempt=1;;attempt++){
  try{
   await loc.tap({trial:true}); // Built-in actionability retries the same locator after a pushed redraw.
   const box=await loc.evaluate(n=>{const root=n.getRootNode();if(!root.elementFromPoint)throw Error('detached by a redraw');const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,top=root.elementFromPoint(x,y);return {w:Math.round(r.width),h:Math.round(r.height),hit:!!top&&(top===n||n.contains(top))};});
   result.taps.push(label+' '+box.w+'x'+box.h);
   check(box.w>=44&&box.h>=44,label+' is '+box.w+'x'+box.h+', under 44px');check(box.hit,label+' is covered where it is tapped');
   await loc.tap();return;
  }catch(e){if(attempt<3&&/not attached|detached/i.test(e.message)){await page.waitForTimeout(300);continue;}throw e;}
 }
}
// inReach: with no scrolling at all, the control is wholly inside the window
// and its chat's visible area, 44px or more, and on top at its centre (the point returned).
async function inReach(loc,label){
 const r=await loc.evaluate(n=>{const root=n.getRootNode(),b=n.getBoundingClientRect(),v=n.closest('.zoom-content').getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,top=root.elementFromPoint(x,y);return {x,y,w:Math.round(b.width),h:Math.round(b.height),inside:b.top>=Math.max(0,v.top)&&b.bottom<=Math.min(innerHeight,v.bottom)&&b.left>=0&&b.right<=innerWidth,hit:!!top&&(top===n||n.contains(top))};});
 check(r.inside,label+' is not in view');check(r.hit,label+' is covered where it is tapped');check(r.w>=44&&r.h>=44,label+' is '+r.w+'x'+r.h+', under 44px');
 result.checks.push(label+' in reach ('+r.w+'x'+r.h+')');return r;
}
const z=()=>page.locator('#zoom'),settled=()=>page.waitForFunction(()=>document.querySelector('#skin')?.shadowRoot?.querySelectorAll('#zoom .zoom-layer').length===1);
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM||undefined});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 const shot=name=>page.screenshot({path:path.join(evidence,'screenshots',m.id+'-touch-'+name+'.png')});
 await page.goto(urls.sergey.page);await page.goto(origin+'/?skin='+m.id);await page.getByRole('button',{name:'Use this skin',exact:true}).tap();await page.locator(rootClass).waitFor();
 /* Long histories for the Zoom check below: real messages in this disposable world, only in Anna's chats (no other journey reads them), topped up to 200 and never repeated; a device conversation is one reply chain. */
 const seed=JSON.parse(fs.readFileSync(path.join(world,'seed.json'))),runTag=Date.now().toString(36);
 await page.waitForFunction(()=>!!window.agentnet?.api);const history=family!=='zoom'?null:await page.evaluate(async({conv,to,count})=>{const api=window.agentnet.api,pad=i=>String(i).padStart(3,'0'),mine=(v,re)=>v.messages.filter(x=>re.test(x.body));
  for(let i=mine(await api('/api/dm?id='+conv),/^Long history \d{3}$/).length+1;i<=count;i++)await api('/api/dm/send',{conv,body:'Long history '+pad(i)});
  const o=await api('/api/overview');let thread=(o.threads||[]).find(t=>t.peer===to&&t.title==='Device history 001')?.id;if(!thread)thread=(await api('/api/send',{to,kind:'message',body:'Device history 001'})).id;
  const t=await api('/api/thread?id='+thread);let last=t.messages.at(-1).id;for(let i=mine(t,/^Device history \d{3}$/).length+1;i<=count;i++)last=(await api('/api/send',{to,kind:'message',body:'Device history '+pad(i),reply_to:last})).id;
  for(let i=0;i<60;i++){const v=[await api('/api/dm?id='+conv),await api('/api/thread?id='+thread)];if(!v.some(x=>x.messages.some(y=>y.state==='queued')))break;await new Promise(r=>setTimeout(r,1000));} /* bounded: their delivery has settled before the views open */
  return {thread};},{conv:seed.dm_anna,to:urls.anna.address,count:200});
 // Settings and You, from the main list.
 if(family==='zoom')await z().locator('.person-card').first().waitFor();
 await tap(page.getByRole('button',{name:'Settings',exact:true}),'Settings');await page.locator('#settings-appearance').waitFor();
 check(await page.locator('#settings-tab-appearance').getAttribute('aria-selected')==='true','Settings opens Appearance');
 await tap(page.locator('#settings-tab-profile'),'Profile tab');await page.locator('#settings-profile').waitFor();
 await tap(page.locator('#settings-close'),'Close settings');check(!(await page.locator('#settings').evaluate(d=>d.open)),'Settings closes');
 await tap(page.locator('#profile-btn'),'You');check(await page.locator('#settings-tab-profile').getAttribute('aria-selected')==='true','You opens Profile');await page.locator('#settings-close').tap();
 await shot('list');
 if(family==='zoom'){
  await tap(z().locator('.person-card').filter({hasText:'Bohdan'}),'Person card');await z().locator('.mini-chat').waitFor();await settled();
  check(await z().locator('.zoom-message').count()===0,'A person card opens the chat');
  const mute=z().locator('.zoom-chips button').first();if(await mute.count()){const before=await mute.textContent();await tap(mute,'Mute chip');await page.waitForFunction(b=>document.querySelector('#skin').shadowRoot.querySelector('#zoom .zoom-chips button')?.textContent!==b,before);await z().locator('.zoom-chips button').first().tap();}
  // Project space (optional Drive): opens in the chat level, closes, and opens again with content (its existing off/unavailable state included).
  const space=()=>z().locator('.zoom-chips').getByRole('button',{name:'Project space',exact:true}),panel=()=>z().locator('#drive-panel:not([hidden])');
  await tap(space(),'Project space');await panel().waitFor();await page.waitForFunction(()=>!!document.querySelector('#skin').shadowRoot.querySelector('#zoom #drive-panel')?.textContent.trim());
  await space().tap();await page.waitForFunction(()=>!document.querySelector('#skin').shadowRoot.querySelector('#zoom #drive-panel:not([hidden])'));
  await space().tap();await panel().waitFor();await page.waitForFunction(()=>!!document.querySelector('#skin').shadowRoot.querySelector('#zoom #drive-panel')?.textContent.trim());result.checks.push('Zoom Project space opens, closes and reopens in the chat');await shot('project-space');await space().tap();
  await tap(z().getByRole('button',{name:'Write in this DM…',exact:true}),'Write in this DM');await page.locator('#write-body').waitFor();await page.locator('#dialog-cancel').tap();
  await tap(z().locator('.mini-chat button.mc-bubble').filter({hasText:/./}).first(),'Message bubble');await z().locator('.zoom-message').waitFor();await settled();
  await tap(z().getByRole('button',{name:'Reply',exact:true}),'Reply');await page.locator('#dialog').getByText(/^Replying to:/).waitFor();await page.locator('#dialog-cancel').tap();await settled();
  await tap(z().locator('.mini-chat .mc.mine button.mc-bubble').last(),'Own message');await z().locator('.zoom-message').waitFor();await settled();
  await tap(z().locator('.zoom-message details.tech > summary'),'Details');
  const menu=z().locator('.zoom-message .msg-menu > summary');if(await menu.count()){await tap(menu,'Message actions');await z().getByRole('button',{name:'Edit',exact:true}).waitFor();await menu.tap();}
  const rungs=z().locator('.ladder .rung');await tap(rungs.nth((await rungs.count())-2),'Ladder: back to the chat');await z().locator('.mini-chat').waitFor();await settled();
  /* Long history (v0.8.26 Android report): Write is in reach the moment a long chat opens and anywhere while its history scrolls, in a DM and in a device conversation, never scrolled to; tapped where it is, it writes to that chat (and a Reply still quotes its message). */
  const longChat=async(name,label)=>{const content=z().locator('.zoom-layer:last-child .zoom-content'),write=z().getByRole('button',{name,exact:true});
   const span=await content.evaluate(c=>({h:c.scrollHeight,v:c.clientHeight}));check(span.h>=10*span.v,label+' history is too short to prove reach: '+span.h+'px in a '+span.v+'px view');result.checks.push(label+': '+span.h+'px of history in a '+span.v+'px view');
   await inReach(write,label+': Write on arrival');
   for(const [where,f] of [['at the oldest',0],['at the newest',1],['mid-history',.5]]){await content.evaluate((c,f)=>{c.scrollTop=f*(c.scrollHeight-c.clientHeight);},f);await page.waitForTimeout(150);await inReach(write,label+': Write '+where);}
   return inReach(write,label+': Write where it is tapped');};
  await tap(z().locator('.ladder .rung').first(),'Ladder: Everyone');await z().locator('.person-card').first().waitFor();await settled();
  await tap(z().locator('.person-card').filter({hasText:'Anna'}),'Anna');await z().locator('.mini-chat').waitFor();await settled();
  // Clearing search recreates the chat header; its observer must follow it on resize.
  const search=z().locator('.zoom-search');await search.fill('Long history');await search.press('Escape');await z().locator('.mini-chat').waitFor();
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
   await page.setViewportSize(viewport);
   await page.waitForFunction(()=>{const root=document.querySelector('#skin').shadowRoot,head=root.querySelector('.zoom-chat-head'),content=head?.closest('.zoom-content'),padding=content&&parseFloat(getComputedStyle(content).scrollPaddingTop);return !!head&&Number.isFinite(padding)&&Math.abs(padding-head.offsetHeight)<=2;});
  }
  result.checks.push('Cleared search keeps sticky-header focus padding current after resize');
  let at=await longChat('Write in this DM…','Long DM');await shot('long-dm');
  await page.touchscreen.tap(at.x,at.y);await page.locator('#write-body').waitFor();check(await page.locator('#dialog-title').textContent()==='Write to Anna','The long DM\'s Write writes to Anna');
  const dmText='Long history write '+runTag;await page.locator('#write-body').fill(dmText);await page.locator('#dialog-ok').tap();await z().locator('.mini-chat').getByText(dmText,{exact:true}).waitFor();
  await tap(z().locator('.mini-chat button.mc-bubble').filter({hasText:'Long history 100'}),'Mid-history message');await z().locator('.zoom-message').waitFor();await settled();
  await tap(z().getByRole('button',{name:'Reply',exact:true}),'Reply (long DM)');await page.locator('#dialog').getByText(/^Replying to: Long history 100/).waitFor();
  const replyText='Long history reply '+runTag;await page.locator('#write-body').fill(replyText);await page.locator('#dialog-ok').tap();await z().locator('.mini-chat').getByText(replyText,{exact:true}).waitFor();
  const dmNow=await page.evaluate(id=>window.agentnet.api('/api/dm?id='+id),seed.dm_anna),parent=dmNow.messages.find(x=>x.body==='Long history 100'),reply=dmNow.messages.find(x=>x.body===replyText);
  check(dmNow.messages.some(x=>x.body===dmText),'The long DM\'s Write was sent in that DM');check(!!reply&&!!parent&&[parent.id,parent.lid].includes(reply.quote),'A Reply from a long DM quotes its message');
  await tap(z().locator('.ladder .rung').first(),'Ladder: Everyone');await z().locator('.person-card').first().waitFor();await settled();
  const anna=()=>z().locator('.person-cluster').filter({hasText:'Anna'});
  await tap(anna().locator('details.person-devices > summary'),'Anna\'s devices');await tap(anna().getByRole('button',{name:/device conversations?$/}),'Device conversations');
  await tap(z().locator('.thread-row').filter({hasText:'Device history 001'}),'Long device conversation');await z().locator('.mini-chat').waitFor();await settled();
  at=await longChat('Write in this conversation…','Long device conversation');await shot('long-device');
  await page.touchscreen.tap(at.x,at.y);await page.locator('#write-body').waitFor();
  check(await page.locator('#dialog-title').textContent()==='Write to '+urls.anna.address,'The device conversation\'s Write writes to its device');check(await page.locator('#write-kind').inputValue()==='message','It still sends as a message by default');
  const devText='Device history write '+runTag;await page.locator('#write-body').fill(devText);await page.locator('#dialog-ok').tap();await z().locator('.mini-chat').getByText(devText,{exact:true}).waitFor();
  check((await page.evaluate(id=>window.agentnet.api('/api/thread?id='+id),history.thread)).messages.some(x=>x.body===devText),'It joined that same device conversation');
  await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(300);await longChat('Write in this conversation…','Desktop long device conversation');await page.setViewportSize({width:390,height:844});
 }else{
  await tap(page.locator('#conv-list button').filter({hasText:'Bohdan'}).first(),'Chat row');await page.locator('#composer').waitFor();await page.waitForTimeout(800); // the chat's own refresh redraws it once
  const theirs=page.locator('#timeline .msg.in').last();
  await tap(theirs.getByRole('button',{name:'Reply',exact:true}),'Reply');await page.locator('#replying').waitFor();await page.locator('#replying-cancel').tap();
  await tap(theirs.locator('.react-pick > summary'),'Add a reaction');await theirs.locator('.react-grid').waitFor();await theirs.locator('.react-close').tap();
  await tap(theirs.getByRole('button',{name:'Remind me…',exact:true}),'Remind me');await page.locator('#dialog').waitFor();await page.locator('#dialog-cancel').tap();
  await tap(theirs.locator('details.tech > summary'),'Details');check(await theirs.locator('details.tech').evaluate(d=>d.open),'Details opens');
  const mine=page.locator('#timeline .msg.out').last();
  await tap(mine.locator('.msg-menu > summary'),'Message actions');await mine.getByRole('button',{name:'Edit',exact:true}).waitFor();await mine.locator('.msg-menu > summary').tap();
  await tap(page.locator('.topics-bar').getByRole('button',{name:'New topic'}),'New topic');check(await page.locator('.topics-bar').getByRole('button',{name:'New topic'}).getAttribute('aria-pressed')==='true','New topic shows as chosen');
  await tap(page.locator('.topics-bar').getByRole('button',{name:/^Main/}),'Main');
  // Phone: the header chips are hidden; Conversation details holds Mute and Project space.
  const details=async name=>{await tap(page.locator('#conversation-details'),'Conversation details');const b=page.locator('#dialog').getByRole('button',{name,exact:true});await tap(b,name);};
  await details('Project space');await page.locator('#drive-panel:not([hidden])').waitFor();await page.waitForFunction(()=>!!document.querySelector('#skin').shadowRoot.querySelector('#drive-panel')?.textContent.trim());
  await details('Project space');await page.locator('#drive-panel').waitFor({state:'hidden'});
  await details('Project space');await page.waitForFunction(()=>!!document.querySelector('#skin').shadowRoot.querySelector('#drive-panel:not([hidden])')?.textContent.trim());result.checks.push('Phone Project space opens, closes and reopens from Conversation details');await details('Project space');
  const mute=async()=>{await tap(page.locator('#conversation-details'),'Conversation details');return page.locator('#dialog').getByRole('button',{name:/^(Mute|Unmute) chat$/});};
  let m1=await mute();if(await m1.count()){const before=await m1.textContent();await tap(m1,'Mute chat (details)');await page.waitForTimeout(800);const m2=await mute();check((await m2.textContent())!==before,'Mute from Conversation details changes the chat');await m2.tap();}else await page.keyboard.press('Escape');
  await shot('chat');await tap(page.locator('#back'),'Back');await page.locator('#conv-list').waitFor();
 }
 await tap(page.locator('#nav-people'),'People');await tap(page.locator('#review-btn'),'Activity');await page.locator('#review').waitFor();await shot('activity');await page.locator('#review-btn').tap();
 result.checks.push('390 touch: '+result.taps.length+' taps, each 44px or more, uncovered and effective');
 assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[],m.id+': failed touch checks');result.pass=true;
 fs.writeFileSync(path.join(evidence,m.id+'-touch.json'),JSON.stringify(result,null,2),{mode:0o600});console.log('PASS '+m.id+' touch: '+result.taps.length+' taps');
})().catch(async e=>{if(page)await page.screenshot({path:path.join(evidence,'screenshots',m.id+'-touch-FAIL.png')}).catch(()=>{});fs.writeFileSync(path.join(evidence,m.id+'-touch.json'),JSON.stringify(result,null,2),{mode:0o600});console.error('FAIL touch:',e.stack,'failures:',result.failures,'taps:',result.taps,'page errors:',errors);process.exitCode=1;}).finally(async()=>{await browser?.close();});
