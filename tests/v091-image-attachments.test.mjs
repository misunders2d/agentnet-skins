import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');

// Actual entry functions, styles, modal, file provider and cleanup. Startup data
// is disabled so this narrow check exercises no account, relay or ordinary send.
test('standalone image chips stay compact and open exact original files', {skip:!process.env.AGENTNET_CHROMIUM}, async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/?]+)$/.exec(req.url);
  if(!m){res.writeHead(404).end();return;}
  try{const [,skin,file]=m;let data=file==='manifest.mjs'?'export default '+fs.readFileSync(path.join(root,'skins',skin,'skin.json'),'utf8'):fs.readFileSync(path.join(root,'skins',skin,'src',file));
   if(file==='entry.mjs'){data=data.toString();const needle=skin==='zoom'?'\nstart();':'const ready = start();';assert(data.includes(needle));data=data.replace(needle,'globalThis.fixture={state,fileChips,releaseOpened};'+(skin==='zoom'?'':'const ready=Promise.resolve();'));}
   res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(String(e));}
 });let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM,args:['--disable-gpu']});
  for(const skin of (process.env.AGENTNET_IMAGE_SKIN?[process.env.AGENTNET_IMAGE_SKIN]:['classic','holonet','zoom']))for(const width of (process.env.AGENTNET_IMAGE_WIDTH?[Number(process.env.AGENTNET_IMAGE_WIDTH)]:[1280,390]))await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:844},acceptDownloads:true}),page=await context.newPage(),errors=[];page.setDefaultTimeout(4000);
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(origin);await page.evaluate(async skin=>{
     const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),sheet=new CSSStyleSheet();sheet.replaceSync(await(await fetch('/'+skin+'/style.css')).text());shadow.adoptedStyleSheets=[sheet];
     const app=document.createElement('div');app.className='skin-root';shadow.append(app);window.imageApp=app;
     const originalCreate=URL.createObjectURL.bind(URL),originalRevoke=URL.revokeObjectURL.bind(URL);window.urls={created:[],revoked:[]};URL.createObjectURL=b=>{const u=originalCreate(b);urls.created.push(u);return u;};URL.revokeObjectURL=u=>{urls.revoked.push(u);originalRevoke(u);};
     const c=document.createElement('canvas');c.width=1080;c.height=2400;const x=c.getContext('2d');x.fillStyle='#17242b';x.fillRect(0,0,c.width,c.height);x.fillStyle='#f7f6ef';x.font='48px sans-serif';x.fillText('Original fictional phone screenshot',40,100);
     const bytes=new Uint8Array(await(await fetch(c.toDataURL('image/png'))).arrayBuffer());window.images={bytes:[...bytes],reads:[],writes:[],files:[{index:2,name:'first-phone-original.png',size:bytes.length,openable:true},{index:5,name:'second-phone-original-with-a-long-filename.png',size:bytes.length,openable:true},{index:8,name:'failed.png',size:6,openable:true}]};
     const host={version:1,workspace:{id:'image-fixture'},onOpen(){},listen(){return()=>{}},api:async(path,body)=>{if(body!==undefined)images.writes.push({path,body});return{};},file:async(id,index,dir)=>{images.reads.push({id,index,dir});return{bytes:index===8?new TextEncoder().encode('broken'):bytes};}};
     const module=await import('/'+skin+'/entry.mjs');await module.mount(app,host);window.stopImages=()=>module.unmount(app);
     fixture.state.overview={person:null};fixture.state.dm='a'.repeat(64);fixture.state.dmData={peer:{person:'fictional-person'}};
     const article=document.createElement('article');article.className='bubble';article.append(fixture.fileChips({id:'b'.repeat(32),dir:'in'},images.files));for(const child of app.children)child.style.display='none';app.append(article);app.style.visibility='visible';
    },skin);
    const chips=page.locator('.files');assert.deepEqual(await chips.locator('.file-name').allTextContents(),['first-phone-original.png','second-phone-original-with-a-long-filename.png','failed.png']);
    assert.equal(await page.locator('.file-preview').count(),0);assert.deepEqual(await page.evaluate(()=>images.reads),[],'no image fetch or decode until Open');
    const box=await chips.boundingBox();assert(box.height<260&&box.x>=0&&box.x+box.width<=width+1,'compact chips fit the viewport: '+JSON.stringify(box));
    for(const [n,name]of ['first-phone-original.png','second-phone-original-with-a-long-filename.png'].entries()){
     const open=page.locator('[data-file-open$=":'+(2+n*3)+'"]');await open.focus();await page.keyboard.press('Enter');const viewer=page.getByRole('dialog',{name,exact:true,includeHidden:true});try{await viewer.waitFor();}catch(e){console.error('IMAGE_MODAL_DISCRIMINATOR',await page.evaluate(()=>({reads:images.reads,urls:window.urls,errors:images.errors,html:imageApp.innerHTML.slice(-5000)})),errors);throw e;}
     const im=viewer.getByRole('img',{name,exact:true});await im.evaluate(i=>i.decode());assert.deepEqual(await im.evaluate(i=>[i.naturalWidth,i.naturalHeight]),[1080,2400]);
     const r=await im.boundingBox();assert(r.width>0&&r.height>0&&r.x>=0&&r.x+r.width<=width+1&&r.height<=844*.65+1,'whole original fits existing viewer');assert(Math.abs(r.width/r.height-1080/2400)<.01);
     const downloaded=page.waitForEvent('download');await viewer.getByRole('link',{name:'Save '+name,exact:true}).click();const file=await downloaded;assert.equal(file.suggestedFilename(),name);assert.deepEqual([...fs.readFileSync(await file.path())],await page.evaluate(()=>images.bytes));
     if(n===0)await page.keyboard.press('Escape');else await viewer.getByRole('button',{name:'Close preview',exact:true}).click();await viewer.waitFor({state:'detached'});assert(await open.evaluate(b=>b.getRootNode().activeElement===b),'focus returns to exact opener');
    }
    await page.locator('[data-file-open$=":8"]').click();const fallback=page.getByRole('link',{name:'Download failed.png',exact:true});await fallback.waitFor();assert.equal(await page.locator('.file-viewer').count(),0,'invalid image bytes retain download fallback');
    assert.equal(await page.getByRole('button',{name:'To project space…',exact:true}).count(),3,'every original retains its existing project action');
    assert.deepEqual(await page.evaluate(()=>images.reads),[2,5,8].map(index=>({id:'b'.repeat(32),index,dir:'in'})));assert.deepEqual(await page.evaluate(()=>images.writes),[]);
    await page.evaluate(()=>stopImages());const urls=await page.evaluate(()=>window.urls);assert(urls.created.every(u=>urls.revoked.includes(u)),'all opened object URLs revoked at unmount');assert.deepEqual(errors,[]);
    console.log(JSON.stringify({skin,width,compact:true,noAutomaticDecode:true,originalBytesAndNames:true,exactIndices:true,keyboardFocus:true,failedDownload:true,cleanup:true}));
   }finally{await context.close();}
  });
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
