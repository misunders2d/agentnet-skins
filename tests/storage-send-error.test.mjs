import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=path.resolve(import.meta.dirname,'..');
const skins=['classic','holonet','zoom'];
const causes={relay_quota:'The workspace attachment quota is full.',file_too_large:"This file exceeds the server's file-size limit.",relay_disk_full:'The server is out of disk space.',local_disk_full:'This device is out of storage.',network_unavailable:'The server cannot be reached.'};

test('standalone send failures classify only known anchored producer details',()=>{
 for(const skin of skins){
  const source=fs.readFileSync(path.join(collection,'skins',skin,'src/entry.mjs'),'utf8');
  const start=source.indexOf('function storageFailure(m) {'),end=source.indexOf('function storageAdmin()',start);
  assert(start>=0&&end>start);const parse=vm.runInNewContext(source.slice(start,end)+';storageFailure');
  for(const [code,reason] of Object.entries(causes)){
   assert.equal(parse({detail:'send_error:'+code+': PRIVATE producer prose'}).reason,reason);
   assert.equal(parse({copies:[{state:'failed',detail:'send_error:'+code+': retained'}]}).code,code);
   assert.equal(parse({copies:[{state:'delivered',detail:'send_error:'+code+': obsolete'}]}),null);
  }
  for(const detail of ['not sent: relay_quota','prefix send_error:relay_quota: x','send_error:unknown: x','Reading files\nReported at 2026-10-15T20:00:00Z','permission denied'])assert.equal(parse({detail}),null);
  console.log(skin+': five known causes, failed-copy fallback, delivered-copy and unknown/native negatives');
 }
});

