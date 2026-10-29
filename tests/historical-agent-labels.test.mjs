import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const collection=process.env.AGENTNET_COLLECTION_CANDIDATE||path.resolve(import.meta.dirname,'..');
const sourceRoot=process.env.AGENTNET_LABEL_SOURCE;
const source=skin=>fs.readFileSync(sourceRoot?path.join(sourceRoot,skin,'entry.mjs'):path.join(collection,'skins',skin,'src','entry.mjs'),'utf8');
const host='atlas/host',key='11111111-11111111-11111111-11111111',pi='a'.repeat(32),claude='b'.repeat(32),conv='c'.repeat(64);
const descendants=n=>n&&typeof n==='object'?[n,...(n.children||[]).flatMap(descendants)]:[];
const words=n=>n&&typeof n==='object'?n.textContent:String(n??'');
function element(tag,attrs={},...children){
 const n={tag,attrs:attrs||{},children:children.flat(Infinity).filter(v=>v!==false&&v!=null),dataset:{},listeners:{},value:attrs?.value||'',disabled:false,
  setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.listeners[k]=f;},focus(){},get textContent(){return this._text??this.children.map(words).join('');},set textContent(v){this._text=String(v);}};
 return n;
}
const block=(source,name)=>source.match(new RegExp('^function '+name+'\\([^]*?^}', 'm'))?.[0]||'';
for(const skin of ['classic','holonet','zoom'])test(skin+': exact historical targets distinguish same-group Review, focused reason and detached reply',async()=>{
 const code=source(skin),controls=new Map(),calls=[],landings=[];
 const target=id=>({address:host,fingerprint:key,agent_id:id});
 const records=[{id:pi,host,host_key:key,label:'Pi',harness:'claude'},{id:claude,host,host_key:key,label:'Claude',harness:'pi'}];
 const state={overview:{me:{address:'atlas/laptop',responder:'codex'},person:{person:'atlas'},dms:[{id:conv,title:'One shared group'}],needs_you:[{conv,id:'1'.repeat(32),target:target(pi),reason:'agent_needs_human',why:'Pi exact reason'},{conv,id:'2'.repeat(32),target:target(claude),reason:'agent_needs_human',why:'Claude exact reason'}],threads:[],links:[],held:[]}};
 const context=vm.createContext({state,Date,Map,Set,console,structuredClone,el:element,catalogRecords:h=>h===host?records:[],deviceWords:h=>h,
  $:id=>{if(!controls.has(id))controls.set(id,Object.assign(element('div'),{close(){}}));return controls.get(id);},alive:true,fill:(n,...children)=>{n.children=children.flat(Infinity).filter(v=>v!==false&&v!=null);delete n._text;return n;},
  unreadUI:{update(){}},wsNow:()=> 'default',plural:(n,s,p)=>n+' '+(n===1?s:p),contactsOf:()=>[],linkNotices:()=>[],
  guestInvitationRow:()=>assert.fail('unrelated invitation'),toggleReview(){},openMessage:r=>landings.push(structuredClone(r)),currentHost:{id:'captured-host'},sendID:()=> 'e'.repeat(32),
  api:async(p,body,captured)=>{calls.push({p,body:structuredClone(body),captured});return {};},act:async(body,captured)=>{calls.push({p:'/api/act',body:structuredClone(body),captured});return {};},announce(){},refetch:async()=>{},
 });
 const author=code.match(/^const namedAuthor = [^]*?^};/m)?.[0];assert(author,'actual historical author-name formatter');
 // A detached answer opens the shared retained-answer dialog (MEL-710).
 const intents=code.match(/^const answerIntents = [^\n]*/m)?.[0]||'';
 vm.runInContext([author,intents,...['historicalTargetLabel','agentNeedsYouHeading','agentDetailFor','agentNeedsYouTurn','renderReview','answerScope','answerIntent','paintAnswers','answerDialog','decide'].map(name=>block(code,name))].join('\n'),context);
 context.renderReview([]);
 const review=controls.get('review-list'),rows=review.children;
 assert.equal(rows.length,2);assert.match(words(rows[0]),/^Pi on atlas\/host couldn’t finish/);assert.match(words(rows[1]),/^Claude on atlas\/host couldn’t finish/);
 assert(words(rows[0]).includes('One shared group')&&words(rows[1]).includes('One shared group'),'distinction does not depend on a different chat title');
 for(const row of rows)descendants(row).find(n=>n.tag==='button').attrs.onclick();
 assert.deepEqual(landings,[{id:'1'.repeat(32),conv},{id:'2'.repeat(32),conv}],'Review links keep each exact original request');
 const m={id:'1'.repeat(32),target:target(pi),kind:'question',state:'needs_human',job_detail:'Complete exact reason\nSecond paragraph',actions:[],continuation:{host,id:'3'.repeat(32),key,attempt:7}};
 const before=JSON.stringify(m),region=context.agentNeedsYouTurn(m,{id:conv},m.job_detail);
 assert.equal(region.attrs['aria-label'],'Pi on '+host+' says');assert.match(words(region),/^Pi on atlas\/host couldn’t finish/);assert(words(region).includes('Second paragraph'));
 assert(!words(region).includes('Claude'),'today’s changed program never relabels the original target');
 assert.equal(context.historicalTargetLabel({address:host,fingerprint:key}),'Earlier default · identity unknown on '+host);
 assert.equal(context.historicalTargetLabel(undefined),'Earlier default · identity unknown');
 assert.equal(context.historicalTargetLabel(target('9'.repeat(32))),'Agent 99999999 on '+host);
 records[0].host_key='replacement-key';records[0].label='Current default';
 assert.equal(context.historicalTargetLabel(target(pi)),'Agent aaaaaaaa on '+host,'replacement key cannot lend its name to a historical request');
 records[0].host_key=key;records[0].label='Pi';records[0].host='wrong/host';
 assert.equal(context.historicalTargetLabel(target(pi)),'Agent aaaaaaaa on '+host,'host identity is checked independently of its key');records[0].host=host;
 assert.equal(JSON.stringify(m),before,'rendering changes no original target or continuation');
 if(skin!=='holonet'){
  let dialog;context.dialog=options=>{dialog=options;};context.decide('continue',m,{id:conv});
  assert.equal(dialog.title,'Answer Pi on '+host);assert.equal(calls.length,0,'opening the detached answer does not send');
  const input=descendants({children:dialog.body}).find(n=>n.tag==='textarea');input.value='Exact original answer';await dialog.run();
  assert.equal(calls.length,1);assert.equal(calls[0].p,'/api/operator/decide');
  assert.deepEqual(calls[0].body,{host,id:m.continuation.id,key,action:'continue',expect:'needs_human',attempt:7,text:'Exact original answer',send_id:'e'.repeat(32),report:''},'existing continuation wire tuple is untouched');
 }
});
