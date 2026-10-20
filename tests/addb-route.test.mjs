import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const collection=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
test('actual addB tolerates only late fulfillment of an already handled real route',{skip:!process.env.AGENTNET_CHROMIUM,timeout:60000},async()=>{
 const {chromium}=require(process.env.AGENTNET_PLAYWRIGHT||'playwright');
 const declarations=fs.readFileSync(path.join(collection,'tests/browser.cjs'),'utf8').split('\n')
  .map(line=>line.match(/\baddB\s*=\s*(async r=>\{.*\});\s*$/)).filter(Boolean);
 assert.equal(declarations.length,1,'Exactly one actual addB handler assignment ends on its source line');
 const expression=declarations[0][1];
 const guard='.catch(e=>{if(!/(^|: )Route is already handled!$/.test(e.message))throw e;})';
 assert.equal(expression.split(guard).length,2);
 const seed={dm_vitalii:'fixture'},B={pid:'b'.repeat(32)},actual=vm.runInNewContext('('+expression+')',{seed,B});
 const old=vm.runInNewContext('('+expression.replace(guard,'')+')',{seed,B});
 const server=http.createServer((req,res)=>{if(req.url.startsWith('/api/dm?')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:seed.dm_vitalii,agents:[]}));}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Route lifetime fixture</title>');}});
 let browser,context,oldError;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:process.env.AGENTNET_CHROMIUM});context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(4000);
  let resolveRoute,rejectRoute;const finished=new Promise((resolve,reject)=>{resolveRoute=resolve;rejectRoute=reject;});
  await page.route(/\/api\/dm\?id=/,async route=>{
   try{
    await route.continue(); // Public API legitimately handles this actual Route once.
    await assert.rejects(old(route),error=>{oldError=error.message;return /(^|: )Route is already handled!$/.test(error.message);});
    await actual(route);resolveRoute();
   }catch(error){rejectRoute(error);}
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  await Promise.all([finished,page.evaluate(()=>fetch('/api/dm?id=fixture').then(r=>r.json()))]);
  for(const phase of ['fetch','json','fulfill','fulfill-near-match']){
   const error=new Error(phase==='fetch'?'route.fetch: Route is already handled!':phase==='json'?'Route is already handled!':phase==='fulfill'?'Different fulfill failure':'Route is already handled! suffix');
   const route={fetch:async()=>{if(phase==='fetch')throw error;return{json:async()=>{if(phase==='json')throw error;return{id:seed.dm_vitalii,agents:[]};}};},fulfill:async()=>{throw error;}};
   await assert.rejects(actual(route),caught=>caught===error,phase+' must propagate');
  }
  console.log(JSON.stringify({realRoutePubliclyHandled:true,oldLateFulfillError:oldError,actualGuardedHandlerCompleted:true,nonmatchingOrUpstreamErrorControls:4}));
 }finally{
  await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));
 }
});
