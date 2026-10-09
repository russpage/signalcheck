// Run with npm run test:browser after installing Chromium. No public site used.
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { buildActionPlan, recordAction, verifyAction } from '../lib/action-plan.mjs';
import { spawn } from 'node:child_process';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'website-qa-browser-'));
let receivedLeads = 0;
const embedded = http.createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end('<form id="external"><label for="name">Name</label><input id="name" required></form>');
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await listen(embedded);
const embedUrl = `http://127.0.0.1:${embedded.address().port}`;
let repaired = false;
const server = http.createServer((request, response) => {
  if (request.url.startsWith('/g/collect')) { response.writeHead(204); response.end(); return; }
  if (request.url.startsWith('/api/leads')) { receivedLeads++; response.writeHead(200); response.end('accepted'); return; }
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><html><head><title>private-person private@example.com private-secret</title></head><body>
    <button id="spa" type="button">Open details</button><p id="details" hidden>Details</p>
    <iframe id="embed" title="External form" src="${embedUrl}"></iframe>
    <form id="validating" action="/api/leads" method="POST"><label for="email">Email</label><input id="email" type="email" required><button type="submit">Send</button></form>
    <form id="bypassed" novalidate><input type="email" required><button type="submit">Bypass native</button></form>
    <form id="button-bypassed"><input type="email" required><button type="submit" formnovalidate>Bypass button</button></form>
    <form id="broken" action="/api/leads" method="POST" ${repaired ? '' : 'novalidate'}><input id="broken-email" type="email" required><button type="submit">Send broken</button></form>
    <script>
      function emit(event){return fetch('/g/collect?v=2&tid=G-FIXTURE&en='+event+'&cid=private-client');}
      emit('page_view');
      document.querySelector('#spa').onclick=()=>{history.pushState({},'', '/details');document.querySelector('#details').hidden=false;emit('page_view');};
      document.querySelector('#bypassed').onsubmit=e=>e.preventDefault();
      document.querySelector('#button-bypassed').onsubmit=e=>e.preventDefault();
      document.querySelector('#broken').onsubmit=e=>{e.preventDefault();emit('generate_lead');fetch('/api/leads',{method:'POST',body:'private@example.com'}).catch(()=>{});};
      setTimeout(()=>{throw new ReferenceError('private-person is not defined')},100);
    </script></body></html>`);
});
await listen(server);
const url = `http://127.0.0.1:${server.address().port}/?email=private@example.com&token=private-secret&phone=8015551234`;
const event = {vendor:'ga4',destinationId:'G-FIXTURE',eventName:'generate_lead',count:0};
const config = {
  pages: [{url, label:'private-person private@example.com private-secret', expectedForms:[{selector:'#validating',requiredFields:['#email'],requireLabels:true},{selector:'#external',frameSelector:'#embed',requireLabels:true}], assertions:[{selector:'#spa',visible:true,enabled:true,accessibleName:'Open details'}], expectedEvents:[event,{vendor:'ga4',destinationId:'G-FIXTURE',eventName:'page_view',count:2}], steps:[{id:'details',type:'click',selector:'#spa',nonDestructive:true,settleMs:500,expectedEvents:[{vendor:'ga4',destinationId:'G-FIXTURE',eventName:'page_view',count:1}]}]}],
  devices:['desktop'],consentStates:['unset'],settleMs:500,networkIdleTimeoutMs:500,screenshotDevices:[],collectorHosts:{'127.0.0.1':'ga4'},
  journeys:[{id:'bypass-invalid',kind:'invalid-validation',url,enabled:true,formSelector:'#bypassed',fields:[],expectedEvents:[event],settleMs:500},{id:'button-bypass-invalid',kind:'invalid-validation',url,enabled:true,formSelector:'#button-bypassed',fields:[],expectedEvents:[event],settleMs:500},{id:'native-invalid',kind:'invalid-validation',url,enabled:true,formSelector:'#validating',fields:[{selector:'#email',value:''}],expectedEvents:[event],settleMs:500},{id:'broken-invalid',kind:'invalid-validation',url,enabled:true,formSelector:'#broken',fields:[{selector:'#broken-email',value:''}],expectedEvents:[event],settleMs:500}]
};
try {
  await fs.writeFile(path.join(directory,'config.json'),JSON.stringify(config));
  const processResult = await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['bin/run.mjs','--config',path.join(directory,'config.json'),'--output',path.join(directory,'run'),'--allow-invalid'],{cwd:path.resolve(import.meta.dirname,'..'),stdio:['ignore','pipe','pipe']});
    let output=''; child.stdout.on('data',chunk=>output+=chunk); child.stderr.on('data',chunk=>output+=chunk);
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Fixture browser run exceeded 90 seconds'));},90000);
    child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);resolve({code,output});});
  });
  const report=JSON.parse(await fs.readFile(path.join(directory,'run/report.json'),'utf8'));
  assert.notEqual(report.status,'failed',processResult.output);
  assert.equal(report.executionComplete,true);
  assert.equal(report.visits.length,5);
  assert.equal(receivedLeads,0,'No invalid form write should reach the fixture backend');
  const page=report.visits.find(v=>v.type==='page');
  assert.equal(page.assertions.filter(a=>a.status==='verified').length,3);
  assert.ok(page.forms.some(f=>f.id==='external' && f.frameIndex>0),'Cross-origin iframe form must be inspected');
  assert.equal(page.events.filter(e=>e.eventName==='page_view').length,2,'SPA page view should be observed');
  assert.equal(page.findings.some(f=>f.code==='missing_expected_event'),false);
  assert.ok(report.findings.some(f=>f.code==='BROWSER_SCRIPT_ERROR'));
  const native=report.visits.find(v=>v.journeyId==='native-invalid');
  assert.equal(native.submission.verified,true);
  assert.equal(native.submission.blockedWrites,0);
  const broken=report.visits.find(v=>v.journeyId==='broken-invalid');
  assert.equal(broken.submission.verified,false);
  assert.ok(broken.findings.some(f=>f.code==='FORM_INVALID_INPUT_WRITE_ATTEMPTED'));
  assert.ok(broken.findings.some(f=>f.code==='unexpected_event_count'));
  for (const id of ['bypass-invalid','button-bypass-invalid']) { const visit=report.visits.find(v=>v.journeyId===id);assert.equal(visit.submission.verified,false);assert.equal(visit.submission.nativeValidationEnabled,false);assert.equal(visit.submission.blockedWrites,0);assert.ok(visit.findings.some(f=>f.code==='FORM_INVALID_INPUT_UNVERIFIED')); }
  assert.doesNotMatch(JSON.stringify(report),/private@example.com|private-person|private-client|private-secret|8015551234/);
  assert.doesNotMatch(processResult.output,/private@example.com|private-person|private-client|private-secret|8015551234/);
  let plan=buildActionPlan(report,{mode:'prepare-fixes'});
  const target=plan.actions.find(a=>a.code==='unexpected_event_count' && a.scope.journeyId==='broken-invalid');
  assert.ok(target,'The unwanted conversion must become an action');
  plan=recordAction(plan,target.id,{stage:'investigated',evidenceRef:'fixture:source',cause:'Native validation bypassed',causeConfidence:'high'});
  plan=recordAction(plan,target.id,{stage:'prepared',evidenceRef:'fixture:patch',changeRef:'fixture:remove-novalidate',rollback:'Restore fixture bypass'});
  repaired=true;
  plan=recordAction(plan,target.id,{stage:'applied',evidenceRef:'fixture:changed-source',authorized:true,authorizationRef:'fixture:local-test'});
  const rerun=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['bin/run.mjs','--config',path.join(directory,'config.json'),'--output',path.join(directory,'retest'),'--allow-invalid'],{cwd:path.resolve(import.meta.dirname,'..'),stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Retest timed out'));},90000);
    child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);resolve({code,output});});
  });
  const after=JSON.parse(await fs.readFile(path.join(directory,'retest/report.json'),'utf8'));
  assert.equal(after.executionComplete,true,rerun.output);
  const result=verifyAction(plan,target.id,after).actions.find(a=>a.id===target.id);
  assert.equal(result.status,'verified-browser-scope',JSON.stringify(result.verificationResult));
  assert.equal(result.verificationResult.downstreamReceipt,'untested');
  assert.equal(receivedLeads,0,'Repair verification must not deliver synthetic leads');
  console.log('Browser fixture passed: 10 visits, SPA events, iframe forms, invalid validation, write interception, unwanted conversion, redaction and verified repair.');
} finally {
  await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>embedded.close(resolve))]);
  await fs.rm(directory,{recursive:true,force:true});
}
