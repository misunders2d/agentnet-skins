import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawn,spawnSync} from 'node:child_process';import {browserEnvironment} from './browser.mjs';import {root,listSkins,isOverlay,fixtureSkinId,manifestAt,pin as readPin,upstream,run,agentnetBinary,pinnedReservedIds,buildRenamedCopy} from './lib.mjs';
const pin=readPin(),up=upstream(),cache=path.join(root,'.cache');fs.mkdirSync(cache,{recursive:true,mode:0o700});
const go=process.env.AGENTNET_GO||'go',bin=agentnetBinary();
const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'agentnet-skins-')),world=path.join(evidence,'world');fs.chmodSync(evidence,0o700);
fs.mkdirSync(path.join(evidence,'screenshots'),{mode:0o700});
// Disposable scaffolds, built from a project copy without their sibling sources:
// a standalone one (Holonet's code) and a throwaway overlay (Comic kit with a
// changed colour), the latter built twice to prove identical bytes.
const scaffoldProject=(name)=>{const dir=path.join(evidence,name);fs.mkdirSync(path.join(dir,'skins'),{recursive:true});fs.cpSync(path.join(root,'scripts'),path.join(dir,'scripts'),{recursive:true});fs.copyFileSync(path.join(root,'upstream.json'),path.join(dir,'upstream.json'));return dir;};
const projectEnv={...process.env,AGENTNET_UPSTREAM:up};
const scaffoldId=fixtureSkinId(),scaffold=scaffoldProject('scaffold');fs.cpSync(path.join(root,'skins','holonet'),path.join(scaffold,'skins','holonet'),{recursive:true});run(process.execPath,['scripts/new-skin.mjs',scaffoldId,'QA Orbit','--standalone'],{cwd:scaffold});fs.rmSync(path.join(scaffold,'skins','holonet'),{recursive:true});run(process.execPath,['scripts/build.mjs',scaffoldId],{cwd:scaffold});fs.cpSync(path.join(scaffold,'dist',scaffoldId),path.join(root,'dist',scaffoldId),{recursive:true});
const overlayId=fixtureSkinId(root,'qa-overlay'),overlayProject=scaffoldProject('overlay');run(process.execPath,['scripts/new-skin.mjs',overlayId,'QA Overlay'],{cwd:overlayProject,env:projectEnv});
const theme=path.join(overlayProject,'skins',overlayId,'overlay','theme.css');fs.writeFileSync(theme,fs.readFileSync(theme,'utf8').replace('--an-canvas: #FFF8EC;','--an-canvas: #EEF6FF;'));
run(process.execPath,['scripts/build.mjs',overlayId],{cwd:overlayProject,env:projectEnv});const overlaySums=fs.readFileSync(path.join(overlayProject,'dist',overlayId+'.SHA256SUMS'),'utf8');
run(process.execPath,['scripts/build.mjs',overlayId],{cwd:overlayProject,env:projectEnv});if(fs.readFileSync(path.join(overlayProject,'dist',overlayId+'.SHA256SUMS'),'utf8')!==overlaySums)throw Error('Overlay rebuild changed bytes');
run(process.execPath,['scripts/check.mjs'],{cwd:overlayProject,env:projectEnv});fs.cpSync(path.join(overlayProject,'dist',overlayId),path.join(root,'dist',overlayId),{recursive:true});
// A pinned AgentNet that still embeds a skin reserves its id (v0.8.24 and
// older, and candidates before the move): its program skips an installed
// package with that id and its browser refuses to import one. Production-loader
// journeys then run a disposable copy under a test id and name; only skin.json
// and the generated manifest.mjs differ. Standalone contract suites, previews
// and the published catalog always use the real package.
const pinnedReserved=pinnedReservedIds(),aliases=[];
const skins=[...listSkins(),scaffoldId,overlayId].map(id=>{
 const pkg=path.join(root,'dist',id),overlay=id===overlayId||isOverlay(id),family=overlay?'comic':id===scaffoldId?'holonet':id;let loader=pkg;
 if(!overlay&&pinnedReserved.includes(id)){
  let alias='qa-'+id,n=1;while(fs.existsSync(path.join(root,'skins',alias))||fs.existsSync(path.join(root,'dist',alias)))alias='qa-'+id+'-'+(++n);
  loader=buildRenamedCopy(id,alias,'QA '+manifestAt(pkg).name,evidence);aliases.push(alias);
  console.log('NOTE pinned AgentNet '+pin.commit.slice(0,12)+' reserves "'+id+'": production-loader journeys use test copy '+alias+' (same code; renamed manifest)');
 }
 return {id,family,overlay,package:pkg,loader};
});
const wrapper=path.join(evidence,'agentnet-fixture');
fs.writeFileSync(wrapper,`#!/bin/sh\nset -eu\ntarget=""\nif [ "$1" = "--home" ] && [ "$3" = "daemon" ]; then target="$2/skins"; fi\nif [ "$1" = "hub" ] && [ "$2" = "serve" ] && [ "$3" = "--data" ]; then target="$4/skins"; fi\nif [ -n "$target" ]; then\n mkdir -p "$target"\n chmod 700 "$target"\n cp -R "${path.join(root,'dist')}/." "$target/"\n rm -f "$target/"*.SHA256SUMS "$target/"*.LICENSES.txt\n chmod -R go-rwx "$target"\nfi\nexec "${bin}" "$@"\n`,{mode:0o700});
const browserEnv=browserEnvironment();
console.log('Pinned upstream: '+pin.version+' '+pin.commit);console.log('Private evidence: '+evidence);
const summary=Object.fromEntries(skins.map(s=>[s.id,{}]));let failed=false;
// AgentNet's own generic contract check (internal/ui/testdata/skin_contract_check.cjs)
// for every package, against the pinned demo daemon: `agentnet ui --demo`,
// invented data, disposable home. It runs AgentNet's journey for the ids it
// knows (classic, zoom, comic); an overlay also runs its Comic journey from a
// copy whose manifest says comic (the same files).
const contractCheck=(label,dir,id,demoURL)=>{
 const x=spawnSync(process.execPath,[path.join(up,'internal/ui/testdata/skin_contract_check.cjs'),demoURL,dir],{env:{...process.env,...browserEnv,AGENTNET_SCREENSHOTS:path.join(evidence,'screenshots')},encoding:'utf8',timeout:300000});
 fs.writeFileSync(path.join(evidence,id+'-'+label.replace(/\W+/g,'-')+'.txt'),(x.stdout||'')+'\n'+(x.stderr||''),{mode:0o600});
 const pass=x.status===0&&/skin contract check PASS/.test(x.stdout||'');summary[id][label]=pass?'PASS':'FAIL';
 if(pass)console.log('PASS '+id+' '+label+': pinned demo daemon, 1440 and 390, A/B/A');
 else{failed=true;console.error('FAIL '+id+' '+label+'\n'+(x.stdout||'').slice(-4000)+'\n'+(x.stderr||'').slice(-4000)+(x.error?'\n'+x.error.message:''));}
};
const demoHome=path.join(evidence,'demo-home');fs.mkdirSync(demoHome,{mode:0o700});
const demo=spawn(bin,['--home',demoHome,'ui','--demo','--listen','127.0.0.1:0'],{stdio:['ignore','pipe','ignore'],env:{...process.env,HOME:demoHome,AGENTNET_NOTIFY:'off'}});
try{
 const demoURL=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('demo daemon did not print its page')),20000);demo.stdout.on('data',d=>{out+=d;const m=out.match(/Open: (http:\/\/127\.0\.0\.1:\d+\/\?t=[0-9a-f]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});demo.on('exit',code=>{clearTimeout(timer);reject(Error('demo daemon exited '+code));});});
 const nativePackages=skins.filter(s=>manifestAt(s.package).files.includes('native-request.mjs')).map(s=>s.package);
 if(nativePackages.length){
  const x=spawnSync(process.execPath,[path.join(root,'tests/native-requests.cjs'),demoURL,...nativePackages],{env:{...process.env,...browserEnv,AGENTNET_UPSTREAM:up,AGENTNET_SCREENSHOTS:path.join(evidence,'screenshots')},encoding:'utf8',timeout:180000});
  fs.writeFileSync(path.join(evidence,'native-requests.txt'),(x.stdout||'')+'\n'+(x.stderr||''),{mode:0o600});
  if(x.status!==0){failed=true;console.error('FAIL native request presentation\n'+x.stdout+'\n'+x.stderr);}else console.log(x.stdout.trim());
 }
 for(const s of skins){
  contractCheck('agentnet skin_contract_check',s.package,s.id,demoURL);
  if(s.overlay){
   const copy=path.join(evidence,'comic-journey-'+s.id),m=manifestAt(s.package);fs.cpSync(s.package,copy,{recursive:true});fs.writeFileSync(path.join(copy,'skin.json'),JSON.stringify({...m,id:'comic'},null,2)+'\n');
   contractCheck('agentnet Comic journey',copy,s.id,demoURL);
  }
 }
}finally{demo.kill();}
// The pinned AgentNet's own gallery code reads published/ as the latest release.
{const x=spawnSync(process.execPath,[path.join(root,'tests','gallery-acceptance.mjs'),path.join(root,'published'),pin.version],{env:{...process.env,AGENTNET_UPSTREAM:up,AGENTNET_RESERVED:JSON.stringify(pinnedReserved)},encoding:'utf8'});
 fs.writeFileSync(path.join(evidence,'gallery-acceptance.txt'),(x.stdout||'')+'\n'+(x.stderr||''),{mode:0o600});
 if(x.status!==0){failed=true;console.error('FAIL AgentNet gallery acceptance of published/\n'+x.stdout+'\n'+x.stderr);}
 else{console.log(x.stdout.trim().split('\n').at(-1));const r=JSON.parse(x.stdout.slice(0,x.stdout.lastIndexOf('}')+1));for(const[id,v]of Object.entries(r))if(summary[id])summary[id]['agentnet gallery (published/)']='PASS: '+v;}}
