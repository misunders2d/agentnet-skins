import fs from 'node:fs';import path from 'node:path';import {root,listSkins,manifestAt,validateManifest,validateSources,sums} from './lib.mjs';
const ids=process.argv.slice(2);for(const id of ids.length?ids:listSkins()){
 if(!listSkins().includes(id))throw Error('Unknown skin '+id);
 const input=path.join(root,'skins',id),m=validateManifest(manifestAt(input)),out=path.join(root,'dist',id);
 if(m.id!==id)throw Error('Directory must match manifest id');
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true,mode:0o700});
 const source=path.join(input,'src');
 // Manifest module generated only in output: builds never modify tracked sources.
 for(const n of m.files){fs.mkdirSync(path.dirname(path.join(out,n)),{recursive:true,mode:0o700});if(n==='manifest.mjs')fs.writeFileSync(path.join(out,n),'export default '+JSON.stringify(m,null,2)+';\n',{mode:0o600});else fs.copyFileSync(path.join(source,n),path.join(out,n));fs.chmodSync(path.join(out,n),0o600);}
 fs.copyFileSync(path.join(input,'skin.json'),path.join(out,'skin.json'));fs.chmodSync(path.join(out,'skin.json'),0o600);
 const bytes=validateSources(out,m);fs.writeFileSync(path.join(root,'dist',id+'.SHA256SUMS'),sums(out,['skin.json',...m.files]),{mode:0o600});
 console.log(`Built ${id}: ${m.files.length} assets, ${bytes} bytes -> dist/${id}`);
}
