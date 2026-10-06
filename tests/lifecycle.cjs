// Modified from pinned AgentNet v0.8.1 tests for portable scaffold-family packages.
// Dynamic identity, isolated provider journeys and added regression coverage.
// Isolated contract enforcement: actual Classic package against public host
// backed by the disposable native provider; no production-global fallback.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
const evidence=path.resolve(process.env.AGENTNET_CLASSIC_EVIDENCE||'/tmp/agentnet-classic-evidence');
const pkg=path.resolve(process.env.AGENTNET_SKIN_PACKAGE),manifest=JSON.parse(fs.readFileSync(path.join(pkg,'skin.json'),'utf8'));
const bootstrap=`import {mount,unmount} from '/copied-package/entry.mjs';
const raw=window.fetch.bind(window), Source=window.EventSource;
const root=document.querySelector('#surface').attachShadow({mode:'open'}),css=document.createElement('link'),box=document.createElement('div');
css.rel='stylesheet';css.href='/copied-package/style.css';root.append(css,box);box.style.height='100vh';
for(const key of ['agentnet','agentnetEngine','agentnetWorkspace','agentnetModules'])Object.defineProperty(window,key,{get(){throw Error('Private global '+key)}});
window.fetch=()=>{throw Error('Direct module fetch')};window.EventSource=function(){throw Error('Direct module EventSource')};
window.capabilityMode='absent';window.appUpdates=0;window.appReplacements=0;window.clipboardReads=0;window.hostCalls=0;window.streams=0;window.catalogListeners=0;window.outside=[];
const observer=new MutationObserver(records=>{for(const r of records)if(r.target.getRootNode()!==root)outside.push(r.type+':'+r.target.nodeName)});
observer.observe(document.documentElement,{attributes:true,childList:true,subtree:true});
const view={},otherView={},views={default:view,other:otherView};window.reconnects=0;window.sendCount=0;
const known={version:1,platform:'daemon',workspace:{id:'default'},workspaces:{state:id=>views[id],list:()=>[{id:'default'},{id:'other'}]},skins:[{id:${JSON.stringify(manifest.id)},name:${JSON.stringify(manifest.name)}},{id:'default',name:'Comic'}],selectSkin(){},onOpen(){},
 onSkinsChange(){catalogListeners++;return()=>catalogListeners--;},
 api:async(p,b)=>{hostCalls++;if(window.retired&&p==='/api/overview'){const e=Error('stale or disconnected workspace');e.status=409;throw e;}if(b&&['/api/dm/send','/api/send'].includes(p))window.sendCount++;if(p==='/api/dm/send'&&window.sendGate){window.sendStarted=true;await window.sendGate;window.sendGate=null}const r=await raw('/transport'+p,b===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw Error(await r.text());return r.json()},
 listen(fn){window.restart=()=>fn({type:'restart'});streams++;const es=new Source('/transport/events');es.addEventListener('change',e=>fn({type:'change',seq:Number(e.data)}));return()=>{es.close();streams--}},
 stage:async f=>{const r=await raw('/transport/api/upload?name='+encodeURIComponent(f.name),{method:'POST',body:f});return(await r.json()).id},
 file:async(id,i,dir)=>{const r=await raw('/transport/api/files/'+id+'/'+i+'?dir='+dir);return{bytes:new Uint8Array(await r.arrayBuffer())}},
};
known.reconnect=async(...args)=>{if(args.length)throw Error('reconnect takes no arguments');window.reconnects++;await unmount(box);window.retired=false;await mount(box,host);};
const optional={appStatus:async()=>{if(window.capabilityMode==='reject')throw Error('App unavailable in this host');return{cli_path:'/synthetic/agentnet',cli_state:'custom',version:'fixture',app_update_supported:true}},appUpdate:async()=>{window.appUpdates++;return{state:'restarting',message:'Synthetic update prepared; restart not proven'}},appReplaceCommand:async()=>{window.appReplacements++;return{cli_state:'installed'}},clipboardImage:async()=>{window.clipboardReads++;return null}};
const host=new Proxy(known,{get(t,k){if(['drive','manageLocalSkins','skin'].includes(k))return undefined;if(k in optional)return window.capabilityMode==='absent'?undefined:optional[k];if(!(k in t))throw Error('Undocumented host member '+String(k));return t[k]}});
const otherHost=new Proxy({...known,workspace:{id:'other'}},{get(t,k){if(['drive','manageLocalSkins','skin'].includes(k))return undefined;if(k in optional)return window.capabilityMode==='absent'?undefined:optional[k];if(!(k in t))throw Error('Undocumented host member '+String(k));return t[k]}});
window.mountOther=()=>mount(box,otherHost);window.view=view;window.unmountClassic=()=>unmount(box);window.mountClassic=()=>mount(box,host);await mount(box,host);window.ready=true;`;
let server,browser,page;const errors=[];
(async()=>{
 const urls=JSON.parse(fs.readFileSync(path.join(process.env.AGENTNET_SKIN_WORLD||path.join(evidence,'world'),'urls.json'),'utf8'));const native=new URL(urls.sergey.page);
 assert(native.hostname==='127.0.0.1'&&native.port!=='18990');
 const login=await fetch(native.href,{redirect:'manual'});const cookie=login.headers.get('set-cookie')?.split(';')[0];assert(cookie);
 server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://fixture');
  if(u.pathname.startsWith('/transport/')){
   const target=new URL(u.pathname.slice('/transport'.length)+u.search,native.origin);const init={method:req.method,headers:{cookie,'Host':native.host,'Origin':native.origin}};
   if(req.headers['content-type'])init.headers['Content-Type']=req.headers['content-type'];
   if(req.method!=='GET'){init.body=Readable.toWeb(req);init.duplex='half'}
   const controller=new AbortController();init.signal=controller.signal;res.once('close',()=>controller.abort());const upstream=await fetch(target,init);res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/json'});Readable.fromWeb(upstream.body).on('error',()=>res.destroy()).pipe(res);return;
  }
  let body,type='text/javascript';
  if(u.pathname==='/'){body='<!doctype html><meta name="viewport" content="width=device-width"><style>html,body,#surface{margin:0;height:100%;}</style><div id="surface"></div><script type="module" src="/bootstrap.mjs"></script>';type='text/html'}
  else if(u.pathname==='/bootstrap.mjs')body=bootstrap;
  else if(u.pathname.startsWith('/copied-package/')){const n=u.pathname.slice('/copied-package/'.length);if(!manifest.files.includes(n)){res.writeHead(404);res.end();return}body=fs.readFileSync(path.join(pkg,n));type=n.endsWith('.css')?'text/css':n.endsWith('.svg')?'image/svg+xml':n.endsWith('.png')?'image/png':'text/javascript'}
  else {res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':type});res.end(body);
 }catch(e){res.writeHead(500);res.end('Fixture transport failed')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({executablePath:process.env.AGENTNET_CHROMIUM||undefined,headless:true,args:['--no-sandbox']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);
 await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().click();await page.locator('#conv-name').filter({hasText:'Vitalii'}).waitFor();
 if(await page.locator('#hub:visible').count()) await page.locator('#hub .thread-row').first().click();
 await page.locator('#body').fill('Saved contract-only draft');
 await page.evaluate(()=>unmountClassic());await page.evaluate(()=>mountOther());
 await page.locator('#conv-list').getByText('Vitalii',{exact:true}).first().click();await page.locator('#composer').waitFor();assert.equal(await page.locator('#body').inputValue(),'','Second membership must not inherit first draft');await page.locator('#body').fill('Other workspace draft');await page.evaluate(()=>unmountClassic());await page.evaluate(()=>mountClassic());await page.waitForFunction(()=>document.querySelector('#surface').shadowRoot.querySelector('#body').value==='Saved contract-only draft');
 const before=await page.evaluate(()=>({streams,catalogListeners,hostCalls,outside}));assert(before.streams===1&&before.catalogListeners===1&&before.hostCalls>0);assert.deepEqual(before.outside,[]);
 assert(await page.locator('[data-skin="'+manifest.id+'"]').getAttribute('aria-pressed')==='true');
 await page.evaluate(()=>unmountClassic());assert(await page.evaluate(id=>!!view[id]&&!view.default,manifest.id));assert.deepEqual(await page.evaluate(()=>({streams,catalogListeners})),{streams:0,catalogListeners:0});
 await page.evaluate(()=>mountClassic());await page.locator('#body').filter({visible:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#surface').shadowRoot.querySelector('#body').value==='Saved contract-only draft');
 await page.evaluate(()=>{window.sendGate=new Promise(r=>window.releaseSend=r)});
 const text='Classic pending remount '+Date.now();await page.locator('#body').fill(text);await page.locator('#composer').evaluate(el=>el.requestSubmit());await page.waitForFunction(()=>window.sendStarted);
 await page.evaluate(()=>unmountClassic());await page.evaluate(()=>mountClassic());await page.locator('#timeline').getByText(text,{exact:true}).waitFor();assert.equal(await page.locator('#body').inputValue(),'','Pending preview retains send while composer accepts newer drafts');await page.evaluate(()=>releaseSend());
 await page.locator('#timeline').getByText(text,{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('#surface').shadowRoot.querySelector('#send').disabled&&document.querySelector('#surface').shadowRoot.querySelector('#body').value==='');
 await page.locator('#body').fill('Reconnect keeps draft');await page.locator('#file-input').setInputFiles({name:'restart.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic restart')});
 await page.evaluate(()=>unmountClassic());await page.evaluate(id=>{for(const d of Object.values(view[id].drafts))for(const f of d.files||[])f.staged='retired-daemon-stage';},manifest.id);await page.evaluate(()=>mountClassic());
 await page.waitForFunction(()=>document.querySelector('#surface').shadowRoot.querySelector('#body').value==='Reconnect keeps draft');
 const sentBeforeRestart=await page.evaluate(()=>sendCount);await page.evaluate(()=>{window.retired=true;restart();});await page.waitForFunction(()=>reconnects===1);
 await page.waitForFunction(()=>document.querySelector('#surface').shadowRoot.querySelector('#body').value==='Reconnect keeps draft');
 await page.locator('#attach-list').getByText(/Reattach after restart/).waitFor();
 await page.locator('#composer').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>document.querySelector('#surface').shadowRoot.querySelector('#compose-error').textContent.includes('reattach'));
 assert.equal(await page.evaluate(()=>sendCount),sentBeforeRestart,'Reconnect must never replay staged files or send');assert.deepEqual(await page.evaluate(()=>({streams,catalogListeners})),{streams:1,catalogListeners:1});
 await page.evaluate(()=>{window.capabilityMode='present'});await page.locator('#profile-btn').click();await page.locator('#settings-tab-device').click();await page.getByRole('button',{name:'Replace command…',exact:true}).click();assert.equal(await page.evaluate(()=>appReplacements),0,'Opening confirmation never replaces command');await page.locator('#dialog-cancel').click();assert.equal(await page.evaluate(()=>appReplacements),0,'Cancel never replaces command');await page.getByRole('button',{name:'Replace command…',exact:true}).click();await page.locator('#dialog-ok').click();await page.waitForFunction(()=>appReplacements===1);await page.getByText('Your tools can use this copy of AgentNet.',{exact:true}).waitFor();await page.locator('#settings-tab-profile').click();await page.getByRole('button',{name:'Update AgentNet',exact:true}).click();await page.waitForFunction(()=>appUpdates===1);await page.getByText('Synthetic update prepared; restart not proven',{exact:true}).waitFor();await page.locator('#settings-close').click();await page.locator('#body').fill('');await page.locator('#body').evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','Ordinary pasted text');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});await page.waitForFunction(()=>document.querySelector('#surface').shadowRoot.querySelector('#body').value==='Ordinary pasted text');assert.equal(await page.evaluate(()=>clipboardReads),1,'Native clipboard read only for explicit paste');await page.evaluate(()=>{window.capabilityMode='reject'});await page.locator('#profile-btn').click();await page.getByText('App unavailable in this host',{exact:true}).waitFor();await page.locator('#settings-close').click();
 await page.evaluate(()=>unmountClassic());assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>outside),[]);
 const result={pass:true,host_version:1,adapter:'isolated public host backed by disposable native API',checks:['Copied package at unrelated URL mounts without private globals','Manifest identity works with no optional host.skin and namespaces drafts','All native data/actions/file traffic passes captured public host','No document writes outside owned shadow root','Unmount stops stream/catalog listeners','A/B/A remount restores workspace drafts without crossing identical conversation IDs','Final void reconnect remounts, keeps text, retires staged IDs, rejects send until reattachment and never replays','Pending send remains on captured host and clears accepted draft after remount','Optional app absence/rejection, replacement cancel/confirm with partial status merge, update preparation and native text-paste callback guards','No page errors'],limits:['Google provider consent and native OS integration not exercised','Does not certify arbitrary skins or sandbox full-trust code']};
 fs.writeFileSync(path.join(evidence,'contract-result.json'),JSON.stringify(result,null,2),{mode:0o600});console.log('PASS '+manifest.id+' skin runtime contract and lifecycle');
})().catch(e=>{console.error('FAIL skin contract: '+e.stack+'; page errors: '+errors.join('; '));process.exitCode=1;}).finally(async()=>{await browser?.close();server?.closeAllConnections();server?.close();});
