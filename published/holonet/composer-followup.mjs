// Pure presentation predicates. The captured host remains the authority.
const id=/^[a-f0-9]{32}$/,key=/^[a-f0-9]{8}(?:-[a-f0-9]{8}){3}$/;
const active=new Set(['running','queued','part_waiting','pending','accepted']);
export function composerFollowup(m,pid,topic,dm,me){
 if(!m||!dm||dm.frozen||m._local||m.deleted||m.dir!=='out'||!['question','task'].includes(m.kind)||m.origin?.startsWith('agent:')||m.verified_agent||m.exec?.stale||!active.has(m.exec?.state))return null;
 const agent=(dm.agents||[]).find(a=>a.pid===pid||(a.pids||[]).includes(pid));
 const fingerprint=m.send_group_author||m.claimed_key||(m.from===me?.address?me.fingerprint:'');
 const ref={id:m.lid||m.id,fingerprint};
 if(!id.test(ref.id)||!key.test(fingerprint||'')||!agent?.can_ask||agent.state!=='active'||m.pid!==pid||(m.topic||'')!==topic||m.target?.address!==agent.host?.address||m.target?.fingerprint!==agent.host?.fingerprint||(m.target?.agent_id||'')!==(agent.agent_id||''))return null;
 return {ref,kind:m.kind,source:m.id,pid,topic,target:{address:m.target.address,fingerprint:m.target.fingerprint,agent_id:m.target.agent_id||''}};
}
export function activeComposerFollowups(dm,me,topic){
 const rows=new Map();
 for(const m of dm?.messages||[]){if(!composerFollowup(m,m.pid,topic,dm,me))continue;if(!rows.has(m.pid))rows.set(m.pid,[]);rows.get(m.pid).push(m);}
 return rows;
}
export function sameFollowup(a,b){return !!a&&!!b&&a.source===b.source&&a.kind===b.kind&&a.pid===b.pid&&a.topic===b.topic&&a.ref.id===b.ref.id&&a.ref.fingerprint===b.ref.fingerprint&&a.target.address===b.target.address&&a.target.fingerprint===b.target.fingerprint&&a.target.agent_id===b.target.agent_id;}
