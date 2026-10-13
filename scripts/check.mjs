import path from 'node:path';import {spawnSync} from 'node:child_process';import {root,listSkins,isOverlay,validateOverlay,manifestAt,validateManifest,validateSources} from './lib.mjs';
for(const id of listSkins()){
 const dir=path.join(root,'dist',id),m=validateManifest(manifestAt(dir)),overlay=isOverlay(id);
 if(m.id!==id)throw Error('dist/'+id+' does not hold '+id);
 // An overlay's own sources take the source lint; its package is AgentNet's Comic build.
 if(overlay)validateOverlay(id);
 validateSources(dir,m,{bundle:overlay});
 for(const file of m.files.filter(n=>/\.m?js$/.test(n))){const p=spawnSync(process.execPath,['--check',path.join(dir,file)],{stdio:'inherit'});if(p.status)process.exit(p.status);}
 console.log('PASS package manifest, assets, syntax and static contract: '+id+(overlay?' (overlay sources linted; package built by AgentNet '+m.agentnet+')':''));
}
