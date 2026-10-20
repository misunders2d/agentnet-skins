// Pure routing predicates. The captured host remains the authority.
const id=/^[a-f0-9]{32}$/,key=/^[a-f0-9]{8}(?:-[a-f0-9]{8}){3}$/;
function followupRef(m,me){
 if(!m||m._local||m.deleted||m.dir!=='out'||!['question','task'].includes(m.kind)||m.origin?.startsWith('agent:')||m.verified_agent)return null;
 const fingerprint=m.send_group_author||m.claimed_key||(m.from===me?.address?me.fingerprint:'');
 const ref={id:m.lid||m.id,fingerprint};
 return id.test(ref.id)&&key.test(fingerprint||'')?ref:null;
}
export function composerFollowup(m,pid,topic,dm,me){
 const ref=followupRef(m,me),attempt=m?.exec?.attempt;
 if(!ref||!dm||dm.frozen||m.exec?.state!=='running'||m.exec.stale||!Number.isSafeInteger(attempt)||attempt<1)return null;
 const agent=(dm.agents||[]).find(a=>a.pid===pid||(a.pids||[]).includes(pid));
 if(!agent?.can_ask||agent.state!=='active'||agent.topic!=null&&agent.topic!==topic||m.pid!==pid||(m.topic||'')!==topic||m.exec.host!==agent.host?.address||m.target?.address!==agent.host?.address||m.target?.fingerprint!==agent.host?.fingerprint||(m.target?.agent_id||'')!==(agent.agent_id||''))return null;
 return {ref,kind:m.kind,source:m.id,pid,topic,attempt,target:{address:m.target.address,fingerprint:m.target.fingerprint,agent_id:m.target.agent_id||''}};
}
export function activeComposerFollowups(dm,me,topic){
 const rows=new Map(),seen=new Set();
 for(const m of dm?.messages||[]){const current=composerFollowup(m,m.pid,topic,dm,me);if(!current)continue;const key=m.pid+JSON.stringify(current.ref);if(seen.has(key))continue;seen.add(key);if(!rows.has(m.pid))rows.set(m.pid,[]);rows.get(m.pid).push(m);}
 return rows;
}
export function sameFollowup(a,b){return !!a&&!!b&&a.kind===b.kind&&a.pid===b.pid&&a.topic===b.topic&&a.attempt===b.attempt&&a.ref.id===b.ref.id&&a.ref.fingerprint===b.ref.fingerprint&&a.target.address===b.target.address&&a.target.fingerprint===b.target.fingerprint&&a.target.agent_id===b.target.agent_id;}
export function composerReplyFollowup(dm,pid,topic,me,replyTo){
 const messages=dm?.messages||[],seen=new Set();let next=replyTo;
 while(next&&!seen.has(next)){
  seen.add(next);const exact=messages.filter(m=>m.id===next),rows=exact.length?exact:messages.filter(m=>m.lid===next);
  if(!rows.length||rows.some(m=>(m.topic||'')!==topic))return;
  const current=rows.map(m=>composerFollowup(m,pid,topic,dm,me));
  if(current.every(Boolean)&&current.every(m=>sameFollowup(m,current[0])))return current[0];
  const parents=new Set(rows.map(m=>m.reply_to||''));if(parents.size!==1)return;next=rows[0].reply_to;
 }
}
export function currentComposerFollowup(dm,pid,topic,me,replyTo){
 const reported=(dm?.messages||[]).filter(m=>m.pid===pid&&(m.topic||'')===topic&&m.exec?.state==='running'&&followupRef({...m,deleted:false},me)),attempts=new Map();
 for(const m of reported){const current=composerFollowup(m,pid,topic,dm,me),key=current&&JSON.stringify(current.ref);if(!current||attempts.has(key)&&attempts.get(key)!==current.attempt)throw Error('Running work is reported, but its current attempt or identity cannot be verified. Nothing was sent; your draft is kept.');attempts.set(key,current.attempt);}
 const rows=activeComposerFollowups(dm,me,topic).get(pid)||[];
 if(!rows.length)return;if(rows.length===1)return composerFollowup(rows[0],pid,topic,dm,me);
 const bound=composerReplyFollowup(dm,pid,topic,me,replyTo);if(bound)return bound;
 throw Error('This agent has '+rows.length+' distinct running requests in this chat/topic, and this message has no exact reply binding. Nothing was sent; your draft is kept.');
}

