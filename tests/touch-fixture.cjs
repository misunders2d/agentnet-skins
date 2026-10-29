// Only the bounded ASCII records of the disposable Zoom touch fixture.
const assert=require('node:assert/strict');
const messageID=/^[0-9a-f]{32}$/,conversationID=/^[0-9a-f]{64}$/;
function dmRecords(stdout,queriedConv,expectedConv,from,extraBodies=[]){
 assert.match(queriedConv,conversationID);assert.equal(queriedConv,expectedConv,'Wrong original DM command target');
 assert.equal(typeof stdout,'string');assert(stdout.length<=1024*1024,'DM output exceeds fixture bound');
 const lines=stdout.split('\n'),records=[],bodies=new Set(),ids=new Set(),lids=new Set(),extra=new Set(extraBodies);
 for(let i=0;i<lines.length;i++){
  const candidate=lines[i].trim();if(!/^Long history \d{3}$/.test(candidate)&&!extra.has(candidate))continue;
  assert.equal(lines[i],'  '+candidate,'Malformed fixture body indentation or whitespace');const body=lines[i].slice(2);
  assert(/^[\x20-\x7e]+$/.test(body),'Non-ASCII fixture body');
  const h=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}  (in|out) ([\x20-\x7e]+?) message \(([^()\r\n]+)\)  ([0-9a-f]{32}) lid ([0-9a-f]{32})$/.exec(lines[i-1]||'');
  assert(h,'Malformed fixture DM header');assert.equal(h[1],'out');assert(h[2]===from||h[2]===from+' [ui]','Wrong fixture author');
  const state=h[3],parts=state.split('; ');assert(/^(queued|custody|delivered|waiting|failed|not_delivered|expired|quarantined)$/.test(parts[0]),'Malformed fixture state');
  for(const copy of parts.slice(1))assert(/^[a-z0-9_-]+\/[a-z0-9_-]+: (queued|custody|delivered|waiting|failed|not_delivered|expired|quarantined)$/.test(copy),'Malformed fixture copy state');
  assert(!bodies.has(body),'Duplicate fixture body');assert(!ids.has(h[4]),'Duplicate fixture ID');assert(!lids.has(h[5]),'Duplicate fixture LID');
  bodies.add(body);ids.add(h[4]);lids.add(h[5]);records.push({id:h[4],lid:h[5],body,state,queued:/\bqueued\b/.test(state)});
 }
 return records;
}
function historyPrefix(records,prefix){
 const rows=records.filter(m=>m.body.startsWith(prefix)&&/^\d{3}$/.test(m.body.slice(prefix.length))).sort((a,b)=>a.body.localeCompare(b.body));
 assert(rows.length<=200,'Too many history records');
 for(let i=0;i<rows.length;i++)assert.equal(rows[i].body,prefix+String(i+1).padStart(3,'0'),'History has a gap or duplicate');
 return rows;
}
function threadRecords(stdout,root,peer,from){
 assert.match(root,messageID);assert.equal(typeof stdout,'string');assert(stdout.length<=1024*1024,'Thread output exceeds fixture bound');
 const view=JSON.parse(stdout);assert.equal(view.peer,peer,'Wrong device peer');assert.equal(view.offset,0);assert(Array.isArray(view.messages));assert.equal(view.total,view.messages.length,'Incomplete device membership');
 assert(view.messages.length<=1000,'Device membership exceeds fixture bound');
 const ids=new Set();for(const m of view.messages){assert.match(m.id,messageID);assert(!ids.has(m.id),'Duplicate device ID');ids.add(m.id);assert.equal(m.dir,'out');assert.equal(m.from,from);assert.equal(m.to,peer);assert.equal(m.kind,'message');assert.equal(typeof m.body,'string');}
 const rows=historyPrefix(view.messages,'Device history ');assert(rows.length>0,'Missing device root');assert.equal(rows[0].id,root,'Wrong exact device root');assert(!rows[0].reply_to,'Device root is not a root');
 for(let i=1;i<rows.length;i++)assert.equal(rows[i].reply_to,rows[i-1].id,'Device history is not one exact predecessor chain');
 return view.messages;
}
function renderedIDMatches(rendered,stored){assert.match(rendered,messageID);assert.match(stored,messageID);return rendered===stored;}
// Only exact, empty-output busy failures of the bound pure reads may repeat.
function publicCLI({binary,home,cwd,env,conv,thread=()=>null,spawnSync=require('node:child_process').spawnSync,now=Date.now,onRetry=({operation,attempt})=>console.log('Zoom fixture busy read retry '+operation+' '+attempt+'/2')}){
 return (args,deadline)=>{
  const command=Object.freeze([...args]),expires=deadline===undefined?now()+15000:deadline;
  const operation=command.length===3&&command[0]==='dm'&&command[1]==='show'&&command[2]===conv&&conversationID.test(conv)?'dm show':command.length===5&&command[0]==='conversation'&&command[1]==='--json'&&command[2]==='--limit'&&command[3]==='0'&&command[4]===thread()&&messageID.test(command[4])?'conversation':'';
  for(let attempt=1;attempt<=3;attempt++){
   const remaining=expires-now();assert(remaining>0,'Public fixture deadline expired');
   if(operation==='conversation')assert.equal(command[4],thread(),'Changed fixture thread');
   const r=spawnSync(binary,['--home',home,...command],{env,cwd,encoding:'utf8',timeout:remaining,maxBuffer:1024*1024});
   assert.equal(r.error,undefined);assert.equal(r.signal,null);
   if(operation&&r.status===1&&r.stdout===''&&/^agentnet: database is locked \(5\) \(SQLITE_BUSY\)\n?$/.test(r.stderr)&&attempt<3&&now()<expires){onRetry({operation,attempt});continue;}
   assert.equal(r.status,0,r.stderr);return r.stdout;
  }
 };
}
// device: also a 200-message device conversation. Old device conversations
// are read only since AgentNet v0.10.0 (MEL-713), so the touch journey seeds
// the DM alone; the device phase stays for its unit tests until AgentNet
// drops version 1.
function seedPublicHistory({world,binary,conv,to,from,spawnSync,device=false}){
 const fs=require('node:fs'),path=require('node:path');assert(binary,'Missing public fixture CLI');assert.match(conv,conversationID);
 const env={PATH:path.join(world,'bin')+':/usr/bin:/bin',HOME:path.join(world,'cli-home'),SSL_CERT_FILE:path.join(world,'cert.pem'),AGENTNET_NOTIFY:'off'};
 let meta;const native=publicCLI({binary,home:path.join(world,'sergey'),env,cwd:path.join(world,'work'),conv,thread:()=>meta.thread,spawnSync});
 const dm=(extra=[],deadline)=>dmRecords(native(['dm','show',conv],deadline),conv,conv,from,extra);
 const metaPath=path.join(world,'zoom-touch-history.json');
 if(fs.existsSync(metaPath)){meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));assert.equal(meta.conv,conv);assert.equal(meta.to,to);assert.equal(meta.from,from);assert.match(meta.thread,messageID,'Interrupted seed requires a fresh disposable world');}
 else{meta={conv,to,from,thread:null};fs.writeFileSync(metaPath,JSON.stringify(meta),{flag:'wx',mode:0o600});}
 const pad=i=>String(i).padStart(3,'0');
 let rows=historyPrefix(dm(),'Long history ');
 for(let i=rows.length+1;i<=200;i++)native(['dm','send',conv,'Long history '+pad(i)]);
 // Settle the DM phase before the first legacy write, within one 15s budget.
 const dmSettledBy=Date.now()+15000;
 for(const m of dm([],dmSettledBy)){
  if(!m.queued)continue;
  const remaining=dmSettledBy-Date.now();assert(remaining>0,'DM fixture delivery did not settle in 15s');
  const status=native(['status','--wait',remaining+'ms',m.lid],dmSettledBy);assert(status.trim(),'Missing public status');assert(!/\bqueued\b|local record/i.test(status),'Fixture delivery is still local or queued');
 }
 if(!device){const settledDM=dm([],Date.now()+60000);assert.equal(historyPrefix(settledDM,'Long history ').length,200);assert(!settledDM.some(m=>m.queued),'DM fixture delivery is still queued');return {dm};}
 if(!meta.thread){const sent=native(['send','--wait','5s',to,'Device history 001']),id=/^([0-9a-f]{32}) [a-z_]+(?: [^\r\n]*)?\n?$/.exec(sent);assert(id,'Malformed public send ID');meta.thread=id[1];fs.writeFileSync(metaPath,JSON.stringify(meta),{mode:0o600});}
 const thread=(deadline)=>threadRecords(native(['conversation','--json','--limit','0',meta.thread],deadline),meta.thread,to,from);
 rows=historyPrefix(thread(),'Device history ');let last=rows.at(-1).id;
 for(let i=rows.length+1;i<=200;i++){const sent=native(['send','--wait','5s','--reply-to',last,to,'Device history '+pad(i)]),id=/^([0-9a-f]{32}) [a-z_]+(?: [^\r\n]*)?\n?$/.exec(sent);assert(id,'Malformed public send ID');last=id[1];}
 // One shared original settlement budget; public status waits, never polling.
 const settledBy=Date.now()+60000,dmSeed=dm([],settledBy),deviceSeed=thread(settledBy);
 for(const id of [...dmSeed.filter(m=>m.queued).map(m=>m.lid),...deviceSeed.filter(m=>m.state==='queued').map(m=>m.id)]){
  const remaining=settledBy-Date.now();assert(remaining>0,'Fixture delivery did not settle in 60s');
  const status=native(['status','--wait',remaining+'ms',id],settledBy);assert(status.trim(),'Missing public status');assert(!/\bqueued\b|local record/i.test(status),'Fixture delivery is still local or queued');
 }
 const settledDM=dm([],settledBy),settledThread=thread(settledBy);assert.equal(historyPrefix(settledDM,'Long history ').length,200);assert.equal(historyPrefix(settledThread,'Device history ').length,200);assert(!settledDM.some(m=>m.queued)&&!settledThread.some(m=>m.state==='queued'),'Fixture delivery has not settled');
 return {thread:meta.thread,dm,device:thread};
}
module.exports={dmRecords,historyPrefix,threadRecords,renderedIDMatches,seedPublicHistory,publicCLI};
