import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {root,listSkins} from './lib.mjs';
const world=process.env.AGENTNET_SKIN_WORLD,evidence=process.env.AGENTNET_SKINS_EVIDENCE,urls=JSON.parse(fs.readFileSync(path.join(world,'urls.json')));
// v0.8.1 ui prints explanatory lines after its URL; pass only the URL.
for(const value of Object.values(urls)){const match=value.page.match(/https?:\/\/[^\s]+/);if(!match)throw Error('Fixture did not emit page URL');value.page=match[0];}
fs.writeFileSync(path.join(world,'urls.json'),JSON.stringify(urls),{mode:0o600});
const screenshots=path.join(evidence,'screenshots');fs.mkdirSync(screenshots,{mode:0o700});
let failed=false;
for(const id of JSON.parse(process.env.AGENTNET_SKIN_IDS||JSON.stringify(listSkins()))){
 const pkg=path.join(root,'dist',id),env={...process.env,AGENTNET_SKIN_PACKAGE:pkg,AGENTNET_SCREENSHOTS:screenshots,AGENTNET_CLASSIC_EVIDENCE:evidence};
 for(const [script,args]of [['contract.cjs',[urls.sergey.page,pkg]],['lifecycle.cjs',[]],['browser.cjs',[]],['browser-provider.cjs',[]],['motion.cjs',[]]]){
  const x=spawnSync(process.execPath,[path.join(root,'tests',script),...args],{env,encoding:'utf8'});
  fs.writeFileSync(path.join(evidence,id+'-'+script+'.txt'),x.stdout+'\n'+x.stderr,{mode:0o600});
  if(x.status){console.error(x.stdout,x.stderr);failed=true;}else console.log(x.stdout.trim());
 }
}

if(failed)process.exit(1);