// Direct topics bind immutable request IDs and the current host pin. Resolve
// only at send time; a last-message/newest-running guess never chooses work.
export function currentDirectComposerFollowup(thread,selected,me,replyTo){
 if(!thread)return;
 const binding=directBinding(thread),host=binding.host,pin=directAgentKey(thread),rows=new Map();
 for(const m of thread.messages||[]){
  if(m.exec?.state!=='running'||m.dir!=='out'||!['question','task'].includes(m.kind)||m._local||m.author?.agent||m.verified_agent||m.origin?.startsWith('agent:'))continue;
  if((m.target?.agent_id||'')!==selected)continue;
  const fingerprint=m.from_key||(m.from===me?.address?me.fingerprint:'');
  if(!id.test(m.id)||!key.test(fingerprint||''))continue;
  const attempt=m.exec.attempt;
  if(m.deleted||pin.pending||!pin.pinned||m.to!==host||m.exec.host!==host||m.exec.stale||!Number.isSafeInteger(attempt)||attempt<1||(m.target?.agent_id||'')!==selected||m.target&&(m.target.address!==host||m.target.fingerprint!==pin.pinned))throw new ComposerRecovery(m.id,host,attempt);
  const bound={ref:{id:m.id,fingerprint},kind:m.kind,source:m.id,pid:'',topic:thread.id,attempt,target:{address:host,fingerprint:pin.pinned,agent_id:selected}};
  if(rows.has(m.id)&&!sameFollowup(rows.get(m.id),bound))throw new ComposerRecovery(m.id,host,attempt);
  rows.set(m.id,bound);
 }
 if(rows.size<2)return rows.values().next().value;
 const seen=new Set();
 for(let next=replyTo;next&&!seen.has(next);){seen.add(next);if(rows.has(next))return rows.get(next);next=thread.messages?.find(m=>m.id===next)?.reply_to;}
 throw Error('This agent has multiple running requests in this topic, and this message has no exact reply binding. Nothing was sent; your draft is kept.');
}

// Concrete recipients come only from the verified catalog. A default setting
// never creates another recipient or changes an original conversation binding.
export function concreteAgentLabel(record,records=[]) {
 const harness=({pi:'Pi',claude:'Claude',codex:'Codex',omp:'OMP',agy:'Antigravity'})[record.harness]||record.harness||'';
 const label=harness?(record.label||harness).toLowerCase()===harness.toLowerCase()?harness:record.label+' · '+harness:(record.label||'Agent')+' · program unavailable';
 const twins=records.filter(a=>a.label===record.label&&a.harness===record.harness);
 return twins.length>1?label+' · '+record.id.slice(0,8):label;
}
export function directBinding(view) {
 const topic=view?.topic||view||{},declared=Object.prototype.hasOwnProperty.call(topic,'agent_host');
 const first=!declared&&(view?.messages||[]).find(m=>m.target?.agent_id);
 const id=topic.agent_id||first?.target?.agent_id||'';
 const legacy=!!topic.agent_legacy;
 return {agent:!!id||legacy,id,legacy,host:(id||legacy)&&topic.agent_host||first?.target?.address||view?.peer||topic.peer||'',key:topic.agent_key||first?.target?.fingerprint||view?.key?.pinned||''};
}
export function directChatKey(view) {
 const b=directBinding(view);return JSON.stringify(b.agent?[b.host,b.key,b.id]:[view?.peer||'', '', 'human']);
}
export function sameDirectAgent(a,b) { return directChatKey(a)===directChatKey(b); }

export class ComposerRecovery extends Error {
 constructor(request,host,attempt){super('Request '+request+' on '+host+(attempt?' (attempt '+attempt+')':'')+' still reports running, but its current attempt or identity cannot be verified. Refresh work status; your text and files are kept.');this.name='ComposerRecovery';}
}

// Only list queries carry the exact execution binding; topic mutations keep their documented shape.
export function directTopicQuery(view,options={}) {const b=directBinding(view);return new URLSearchParams({peer:view.peer,...(b.agent?{agent_host:b.host,agent_key:b.key,agent_id:b.id}:{}),...options});}

export function directAgentKey(thread) {return directBinding(thread).host!==thread?.peer?thread?.agent_host_key||{}:thread?.key||{};}
