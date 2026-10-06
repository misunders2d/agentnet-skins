import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const require=createRequire(import.meta.url);
test('managed browser executable stays resolved across isolated child HOME',()=>{
 const invokingEnv={...process.env};delete invokingEnv.AGENTNET_CHROMIUM;
 const resolved=browserEnvironment(invokingEnv),official=require(resolved.AGENTNET_PLAYWRIGHT).chromium.executablePath();
 assert.equal(resolved.AGENTNET_CHROMIUM,path.resolve(official));
 const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'skin-browser-home-'));
 try{
  const code=`import {browserEnvironment} from ${JSON.stringify(new URL('../scripts/browser.mjs',import.meta.url).href)};process.stdout.write(JSON.stringify({home:process.env.HOME,...browserEnvironment()}));`;
  const x=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{...invokingEnv,...resolved,HOME:isolated},encoding:'utf8'});
  assert.equal(x.status,0,x.stderr);const child=JSON.parse(x.stdout);
  assert.equal(child.home,isolated);assert.equal(child.AGENTNET_CHROMIUM,resolved.AGENTNET_CHROMIUM);
  assert.equal(child.AGENTNET_PLAYWRIGHT,resolved.AGENTNET_PLAYWRIGHT);
 }finally{fs.rmSync(isolated,{recursive:true,force:true});}
});
test('explicit browser override wins without changing HOME',()=>{
 const before=process.env.HOME,resolved=browserEnvironment({...process.env,AGENTNET_CHROMIUM:'./custom-chromium'});
 assert.equal(resolved.AGENTNET_CHROMIUM,path.resolve('./custom-chromium'));assert.equal(process.env.HOME,before);
});
