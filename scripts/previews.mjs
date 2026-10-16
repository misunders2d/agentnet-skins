// Renders gallery previews: the real skins running on the pinned AgentNet with
// a disposable fictional company (invented people and messages, a hub and
// installations on this machine only, deleted afterwards). Each installed
// package opens through AgentNet's production loader after its trust step; the
// screenshot is the skin's own area (AgentNet's switcher bar above it is not
// part of the skin), desktop 1440x1000 and phone 390x844, light and dark.
//
//   npm run previews [-- <id>...]   writes skins/<id>/previews/{desktop,mobile}-{light,dark}.png
//
// Needs what npm test needs (Go, Python 3, OpenSSL, Chromium via Playwright or AGENTNET_CHROMIUM).
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
import {root,run,listSkins,isOverlay,manifestAt,upstream,agentnetBinary,pinnedReservedIds,buildRenamedCopy,pin} from './lib.mjs';import {browserEnvironment} from './browser.mjs';
const ids=process.argv.slice(2).filter(a=>!a.startsWith('--'));for(const id of ids)if(!listSkins().includes(id))throw Error('Unknown skin '+id);
const chosen=ids.length?ids:listSkins();
if(!process.argv.includes('--no-build'))run(process.execPath,[path.join(root,'scripts','build.mjs'),...chosen]);
const up=upstream(),bin=agentnetBinary(),go=process.env.AGENTNET_GO||'go',env=browserEnvironment(),{chromium}=createRequire(import.meta.url)(env.AGENTNET_PLAYWRIGHT);
const work=fs.mkdtempSync(path.join(os.tmpdir(),'agentnet-previews-')),world=path.join(work,'world'),packages=path.join(work,'packages');fs.chmodSync(work,0o700);fs.mkdirSync(packages,{mode:0o700});
// Packages the program would refuse under a reserved id (an AgentNet that still embeds it) open under a preview id; the code is the same.
const reserved=pinnedReservedIds(),shown=[];
for(const id of chosen){let dir=path.join(root,'dist',id),loader=id;if(!isOverlay(id)&&reserved.includes(id)){loader='preview-'+id;dir=buildRenamedCopy(id,loader,'Preview '+manifestAt(dir).name,work);}fs.cpSync(dir,path.join(packages,loader),{recursive:true});if(loader!==id)fs.rmSync(dir,{recursive:true,force:true});shown.push({id,loader,family:isOverlay(id)?'comic':id});}
const wrapper=path.join(work,'agentnet');
fs.writeFileSync(wrapper,`#!/bin/sh\nset -eu\nif [ "$1" = "--home" ] && [ "$3" = "daemon" ]; then mkdir -p "$2/skins"; cp -R "${packages}/." "$2/skins/"; chmod -R go-rwx "$2/skins"; fi\nexec "${bin}" "$@"\n`,{mode:0o700});
// Brightwater Ceramics: invented people on their own installations.
const seed=String.raw`set -eu
umask 077
W=$1; A=$2; GO=$3; UP=$4
export AGENTNET_NOTIFY=off HOME="$W/cli-home"
mkdir -p "$W/cli-home"
free_port(){ python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])'; }
backend=$(free_port); port=$(free_port)
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$W/key.pem" -out "$W/cert.pem" -days 2 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1 > "$W/cert.log" 2>&1
export SSL_CERT_FILE="$W/cert.pem"
"$GO" -C "$UP" build -o "$W/tls-proxy" internal/ui/testdata/human_navigation_tls_proxy.go
"$A" hub serve --data "$W/hub" --listen "127.0.0.1:$backend" --platform-tls --public-url "https://127.0.0.1:$port" > "$W/hub.log" 2>&1 & echo $! >> "$W/pids"
"$W/tls-proxy" "127.0.0.1:$port" "127.0.0.1:$backend" "$W/cert.pem" "$W/key.pem" > "$W/proxy.log" 2>&1 & echo $! >> "$W/pids"
for _ in $(seq 1 100); do [ -f "$W/hub/bootstrap-invite.txt" ] && break; sleep .1; done
sleep .3
"$A" --home "$W/odile" join --agent laptop "$("$A" hub bootstrap-invite --raw --data "$W/hub")" > "$W/join.log"
for who in tomasz priya kofi; do "$A" --home "$W/$who" join --agent desk "$("$A" --home "$W/odile" admin invite --raw "$who")" >> "$W/join.log"; done
for who in odile tomasz priya kofi; do "$A" --home "$W/$who" daemon --ui 127.0.0.1:0 > "$W/$who.log" 2>&1 & echo $! >> "$W/pids"; done
sleep 1
"$A" --home "$W/odile" person create "Odile Varga" > "$W/person.log"
"$A" --home "$W/tomasz" person create "Tomasz Reyes" >> "$W/person.log"
"$A" --home "$W/priya" person create "Priya Lindqvist" >> "$W/person.log"
"$A" --home "$W/kofi" person create "Kofi Brennan" >> "$W/person.log"
an(){ who=$1; shift; env -i PATH="/usr/bin:/bin" HOME="$W/cli-home" SSL_CERT_FILE="$W/cert.pem" AGENTNET_NOTIFY=off "$A" --home "$W/$who" "$@"; }
person(){ an "$1" person | head -1 | cut -d' ' -f1; }
conv(){ grep -Eo '[0-9a-f]{64}' | head -1; }
seen(){ for _ in $(seq 1 100); do an "$1" dm show "$2" > /dev/null 2>&1 && return 0; sleep .2; done; echo "$1 never received $2" >&2; return 1; }
tomasz=$(person tomasz); priya=$(person priya)
dm_t=$(an odile dm new tomasz/desk | conv)
dm_p=$(an odile dm new priya/desk | conv)
dm_k=$(an kofi dm new admin/laptop | conv)
an odile dm send "$dm_t" "Morning! The kiln is booked solid on Thursday. Could we move the glaze test to Friday at 9?" > /dev/null; seen tomasz "$dm_t"; sleep 1
an tomasz dm send "$dm_t" "Friday works. I'll bring the three celadon samples and the new speckled white." > /dev/null; sleep 1
an odile dm send "$dm_t" "Perfect. Bring the firing log too, so we can compare cone 6 and cone 7." > /dev/null; sleep 1
an tomasz dm send "$dm_t" "Will do. The speckled white came out glossier than the test tile, so I want a second opinion." > /dev/null
an odile dm send "$dm_p" "Thanks Priya, I will read the proofs tonight." > /dev/null; seen priya "$dm_p"
an priya dm send "$dm_p" "The spring catalogue proofs are ready. Page 4 still needs the price for the teapot set." > /dev/null
an kofi dm send "$dm_k" "Can we promise the Harbourside Café their 120 mugs by the 28th?" > /dev/null
group=$(an odile group create "Spring catalogue shoot" | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"]["conv"])')
join(){
	inv=$(an odile group invite "$group" "$1" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
	for _ in $(seq 1 100); do an "$2" group invitations | grep -q "$inv" && break; sleep .2; done
	an "$2" group accept "$inv" > /dev/null
	for _ in $(seq 1 150); do an odile group invitations | python3 -c 'import json,sys; sys.exit(0 if any(i["id"]=="'"$inv"'" and i["status"]=="published" for i in json.load(sys.stdin)) else 1)' && break; sleep .2; done
}
join "$tomasz" tomasz
join "$priya" priya
sleep 2
an odile dm send "$group" "The shoot is on Tuesday in the north studio. Priya: lighting. Tomasz: the pieces." > /dev/null; sleep 1
an priya dm send "$group" "I'll book the softboxes and the grey backdrop." > /dev/null; sleep 1
an tomasz dm send "$group" "Packing the mugs and the teapot set tomorrow afternoon." > /dev/null
page=$("$A" --home "$W/odile" ui | grep -Eo 'http://127\.0\.0\.1:[0-9]+/\?t=[0-9a-f]+' | head -1)
printf '{"page":"%s","dm":"%s"}\n' "$page" "$dm_t" > "$W/world.json"
`;
const views={
 classic:{async open(page){if(await page.locator('#back').isVisible())await page.locator('#back').click();await page.locator('#nav-chats').click();await page.locator('#conv-list').getByText('Tomasz Reyes',{exact:true}).first().click();await page.locator('#composer').waitFor();},
  async theme(page,theme){if(await page.locator('#back').isVisible())await page.locator('#back').click();await page.locator('#profile-btn').click();await page.locator('#settings-tab-appearance').click();await page.locator('#theme-choice [data-theme="'+theme+'"]').click();await page.locator('#settings-close').click();}},
 zoom:{async open(page){const z=page.locator('#zoom'),settled=()=>page.waitForFunction(()=>document.querySelector('#skin')?.shadowRoot?.querySelectorAll('#zoom .zoom-layer').length===1);await page.locator('#nav-chats').click();await settled();await z.locator('.ladder .rung').nth(0).click();await z.locator('.person-card').filter({hasText:'Tomasz Reyes'}).click();await z.locator('.mini-chat').waitFor();await settled();}},
 comic:{async open(page){await page.getByRole('navigation',{name:'Main'}).getByRole('button',{name:'Chats',exact:true}).click();await page.locator('[data-part=chat-row]').filter({hasText:'Tomasz Reyes'}).first().click();await page.locator('[data-part=conversation]').waitFor();},
  async theme(page,theme){const back=page.getByRole('button',{name:'Back to chats',exact:true}).first();if(page.viewportSize().width<1024){await back.waitFor({state:'visible'});await back.click();}else if(await back.isVisible())await back.click();await page.getByRole('navigation',{name:'Main'}).getByRole('button',{name:/^(Settings|You)$/}).click();await page.getByRole('button',{name:/Appearance/}).first().click();await page.getByRole('radio',{name:theme==='dark'?'Dark':'Light',exact:true}).click();}},
};
views.holonet=views.classic;views.zoom.theme=views.classic.theme;
let browser;const pids=()=>fs.existsSync(path.join(world,'pids'))?fs.readFileSync(path.join(world,'pids'),'utf8').trim().split('\n').filter(Boolean).map(Number):[];
try{
 fs.mkdirSync(world,{mode:0o700});const seedFile=path.join(work,'seed.sh');fs.writeFileSync(seedFile,seed,{mode:0o700});
 run('bash',[seedFile,world,wrapper,go,up],{stdio:['ignore','inherit','inherit']});
 const {page:entry}=JSON.parse(fs.readFileSync(path.join(world,'world.json'),'utf8')),origin=new URL(entry).origin;
 browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM});
 for(const s of shown){
  const view=views[s.family]||views.classic,context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(entry);await page.goto(origin+'/?skin='+s.loader);await page.getByRole('button',{name:'Use this skin',exact:true}).click();await page.locator('#skin').first().waitFor();
  for(const [kind,width,height] of [['desktop',1440,1000],['mobile',390,844]])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
   const top=await page.locator('#skin').first().evaluate(n=>n.getBoundingClientRect().top);await page.setViewportSize({width,height:height+Math.round(top)});
   await view.theme(page,theme);await view.open(page);await page.waitForTimeout(700);
   const box=await page.locator('#skin').first().boundingBox();if(Math.round(box.width)!==width||Math.round(box.height)!==height)throw Error(s.id+': skin area '+box.width+'x'+box.height+', expected '+width+'x'+height);
   const file=path.join(root,'skins',s.id,'previews',kind+'-'+theme+'.png');fs.mkdirSync(path.dirname(file),{recursive:true});
   await page.screenshot({path:file,clip:{x:box.x,y:box.y,width,height}});
   const size=fs.statSync(file).size;if(size>1<<20)throw Error(file+' is over 1 MiB');console.log('Wrote skins/'+s.id+'/previews/'+kind+'-'+theme+'.png ('+size+' bytes)');
  }
  if(errors.length)throw Error(s.id+': page errors while rendering previews: '+errors.join('; '));
  await context.close();
 }
 console.log('Previews rendered on AgentNet '+pin().version+' '+pin().commit.slice(0,12)+'. Inspect every image before committing.');
}finally{
 await browser?.close();for(const pid of pids())try{process.kill(pid);}catch{}
 for(const s of shown)if(s.loader!==s.id)fs.rmSync(path.join(root,'dist',s.loader),{recursive:true,force:true});
 spawnSync('sleep',['1']);fs.rmSync(work,{recursive:true,force:true});
}
