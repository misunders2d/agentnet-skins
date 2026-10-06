import fs from 'node:fs';import path from 'node:path';import {root,manifestAt,validateManifest} from './lib.mjs';
const[id,name]=process.argv.slice(2);if(!id||!name)throw Error('usage: npm run new-skin -- <id> "Display name"');
const source=path.join(root,'skins','holonet'),m=manifestAt(source);m.id=id;m.name=name;validateManifest(m);
const target=path.join(root,'skins',id);if(fs.existsSync(target))throw Error('Skin already exists');
fs.cpSync(source,target,{recursive:true});fs.writeFileSync(path.join(target,'skin.json'),JSON.stringify(m,null,2)+'\n');
console.log(`Created skins/${id}; complete isolated package. Edit src/style.css and branding in src/template.mjs, then npm run build && npm test. Shared Holonet selectors intentionally retained; shadow roots isolate each package.`);
