// published/ is exactly what AgentNet's skin gallery downloads and verifies:
// every hash, size and consent digest is recomputed here from the bytes.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {root,listSkins,validateManifest,packageFiles,galleryEntry} from '../scripts/lib.mjs';
const published=path.join(root,'published'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const HEX=/^[0-9a-f]{64}$/,RELEASE=/^v\d{1,6}\.\d{1,6}\.\d{1,6}$/,SEGMENT=/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const pathOK=p=>typeof p==='string'&&p.length<=200&&p.split('/').every(s=>SEGMENT.test(s)&&s!=='..');
// Consent digest as AgentNet computes it (static/skins.go parseSkin, local-skins.mjs prepare).
const digest=dir=>{const raw=fs.readFileSync(path.join(dir,'skin.json')),h=crypto.createHash('sha256').update(raw);for(const n of JSON.parse(raw).files)h.update(Buffer.from(n)).update(Buffer.from([0])).update(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest());return h.digest('hex');};
const catalog=JSON.parse(fs.readFileSync(path.join(published,'catalog.json'),'utf8'));
test('catalog format and order',()=>{
 assert.deepEqual(Object.keys(catalog),['catalog','skins']);assert.equal(catalog.catalog,1);assert.ok(Array.isArray(catalog.skins)&&catalog.skins.length<=64);
 const ids=catalog.skins.map(s=>s.id);assert.deepEqual(ids,[...ids].sort(),'skins in id order');assert.equal(new Set(ids).size,ids.length);
 assert.equal(fs.readFileSync(path.join(published,'catalog.json'),'utf8'),JSON.stringify(catalog,null,2)+'\n','canonical JSON');
 // Exactly the skins whose gallery metadata is complete.
 assert.deepEqual(ids,listSkins().filter(id=>galleryEntry(id).ready));
});
test('no extra or missing files',()=>{
 const expected=['catalog.json',...catalog.skins.flatMap(s=>[...s.files,...s.previews].map(f=>s.id+'/'+f.path))].sort();
 assert.deepEqual(packageFiles(published),expected);
});
for(const s of catalog.skins)test('skin '+s.id+': hashes, digest, manifest, metadata',()=>{
 const dir=path.join(published,s.id),raw=fs.readFileSync(path.join(dir,'skin.json')),m=validateManifest(JSON.parse(raw));
 assert.deepEqual(Object.keys(s),['id','name','description','version','api',...(s.agentnet!==undefined?['agentnet']:[]),'digest','files','previews']);
 assert.equal(s.id,m.id);assert.equal(s.name,m.name);assert.ok(Buffer.byteLength(s.name)<=80);assert.equal(s.api,m.api);assert.equal(s.api,1);
 assert.equal(s.agentnet,m.agentnet,'catalog agentnet equals the manifest');if(s.agentnet!==undefined)assert.match(s.agentnet,RELEASE);
 assert.match(s.version,/^[0-9A-Za-z.+-]{1,32}$/);assert.ok(typeof s.description==='string'&&s.description.length<=400&&s.description.trim());
 assert.deepEqual(s.files.map(f=>f.path),['skin.json',...m.files],'files: skin.json, then the manifest order');assert.ok(s.files.length<=33);
 let total=0;for(const f of s.files){assert.ok(pathOK(f.path),f.path);assert.match(f.sha256,HEX);const b=fs.readFileSync(path.join(dir,f.path));assert.equal(f.size,b.length,f.path+' size');assert.equal(f.sha256,sha(b),f.path+' sha256');assert.ok(b.length<=4<<20);total+=b.length;}
 assert.ok(total<=16<<20);
 assert.match(s.digest,HEX);assert.equal(s.digest,digest(dir),'consent digest');
 assert.ok(s.previews.length>=1&&s.previews.length<=6);
 for(const p of s.previews){assert.ok(pathOK(p.path)&&/^previews\/[^/]+\.(png|webp)$/.test(p.path),p.path);const b=fs.readFileSync(path.join(dir,p.path));assert.equal(p.size,b.length);assert.equal(p.sha256,sha(b));assert.ok(b.length<=1<<20);assert.ok(typeof p.alt==='string'&&p.alt.trim()&&p.alt.length<=200);}
 // The catalog is this collection's current build and metadata.
 const g=galleryEntry(s.id);assert.equal(s.version,g.version);assert.equal(s.description,g.description);
 assert.deepEqual(s.previews.map(p=>[p.path,p.alt]),g.previews.map(p=>['previews/'+p.file,p.alt]));
 for(const p of g.previews)assert.ok(fs.readFileSync(path.join(root,'skins',s.id,'previews',p.file)).equals(fs.readFileSync(path.join(dir,'previews',p.file))),'preview '+p.file+' matches skins/'+s.id+'/previews');
 const built=path.join(root,'dist',s.id);if(fs.existsSync(built))for(const f of s.files)assert.ok(fs.readFileSync(path.join(built,f.path)).equals(fs.readFileSync(path.join(dir,f.path))),'published '+f.path+' matches dist/'+s.id+': run npm run publish');
});
