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
