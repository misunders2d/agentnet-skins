// Actual standalone packages; invented report projection and recorded API actions.
// Keep every intercepted action, including reads and rejected actions. Native
// decision assertions use their own list; a read must match the real thread view.
function createNativeAudit() {
 const assert=require('node:assert/strict'),events=[],calls=[],reads=[];
 let expected=[];
 const keys=(value,names)=>assert.deepEqual(Object.keys(value).sort(),names.sort());
 return {events,calls,reads,
  observeThread(view) {
   expected=view.messages.filter(m=>m.unread||m.dir==='out').map(m=>m.id);
   assert(expected.every(id=>/^[0-9a-f]{32}$/.test(id)));
   assert.equal(new Set(expected).size,expected.length);
  },
  record(path,body) {
   const call={path,body:structuredClone(body)};events.push(call);
   if(path==='/api/act'&&body.do==='read') {
    keys(body,['do','ids']);assert(Array.isArray(body.ids)&&body.ids.length>0);
    assert.deepEqual(body.ids,expected,'Read must name exactly the eligible real thread messages');
    const entry={call,expected:[...expected],status:null};reads.push(entry);expected=[];
    return {kind:'read',entry};
   }
   const local=path==='/api/act';assert(local||path==='/api/operator/decide','Unexpected action endpoint');
   keys(body,local?['do','id','key','attempt','body','send_id']:['host','id','key','attempt','action','expect','text','report','send_id']);
   assert.equal(local?body.do:body.action,'continue');assert.equal(body.id,'a'.repeat(32));
   assert.equal(body.key,'fixture-request-key');assert.equal(body.attempt,1);assert.match(body.send_id,/^[0-9a-f]{32}$/);
   if(!local){assert.equal(body.host,'owner/native-host');assert.equal(body.expect,'running');assert.equal(body.report,'c'.repeat(32));}
   const text=local?body.body:body.text,prefix='agentnet-native-response-v1\n';assert(text.startsWith(prefix));
   const response=JSON.parse(text.slice(prefix.length));assert.equal(response.token,'b'.repeat(32));
   assert(['allow','deny','cancel','submit'].includes(response.choice));
   assert(Object.keys(response).every(k=>['token','choice','answers','values'].includes(k)));
   calls.push(call);return {kind:'native'};
  },
  completeRead(entry,status) {
   assert(reads.includes(entry));assert.equal(entry.status,null);entry.status=status;
   assert(status>=200&&status<300,'The real demo provider must accept the read');
  },
  verify() {
   assert.equal(events.length,calls.length+reads.length,'Every action must be classified');
   assert(reads.every(r=>r.status>=200&&r.status<300),'Every read must complete successfully');
  }
 };
}
module.exports={createNativeAudit};
if(require.main===module) {
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT || 'playwright');
const main=process.env.AGENTNET_UPSTREAM;
const [target,...dirs]=process.argv.slice(2);
if (!main || !target || !dirs.length) { console.error('Usage: AGENTNET_UPSTREAM=source node tests/native-requests.cjs DAEMON_URL SKIN_DIR...');process.exit(2); }
const packages=new Map(dirs.map(dir=>[JSON.parse(fs.readFileSync(path.join(dir,'skin.json'))).id,path.resolve(dir)])),ids=[...packages.keys()];
const root=process.env.AGENTNET_SCREENSHOTS;if(root)fs.mkdirSync(root,{recursive:true,mode:0o700});
let browser,server;const actionAudit=createNativeAudit(),calls=actionAudit.calls,errors=[];
(async()=>{const url=new URL(target);
const first=await fetch(url),cookie=first.headers.get('set-cookie')?.split(';')[0];assert(cookie);
server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://fixture');
 if(u.pathname.startsWith('/transport/')){const p=u.pathname.slice('/transport'.length)+u.search;let body='';for await(const chunk of req)body+=chunk;
  const action=req.method==='POST'&&(p==='/api/operator/decide'||p==='/api/act')?actionAudit.record(p,JSON.parse(body)):null;
  if(action?.kind==='native'){if(calls.at(-1).body.text?.includes('\"secret\"')&&calls.filter(c=>c.body.text?.includes('\"secret\"')).length%2===1){res.statusCode=503;res.end('Lost response');return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({note:'saved'}));return;}
  const r=await fetch(new URL(p,url),{method:req.method,headers:{Cookie:cookie,Origin:url.origin,...(body?{'Content-Type':'application/json'}:{})},body:body||undefined});let bytes=Buffer.from(await r.arrayBuffer());
  if(p.startsWith('/api/thread?')&&r.ok)actionAudit.observeThread(JSON.parse(bytes));
  if(action?.kind==='read')actionAudit.completeRead(action.entry,r.status);
  if(p==='/api/overview'&&r.ok){const o=JSON.parse(bytes);const mode=req.headers['x-native-fixture']||'allow';o.threads.push({id:'c'.repeat(32),peer:'owner/native-host',title:'Native request',last_at:new Date().toISOString(),count:1,notices:1});o.review=[{id:'c'.repeat(32),peer:'owner/native-host',kind:'message',why:'Native request',notice:true,at:new Date().toISOString(),report:{host:'owner/native-host',at:new Date().toISOString(),items:[{id:'a'.repeat(32),from:o.me.address,key:'fixture-request-key',kind:'question',state:'running',blocker:'running',since:new Date().toISOString(),attempt:1,actionable:false,native:{harness:'codex',host:'owner/native-host',request:'a'.repeat(32),key:'fixture-request-key',attempt:1,token:'b'.repeat(32),expires:0,choices:['allow','deny','cancel'],cwd:'/fixture',operation:'printf exact > fixture.md'}}]}}];const item=o.review[0].report.items[0],n=item.native;if(mode==='secret'){n.choices=['submit','cancel'];n.questions=[{id:'secret',question:'Private fixture answer',isSecret:true}];}if(mode==='form'){n.choices=['submit','cancel'];n.fields=[{id:'ready',type:'boolean',title:'Ready?',required:true},{id:'empty',type:'string',enum:['','value'],title:'Empty enum',required:true}];}if(mode==='local'){n.host=o.me.address;o.review[0].peer=n.host;o.review[0].report.host=n.host;o.threads.at(-1).peer=n.host;}if(mode==='expired')n.expires=Date.now()-100;bytes=Buffer.from(JSON.stringify(o));}
  res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json'});res.end(bytes);return;}
 if(u.pathname.startsWith('/pkg/')){const [, ,id,...parts]=u.pathname.split('/'),pkg=packages.get(id),name=parts.join('/'),m=JSON.parse(fs.readFileSync(path.join(pkg,'skin.json')));if(!['skin.json',...m.files].includes(name)){res.statusCode=404;res.end();return;}res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.mjs')?'text/javascript':'application/octet-stream');res.end(fs.readFileSync(path.join(pkg,name)));return;}
 if(u.pathname.startsWith('/assets/')){const name=u.pathname.slice(8);if(!['typing.mjs','core.css','skin-base.css'].includes(name)){res.statusCode=404;res.end();return;}res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(path.join(main,'internal/ui/static',name)));return;}
 if(u.pathname==='/'){const id=u.searchParams.get('skin');assert(ids.includes(id));res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/assets/core.css"><div id="skin"></div><script type="module">
const realFetch=fetch.bind(window),mode=new URLSearchParams(location.search).get('mode')||'allow';let open;
const host={version:1,platform:'daemon',workspace:{id:'default',endpoint:location.origin,address:'owner/phone'},workspaces:null,api:async(p,b)=>{const r=await realFetch('/transport'+p,b===undefined?{headers:{'X-Native-Fixture':mode}}:{method:'POST',headers:{'Content-Type':'application/json','X-Native-Fixture':mode},body:JSON.stringify(b)});if(!r.ok)throw Error(await r.text());return r.json();},listen(){return()=>{};},onOpen(f){open=f;},skins:[{id:'${id}',name:'${id}'},{id:'comic',name:'Comic',builtin:true}],onSkinsChange(){return()=>{};},selectSkin(){throw Error('No skin switch required');},file(){throw Error('No file read');},stage(){throw Error('No upload');}};
const shadow=document.getElementById('skin').attachShadow({mode:'open'}),base=document.createElement('link');base.rel='stylesheet';base.href='/assets/skin-base.css';const css=document.createElement('link');css.rel='stylesheet';css.href='/pkg/${id}/style.css';const root=document.createElement('div');shadow.append(base,css,root);const module=await import('/pkg/${id}/entry.mjs');await module.mount(root,host);window.openNative=()=>open('', 'review');window.unmountNative=()=>module.unmount(root);window.ready=true;
</script>`);return;}
 res.statusCode=404;res.end();
}catch(e){res.statusCode=500;res.end('Fixture error');errors.push(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM || process.env.AGENTNET_CHROME || '/usr/bin/chromium'});const results=[];
for(const id of ids){const page=await browser.newPage();page.on('pageerror',e=>errors.push(id+': '+e.message));for(const width of [390,320,1280]){const before=calls.length;await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:'+server.address().port+'/?skin='+id);await page.waitForFunction(()=>window.ready);await page.evaluate(()=>window.openNative());const card=page.getByRole('listitem').filter({has:page.getByText('Codex native request',{exact:true})});try { await card.getByRole('button',{name:'Allow this action',exact:true}).waitFor(); } catch(e) { if(root)fs.writeFileSync(path.join(root,id+'-'+width+'-failure.json'),JSON.stringify({errors,dom:await page.evaluate(()=>document.getElementById('skin').shadowRoot.innerHTML)},null,2));if(root)await page.screenshot({path:path.join(root,id+'-'+width+'-failure.png')});throw e; }assert.equal(await page.getByText(/listed these but did not let this device decide/).count(),0);const button=card.getByRole('button',{name:'Allow this action',exact:true});assert((await button.boundingBox()).height>=44);await button.hover();assert(await button.evaluate(b=>{const s=getComputedStyle(b),luma=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(v=>{const c=Number(v)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};const a=luma(s.color),c=luma(s.backgroundColor);return(Math.max(a,c)+.05)/(Math.min(a,c)+.05)>=4.5;}),'Native primary action must remain legible while hovered');await button.click();await page.waitForFunction(()=>{const r=document.getElementById('skin').shadowRoot;return /Response saved/.test(r.textContent);});assert.equal(calls.length,before+1);assert.equal(calls.at(-1).path,'/api/operator/decide');assert.equal(calls.at(-1).body.expect,'running');if(root)await page.screenshot({path:path.join(root,id+'-'+width+'.png')});await page.evaluate(()=>window.unmountNative());results.push({skin:id,width,pass:true});}
for(const mode of ['secret','form','local','expired']) {
 const before=calls.length;await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:'+server.address().port+'/?skin='+id+'&mode='+mode);await page.waitForFunction(()=>window.ready);await page.evaluate(()=>window.openNative());
 const card=page.getByRole('listitem').filter({has:page.getByText('Codex native request',{exact:true})});
 if(mode==='secret') {
  await card.getByLabel('Private fixture answer').fill('fixture-secret');assert.equal(await card.getByLabel('Private fixture answer').getAttribute('type'),'password');
  await card.getByRole('button',{name:'Send native answer',exact:true}).click();await card.getByRole('button',{name:'Retry response',exact:true}).click();
  await card.getByText(/Response saved/).waitFor();assert.deepEqual(calls[before+1],calls[before]);assert.equal(await card.getByLabel('Private fixture answer').inputValue(),'');
 }else if(mode==='form') {
  await card.getByLabel('Ready?').selectOption('1');await card.getByLabel('Empty enum').selectOption('0');await card.getByRole('button',{name:'Send native answer',exact:true}).click();await card.getByText(/Response saved/).waitFor();
  assert.deepEqual(JSON.parse(calls[before].body.text.slice('agentnet-native-response-v1\n'.length)).values,{ready:false,empty:''});
 }else if(mode==='local') {
  await card.getByRole('button',{name:'Allow this action',exact:true}).click();await card.getByText(/Response saved/).waitFor();assert.equal(calls[before].path,'/api/act');
 }else {assert.equal(await card.getByRole('button',{name:'Allow this action',exact:true}).isDisabled(),true);assert.equal(calls.length,before);}
 await page.evaluate(()=>window.unmountNative());results.push({skin:id,mode,pass:true});
}await page.close();}
actionAudit.verify();assert.deepEqual(errors,[]);if(root)fs.writeFileSync(path.join(root,'native-result.json'),JSON.stringify({results,errors,audit:actionAudit.events,reads:actionAudit.reads},null,2));console.log(JSON.stringify({checks:results.length,actions:actionAudit.events.length,reads:actionAudit.reads.length,result:'PASS',scope:'actual built standalone skins, mocked native report/action; real validated demo reads; no native authority claim'}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(root)fs.writeFileSync(path.join(root,'native-audit.json'),JSON.stringify({actions:actionAudit.events,reads:actionAudit.reads,errors},null,2));if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
}
