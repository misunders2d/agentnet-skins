// The pinned AgentNet's own skin gallery (internal/ui/static/skin-gallery.mjs,
// with local-skins.mjs prepare) reading published/ as if it were the latest
// release: every listed skin must verify and install, every preview must
// verify. Run by scripts/test.mjs with AGENTNET_UPSTREAM (the pinned checkout).
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const [published,running]=process.argv.slice(2),up=process.env.AGENTNET_UPSTREAM,reserved=JSON.parse(process.env.AGENTNET_RESERVED||'[]');
const {gallery,LATEST,RAW}=await import(pathToFileURL(path.join(up,'internal/ui/static/skin-gallery.mjs')).href);
const {prepare}=await import(pathToFileURL(path.join(up,'internal/ui/static/local-skins.mjs')).href);
const tag='v0.0.0-gallery-check',base=RAW+tag+'/published/',asked=[];
const fetcher=async(url,init)=>{
 asked.push(url);if(init.credentials!=='omit'||init.redirect!=='error')throw Error('gallery request options changed');
 if(url===LATEST)return new Response(JSON.stringify({tag_name:tag,draft:false,prerelease:false}));
 if(!url.startsWith(base))return new Response('no',{status:404});
 const file=path.join(published,...url.slice(base.length).split('/'));
 return fs.existsSync(file)?new Response(fs.readFileSync(file)):new Response('no',{status:404});
};
const store=[],local={supported:()=>true,prepare,catalog:async()=>store.map(x=>({...x})),install:async files=>{const {item}=await prepare(files);store.push(item);return item;}};
const g=gallery({running:()=>running,fetcher,local}),list=await g.list(),catalog=JSON.parse(fs.readFileSync(path.join(published,'catalog.json'),'utf8')),results={};
if(list.skins.length!==catalog.skins.length)throw Error('gallery listed '+list.skins.length+' of '+catalog.skins.length+' catalog skins');
for(const s of list.skins){
 if(s.state!=='install')throw Error(s.id+': gallery state '+s.state+' on AgentNet '+running);
 for(let i=0;i<s.previews;i++){const blob=await g.preview(s.id,i);if(!blob.size)throw Error(s.id+': empty preview');}
 if(reserved.includes(s.id)){
  // This AgentNet still embeds a skin with that id: it must refuse, never install over it.
  const refused=await g.install(s.id).then(()=>false,e=>/Invalid AgentNet skin manifest|built into AgentNet/.test(e.message));
  if(!refused)throw Error(s.id+': a pinned AgentNet that reserves this id installed it');
  results[s.id]='listed, previews verified; install refused by this pin (reserved id)';
 }else{
  const id=await g.install(s.id),held=store.find(x=>x.id===id),entry=catalog.skins.find(x=>x.id===s.id);
  if(id!=='local:'+s.id||held.digest!==entry.digest)throw Error(s.id+': installed '+id+' with digest '+held?.digest);
  results[s.id]='listed, previews verified, installed with digest '+entry.digest.slice(0,12);
 }
}
if(asked.some(u=>!u.startsWith('https://api.github.com/')&&!u.startsWith(RAW)))throw Error('gallery read another source');
console.log(JSON.stringify(results,null,1));console.log('PASS pinned AgentNet gallery accepts published/: '+Object.keys(results).join(', '));
