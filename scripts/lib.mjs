import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// AgentNet v0.8.25 keeps only Comic built in; Classic and Zoom are collection packages.
export const reserved=['comic','default'];
export const reservedNames=['comic'];
export const releasePattern=/^v\d{1,6}\.\d{1,6}\.\d{1,6}$/;
export function listSkins(project=root){return fs.readdirSync(path.join(project,'skins'),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();}
// An overlay skin keeps Comic's interface and replaces its skin layer: skins/<id>/overlay/.
export function isOverlay(id,project=root){return fs.existsSync(path.join(project,'skins',id,'overlay'));}
export function manifestAt(dir){if(fs.lstatSync(dir).isSymbolicLink()||fs.lstatSync(path.join(dir,'skin.json')).isSymbolicLink())throw Error('Manifest/root symlink refused');return JSON.parse(fs.readFileSync(path.join(dir,'skin.json'),'utf8'));}
export function validateManifest(m){
 if(m.api!==1)throw Error('Host API must be 1');
 if(!/^[a-z][a-z0-9-]{0,47}$/.test(m.id)||reserved.includes(m.id))throw Error('Invalid or reserved skin id');
 if(typeof m.name!=='string'||!m.name.trim()||m.name.length>80||/\p{Cc}/u.test(m.name)||reservedNames.includes(m.name.trim().toLowerCase().replace(/\s+/g,' ')))throw Error('Invalid or reserved display name');
 if('agentnet'in m&&(typeof m.agentnet!=='string'||!releasePattern.test(m.agentnet)))throw Error('agentnet must name a release such as v0.8.25');
 if('builtin'in m||'digest'in m)throw Error('Trust and digest belong to host');
 if(!Array.isArray(m.files)||!m.files.length||m.files.length>32||new Set(m.files).size!==m.files.length)throw Error('Invalid files inventory');
 for(const f of m.files)if(typeof f!=='string'||f==='skin.json'||f.includes('\\')||f.startsWith('/')||f.split('/').some(p=>!p||p==='.'||p==='..')||/[?#\p{Cc}]/u.test(f)||! /\.(m?js|css|json|png|svg|webp|woff2)$/.test(f))throw Error('Unsafe asset path or type: '+f);
 if(!m.files.includes(m.entry)||! /\.m?js$/.test(m.entry))throw Error('Undeclared or invalid entry');
 for(const k of ['style','document'])if(m[k]&&(!m.files.includes(m[k])||!m[k].endsWith('.css')))throw Error('Undeclared '+k);
 return m;
}
// Hand-written skin code must not reach transport, page globals, the page's
// DOM, polling, eval or inline styles. Overlay sources are linted the same way.
const forbiddenCode=/(?:window|globalThis)\.(?:agentnet\w*|fetch)|\bfetch\s*\(|\bEventSource\b|\bXMLHttpRequest\b|\bWebSocket\b|document\.(?:querySelector|getElementById|body|head|documentElement)|\bsetInterval\s*\(|(?:innerHTML\s*=|\beval\s*\()/;
const inlineStyle=/\bstyle\s*:\s*["']|\bstyle=["']/;
function lintCode(name,s){
 if(forbiddenCode.test(s))throw Error('Forbidden transport, globals, DOM, polling or eval: '+name);
 if(inlineStyle.test(s))throw Error('CSP-forbidden inline style: '+name);
}
// bundle: the package's code is AgentNet's own Comic build (an overlay skin),
// checked at run time by AgentNet's contract check, so the source lint above
// applies to the overlay's sources instead (validateOverlay). Every other rule
// is the same; package-relative URLs may also name a declared directory (m/emoji).
export function validateSources(dir,m,{bundle=false}={}){
 let total=0;const declared=new Set(m.files);
 const inside=(target)=>declared.has(target)||m.files.some(f=>f.startsWith(target.replace(/\/$/,'')+'/'));
 for(const name of m.files){
  for(let parent=path.dirname(name);parent!=='.';parent=path.dirname(parent))if(fs.lstatSync(path.join(dir,parent)).isSymbolicLink())throw Error('Asset parent symlink refused');
  const file=path.join(dir,name),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4*1024*1024)throw Error('Invalid or oversized asset: '+name);
  total+=stat.size;
  if(!/\.(m?js|css)$/.test(name))continue;
  const s=fs.readFileSync(file,'utf8');
  if(/\.m?js$/.test(name)&&!bundle)lintCode(name,s);
  const imports=[...s.matchAll(/(?:^|\n)\s*import[^;\n]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|new URL\(\s*["']([^"']+)["']/g)].map(x=>x[1]||x[2]||x[3]);
  if(name.endsWith('.css'))for(const match of s.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)){const target=match[2].trim();if(!target.startsWith('./')&&!/^(?:[a-z]+:|\/|\.\.)/i.test(target))imports.push('./'+target);else imports.push(target);}
  for(const target of imports){
   if(target==='/assets/typing.mjs')continue;
   if(bundle&&!/^(?:[a-z]+:|\/|\.\.)/i.test(target)&&inside(path.posix.normalize(path.posix.join(path.posix.dirname(name),target))))continue;
   if(!target.startsWith('./')||!declared.has(path.posix.normalize(path.posix.join(path.posix.dirname(name),target))))throw Error('Undeclared or external import: '+name+' -> '+target);
  }
 }
 if(total>16*1024*1024)throw Error('Package exceeds 16 MiB');return total;
}
export function sums(dir,names){return names.map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex')+'  '+n).join('\n')+'\n';}
// The consent digest (AgentNet static/skins.go parseSkin, local-skins.mjs prepare):
// SHA-256 of skin.json's bytes, then per declared file: name, 0x00, raw SHA-256.
export function packageDigest(dir){
 const raw=fs.readFileSync(path.join(dir,'skin.json')),m=JSON.parse(raw),hash=crypto.createHash('sha256').update(raw);
 for(const name of m.files)hash.update(Buffer.from(name,'utf8')).update(Buffer.from([0])).update(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest());
 return hash.digest('hex');
}

// Exact package inventories include declared nested assets.
export function packageFiles(dir,prefix=''){return fs.readdirSync(path.join(dir,prefix),{withFileTypes:true}).flatMap(item=>{const name=prefix?prefix+'/'+item.name:item.name;return item.isDirectory()?packageFiles(dir,name):[name];}).sort();}
// Keep disposable runtime packages separate from real source and build outputs.
export function fixtureSkinId(project=root,base='qa-orbit'){let id=base,suffix=1;while(fs.existsSync(path.join(project,'skins',id))||fs.existsSync(path.join(project,'dist',id))||fs.existsSync(path.join(project,'dist',id+'.SHA256SUMS')))id=base+'-'+(++suffix);return id;}

export function run(cmd,args,opts={}){const x=spawnSync(cmd,args,{cwd:root,stdio:'inherit',...opts});if(x.status!==0)throw Error(cmd+' '+args.join(' ')+' failed ('+(x.status??x.signal)+')');return x;}
export function pin(project=root){return JSON.parse(fs.readFileSync(path.join(project,'upstream.json'),'utf8'));}
// The pinned AgentNet checkout, shared by tests, overlay builds and new
// overlay skins. AGENTNET_UPSTREAM names one already prepared; otherwise
// .cache/upstream is archived from AGENTNET_SOURCE (only the pinned commit,
// never working-tree changes) or cloned from the pinned repository.
export function upstream(project=root){
 const p=pin(project);
 const dir=process.env.AGENTNET_UPSTREAM?path.resolve(process.env.AGENTNET_UPSTREAM):path.join(project,'.cache','upstream'),stamp=path.join(dir,'.agentnet-commit');
 if(!process.env.AGENTNET_UPSTREAM&&!fs.existsSync(stamp)){
  const cache=path.dirname(dir);fs.mkdirSync(cache,{recursive:true,mode:0o700});fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  if(process.env.AGENTNET_SOURCE){
   const source=path.resolve(process.env.AGENTNET_SOURCE),tar=path.join(cache,'upstream.tar'),fd=fs.openSync(tar,'w');
   try{run('git',['-C',source,'archive',p.commit],{stdio:['ignore',fd,'inherit']});}finally{fs.closeSync(fd);}
   run('tar',['-xf',tar,'-C',dir]);fs.unlinkSync(tar);
  }else{
   run('git',['clone','--no-checkout',p.repository,dir]);run('git',['-C',dir,'checkout','--detach',p.commit]);
  }
  fs.writeFileSync(stamp,p.commit+'\n');
 }
 if(!fs.existsSync(stamp)||fs.readFileSync(stamp,'utf8').trim()!==p.commit)throw Error('Wrong upstream pin in '+dir+'; delete it and retry');
 return dir;
}

// Overlay skins: skins/<id>/skin.json holds only api, id, name and agentnet;
// the build writes the complete manifest.
const overlayKeys=['api','id','name','agentnet'];
export function overlayManifest(id,project=root){
 const m=JSON.parse(fs.readFileSync(path.join(project,'skins',id,'skin.json'),'utf8')),p=pin(project);
 for(const k of Object.keys(m))if(!overlayKeys.includes(k))throw Error(id+': an overlay skin.json holds only api, id, name and agentnet; the build writes the rest ('+k+')');
 validateManifest({...m,entry:'entry.mjs',files:['entry.mjs']});
 if(m.id!==id)throw Error('Directory must match manifest id');
 if(m.agentnet!==p.version)throw Error(id+': an overlay is built from the pinned AgentNet '+p.version+'; set "agentnet": "'+p.version+'"');
 return m;
}
// The overlay's own sources: Comic's slots, helpers and fonts (the kit README,
// internal/ui/web/src/skin/README.md in the pinned AgentNet).
export function validateOverlay(id,project=root){
 const m=overlayManifest(id,project),dir=path.join(project,'skins',id,'overlay'),files=packageFiles(dir);
 for(const name of files){
  const file=path.join(dir,name),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.size>4*1024*1024)throw Error('Invalid or oversized overlay file: '+name);
  if(name.startsWith('fonts/')?!/^fonts\/(?:[^/]+\.woff2|LICENSE[^/]*\.txt)$/.test(name):!/\.(tsx?|m?js|css|svg|png|webp|json)$/.test(name))throw Error('Unsupported overlay file: '+name);
  if(/\.(tsx?|m?js)$/.test(name)){const s=fs.readFileSync(file,'utf8');lintCode('overlay/'+name,s);if(/\bfrom\s*["'](?:[a-z]+:|\/\/)|\bimport\s*\(\s*["'](?:[a-z]+:|\/\/)|["']\.\.\/\.\.\//.test(s))throw Error('Overlay imports stay in AgentNet\'s web source: overlay/'+name);}
 }
 const brand=path.join(dir,'brand.tsx');if(!fs.existsSync(brand))throw Error(id+': overlay/brand.tsx names the skin (id, name, storage, themeKey)');
 const b=fs.readFileSync(brand,'utf8'),field=k=>(b.match(new RegExp('\\b'+k+':\\s*"([^"]*)"'))||[])[1];
 if(field('id')!==m.id)throw Error(id+': brand.tsx id must equal the manifest id');
 for(const k of ['storage','themeKey']){const v=field(k);if(!v||!(v===m.id||v.startsWith(m.id+'.'))||v.startsWith('agentnet.'))throw Error(id+': brand.tsx '+k+' must start with the skin id, never agentnet.');}
 const doc=path.join(dir,'document.css');
 if(fs.existsSync(doc)){
  const s=fs.readFileSync(doc,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  if(s.replace(/@font-face\s*\{[^{}]*\}/g,'').trim())throw Error(id+': overlay/document.css holds only @font-face rules');
  for(const match of s.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)){const target=match[2].trim();if(!/^m\/fonts\/[^/]+\.woff2$/.test(target)||(fs.existsSync(path.join(dir,'fonts'))&&!fs.existsSync(path.join(dir,'fonts',target.slice('m/fonts/'.length)))))throw Error(id+': document.css fonts come from overlay/fonts as m/fonts/<file>.woff2: '+target);}
 }
 return m;
}
// Builds an overlay with the pinned AgentNet's own Comic build
// (internal/ui/web/build.sh, needs npm registry access or its cache).
export function buildOverlay(id,project=root){
 const m=validateOverlay(id,project),up=upstream(project),out=path.join(project,'dist',id),temp=fs.mkdtempSync(path.join(os.tmpdir(),'agentnet-overlay-'));
 fs.mkdirSync(path.join(project,'dist'),{recursive:true,mode:0o700});fs.rmSync(out,{recursive:true,force:true});
 try{
  run('sh',[path.join(up,'internal/ui/web/build.sh')],{cwd:temp,stdio:['ignore','inherit','inherit'],env:{...process.env,SKIN_OVERLAY:path.join(project,'skins',id,'overlay'),SKIN_OUT:out,SKIN_MANIFEST:path.join(out,'skin.json'),SKIN_ID:m.id,SKIN_NAME:m.name,SKIN_AGENTNET:m.agentnet,SKIN_LICENSES:path.join(project,'dist',id+'.LICENSES.txt'),SKIN_SUMS:path.join(temp,'SHA256SUMS')}});
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 for(const name of ['',...packageFiles(out)]){const p=path.join(out,name);fs.chmodSync(p,fs.statSync(p).isDirectory()?0o700:0o600);}
 for(let dir of packageFiles(out).map(n=>path.dirname(n)))for(;dir!=='.';dir=path.dirname(dir))fs.chmodSync(path.join(out,dir),0o700);
 return manifestAt(out);
}

// Gallery metadata, skins/<id>/gallery.json: {version, description, previews:[{file, alt}]}
// with files in skins/<id>/previews/. A skin reaches the catalog once it has a
// description and at least one real preview; malformed metadata is an error.
const galleryKeys=['version','description','previews'],plain=/[\p{Cc}<>]/u;
const isPNG=b=>b.length>8&&b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
const isWebP=b=>b.length>12&&b.toString('latin1',0,4)==='RIFF'&&b.toString('latin1',8,12)==='WEBP';
export function galleryEntry(id,project=root){
 const file=path.join(project,'skins',id,'gallery.json');
 if(!fs.existsSync(file))return {ready:false,reason:'no gallery.json'};
 const g=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const k of Object.keys(g))if(!galleryKeys.includes(k))throw Error(id+': gallery.json holds only version, description and previews ('+k+')');
 if(typeof g.version!=='string'||!/^[0-9A-Za-z.+-]{1,32}$/.test(g.version))throw Error(id+': gallery.json version: 1-32 letters, digits, . + or -');
 if(typeof g.description!=='string'||g.description.length>400||plain.test(g.description)||g.description!==g.description.trim())throw Error(id+': gallery.json description: plain text on one line, at most 400 characters');
 if(!Array.isArray(g.previews)||g.previews.length>6)throw Error(id+': gallery.json previews: at most 6');
 const seen=new Set();
 for(const p of g.previews){
  if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['file','alt'].includes(k))||typeof p.file!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,90}\.(png|webp)$/.test(p.file)||seen.has(p.file))throw Error(id+': gallery.json preview file: a distinct .png or .webp name in previews/');
  if(typeof p.alt!=='string'||!p.alt.trim()||p.alt.length>200||plain.test(p.alt)||p.alt!==p.alt.trim())throw Error(id+': gallery.json preview alt: plain text, 1-200 characters');
  seen.add(p.file);const bytes=fs.readFileSync(path.join(project,'skins',id,'previews',p.file));
  if(bytes.length>1<<20)throw Error(id+': preview over 1 MiB: '+p.file);
  if(!(p.file.endsWith('.png')?isPNG(bytes):isWebP(bytes)))throw Error(id+': preview is not the image its name says: '+p.file);
 }
 if(!g.description)return {ready:false,reason:'gallery.json has no description yet'};
 if(!g.previews.length)return {ready:false,reason:'gallery.json lists no previews yet'};
 return {ready:true,version:g.version,description:g.description,previews:g.previews.map(p=>({file:p.file,alt:p.alt}))};
}

// The pinned AgentNet program, built from the pinned checkout (AGENTNET_GO picks Go).
export function agentnetBinary(project=root){const up=upstream(project),bin=path.join(project,'.cache','agentnet');run(process.env.AGENTNET_GO||'go',['build','-o',bin,'./cmd/agentnet'],{cwd:up});return bin;}
// The ids the pinned AgentNet reserves for skins it still embeds (v0.8.24 and older reserve classic and zoom).
export function pinnedReservedIds(project=root){const m=fs.readFileSync(path.join(upstream(project),'internal/ui/static/skins.go'),'utf8').match(/ReservedSkinIDs\s*=\s*\[\]string\{([^}]*)\}/);if(!m)throw Error('Cannot read the pinned AgentNet reserved skin ids');return [...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);}
// A disposable copy of a standalone skin under another id and name, built into
// dist/<alias>; only skin.json and the generated manifest.mjs differ.
export function buildRenamedCopy(id,alias,name,work){
 const temp=fs.mkdtempSync(path.join(work,'copy-'+id+'-'));
 try{
  fs.mkdirSync(path.join(temp,'skins'));fs.cpSync(path.join(root,'scripts'),path.join(temp,'scripts'),{recursive:true});fs.copyFileSync(path.join(root,'upstream.json'),path.join(temp,'upstream.json'));fs.cpSync(path.join(root,'skins',id),path.join(temp,'skins',alias),{recursive:true});
  const m=manifestAt(path.join(temp,'skins',alias));m.id=alias;m.name=name;fs.writeFileSync(path.join(temp,'skins',alias,'skin.json'),JSON.stringify(m,null,2)+'\n');
  run(process.execPath,['scripts/build.mjs',alias],{cwd:temp});fs.rmSync(path.join(root,'dist',alias),{recursive:true,force:true});fs.cpSync(path.join(temp,'dist',alias),path.join(root,'dist',alias),{recursive:true});
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 return path.join(root,'dist',alias);
}
