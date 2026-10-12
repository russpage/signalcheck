import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {AUDIT_MODULES,buildAuditReview} from '../lib/audits.mjs';
import {main} from '../bin/audits.mjs';
import {renderHtml,renderMarkdown,renderDigest} from '../bin/report.mjs';
const review={moduleId:'meta-signal',status:'reviewed-no-mismatch',pageUrl:'https://example.com/products/bike?gclid=private-click',scope:'Homepage desktop, unset consent',summary:'No mismatch in inspected browser',expected:'Reviewed browser/server events reach the platform',observed:'Browser emission only',businessImpact:'Platform stage unknown',nextAction:'Obtain server and platform evidence',owner:'Site owner',retest:'Repeat original action',confidence:'high',severity:'info',evidence:[{ref:'private:browser',checkpoint:'browser',observedAt:'2026-10-12T00:00:00Z'}]};
const input={schemaVersion:1,site:'https://example.com/?gclid=private-click',selected:['meta-signal','ecommerce-data'],reviews:[review]};
test('all fifteen modules stay visible and missing evidence downgrades a no-mismatch conclusion',()=>{
  const r=buildAuditReview(input);
  assert.equal(AUDIT_MODULES.length,15);assert.equal(new Set(AUDIT_MODULES.map(m=>m.id)).size,15);
  assert.equal(r.modules.length,15);
  const meta=r.modules.find(m=>m.id==='meta-signal');assert.equal(meta.status,'inconclusive');assert.deepEqual(meta.missingEvidence,['backend','platform']);
  assert.equal(r.modules.find(m=>m.id==='ecommerce-data').status,'untested');assert.equal(r.modules.find(m=>m.id==='gtm-health').status,'not-selected');
  const report={auditReview:r};
  for(const result of [renderHtml(report),renderMarkdown(report),JSON.stringify(renderDigest(report))]) {
    assert.match(result,/Meta Pixel/);assert.match(result,/https:\/\/example.com\/products\/bike/);assert.match(result,/inconclusive/);assert.doesNotMatch(result,/private-click|private:browser/);
  }
});
test('review conclusions remain host assertions even with every required checkpoint',()=>{
  const r=buildAuditReview({...input,reviews:[{...review,evidence:['browser','backend','platform'].map(checkpoint=>({ref:'private:'+checkpoint,checkpoint,observedAt:'2026-10-12T00:00:00Z'}))}]});
  assert.equal(r.modules.find(m=>m.id==='meta-signal').status,'reviewed-no-mismatch');
  assert.match(r.verification,/not evidence authenticity/);
  assert.doesNotMatch(JSON.stringify(r),/verified-fixed|verified-browser-scope/);
});
test('unrecognized modules, unsupported fields, fabricated verification statuses and missing evidence fail',()=>{
  for(const value of [{...input,selected:['fake']},{...input,rawPayload:{}},{...input,reviews:[review,review]},{...input,reviews:[{...review,status:'verified-fixed'}]},{...input,reviews:[{...review,evidence:[]}]},{...input,reviews:[{...review,evidence:[{...review.evidence[0],observedAt:'invalid'}]}]}])assert.throws(()=>buildAuditReview(value));
});
test('sanitized compiler output and HTML exclude identifiers and escape hostile content',()=>{
  const r=buildAuditReview({...input,reviews:[{...review,status:'issue',summary:'<script>alert(1)</script> person@example.com gclid=private-click token=private-secret https://example.com/?token=private-secret',evidence:[{...review.evidence[0],ref:'person@example.com'}]}]});
  const html=renderHtml({auditReview:r});
  assert.doesNotMatch(html,/<script>|person@example|private-click|private-secret/);assert.match(html,/&lt;script&gt;/);
});
test('CLI writes a private review dashboard and refuses an unrelated browser site',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'signalcheck-audits-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const filename=path.join(dir,'review.json');await fs.writeFile(filename,JSON.stringify(input));
  await fs.mkdir(path.join(dir,'result'));await fs.writeFile(path.join(dir,'result/report.html'),'old public output',{mode:0o644});
  await main(['--input',filename,'--output',path.join(dir,'result')]);
  const html=await fs.readFile(path.join(dir,'result/report.html'),'utf8');assert.match(html,/review-only/);assert.match(html,/No browser run is attached/);assert.doesNotMatch(html,/Browser emission is observed|No actionable findings/);
  const markdown=await fs.readFile(path.join(dir,'result/summary.md'),'utf8');assert.match(markdown,/Comparison unavailable/);assert.doesNotMatch(markdown,/0 new finding/);
  if(process.platform!=='win32')assert.equal((await fs.stat(path.join(dir,'result/report.html'))).mode&0o777,0o600);
  const report=path.join(dir,'browser.json');await fs.writeFile(report,JSON.stringify({site:'other.example',visits:[]}));
  await assert.rejects(()=>main(['--input',filename,'--output',path.join(dir,'bad'),'--report',report]),/must match/);
  await assert.rejects(()=>main(['--input',filename,'--output']),/options/);
});
