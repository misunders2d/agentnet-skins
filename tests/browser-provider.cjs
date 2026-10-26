// Actual browser Engine/IndexedDB provider, enrolled only into local fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {X509Certificate,createHash}=require('node:crypto');
const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
const world=process.env.AGENTNET_SKIN_WORLD,evidence=process.env.AGENTNET_SKINS_EVIDENCE,pkg=process.env.AGENTNET_SKIN_PACKAGE,m=JSON.parse(fs.readFileSync(path.join(pkg,'skin.json')));
const rootClass='.'+(process.env.AGENTNET_SKIN_FAMILY||m.id)+'-root';

// The skin's interaction family: Classic family (Holonet, Classic) or Zoom.
const family=process.env.AGENTNET_SKIN_FAMILY||m.id,z=()=>page.locator('#zoom'),settled=()=>page.waitForFunction(()=>document.querySelector('#skin')?.shadowRoot?.querySelectorAll('#zoom .zoom-layer').length===1);
const ui=family==='zoom'?{
 // Reload may restore Main; list() still explicitly requires Everyone/Vitalii.
 async ready(){await z().locator('.zoom-layer:only-child .ladder').waitFor();await settled();},
 async list(){await page.locator('#nav-chats').click();await settled();await z().locator('.ladder .rung').nth(0).click();await z().locator('.person-card').filter({hasText:'Vitalii'}).waitFor();await settled();},
 // A person card opens their Main chat, including a newly linked empty inbox.
 // Its empty list has no box; the visible enabled Write action proves readiness.
 async thread(){await z().locator('.person-card').filter({hasText:'Vitalii'}).click();await z().locator('.mini-chat').waitFor({state:'attached'});const write=z().getByRole('button',{name:'Write in this DM…',exact:true});await write.waitFor();await settled();assert(await write.isEnabled(),'The loaded DM accepts a new message, including empty history');assert.equal(await z().locator('.zoom-message').count(),0,'A person card opens their DM as a chat, not its latest message');},
 async send(text,file){await z().getByRole('button',{name:'Write in this DM…',exact:true}).click();await page.locator('#write-body').fill(text);if(file)await page.locator('#write-files').setInputFiles(file);await page.locator('#dialog-ok').click();await page.locator('#dialog').waitFor({state:'hidden'});},
 sent:text=>z().locator('.mini-chat').getByText(text,{exact:true}),
 async fileView(name){await settled();await z().locator('button.mc-bubble').filter({hasText:name}).click();await z().locator('.zoom-message').waitFor();await settled();return z().locator('.zoom-message');},
}:{
 async list(){if(await page.locator('#back').isVisible())await page.locator('#back').click();await page.locator('#nav-chats').click();await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().waitFor();},
 async thread(){await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().click();await page.locator('#composer').waitFor();},
 async send(text,file){if(file)await page.locator('#file-input').setInputFiles(file);if(text)await page.locator('#body').fill(text);await page.locator('#composer').evaluate(f=>f.requestSubmit());},
 sent:text=>page.locator('#timeline').getByText(text,{exact:true}),
 async fileView(name){return page.locator('#timeline .msg').filter({hasText:name});},
};
let browser,page,owner;const errors=[];
// The native owner decides through its existing authenticated daemon, using
// the same human-device approval as the UI; no second CLI opens its live DB.
const nativeAPI=(route,body)=>owner.evaluate(async ({route,body})=>{
 const response=await fetch(route,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 if(!response.ok)throw Error('Native fixture API '+route+' returned '+response.status);
 return response.json();
},{route,body});
(async()=>{
 const cert=new X509Certificate(fs.readFileSync(path.join(world,'cert.pem'))),spki=createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('base64');
 browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM||undefined,args:['--ignore-certificate-errors-spki-list='+spki]});
 const nativeURL=new URL(JSON.parse(fs.readFileSync(path.join(world,'urls.json'))).sergey.page.match(/https?:\/\/\S+/)[0]);assert.equal(nativeURL.hostname,'127.0.0.1');
 const nativeContext=await browser.newContext();await nativeContext.route('**/*',route=>new URL(route.request().url()).origin===nativeURL.origin?route.continue():route.abort());owner=await nativeContext.newPage();owner.setDefaultTimeout(20000);await owner.goto(nativeURL.href);
 const before=await nativeAPI('/api/overview');assert.equal(before.role,'person');assert.equal(before.person?.state,'self');const own=before.person.devices.find(d=>d.this);assert(own?.human,'Approver must be the current human device');assert.equal(own.address,before.me.address);assert.equal(own.fingerprint,before.me.fingerprint);
 const offerLink=await nativeAPI('/api/device/link',{}),raw=offerLink.url.match(/agentnet-link-v2:[A-Za-z0-9_-]+/)?.[0];assert(raw,'Fixture must return a device link');
 const offer=JSON.parse(Buffer.from(raw.split(':')[1],'base64url')),invite=JSON.parse(Buffer.from(offer.invite.split(':')[1],'base64url'));
 // The browser checks this exact fixture certificate through Chromium SPKI pin;
 // computer-only certificate field is omitted from the test browser invitation.
 const origin=new URL(invite.hub).origin;assert.equal(new URL(origin).hostname,'127.0.0.1');delete invite.cert;offer.invite='agentnet-invite-v1:'+Buffer.from(JSON.stringify(invite)).toString('base64url');
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Test Phone) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'});page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.goto(origin+'/?skin='+m.id+'#agentnet-link-v2:'+Buffer.from(JSON.stringify(offer)).toString('base64url'));
 await page.locator('.join-go').click();
 assert.equal(offer.person,before.person.person);assert.equal(offer.approver.address,own.address);assert.equal(offer.approver.fingerprint,own.fingerprint);
 let pending;const deadline=Date.now()+20000;while(Date.now()<deadline){pending=(await nativeAPI('/api/overview')).links?.find(r=>r.id===offer.offer);if(pending)break;await new Promise(r=>setTimeout(r,100));}assert(pending,'Browser requested this exact device offer');assert.equal(pending.state,'pending');const joining={address:pending.address,fingerprint:pending.fingerprint};
 await nativeAPI('/api/device/decide',{id:pending.id,accept:true}); // one exact ordinary human approval, never retried
 const approved=await nativeAPI('/api/overview');assert.equal(approved.role,'person');assert.equal(approved.person.state,'self');assert.equal(approved.person.person,before.person.person);const added=approved.person.devices.find(d=>d.address===joining.address&&d.fingerprint===joining.fingerprint);assert(added?.human,'The exact new device is a verified human');assert.equal(approved.person.devices.length,before.person.devices.length+1);for(const d of before.person.devices)assert(approved.person.devices.some(a=>a.address===d.address&&a.fingerprint===d.fingerprint&&a.human===d.human),'Existing signed roster binding is preserved');
 await page.getByRole('button',{name:'Use this skin',exact:true}).waitFor();await page.getByRole('button',{name:'Use this skin',exact:true}).click();await page.locator(rootClass).waitFor();await page.waitForFunction(()=>window.agentnet?.platform==='browser');await ui.ready?.();
 const linked=await page.evaluate(()=>window.agentnet.api('/api/overview'));assert.equal(linked.role,'person');assert.equal(linked.person?.state,'self');assert.equal(linked.person.person,before.person.person);assert.equal(linked.me.address,joining.address);assert.equal(linked.me.fingerprint,joining.fingerprint);const exact=linked.person.devices.find(d=>d.this);assert(exact?.human,'Browser is its verified human device');assert.equal(exact.address,joining.address);assert.equal(exact.fingerprint,joining.fingerprint);
 const enrollmentProof={exactOfferAndPendingKey:true,approverIsCurrentVerifiedHuman:true,sameVerifiedPerson:true,exactNewDeviceHumanBinding:true,originalRosterBindingsPreserved:true,oneApprovalCall:true,rosterDeviceCount:approved.person.devices.length};
 await ui.list();await page.screenshot({path:path.join(evidence,'screenshots',m.id+'-engine-chats.png')});
 await ui.thread();
 const text='Browser-provider synthetic '+Date.now();await ui.send(text);await ui.sent(text).waitFor();
 const name=m.id+'-browser-provider-'+Date.now().toString(36)+'.txt';await ui.send('',{name,mimeType:'text/plain',buffer:Buffer.from('Encrypted browser-provider fixture bytes')});const row=await ui.fileView(name);await row.getByRole('button',{name:'Open',exact:true}).click();const link=row.getByRole('link',{name:'Download '+name,exact:true});await link.waitFor();
 await page.screenshot({path:path.join(evidence,'screenshots',m.id+'-engine-thread-files.png')});await page.reload();await page.locator(rootClass).waitFor();assert.equal(await page.getByRole('button',{name:'Use this skin',exact:true}).count(),0);await ui.ready?.();await ui.list();await ui.thread();await ui.sent(text).waitFor();assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(evidence,m.id+'-browser-provider.json'),JSON.stringify({pass:true,skin:m.id,host_version:1,provider:'Actual browser Engine/IndexedDB against disposable TLS Hub',enrollment:enrollmentProof,checks:['Own device enrollment approved in synthetic native home','Installed relay package trust and mount','History/people present in browser provider','Browser send/file stage/file open via captured host','IndexedDB history and trust survive reload'],limits:['Chromium Android viewport/UA, not physical Android OS','Test certificate pinned by SPKI; no public/live relay or Google account']},null,2),{mode:0o600});console.log('PASS '+m.id+' actual browser provider: enrollment, host API, sends/files, IndexedDB reload');
})().catch(async e=>{await page?.screenshot({path:path.join(evidence,'screenshots',m.id+'-engine-FAIL.png')}).catch(()=>{});console.error('FAIL browser provider:',e.stack,'page errors:',errors);process.exitCode=1;}).finally(async()=>{await browser?.close();});
