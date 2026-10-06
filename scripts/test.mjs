import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';import {browserEnvironment} from './browser.mjs';import {root,listSkins,fixtureSkinId} from './lib.mjs';
const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.json'))),cache=path.join(root,'.cache'),up=path.join(cache,'upstream');fs.mkdirSync(cache,{recursive:true,mode:0o700});
function run(cmd,args,opts={}){const x=spawnSync(cmd,args,{cwd:root,stdio:'inherit',...opts});if(x.status!==0)throw Error(cmd+' failed ('+x.status+')');return x;}
if(!fs.existsSync(path.join(up,'.agentnet-commit'))){
 fs.mkdirSync(up,{recursive:true});
 if(process.env.AGENTNET_SOURCE){
  const source=path.resolve(process.env.AGENTNET_SOURCE),tar=path.join(cache,'upstream.tar'),fd=fs.openSync(tar,'w');
  try{run('git',['-C',source,'archive',pin.commit],{stdio:['ignore',fd,'inherit']});}finally{fs.closeSync(fd);}
  run('tar',['-xf',tar,'-C',up]);fs.unlinkSync(tar);
 }else{
  run('git',['clone','--no-checkout',pin.repository,up]);run('git',['-C',up,'checkout','--detach',pin.commit]);
 }
 fs.writeFileSync(path.join(up,'.agentnet-commit'),pin.commit+'\n');
}
if(fs.readFileSync(path.join(up,'.agentnet-commit'),'utf8').trim()!==pin.commit)throw Error('Wrong upstream pin; delete .cache/upstream and retry');
const go=process.env.AGENTNET_GO||'go',bin=path.join(cache,'agentnet');run(go,['build','-o',bin,'./cmd/agentnet'],{cwd:up});
const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'agentnet-skins-')),world=path.join(evidence,'world');fs.chmodSync(evidence,0o700);
const scaffoldId=fixtureSkinId();
const scaffold=path.join(evidence,'scaffold');fs.mkdirSync(scaffold);fs.cpSync(path.join(root,'scripts'),path.join(scaffold,'scripts'),{recursive:true});fs.mkdirSync(path.join(scaffold,'skins'));fs.cpSync(path.join(root,'skins','holonet'),path.join(scaffold,'skins','holonet'),{recursive:true});run(process.execPath,['scripts/new-skin.mjs',scaffoldId,'QA Orbit'],{cwd:scaffold});fs.rmSync(path.join(scaffold,'skins','holonet'),{recursive:true});run(process.execPath,['scripts/build.mjs',scaffoldId],{cwd:scaffold});fs.cpSync(path.join(scaffold,'dist',scaffoldId),path.join(root,'dist',scaffoldId),{recursive:true});
const ids=[...listSkins(),scaffoldId];
const wrapper=path.join(evidence,'agentnet-fixture');
fs.writeFileSync(wrapper,`#!/bin/sh\nset -eu\ntarget=""\nif [ "$1" = "--home" ] && [ "$3" = "daemon" ]; then target="$2/skins"; fi\nif [ "$1" = "hub" ] && [ "$2" = "serve" ] && [ "$3" = "--data" ]; then target="$4/skins"; fi\nif [ -n "$target" ]; then\n mkdir -p "$target"\n chmod 700 "$target"\n cp -R "${path.join(root,'dist')}/." "$target/"\n rm -f "$target/"*.SHA256SUMS\n chmod -R go-rwx "$target"\nfi\nexec "${bin}" "$@"\n`,{mode:0o700});
const browserEnv=browserEnvironment();
const env={...process.env,...browserEnv,AGENTNET_UPSTREAM:up,AGENTNET_SKIN_IDS:JSON.stringify(ids),AGENTNET_COMPANY_BINARY:wrapper,AGENTNET_COMPANY_WORLD:world,AGENTNET_SKIN_WORLD:world,AGENTNET_COMPANY_GO:go,AGENTNET_COMPANY_SEED:'1',AGENTNET_TEST_ROOT:root,AGENTNET_SKINS_EVIDENCE:evidence,AGENTNET_COMPANY_RUN:'node "$AGENTNET_TEST_ROOT/scripts/world-tests.mjs"'};
console.log('Pinned upstream: '+pin.version+' '+pin.commit);console.log('Private evidence: '+evidence);
try{run('bash',[path.join(up,'internal/ui/testdata/company_world.sh')],{env});console.log('PASS all skin packages: '+ids.join(', '));}
finally{
 // Dispose homes, keys, enrollment URLs, task data and harness output after checks.
 fs.rmSync(world,{recursive:true,force:true});fs.rmSync(wrapper,{force:true});fs.rmSync(scaffold,{recursive:true,force:true});fs.rmSync(path.join(root,'dist',scaffoldId),{recursive:true,force:true});
 console.log('Disposable company removed. Screenshots and bounded test evidence kept privately: '+evidence);
}
