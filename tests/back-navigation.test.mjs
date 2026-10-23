import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),collection=path.resolve(import.meta.dirname,'..');
test('standalone registered Back dismisses the top layer and unregisters',{skip:!process.env.AGENTNET_CHROMIUM},async t=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#skin{height:100vh}</style><div id="skin"></div>');return;}
  const m=/^\/(classic|holonet|zoom)\/([^/]+)$/.exec(req.url);if(!m){res.writeHead(404).end();return;}
  try{let data=m[2]==='manifest.mjs'?'export default '+fs.readFileSync(path.join(collection,'skins',m[1],'skin.json'),'utf8'):fs.readFileSync(path.join(collection,'skins',m[1],'src',m[2]));
   if(m[2]==='entry.mjs'){const needle=m[1]==='zoom'?'\nstart();':'const ready = start();';assert(data.toString().includes(needle));data=data.toString().replace(needle,'window.fixture={state,handleBack,renderAppControls'+(m[1]==='zoom'?',Zoom':'')+'};'+(m[1]==='zoom'?'':'const ready=Promise.resolve();'));}
   res.setHeader('Content-Type',m[2].endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch(e){res.writeHead(404).end(e.message);}
 });
 let browser;try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});
  for(const skin of ['classic','holonet','zoom'])for(const width of [390,1280])await t.test(skin+' '+width,async()=>{
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
   const report=await page.evaluate(async skin=>{
    const shadow=document.querySelector('#skin').attachShadow({mode:'open'}),root=document.createElement('div');root.className='skin-root';shadow.append(root);
    const module=await import('/'+skin+'/entry.mjs');let callback=null,off=0,statusCalls=0;
    await module.mount(root,{version:1,platform:'daemon',appControlsAvailable:false,workspace:{id:'fixture'},listen(){return()=>{}},onOpen(){},onBack(fn){callback=fn;return()=>{callback=null;off++;};},async appStatus(){statusCalls++;throw Error('known headless must skip');},api:async()=>{throw Error('unexpected API');}});
    if(callback!==fixture.handleBack)throw Error('actual handler not registered');
    fixture.state.overview={me:{address:'atlas/desk'},people:[],person:{person:'atlas',devices:[]},threads:[],dms:[]};
    await fixture.renderAppControls();if(statusCalls)throw Error('known headless performed unsupported request');
    const dialog=root.querySelector('#dialog');dialog.showModal();fixture.state.dialogBusy=true;if(callback()!==true||!dialog.open)throw Error('busy confirmation closed');fixture.state.dialogBusy=false;
    const prevent=e=>e.preventDefault();dialog.addEventListener('cancel',prevent);callback();if(!dialog.open)throw Error('cancel veto ignored');dialog.removeEventListener('cancel',prevent);callback();if(dialog.open)throw Error('top dialog stayed open');
    root.querySelector('#review').hidden=false;callback();if(!root.querySelector('#review').hidden)throw Error('review stayed open');
    if(skin==='zoom'){let out=0;fixture.Zoom.level=2;fixture.Zoom.out=()=>{out++;fixture.Zoom.level--;};if(callback()!==true||out!==1)throw Error('Zoom level was not dismissed');fixture.Zoom.level=0;}
    if(callback()!==false)throw Error('root Back must permit leaving');
    await module.unmount(root);if(callback!==null||off!==1)throw Error('unmount left Back registration');
    return {topLayer:true,busyPreserved:true,cancelVeto:true,review:true,rootExit:true,headlessCalls:statusCalls,unsubscribe:off};
   },skin);
   assert.deepEqual(errors,[]);console.log(JSON.stringify({skin,width,...report,errors}));await context.close();
  });
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
