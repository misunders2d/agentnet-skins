import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {browserEnvironment} from '../scripts/browser.mjs';
const env=browserEnvironment(),require=createRequire(import.meta.url),{chromium}=require(env.AGENTNET_PLAYWRIGHT||'playwright');
test('standalone reminder controls reconcile delayed, failed and newer state without blocking input',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:env.AGENTNET_CHROMIUM||undefined});
 try{for(const skin of ['classic','holonet','zoom'])for(const width of [390,1440]){
  const source=fs.readFileSync(new URL('../skins/'+skin+'/src/entry.mjs',import.meta.url),'utf8');
  const dom=source.slice(source.indexOf('const present ='),source.indexOf('// Every operation keeps'));
  const reminders=source.slice(source.indexOf('const canRemind ='),source.indexOf('// remindDialog sets'));
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<main id="root"><input aria-label="Unrelated draft"><div id="line"></div><div id="outbox"></div><span id="badge"></span></main>');
  await page.addScriptTag({content:`${dom}
 const root=document.getElementById('root');let alive=true,currentHost={};const state={gen:0,dm:'chat',overview:{remind:true,reminders:[]}};
 let canonical=[],failRead=false;const calls=[];const notices=[];const firstLine=s=>s,announce=s=>notices.push(s),remindDialog=()=>{};
 const api=(path,body,host)=>new Promise((resolve,reject)=>calls.push({path,body,host,resolve,reject}));
 const scheduleUI={update(){document.getElementById('outbox').replaceChildren(...[...reminderFlights().keys()].map(reminderStatus).filter(Boolean));}};
 const updateOutboxBadge=()=>document.getElementById('badge').textContent=String(projectedReminders().filter(r=>r.overdue).length);
 const loadOverview=async()=>{if(failRead)throw Error('Read unavailable');state.overview={...state.overview,reminders:structuredClone(canonical)};paintReminderChanges();};
 ${reminders}
 const base={message:'message',conv:'chat',title:'Exact message',due:'2030-01-01T10:00:00Z',overdue:true,revision:7,writer:'writer'};
 window.fixture={notices,empty(){notices.length=0;canonical=[];state.overview.reminders=[];reminderFlights().clear();calls.length=0;paintReminderChanges();},switchWorkspace(){currentHost={};state.gen++;canonical=[];state.overview.reminders=[];paintReminderChanges();},reset(count){canonical=[structuredClone(base),...Array.from({length:count},(_,i)=>({...base,message:'other'+i,overdue:false}))];state.overview.reminders=structuredClone(canonical);reminderFlights().clear();calls.length=0;failRead=false;document.getElementById('line').replaceChildren(reminderLine({id:'message',body:'Exact message'}));paintReminderChanges();},calls,act:(path,due)=>remindAct(path,'message',due).catch(()=>{}),async finish(fail=false,read=false){failRead=read;const call=calls.at(-1);if(fail){call.reject(Error('Write refused'));return;}canonical=canonical.filter(r=>r.message!==call.body.id);if(call.body.due)canonical.unshift({...base,due:new Date(call.body.due*1000).toISOString(),overdue:false,revision:8});call.resolve({});},sync(){canonical=canonical.filter(r=>r.message!=='message');canonical.unshift({...base,due:'2031-02-03T11:00:00Z',revision:9,writer:'newer'});state.overview.reminders=structuredClone(canonical);paintReminderChanges();},readable(){failRead=false;},canonical:()=>state.overview.reminders.find(r=>r.message==='message'),rows:()=>projectedReminders()};`});
  for(const count of [100,1000]){
   await page.evaluate(n=>fixture.reset(n),count);
   const line=page.locator('#line');
   const start=Date.now();await line.getByRole('button',{name:'Done',exact:true}).click();await line.getByText('Completing reminder…',{exact:true}).waitFor({timeout:500});
   assert(Date.now()-start<500);assert.equal(await page.locator('#badge').innerText(),'0');assert.equal(await page.evaluate(()=>fixture.canonical().revision),7);
   await page.evaluate(()=>{fixture.act('/api/remind/done');fixture.act('/api/remind/done');});assert.equal(await page.evaluate(()=>fixture.calls.length),1);
   await page.getByRole('textbox',{name:'Unrelated draft'}).fill('Kept while backend waits');
   await page.evaluate(()=>fixture.finish(true));await line.getByRole('status').filter({hasText:'Write refused'}).waitFor();assert.equal(await page.locator('#badge').innerText(),'1');
   await line.getByRole('button',{name:'Retry',exact:true}).click();assert.equal(await page.evaluate(()=>fixture.calls.length),2);assert.deepEqual(await page.evaluate(()=>fixture.calls[1].body.expected),{revision:7,writer:'writer'});
   await page.evaluate(()=>fixture.finish());await line.getByRole('button',{name:'Remind me…',exact:true}).waitFor();assert.equal(await page.evaluate(()=>fixture.rows().length),count);
   await page.evaluate(n=>fixture.reset(n),count);await line.getByRole('button',{name:'Cancel',exact:true}).click();await line.getByText('Canceling reminder…',{exact:true}).waitFor({timeout:500});await page.evaluate(()=>{fixture.sync();fixture.finish(true);});await line.getByText('A newer reminder is shown.',{exact:false}).waitFor();assert.equal(await line.getByRole('button',{name:'Retry',exact:true}).count(),0);assert.equal(await page.evaluate(()=>fixture.canonical().revision),9);
   await line.getByRole('button',{name:'Dismiss error'}).click();await page.evaluate(()=>{void fixture.act('/api/remind',Date.parse('2032-01-01T10:00:00Z')/1000);});await line.getByText('Saving reminder…',{exact:true}).waitFor({timeout:500});assert.equal(await page.evaluate(()=>fixture.rows().find(r=>r.message==='message').due),'2032-01-01T10:00:00.000Z');
   await page.evaluate(()=>fixture.finish(false,true));await line.getByRole('button',{name:'Check current state'}).waitFor();const writes=await page.evaluate(()=>fixture.calls.length);await page.evaluate(()=>fixture.readable());await line.getByRole('button',{name:'Check current state'}).click();await page.waitForFunction(()=>!document.querySelector('#line [role=status]'));assert.equal(await page.evaluate(()=>fixture.calls.length),writes,'confirmation retry must be read-only');
   assert.equal(await page.getByRole('textbox',{name:'Unrelated draft'}).inputValue(),'Kept while backend waits');
  }
  await page.evaluate(()=>{fixture.empty();void fixture.act('/api/remind',Date.parse('2032-01-01T10:00:00Z')/1000);});
  await page.locator('#line').getByText('Saving reminder…',{exact:true}).waitFor({timeout:500});
  assert.deepEqual(await page.evaluate(()=>fixture.calls[0].body.expected),{revision:0});
  await page.evaluate(()=>fixture.finish());await page.locator('#line').getByRole('button',{name:'Done',exact:true}).waitFor();
  await page.locator('#line').getByRole('button',{name:'Done',exact:true}).click();
  await page.evaluate(()=>{fixture.switchWorkspace();fixture.finish(true);});
  await page.waitForFunction(()=>document.querySelector('#line').textContent==='Remind me…');
  assert.deepEqual(await page.evaluate(()=>fixture.notices),[],'old workspace failure leaked into current workspace');
  assert.deepEqual(errors,[]);console.log(skin+' '+width+': delayed/duplicate/create/done/cancel/move/failure/retry/newer/read-only confirmation/workspace fence, 100 and 1000 reminders');await page.close();
 }}finally{await browser.close();}
});
