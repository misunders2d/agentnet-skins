import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {root,listSkins} from './lib.mjs';
const world=process.env.AGENTNET_SKIN_WORLD,evidence=process.env.AGENTNET_SKINS_EVIDENCE,urls=JSON.parse(fs.readFileSync(path.join(world,'urls.json')));
// `agentnet ui` prints explanatory lines after its URL; pass only the URL.
for(const value of Object.values(urls)){const match=value.page.match(/https?:\/\/[^\s]+/);if(!match)throw Error('Fixture did not emit page URL');value.page=match[0];}
fs.writeFileSync(path.join(world,'urls.json'),JSON.stringify(urls),{mode:0o600});
const screenshots=path.join(evidence,'screenshots');fs.mkdirSync(screenshots,{recursive:true,mode:0o700});
// package: the real package bytes; loader: what the production loader installs
// (the same package, or a renamed test copy while the pin reserves its id).
const skins=process.env.AGENTNET_SKINS?JSON.parse(process.env.AGENTNET_SKINS):listSkins().map(id=>({id,family:id,package:path.join(root,'dist',id),loader:path.join(root,'dist',id)}));
// Action-linked motion (tests/motion.cjs) is Holonet's own interaction.
const motionFamilies=['holonet'];
let failed=false;const summary={};
for(const s of skins){
 summary[s.id]={};
 const suites=[['contract.cjs',[urls.sergey.page,s.package],s.package],['lifecycle.cjs',[],s.package],['browser.cjs',[],s.loader],['browser-provider.cjs',[],s.loader],['motion.cjs',[],s.loader]];
 for(const [script,args,pkg]of suites){
  if(script==='motion.cjs'&&!motionFamilies.includes(s.family)){summary[s.id][script]='not applicable (no action-linked motion)';console.log('SKIP '+s.id+' motion.cjs: '+s.family+' has no action-linked motion; not counted as a pass');continue;}
  const env={...process.env,AGENTNET_SKIN_PACKAGE:pkg,AGENTNET_SKIN_FAMILY:s.family,AGENTNET_SCREENSHOTS:screenshots,AGENTNET_CLASSIC_EVIDENCE:evidence};
  const x=spawnSync(process.execPath,[path.join(root,'tests',script),...args],{env,encoding:'utf8'});
  fs.writeFileSync(path.join(evidence,s.id+'-'+script+'.txt'),x.stdout+'\n'+x.stderr,{mode:0o600});
  const label=pkg===s.package?'PASS':'PASS (as '+path.basename(pkg)+')';
  if(x.status){console.error(x.stdout,x.stderr);failed=true;summary[s.id][script]='FAIL';}else{console.log(x.stdout.trim());summary[s.id][script]=label;}
 }
}
fs.writeFileSync(path.join(evidence,'world-summary.json'),JSON.stringify(summary,null,1),{mode:0o600});
if(failed)process.exit(1);
