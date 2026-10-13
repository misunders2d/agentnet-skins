import fs from 'node:fs';import path from 'node:path';import {root,manifestAt,validateManifest,pin,upstream} from './lib.mjs';
const args=process.argv.slice(2),standalone=args.includes('--standalone'),[id,name]=args.filter(a=>a!=='--standalone');
if(!id||!name)throw Error('usage: npm run new-skin -- <id> "Display name" [--standalone]');
const target=path.join(root,'skins',id);if(fs.existsSync(target))throw Error('Skin already exists');
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
// Gallery metadata stays empty until real previews and a description exist: publishing refuses it until then.
const gallery=JSON.stringify({version:'0.1.0',description:'',previews:[]},null,2)+'\n';
if(standalone){
 // A complete independent package: Holonet's code, this manifest identity.
 const source=path.join(root,'skins','holonet'),m=manifestAt(source);m.id=id;m.name=name;validateManifest(m);
 fs.mkdirSync(target);fs.cpSync(path.join(source,'src'),path.join(target,'src'),{recursive:true});write(path.join(target,'skin.json'),JSON.stringify(m,null,2)+'\n');
 write(path.join(target,'gallery.json'),gallery);
 write(path.join(target,'README.md'),`# ${name}\n\nStandalone skin started from Holonet's complete interface (Apache-2.0; see PROVENANCE.md). Describe what makes it distinct, add real previews in previews/, and record what it was checked against.\n`);
 console.log(`Created skins/${id}: a standalone package with Holonet's code. Edit src/style.css, src/template.mjs and the rendering hooks, then npm run build && npm test. Shared Holonet selectors are kept so the interaction journeys apply; shadow roots isolate each package.`);
}else{
 // An overlay skin: Comic's whole interface with this skin layer (the pinned AgentNet's kit).
 const version=pin().version,m={api:1,id,name,agentnet:version};validateManifest({...m,entry:'entry.mjs',files:['entry.mjs']});
 const kit=path.join(upstream(),'internal/ui/web/src/skin');
 for(const file of fs.readdirSync(kit))if(file!=='README.md')fs.cpSync(path.join(kit,file),path.join(target,'overlay',file),{recursive:true});
 const brandFile=path.join(target,'overlay','brand.tsx');let brand=fs.readFileSync(brandFile,'utf8');
 for(const [from,to] of [['id: "comic"','id: '+JSON.stringify(id)],['name: "Comic"','name: '+JSON.stringify(name)],['storage: "agentnet.messenger"','storage: '+JSON.stringify(id)],['themeKey: "agentnet.theme"','themeKey: '+JSON.stringify(id+'.theme')]]){if(!brand.includes(from))throw Error('The pinned kit brand.tsx changed: '+from+' not found');brand=brand.replace(from,to);}
 brand=brand.replace(/blurb: "[^"]*"/,'blurb: '+JSON.stringify(name+', a skin on AgentNet’s Comic.'));fs.writeFileSync(brandFile,brand);
 write(path.join(target,'skin.json'),JSON.stringify(m,null,2)+'\n');write(path.join(target,'gallery.json'),gallery);
 write(path.join(target,'README.md'),`# ${name}\n\nOverlay skin: AgentNet's Comic interface with its own skin layer in overlay/, built from AgentNet ${version} (Apache-2.0). The slots and what each must keep are in the pinned AgentNet's internal/ui/web/src/skin/README.md. Delete every slot you keep unchanged, so it follows Comic on each rebuild; a theme-only skin keeps just brand.tsx and theme.css. Add real previews in previews/.\n`);
 console.log(`Created skins/${id}: an overlay skin on AgentNet ${version}'s Comic kit. Edit overlay/theme.css (and any other slot), delete the slots you keep unchanged, then npm run build && npm test.`);
}
