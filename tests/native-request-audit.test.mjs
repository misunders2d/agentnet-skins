import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createNativeAudit}=createRequire(import.meta.url)('./native-requests.cjs');
const incoming='1'.repeat(32),outgoing='2'.repeat(32),unseen='3'.repeat(32);
const view={messages:[{id:incoming,dir:'in',unread:true},{id:outgoing,dir:'out'},{id:unseen,dir:'in',unread:false}]};
const decision=()=>({host:'owner/native-host',id:'a'.repeat(32),key:'fixture-request-key',attempt:1,action:'continue',expect:'running',text:'agentnet-native-response-v1\n'+JSON.stringify({token:'b'.repeat(32),choice:'allow'}),report:'c'.repeat(32),send_id:'4'.repeat(32)});

test('real-view read is retained, validated and completed without a native decision',()=>{
 const audit=createNativeAudit();audit.observeThread(view);
 const read={do:'read',ids:[incoming,outgoing]},classified=audit.record('/api/act',read);
 assert.deepEqual(audit.events,[{path:'/api/act',body:read}]);assert.equal(audit.calls.length,0);
 assert.throws(()=>audit.verify(),'Pending transport cannot pass');
 audit.completeRead(classified.entry,200);audit.verify();assert.equal(audit.calls.length,0);
});

test('unexpected action, shape, hidden ID, duplicate, omitted ID and reordered read fail and remain audited',()=>{
 for(const [path,body] of [
  ['/api/act',{do:'resolve',id:incoming}],['/api/act',{do:'read',ids:[incoming,outgoing],extra:true}],
  ['/api/act',{do:'read',ids:[incoming,unseen]}],['/api/act',{do:'read',ids:[incoming,incoming]}],
  ['/api/act',{do:'read',ids:[incoming]}],['/api/act',{do:'read',ids:[outgoing,incoming]}],
  ['/api/act',{do:'read',ids:[]}],['/api/operator/decide',{do:'read',ids:[incoming,outgoing]}]
 ]) {
  const audit=createNativeAudit();audit.observeThread(view);
  assert.throws(()=>audit.record(path,body));assert.deepEqual(audit.events,[{path,body}]);
  assert.equal(audit.calls.length,0);assert.throws(()=>audit.verify());
 }
});

test('failed real-provider read and replay cannot pass',()=>{
 const audit=createNativeAudit();audit.observeThread(view);
 const read={do:'read',ids:[incoming,outgoing]},classified=audit.record('/api/act',read);
 assert.throws(()=>audit.completeRead(classified.entry,409));assert.throws(()=>audit.verify());
 assert.throws(()=>audit.record('/api/act',read));assert.equal(audit.events.length,2);
});

test('an extra native decision still violates the original exact decision count',()=>{
 const audit=createNativeAudit(),before=audit.calls.length;
 audit.record('/api/operator/decide',decision());assert.equal(audit.calls.length,before+1);
 audit.record('/api/operator/decide',decision());audit.verify();
 assert.throws(()=>assert.equal(audit.calls.length,before+1));assert.equal(audit.events.length,2);
});

test('a malformed native decision is rejected and retained',()=>{
 const audit=createNativeAudit(),body={...decision(),expect:'done'};
 assert.throws(()=>audit.record('/api/operator/decide',body));
 assert.deepEqual(audit.events,[{path:'/api/operator/decide',body}]);assert.throws(()=>audit.verify());
});
