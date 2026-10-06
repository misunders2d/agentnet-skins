// Actual browser Engine/IndexedDB provider, enrolled only into local fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{X509Certificate,createHash}=require('node:crypto');
const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
const world=process.env.AGENTNET_SKIN_WORLD,evidence=process.env.AGENTNET_SKINS_EVIDENCE,bin=process.env.AGENTNET_COMPANY_BINARY,pkg=process.env.AGENTNET_SKIN_PACKAGE,m=JSON.parse(fs.readFileSync(path.join(pkg,'skin.json')));
const cli=(...args)=>execFileSync(bin,['--home',path.join(world,'sergey'),...args],{encoding:'utf8'});
let browser,page;const errors=[];
(async()=>{
 const cert=new X509Certificate(fs.readFileSync(path.join(world,'cert.pem'))),spki=createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('base64');
 const raw=cli('person','link').match(/agentnet-link-v2:[A-Za-z0-9_-]+/)?.[0];assert(raw,'Fixture must return a device link');
 const offer=JSON.parse(Buffer.from(raw.split(':')[1],'base64url')),invite=JSON.parse(Buffer.from(offer.invite.split(':')[1],'base64url'));
 // The browser checks this exact fixture certificate through Chromium SPKI pin;
 // computer-only certificate field is omitted from the test browser invitation.
 const origin=new URL(invite.hub).origin;assert.equal(new URL(origin).hostname,'127.0.0.1');delete invite.cert;offer.invite='agentnet-invite-v1:'+Buffer.from(JSON.stringify(invite)).toString('base64url');
 browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM||undefined,args:['--ignore-certificate-errors-spki-list='+spki]});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Test Phone) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'});page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.goto(origin+'/?skin='+m.id+'#agentnet-link-v2:'+Buffer.from(JSON.stringify(offer)).toString('base64url'));
 await page.locator('.join-go').click();
 let id;const deadline=Date.now()+20000;while(Date.now()<deadline){id=cli('person','links').match(/^([a-f0-9]{32})\s+pending\s/m)?.[1];if(id)break;await new Promise(r=>setTimeout(r,100));}assert(id,'Browser requested own-device approval');cli('person','approve',id);
 await page.getByRole('button',{name:'Use this skin',exact:true}).waitFor();await page.getByRole('button',{name:'Use this skin',exact:true}).click();await page.locator('.holonet-root').waitFor();await page.waitForFunction(()=>window.agentnet?.platform==='browser');
 await page.locator('#nav-chats').click();await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().waitFor();await page.screenshot({path:path.join(evidence,'screenshots',m.id+'-engine-chats.png')});
 await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().click();await page.locator('#composer').waitFor();
 const text='Browser-provider synthetic '+Date.now();await page.locator('#body').fill(text);await page.locator('#composer').evaluate(f=>f.requestSubmit());await page.locator('#timeline').getByText(text,{exact:true}).waitFor();
 const name='browser-provider.txt';await page.locator('#file-input').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from('Encrypted browser-provider fixture bytes')});await page.locator('#composer').evaluate(f=>f.requestSubmit());const row=page.locator('#timeline .msg').filter({hasText:name});await row.getByRole('button',{name:'Open',exact:true}).click();const link=row.getByRole('link',{name:'Download '+name,exact:true});await link.waitFor();
 await page.screenshot({path:path.join(evidence,'screenshots',m.id+'-engine-thread-files.png')});await page.reload();await page.locator('.holonet-root').waitFor();assert.equal(await page.getByRole('button',{name:'Use this skin',exact:true}).count(),0);if(await page.locator('#back').isVisible())await page.locator('#back').click();await page.locator('#nav-chats').click();await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().click();await page.locator('#timeline').getByText(text,{exact:true}).waitFor();assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(evidence,m.id+'-browser-provider.json'),JSON.stringify({pass:true,skin:m.id,host_version:1,provider:'Actual browser Engine/IndexedDB against disposable TLS Hub',checks:['Own device enrollment approved in synthetic native home','Installed relay package trust and mount','History/people present in browser provider','Browser send/file stage/file open via captured host','IndexedDB history and trust survive reload'],limits:['Chromium Android viewport/UA, not physical Android OS','Test certificate pinned by SPKI; no public/live relay or Google account']},null,2),{mode:0o600});console.log('PASS '+m.id+' actual browser provider: enrollment, host API, sends/files, IndexedDB reload');
})().catch(async e=>{await page?.screenshot({path:path.join(evidence,'screenshots',m.id+'-engine-FAIL.png')}).catch(()=>{});console.error('FAIL browser provider:',e.stack,'page errors:',errors);process.exitCode=1;}).finally(async()=>{await browser?.close();});