const env={...process.env,...browserEnv,AGENTNET_UPSTREAM:up,AGENTNET_SKINS:JSON.stringify(skins.filter(s=>!s.overlay)),AGENTNET_COMPANY_BINARY:wrapper,AGENTNET_COMPANY_WORLD:world,AGENTNET_SKIN_WORLD:world,AGENTNET_COMPANY_GO:go,AGENTNET_COMPANY_SEED:'1',...(skins.some(s=>!s.overlay&&s.family==='zoom')?{AGENTNET_COMPANY_HISTORY_COUNT:'200'}:{}),AGENTNET_TEST_ROOT:root,AGENTNET_SKINS_EVIDENCE:evidence,AGENTNET_COMPANY_RUN:'node "$AGENTNET_TEST_ROOT/scripts/world-tests.mjs"'};
for(const s of skins.filter(s=>s.overlay))summary[s.id]['world journeys']='not applicable (Comic-based overlay; the Classic-family and Zoom journeys test other interfaces)';
try{
 if(spawnSync('bash',[path.join(up,'internal/ui/testdata/company_world.sh')],{cwd:root,stdio:'inherit',env}).status!==0)failed=true;
 const worldSummary=path.join(evidence,'world-summary.json');
 if(fs.existsSync(worldSummary))for(const[id,suites]of Object.entries(JSON.parse(fs.readFileSync(worldSummary,'utf8'))))Object.assign(summary[id],suites);else failed=true;
 console.log('Suites per skin:');for(const[id,suites]of Object.entries(summary))console.log(' '+id+': '+Object.entries(suites).map(([k,v])=>k+' '+v).join(', '));
 fs.writeFileSync(path.join(evidence,'summary.json'),JSON.stringify({pin,skins:summary},null,1),{mode:0o600});
 if(failed)throw Error('Skin checks failed; full logs in '+evidence);
 console.log('PASS all skin packages: '+skins.map(s=>s.id).join(', '));
}finally{
 // Dispose homes, keys, enrollment URLs, task data and harness output after checks.
 fs.rmSync(world,{recursive:true,force:true});fs.rmSync(demoHome,{recursive:true,force:true});fs.rmSync(wrapper,{force:true});
 for(const dir of ['scaffold','overlay'])fs.rmSync(path.join(evidence,dir),{recursive:true,force:true});
 for(const id of [scaffoldId,overlayId,...aliases])fs.rmSync(path.join(root,'dist',id),{recursive:true,force:true});
 console.log('Disposable company removed. Screenshots and bounded test evidence kept privately: '+evidence);
}
