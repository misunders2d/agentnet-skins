import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),source=process.env.AGENTNET_SOURCE||path.join(root,'.cache/upstream'),require=createRequire(import.meta.url);

test('standalone direct organization displays production Engine placements and synthetic topics',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100vh}.skin-root{height:100%}</style><div id="skin"></div>');return;}
  const skin=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(u.pathname);
  try{
   let data,file;
   if(skin){file=skin[2];data=file==='manifest.mjs'?'export default '+fs.readFileSync(path.join(root,'skins',skin[1],'skin.json'),'utf8'):fs.readFileSync(path.join(root,'skins',skin[1],'src',file));
    if(file==='entry.mjs'){data=data.toString();const needle=skin[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.includes(needle));data=data.replace(needle,'globalThis.fixture={state,openThread,loadThread,loadOverview,contactsOf,listen,keepDraft,isLoading:()=>loading'+(skin[1]==='zoom'?',Zoom':'')+'};'+(skin[1]==='zoom'?'':'const ready=Promise.resolve();'));}
   }else if(u.pathname.startsWith('/engine/')){file=u.pathname.slice(8);const base=path.join(source,'internal/ui/static'),target=path.resolve(base,file);if(!target.startsWith(base+path.sep))throw Error('Bad fixture path');data=fs.readFileSync(target);}
   else{res.writeHead(404).end();return;}
   res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(String(e));}
 });let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of (process.env.AGENTNET_ORGANIZATION_SKINS||'classic,holonet,zoom').split(','))for(const width of (process.env.AGENTNET_ORGANIZATION_WIDTHS||'1280,390').split(',').map(Number))await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];let stage='fixture';page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.stack));
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const settled=()=>page.waitForFunction(()=>!fixture.isLoading()&&fixture.state.overview?.seq===f.engine.seq);
   const topicCount=async expected=>{await settled();assert.equal(await page.evaluate(()=>fixture.state.overview.threads.filter(t=>t.agent_id===f.pi.id).length),expected);};
   try{
    await page.goto(origin);
    await page.evaluate(async skin=>{
     const {Engine,openIDB}=await import('/engine/engine.mjs'),wire=await import('/engine/wire.mjs');
     const pubs=new Map(),profiles=new Map(),chains=new Map(),catalogs=new Map(),network=[];
     const json=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{status});
     const transport=async(url,options={})=>{const u=new URL(url),p=u.pathname;network.push({path:p,method:options.method||'GET'});
      if(p==='/v1/version')return json({features:['env2','person2','caps','notify1']});
      if(p.endsWith('/agent-catalog'))return json(catalogs.get(p.slice(11,-14))||[]);
      if(p.endsWith('/profile'))return json(profiles.get(p.slice(11,-8)));
      if(p.startsWith('/v1/persons/')&&p.endsWith('/chain'))return json({records:(chains.get(p.slice(12,-6))||[]).filter(r=>r.seq>Number(u.searchParams.get('after'))),more:false});
      if(/^\/v1\/agents\/[^/]+\/[^/]+$/.test(p)){const pub=pubs.get(p.slice(11));return pub?json({public:JSON.parse(wire.marshalPublic(pub))}):json({error:'fixture missing'},404);}
      if(p.endsWith('/wait'))return json({state:'custody'});if(p.endsWith('/ack'))return json(null,204);
      throw Error('Unexpected isolated relay call '+p);
     };
     const now={value:1792500000000};
     async function device(address){const store=await openIDB('skin-organization-'+wire.newID()),e=new Engine({store,base:'https://isolated.invalid',fetch:transport,now:()=>now.value});e.keys=await wire.newKeys();e.address=address;e.pub=await wire.publicEntry(e.keys,address);e.fp=await wire.fingerprint(e.pub);e.roster=await wire.newRoster(e.keys,address,address.split('/')[0]);e.me=await e.personRecord([e.roster],'self',null);pubs.set(address,e.pub);chains.set(e.me.person,[JSON.parse(wire.rosterJSON(e.roster))]);const session=wire.newID(),caps=[wire.CapEnv2,wire.CapPerson,wire.CapAgentIdentity,wire.CapDirectTopicSync,wire.CapOwnSyncV3,wire.CapRootSync,wire.CapReadSync,wire.CapTopicStateSync];profiles.set(address,{person:JSON.parse(wire.rosterJSON(e.roster)),sessions:[session],caps:[JSON.parse(wire.capsJSON(await wire.newCaps(e.keys,address,session,caps)))],live:true});await store.write([{s:'kv',k:'identity',v:{keys:e.keys,address,fingerprint:e.fp}},{s:'kv',k:'person',v:e.me}]);await e.pinDevices(e.me);return e;}
     const e=await device('atlas/browser'),peer=await device('briar/desk');
     await e.store.write([{s:'persons',k:peer.me.person,v:{...peer.me,state:'pinned'}},{s:'pins',k:peer.address,v:{address:peer.address,json:wire.marshalPublic(peer.pub),fingerprint:peer.fp,pending:null}}]);
     const pi={id:wire.newID(),host:peer.address,host_key:peer.fp,label:'Builder',harness:'pi',ts:Math.floor(now.value/1000)},claude={...pi,id:wire.newID(),harness:'claude'};
     catalogs.set(peer.address,await Promise.all([pi,claude].map(async r=>JSON.parse(wire.agentJSON(await wire.signAgent(peer.keys,r))))));
     e.agentDevices=[peer.address];e.members={listed:'listed',current:true,at:now.value,list:[{address:peer.address,presence:'connected',joined:1}],truncated:false};
     // No live transport or harness is attached. Originals are created with the
     // real sender, signatures, encrypted file manifest and retained file bytes:
     // the engine's older-device sender, which no route reaches since v0.10.0.
     let queueCalls=0;e.queueOutbox=()=>{queueCalls++;};
     const original=async(body,agent=pi,extra={})=>{now.value+=1000;return e.sendDirect({to:peer.address,agent_id:agent.id,kind:'question',body,...extra});};
     const first=await original('Pi source original',pi,{kind:'task',files:[{name:'proof.txt',bytes:new TextEncoder().encode('ORIGINAL_ORGANIZATION_FILE')}]});
     const child=await original('Pi linked reply',pi,{reply_to:first.id});
     const second=await original('Pi destination original'),third=await original('Pi third original'),fourth=await original('Pi fourth original'),other=await original('Claude separate original',claude);
     for(const row of await e.store.all('outbox'))await e.store.write([{s:'outbox',k:row.id,v:{...row,state:'delivered'}}]);
     const sid=wire.newID(),control={v:3,id:sid,from:peer.address,to:e.address,kind:'message',sub:wire.SubStatus,ref:{id:first.id,fingerprint:e.fp},body:JSON.stringify({state:'running',n:1,at:Math.floor(now.value/1000),attempt:7}),ts:Math.floor(now.value/1000)};
     const envelope=await wire.seal(control,peer.keys,e.pub);await wire.verifyEnvelope(wire.parseEnvelope(envelope),peer.pub.sign_key);await e.store.write([{s:'inbox',k:sid,v:{...control,control:true,fp:peer.fp,at:now.value,envelope}}]);
     for(const [row,title]of [[first,'Pi source'],[second,'Pi destination'],[third,'Pi third'],[fourth,'Pi fourth'],[other,'Claude separate']])await e.api('/api/topic/rename',{peer:peer.address,id:row.id,title});
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];const app=document.createElement('div');app.className='skin-root';shadow.append(app);window.app=app;
     window.f={engine:e,peer,pi,claude,first,child,second,third,fourth,other,calls:[],network,queueBefore:queueCalls,queue:()=>queueCalls,stores:[e.store,peer.store],skin};
     const host={version:1,platform:'browser',workspace:{id:'organization-fixture',handle:'captured-organization-fixture'},listen:fn=>e.listen(seq=>fn({type:'change',seq})),onOpen(){},stage:async()=>{throw Error('Organization must not stage files');},file:(id,i,dir)=>e.api('/api/file?'+new URLSearchParams({id,i,dir})),api:async(path,body)=>{f.calls.push({path,...body===undefined?{}:{body:structuredClone(body)}});return e.api(path,body);}};
     window.host=host;const module=await import('/'+skin+'/entry.mjs');window.stop=()=>module.unmount(app);await module.mount(app,host);await fixture.loadOverview();await fixture.openThread(first.id);fixture.listen();
     app.style.visibility='visible';app.classList.add('show-conv');
     f.originals=JSON.stringify(await e.store.all('outbox'));f.controls=JSON.stringify(await e.store.all('inbox'));f.fileBytes=Array.from((await host.file(first.id,0,'out')).bytes);f.initial=await e.api('/api/thread?id='+first.id);
     f.scope=()=>new URLSearchParams({peer:peer.address,agent_host:peer.address,agent_key:peer.fp,agent_id:pi.id});
     f.count=async()=>{const p=await host.api('/api/topics?'+f.scope());return{matched:p.matched,ids:p.topics.map(t=>t.id),titles:p.topics.map(t=>t.title)};};
     f.calls=[];
    },skin);
    stage='initial four exact Pi topics';await topicCount(4);const initial=await page.evaluate(()=>f.count());assert.equal(initial.matched,4);
    const first=await page.evaluate(()=>({id:f.first.id,child:f.child.id,destination:f.second.id,work:f.initial.messages.find(m=>m.id===f.first.id).exec}));assert.equal(first.work.state,'running');assert.equal(first.work.attempt,7);assert.equal(first.work.stale,false);
    stage='merge';await page.evaluate(async()=>{f.merge=await host.api('/api/topic/organization/preview',{conv:'',peer:f.peer.address,ids:[f.first.id,f.child.id],topic:f.second.id,merge:f.first.id});f.moved=await host.api('/api/topic/organization/apply',f.merge);});await topicCount(3);
    const merged=await page.evaluate(()=>({id:fixture.state.data.topic.id,ids:fixture.state.data.messages.map(m=>m.id),work:fixture.state.data.messages.find(m=>m.id===f.first.id)?.exec,body:app.textContent}));assert.equal(merged.id,first.destination);assert.deepEqual(new Set(merged.ids),new Set([first.id,first.child,first.destination]));assert.deepEqual(merged.work,first.work);assert.match(merged.body,/Pi source original/);if(skin==='zoom'){const bubble=page.locator('#m-'+first.id+' .mc-bubble');const details=bubble.getByRole('button',{name:'Message details',exact:true});if(await details.count())await details.click();else await bubble.click();await page.locator('.zoom-message').getByText(/Files: proof\.txt/).waitFor();await page.evaluate(()=>fixture.Zoom.go(2,{}));}else assert.match(merged.body,/proof\.txt/);
    stage='scoped topic picker';await page.getByRole('button',{name:/^All(?: topics)? \(/}).click();const picker=page.getByRole('dialog',{name:'All topics',exact:true});await picker.locator('[data-topic-id]').first().waitFor();assert.equal(await picker.locator('[data-topic-id]').count(),3);assert(!(await picker.innerText()).includes('Claude separate'));await picker.getByRole('button',{name:'Close',exact:true}).click();
    stage='undo';await page.evaluate(async()=>{await host.api('/api/topic/organization/undo',{conv:'',peer:f.peer.address,lid:f.moved.id,author:'',id:crypto.randomUUID().replaceAll('-','')});});await topicCount(4);assert.equal((await page.evaluate(()=>f.count())).matched,4);assert.equal(await page.evaluate(()=>fixture.state.data.topic.id),first.id);
    stage='named synthetic topic';await page.evaluate(async()=>{f.named=await host.api('/api/topic/organization/preview',{conv:'',peer:f.peer.address,ids:[f.third.id,f.fourth.id],new:true,title:'Build decisions'});await host.api('/api/topic/organization/apply',f.named);});await topicCount(3);
    await page.getByRole('button',{name:/^All(?: topics)? \(/}).click();await picker.getByRole('button',{name:'Build decisions · active',exact:true}).click();await page.waitForFunction(()=>fixture.state.data?.topic.id===f.named.topic&&!fixture.isLoading()&&app.querySelector('#m-'+f.third.id)&&app.querySelector('#m-'+f.fourth.id));
    const named=await page.evaluate(()=>({id:fixture.state.data.id,topic:fixture.state.data.topic,title:app.textContent,ids:fixture.state.data.messages.map(m=>m.id),wanted:[f.third.id,f.fourth.id],lookup:f.named.topic}));assert.equal(named.id,named.lookup);assert.equal(named.topic.title,'Build decisions');assert.equal(named.topic.agent_id,await page.evaluate(()=>f.pi.id));assert.deepEqual(new Set(named.ids),new Set(named.wanted));assert.match(named.title,/Build decisions/);assert.match(named.title,/Pi third original/);assert.match(named.title,/Pi fourth original/);assert(!named.ids.includes(named.lookup),'synthetic topic adds no fake message');
    stage='undo open synthetic topic';await page.evaluate(async()=>{const file=new File(['synthetic draft bytes'],'draft.txt',{type:'text/plain'});f.retained={file,files:[{file,name:file.name,size:file.size,staged:'opaque-synthetic-draft'}]};fixture.state.files=f.retained.files;app.querySelector('#body').value='Keep synthetic topic draft';fixture.keepDraft();await host.api('/api/topic/organization/undo',{conv:'',peer:f.peer.address,lid:f.named.operation,author:'',id:crypto.randomUUID().replaceAll('-','')});});await topicCount(4);
    const retired=await page.evaluate(()=>({closed:fixture.Zoom?fixture.Zoom.level===1&&fixture.Zoom.contactKey===JSON.stringify([f.pi.host,f.pi.host_key,f.pi.id]):fixture.state.data===null&&fixture.state.hub?.key===JSON.stringify([f.pi.host,f.pi.host_key,f.pi.id]),draft:fixture.state.drafts[f.named.topic]?.text,file:fixture.state.drafts[f.named.topic]?.files===f.retained.files&&fixture.state.drafts[f.named.topic]?.files[0].file===f.retained.file&&fixture.state.drafts[f.named.topic]?.files[0].staged==='opaque-synthetic-draft'}));assert(retired.closed,'an emptied synthetic topic closes into the same concrete agent chat');assert.equal(retired.draft,'Keep synthetic topic draft');assert(retired.file,'retired synthetic-topic draft retains the actual File and opaque stage');
    stage='original file/work/reply and zero sends';const preserved=await page.evaluate(async()=>({originals:JSON.stringify(await f.engine.store.all('outbox'))===f.originals,controls:JSON.stringify(await f.engine.store.all('inbox'))===f.controls,bytes:Array.from((await host.file(f.first.id,0,'out')).bytes),before:f.fileBytes,work:(await host.api('/api/thread?id='+f.first.id)).messages.find(m=>m.id===f.first.id).exec,initial:f.initial.messages.find(m=>m.id===f.first.id).exec,reply:(await host.api('/api/thread?id='+f.first.id)).messages.find(m=>m.id===f.child.id).reply_to,first:f.first.id,sends:f.calls.filter(c=>/\/api\/(send|request\/followup|dm\/send|dm\/agent\/ask|operator\/decide)$/.test(c.path)),listCalls:f.calls.filter(c=>c.path.startsWith('/api/topics?')).map(c=>c.path),queued:f.queue()===f.queueBefore}));assert(preserved.originals,'original signed ciphertext, manifests, targets and replies unchanged');assert(preserved.controls,'work status original unchanged');assert.deepEqual(preserved.bytes,preserved.before);assert.deepEqual(preserved.work,preserved.initial);assert.equal(preserved.reply,preserved.first);assert.deepEqual(preserved.sends,[]);assert(preserved.queued);assert(preserved.listCalls.every(p=>new URL(p,'http://fixture').searchParams.get('agent_id')===named.topic.agent_id));assert.deepEqual(errors,[]);
    console.log(JSON.stringify({skin,width,storage:'IndexedDB',api:'production Engine via captured Host v1',PiTopics:[4,3,4,3,4],secondAgentSeparate:true,syntheticNamedOriginals:true,originalCiphertextFilesWorkReply:true,ordinarySends:0}));
   }catch(error){const failure=await page.evaluate(({skin,width,stage,errors})=>({skin,width,stage,errors,state:globalThis.fixture?{thread:fixture.state.thread,topic:fixture.state.data?.topic,ids:fixture.state.data?.messages?.map(m=>m.id),overview:fixture.state.overview?.threads,calls:f.calls}:null,dom:globalThis.app?.textContent}),{skin,width,stage,errors}).catch(()=>({skin,width,stage,errors}));console.log('ORGANIZATION_FAILURE '+JSON.stringify(failure));if(process.env.AGENTNET_SCREENSHOTS){fs.mkdirSync(process.env.AGENTNET_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,skin+'-'+width+'-organization-failure.png')});}throw error;
   }finally{await page.evaluate(async()=>{await globalThis.stop?.();for(const s of globalThis.f?.stores||[])s.close();}).catch(()=>{});await context.close();}
  });
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
