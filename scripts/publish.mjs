// Writes published/: the exact built packages, their gallery previews and
// published/catalog.json, the only things AgentNet's skin gallery reads (from
// the latest published GitHub release; docs/UI_SKINS.md, Skin gallery in the
// pinned AgentNet). Deterministic: the same build and metadata give the same bytes.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {root,run,listSkins,manifestAt,packageDigest,galleryEntry} from './lib.mjs';
if(!process.argv.includes('--no-build'))run(process.execPath,[path.join(root,'scripts','build.mjs')]);
const out=path.join(root,'published'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
const skins=[];
for(const id of listSkins()){
 const g=galleryEntry(id);if(!g.ready){console.log('NOT PUBLISHED '+id+': '+g.reason);continue;}
 const dir=path.join(root,'dist',id),m=manifestAt(dir),files=['skin.json',...m.files];
 if(m.id!==id)throw Error('dist/'+id+' does not hold '+id);
 if(m.files.some(f=>f.startsWith('previews/')))throw Error(id+': package paths under previews/ would collide with gallery previews');
 const entry={id,name:m.name,description:g.description,version:g.version,api:m.api,...(m.agentnet?{agentnet:m.agentnet}:{}),digest:packageDigest(dir),files:[],previews:[]};
 for(const f of files){const bytes=fs.readFileSync(path.join(dir,f)),target=path.join(out,id,f);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);entry.files.push({path:f,sha256:sha(bytes),size:bytes.length});}
 for(const p of g.previews){const bytes=fs.readFileSync(path.join(root,'skins',id,'previews',p.file)),rel='previews/'+p.file,target=path.join(out,id,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);entry.previews.push({path:rel,sha256:sha(bytes),size:bytes.length,alt:p.alt});}
 skins.push(entry);console.log('Published '+id+' '+g.version+': '+files.length+' files, '+entry.previews.length+' previews, digest '+entry.digest);
}
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({catalog:1,skins},null,2)+'\n');
console.log('Wrote published/catalog.json: '+skins.length+' skins. Commit published/, then the owner creates a GitHub release; only a published release reaches the gallery.');
