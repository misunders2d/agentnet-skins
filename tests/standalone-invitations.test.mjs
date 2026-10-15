import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');

test('standalone Review reaches one exact guest invitation at narrow widths; quotes stay intentional',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||path.join(collection,'node_modules/playwright'));
 const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://fixture').pathname;
  if(p==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invitation fixture</title><link rel="icon" href="data:,"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(p);if(!m){res.writeHead(404).end();return;}
  try{
   const file=path.join(collection,'skins',m[1],'src',m[2]);
   let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(collection,'skins',m[1],'skin.json'),'utf8'):fs.readFileSync(file);
   if(m[2]==='entry.mjs'){
    if(process.env.AGENTNET_UI_BASELINE)data=fs.readFileSync(path.join(process.env.AGENTNET_UI_BASELINE,m[1]+'-entry.mjs'));
    const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.toString().includes(needle));
    // Keep the existing chat opener and decision dialog; skip unrelated startup.
    const seam='globalThis.fixture={state,renderReview,messageReference};const realOpenDM=openDM;openDM=async(...args)=>{opened.push(args[0]);return realOpenDM(...args);};'+(m[1]==='zoom'?'':'const ready=Promise.resolve();');
    data=data.toString().replace(needle,seam);
   }
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(e.message);}
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of ['classic','holonet','zoom'])for(const width of [760,390])for(const accept of [true,false])await t.test(skin+' '+width+' '+(accept?'join':'decline'),async()=>{
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin);
   try{
    await page.evaluate(async skin=>{
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),style=new CSSStyleSheet();style.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[style];
     const root=document.createElement('div');root.className='skin-root';shadow.append(root);
     const me={person:'atlas',label:'Atlas',state:'self',address:'atlas/desk',devices:[]},peer={person:'briar',label:'Briar',state:'pinned',address:'briar/phone',devices:[]};
     const guest={pid:'exact-guest',host:me,inviter:peer,host_here:true,state:'invited',can_decide:true,shared:[]};
     window.view={id:'c'.repeat(64),kind:'dm',peer,role:'human_guest',guests:[guest],agents:[],messages:[],members:[me,peer],topics:[]};
     window.invite={conv:view.id,pid:guest.pid,peer:peer.address,role:'human',reason:'agent_invite',actions:['accept','decline'],excerpt:'Private planning topic'};
     window.overview={me:{address:me.address,fingerprint:'atlas-key'},person:me,people:[peer],threads:[],dms:[{id:view.id,title:'Planning',peer}],review:[],links:[],needs_you:[invite,{...invite}],held:[],reminders:[],peers:[]};window.posts=[];window.opened=[];window.reads=[];
     const host={version:1,platform:'daemon',workspace:{id:'default'},listen:()=>()=>{},onOpen(){},api:async(p,body)=>{
      if(body===undefined){reads.push(p);if(p.startsWith('/api/dm?'))return structuredClone(view);if(p.startsWith('/api/typing'))return {current:false,supported:false,send:false,scopes:[]};if(p.startsWith('/api/agents'))return {agents:[],sessions:[]};if(p==='/api/teams')return {teams:[]};if(p==='/api/workspace')return {};throw Error('Unexpected read '+p);}
      posts.push({p,body});if(p!=='/api/dm/guest/decide')throw Error('Unexpected mutation '+p);
      overview.needs_you=[];view.guests[0].state=body.accept?'active':'declined';fixture.renderReview([]);return {};
     }};
     await(await import('/'+skin+'/entry.mjs')).mount(root,host);
     for(const child of root.children)child.hidden=true;
     const area=document.createElement('section');area.style.cssText='width:100%;padding:12px;box-sizing:border-box';root.append(area);
     for(const id of ['review-btn','review','dialog']){const node=root.querySelector('#'+id);node.hidden=false;area.append(node);}
     root.style.cssText='display:block;height:100%;overflow:auto;visibility:visible';
     fixture.state.overview=overview;fixture.renderReview([]);
     const quotes=document.createElement('section');quotes.id='quote-check';area.append(quotes);
     const parent={id:'parent',body:'Original request',kind:'question'},between={id:'between',body:'Another turn',kind:'message'},normal={id:'normal',body:'Ordinary reply',kind:'message',reply_to:'parent'},answer={id:'answer',kind:'answer',body:'Agent answer',reply_to:'parent'},explicit={id:'explicit',body:'Intentional quote',kind:'message',reply_to:'parent',quote:'parent'};
     const thread={...view,role:'member',messages:[parent,between,normal,answer,explicit]};
     window.quoteProof={normal:fixture.messageReference(normal,thread)===null,answer:fixture.messageReference(answer,thread)?.textContent,explicit:fixture.messageReference(explicit,thread)?.textContent};quotes.append(fixture.messageReference(explicit,thread));
    },skin);
    assert.deepEqual(await page.evaluate(()=>quoteProof),{normal:true,answer:'↳ answer to Original request',explicit:'Reply to: Original request'});
    assert.equal(await page.locator('#quote-check .replyref').count(),1,'one intentional quote');
    assert.equal(await page.locator('[data-guest-invitation]').count(),1,'one exact invitation despite repeated overview copy');
    assert.equal(await page.locator('#review-count').textContent(),'1','one attention badge');
    // Stale and remote decisions do not acquire local decision controls.
    await page.evaluate(()=>{overview.needs_you=[{...invite,stale:true}];fixture.renderReview([]);});
    assert.equal(await page.locator('[data-guest-invitation]').count(),0);
    await page.evaluate(()=>{overview.needs_you=[{...invite,decide_on:'atlas/phone'}];fixture.renderReview([]);});
    assert.equal(await page.locator('#review-count').textContent(),'0');
    assert.equal(await page.locator('[data-guest-invitation] button').count(),0);
    await page.evaluate(()=>{overview.needs_you=[invite];view.guests[0].can_decide=false;fixture.renderReview([]);});
    const row=page.locator('[data-guest-invitation]');await row.waitFor();
    await row.getByRole('button',{name:'Join conversation…',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('#skin').shadowRoot.querySelector('[data-guest-invitation] button').disabled);
    assert.deepEqual(await page.evaluate(()=>({posts:posts.length,opened:opened.length,modal:document.querySelector('#skin').shadowRoot.querySelector('#dialog').open})),{posts:0,opened:0,modal:false},'current participation is rechecked before decision');
    await page.evaluate(()=>view.guests[0].can_decide=true);
    if(process.env.AGENTNET_SCREENSHOTS)await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,`invitation-${skin}-${width}-pending.png`)});
    const box=await row.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,'invitation fits narrow content');
    await row.getByRole('button',{name:accept?'Join conversation…':'Decline invitation…',exact:true}).click();
    const dialog=page.locator('#dialog');await dialog.waitFor();assert.equal(await page.evaluate(()=>posts.length),0,'opening existing decision does not send');
    await page.locator('#dialog-ok').click();await page.waitForFunction(()=>posts.length===1);
    assert.deepEqual(await page.evaluate(()=>posts),[{p:'/api/dm/guest/decide',body:{pid:'exact-guest',accept}}]);assert.deepEqual(await page.evaluate(()=>opened),['c'.repeat(64)]);
    assert.equal(await page.locator('#review-count').textContent(),'0','decision leaves no duplicate badge');assert.equal(await page.locator('[data-guest-invitation]').count(),0);
    assert.deepEqual(errors,[]);
    if(process.env.AGENTNET_SCREENSHOTS)await page.screenshot({path:path.join(process.env.AGENTNET_SCREENSHOTS,`invitation-${skin}-${width}-${accept}.png`)});
   }finally{await context.close();}
  });
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