test('standalone rendered storage reasons and exact stored-row retries',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://fixture');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);if(!m){res.writeHead(404).end();return;}
  try{
   let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(collection,'skins',m[1],'skin.json'),'utf8'):fs.readFileSync(path.join(collection,'skins',m[1],'src',m[2]));
   if(m[2]==='entry.mjs'){
    const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.toString().includes(needle));
    const expose='globalThis.fixture={state,storageFailure,storageFailureText,storageRetryAllowed,deliveryText,deviceSendText,storageSendActions,'+(m[1]==='zoom'?'Zoom':'renderMsg,dmMsg')+',setHost:h=>{currentHost=h;},mockRefresh:()=>{loadDM=async()=>refreshes.push("dm");loadThread=async()=>refreshes.push("thread");}};';
    data=data.toString().replace(needle,expose+(m[1]==='zoom'?'':'const ready=Promise.resolve();'));
   }
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(e.message);}
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of skins)for(const width of [390,1280])await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin);
   try{
    await page.evaluate(async skin=>{
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];
     const root=document.createElement('div');root.className='skin-root';shadow.append(root);
     window.posts=[];window.refreshes=[];window.outcome=1;window.hold=false;window.rejectRetry=false;
     window.host={version:1,workspace:{id:'storage-fixture'},listen:()=>()=>{},onOpen(){},api:async(p,body)=>{if(p!=='/api/storage/retry_send')throw Error('Unexpected fixture request '+p);posts.push({p,body,workspace:host.workspace.id});if(hold)await new Promise(r=>window.releaseRetry=r);if(rejectRetry)throw Error('PRIVATE untrusted transport detail');return{id:body.id,retried:outcome};}};
     await(await import('/'+skin+'/entry.mjs')).mount(root,host);for(const child of root.children)child.hidden=true;
     const area=document.createElement('section');area.style.cssText='padding:12px;box-sizing:border-box;width:100%';root.append(area);
     const live=root.querySelector('#live');live.hidden=false;area.append(live);
     const probe=document.createElement('section');probe.id='probe';area.append(probe);root.style.cssText='display:block;height:100%;overflow:auto;visibility:visible';
     fixture.state.overview={role:'member',me:{address:'atlas/desk',agent:false},person:{person:'atlas',label:'Atlas',state:'self',devices:[]},threads:[],dms:[],people:[],review:[],needs_you:[],held:[],links:[],reminders:[],peers:[]};fixture.mockRefresh();
     window.draw=(mode='dm',extra={},admin=false)=>{
      fixture.setHost(host);fixture.state.overview.role=admin?'admin':'member';fixture.state.storageAccess=null;
      const m={id:'b'.repeat(32),lid:'c'.repeat(32),from:'atlas/desk',dir:'out',kind:'message',origin:'ui',body:'Stored fixture attachment',at:'2026-10-15T20:00:00Z',author:{label:'Atlas',about:'Synthetic fixture'},state:'failed',delivery:'failed',state_text:'Not sent',detail:'send_error:relay_quota: PRIVATE producer prose',actions:[],...extra};
      const d={id:'a'.repeat(32),kind:mode==='group'?'group':'dm',role:'member',peer:{person:'briar',label:'Briar',address:'briar/desk',devices:[]},agents:[],guests:[],members:[{person:'atlas',label:'Atlas',admin:true}],topics:[],messages:[m],key:{pinned:'key'}};
      fixture.state.dm=mode==='thread'||mode==='thread-details'?null:d.id;fixture.state.dmData=fixture.state.dm?d:null;fixture.state.thread=fixture.state.dm?null:d.id;fixture.state.data=fixture.state.dm?null:d;fixture.state.draftKey=d.id;
      let node;if(skin==='zoom'){fixture.Zoom.msg=m.id;node=mode==='thread'?fixture.Zoom.thread():mode==='thread-details'?fixture.Zoom.message():mode==='dm-details'?fixture.Zoom.dmMessage():fixture.Zoom.dmLevel();}else node=fixture.state.dm?fixture.dmMsg(m,d,null):fixture.renderMsg(m,{[m.id]:m},null,d);
      probe.replaceChildren(node);return probe.textContent;
     };
    },skin);
    const probe=page.locator('#probe');
    for(const mode of ['dm','group','thread',...(skin==='zoom'?['dm-details','thread-details']:[])]){
     for(const [code,reason]of Object.entries(causes))for(const admin of [false,true]){
      const text=await page.evaluate(({mode,code,admin})=>draw(mode,{detail:'send_error:'+code+': PRIVATE producer prose'},admin),{mode,code,admin});
      assert.equal(text.split(reason).length-1,1,skin+' '+mode+' one reason '+code);assert(!text.includes('send_error:'));assert(!text.includes('PRIVATE'));assert(!text.includes('Not sent'),skin+' no duplicate generic failure');
      if(code==='relay_quota'||code==='relay_disk_full')assert.equal(text.includes('Ask a workspace admin'),!admin,'group admin is not workspace admin');
      assert.equal(await probe.getByRole('button',{name:'Retry message',exact:true}).count(),['relay_quota','relay_disk_full'].includes(code)?1:0);
      assert.equal(await probe.getByRole('button',{name:'Open Storage',exact:true}).count(),code==='local_disk_full'||code==='relay_quota'&&admin?1:0);
      if(code==='file_too_large')assert(text.includes('smaller file for a new message'));
     }
    }
    for(const extra of [{_local:true},{replica:true},{history:true},{synced_from:'atlas/other'},{via:'atlas/other'},{excerpt_pid:'e'.repeat(32)},{deleted:true},{send_stopped:true},{delivery_uncertain:true},{delivery_cancelled:true},{dir:'in'},{state:'delivered',delivery:'delivered'}]){
     // Local optimistic callbacks belong to the existing composer, separate from this action.
     await page.evaluate(extra=>draw('dm',{...extra,_retry:()=>{}}),extra);assert.equal(await probe.getByRole('button',{name:'Retry message',exact:true}).count(),0,JSON.stringify(extra));
    }
    for(const [extra,word]of [[{delivery_uncertain:true},'Delivery unconfirmed'],[{send_stopped:true},'local sending stopped']]){
     await page.evaluate(extra=>draw('dm',extra),extra);assert((await probe.innerText()).includes(word));
    }
    await page.evaluate(()=>draw('dm',{detail:'',copies:[{state:'failed',detail:'send_error:relay_disk_full: retained',to:'briar/desk'}]}));assert((await probe.innerText()).includes(causes.relay_disk_full));
    await page.evaluate(()=>draw('dm',{state:'delivered',delivery:'delivered'}));assert(!(await probe.innerText()).includes(causes.relay_quota),'a delivered receipt wins over stale failure detail');
    await page.evaluate(()=>draw('thread',{dir:'in',kind:'question',state:'running',delivery:'custody',state_text:'Working',detail:'Reading files\nReported at 2026-10-15T20:00:00Z',actions:['cancel']}));assert.equal(await probe.locator('[data-native-activity]').count(),1,'existing native activity still renders once');
    await page.evaluate(mode=>draw(mode,{detail:'Unrelated native permission detail',copies:[{state:'failed',detail:'send_error:relay_disk_full: retained',to:'briar/desk'}]}),skin==='zoom'?'dm-details':'dm');if(skin!=='holonet')assert((await probe.textContent()).includes('Unrelated native permission detail'),'failed-copy fallback preserves unrelated direct detail');

    const native=await page.evaluate(()=>{draw('dm',{detail:'Native permission needs owner input',state_text:'Awaiting owner'});return {parsed:fixture.storageFailure({detail:'Native permission needs owner input'}),text:fixture.deviceSendText({detail:'Native permission needs owner input',state_text:'Awaiting owner'}),delivery:fixture.deliveryText({delivery:'failed',state_text:'Ordinary failure'})};});assert.equal(native.parsed,null);assert.equal(native.text,'Awaiting owner');assert.equal(native.delivery,'Ordinary failure');
    await page.evaluate(()=>{draw('dm');fixture.state.overview.role='member';fixture.state.storageAccess={host,canChangeQuota:true};const node=fixture.storageSendActions(fixture.state.dmData.messages[0],fixture.state.dm);document.querySelector('#skin').shadowRoot.querySelector('#probe').replaceChildren(...node.filter(Boolean));});assert.equal(await probe.getByRole('button',{name:'Open Storage',exact:true}).count(),1,'current storage capability is a display hint');
    for(const mode of ['dm','thread']){
     await page.evaluate(mode=>{posts.length=0;refreshes.length=0;hold=true;outcome=1;draw(mode);},mode);
     const button=probe.getByRole('button',{name:'Retry message',exact:true});await button.click();assert.equal(await button.isDisabled(),true);
     await page.evaluate(mode=>draw(mode),mode);assert.equal(await button.isDisabled(),true,'a replacement control shares the exact in-flight key');
     await page.evaluate(()=>{const b=document.querySelector('#skin').shadowRoot.querySelector('#probe button');const retry=[...document.querySelector('#skin').shadowRoot.querySelectorAll('#probe button')].find(n=>n.textContent==='Retry message');retry.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
     assert.equal(await page.evaluate(()=>posts.length),1,'double click has one request');
     await page.evaluate(()=>releaseRetry());await page.waitForFunction(()=>refreshes.length===1);assert.equal(await button.isDisabled(),false,'replacement control re-enables after refresh');
     assert.deepEqual(await page.evaluate(()=>posts.map(x=>x.body)),[{conv:mode==='dm'?'a'.repeat(32):'',id:'c'.repeat(32)}]);assert.match(await page.locator('#live').innerText(),/Queued for sending/);assert.match(await page.locator('#live').innerText(),/not yet confirmed/);
    }
    await page.evaluate(()=>{hold=false;outcome=1;posts.length=0;refreshes.length=0;draw('thread',{lid:''});});await probe.getByRole('button',{name:'Retry message',exact:true}).click();await page.waitForFunction(()=>refreshes.length===1);assert.deepEqual(await page.evaluate(()=>posts.map(x=>x.body)),[{conv:'',id:'b'.repeat(32)}],'physical ID fallback is exact');
    await page.evaluate(()=>{hold=false;outcome=0;refreshes.length=0;draw('dm');});await probe.getByRole('button',{name:'Retry message',exact:true}).click();await page.waitForFunction(()=>refreshes.length===1);assert.match(await page.locator('#live').innerText(),/No eligible stored copy/);
    await page.evaluate(()=>{rejectRetry=true;draw('dm');});await probe.getByRole('button',{name:'Retry message',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#skin').shadowRoot.querySelector('#live').textContent.includes('could not be retried'));assert(!(await page.locator('#live').innerText()).includes('PRIVATE'));
    await page.evaluate(()=>{rejectRetry=false;hold=true;refreshes.length=0;draw('dm');});await probe.getByRole('button',{name:'Retry message',exact:true}).click();await page.evaluate(()=>{fixture.setHost({...host,workspace:{id:'other-workspace'}});releaseRetry();});await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>refreshes.length),0,'workspace switch never refreshes new view');
    await page.evaluate(()=>{hold=false;draw('dm');});
    const bounds=await probe.getByRole('button',{name:'Retry message',exact:true}).boundingBox();assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1,'compact retry fits viewport');assert.deepEqual(errors,[]);
    if(process.env.AGENTNET_SCREENSHOTS){fs.mkdirSync(process.env.AGENTNET_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,`storage-send-${skin}-${width}.png`)});}
    console.log(JSON.stringify({skin,width,views:skin==='zoom'?5:3,causes:5,roles:2,doubleClick:'one exact request',zeroEligible:'not queued',workspaceSwitch:'no foreign refresh',nativeDetail:'unchanged'}));
   }finally{await context.close();}
  });
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
