import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const reserved=['comic','classic','zoom','default'];
export function listSkins(){return fs.readdirSync(path.join(root,'skins'),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();}
export function manifestAt(dir){if(fs.lstatSync(dir).isSymbolicLink()||fs.lstatSync(path.join(dir,'skin.json')).isSymbolicLink())throw Error('Manifest/root symlink refused');return JSON.parse(fs.readFileSync(path.join(dir,'skin.json'),'utf8'));}
export function validateManifest(m){
 if(m.api!==1)throw Error('Host API must be 1');
 if(!/^[a-z][a-z0-9-]{0,47}$/.test(m.id)||reserved.includes(m.id))throw Error('Invalid or reserved skin id');
 if(typeof m.name!=='string'||!m.name.trim()||m.name.length>80||/\p{Cc}/u.test(m.name)||reserved.slice(0,3).includes(m.name.trim().toLowerCase().replace(/\s+/g,' ')))throw Error('Invalid or reserved display name');
 if('builtin'in m||'digest'in m)throw Error('Trust and digest belong to host');
 if(!Array.isArray(m.files)||!m.files.length||m.files.length>32||new Set(m.files).size!==m.files.length)throw Error('Invalid files inventory');
 for(const f of m.files)if(typeof f!=='string'||f==='skin.json'||f.includes('\\')||f.startsWith('/')||f.split('/').some(p=>!p||p==='.'||p==='..')||/[?#\p{Cc}]/u.test(f)||! /\.(m?js|css|json|png|svg|webp|woff2)$/.test(f))throw Error('Unsafe asset path or type: '+f);
 if(!m.files.includes(m.entry)||! /\.m?js$/.test(m.entry))throw Error('Undeclared or invalid entry');
 for(const k of ['style','document'])if(m[k]&&(!m.files.includes(m[k])||!m[k].endsWith('.css')))throw Error('Undeclared '+k);
 return m;
}
export function validateSources(dir,m){
 let total=0;const declared=new Set(m.files);
 for(const name of m.files){
  for(let parent=path.dirname(name);parent!=='.';parent=path.dirname(parent))if(fs.lstatSync(path.join(dir,parent)).isSymbolicLink())throw Error('Asset parent symlink refused');
  const file=path.join(dir,name),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4*1024*1024)throw Error('Invalid or oversized asset: '+name);
  total+=stat.size;
  if(!/\.(m?js|css)$/.test(name))continue;
  const s=fs.readFileSync(file,'utf8');
  if(/\.m?js$/.test(name)){
   if(/(?:window|globalThis)\.(?:agentnet\w*|fetch)|\bfetch\s*\(|\bEventSource\b|\bXMLHttpRequest\b|\bWebSocket\b|document\.(?:querySelector|getElementById|body|head|documentElement)|\bsetInterval\s*\(|(?:innerHTML\s*=|\beval\s*\()/.test(s))throw Error('Forbidden transport, globals, DOM, polling or eval: '+name);
   if(/\bstyle\s*:\s*["']|\bstyle=["']/.test(s))throw Error('CSP-forbidden inline style: '+name);
  }
  const imports=[...s.matchAll(/(?:^|\n)\s*import[^;\n]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|new URL\(\s*["']([^"']+)["']/g)].map(x=>x[1]||x[2]||x[3]);
  if(name.endsWith('.css'))for(const match of s.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)){const target=match[2].trim();if(!target.startsWith('./')&&!/^(?:[a-z]+:|\/|\.\.)/i.test(target))imports.push('./'+target);else imports.push(target);}
  for(const target of imports){
   if(target==='/assets/typing.mjs')continue;
   if(!target.startsWith('./')||!declared.has(path.posix.normalize(path.posix.join(path.posix.dirname(name),target))))throw Error('Undeclared or external import: '+name+' -> '+target);
  }
 }
 if(total>16*1024*1024)throw Error('Package exceeds 16 MiB');return total;
}
export function sums(dir,names){return names.map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex')+'  '+n).join('\n')+'\n';}

// Exact package inventories include declared nested assets.
export function packageFiles(dir,prefix=''){return fs.readdirSync(path.join(dir,prefix),{withFileTypes:true}).flatMap(item=>{const name=prefix?prefix+'/'+item.name:item.name;return item.isDirectory()?packageFiles(dir,name):[name];}).sort();}
// Keep disposable runtime packages separate from real source and build outputs.
export function fixtureSkinId(project=root){let id='qa-orbit',suffix=1;while(fs.existsSync(path.join(project,'skins',id))||fs.existsSync(path.join(project,'dist',id))||fs.existsSync(path.join(project,'dist',id+'.SHA256SUMS')))id='qa-orbit-'+(++suffix);return id;}
