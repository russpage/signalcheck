import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml, renderMarkdown, renderDigest } from '../bin/report.mjs';

test('an inventory-only scan explicitly leaves event contracts untested', () => {
  const report={runId:'discovery',status:'completed',coverage:{pageVisitsPlanned:1,pageVisitsCompleted:1},visits:[{id:'home',status:'completed',eventContractsConfigured:false,findings:[{code:'EVENT_EXPECTATIONS_UNCONFIGURED'}]}],findings:[]};
  for (const output of [renderHtml(report),renderMarkdown(report)]) {
    assert.match(output,/Inventory only: event contracts are untested/);
    assert.match(output,/Observing tags is not a tracking pass/);
  }
  report.visits.push({id:'configured',eventContractsConfigured:true,findings:[]});
  assert.match(renderMarkdown(report),/1\/2 observed visit\(s\); 1 visit\(s\) remain untested/);
});

test('HTML report escapes hostile website findings and evidence',()=>{
  const result=renderHtml({findings:[{severity:'error',title:'<script>alert(1)</script>',evidence:{url:'"><img onerror=alert(1)>'}}]});
  assert.ok(!result.includes('<script>'));
  assert.ok(!result.includes('<img onerror='));
  assert.ok(result.includes('&lt;script&gt;'));
});

test('no-findings report still exposes untested submission coverage',()=>{
  const result=renderMarkdown({coverage:{pageVisitsCompleted:2,pageVisitsPlanned:2,journeysTested:0,journeysPlanned:4},journeys:[{id:'contact',status:'untested',reason:'Test routing needed'}]});
  assert.ok(result.includes('0/4'));
  assert.ok(result.includes('Test routing needed'));
  assert.ok(result.includes('untested'));
});

test('shareable reports replace private custom IDs with stable opaque references',()=>{
  const identity='qa-person@example.com';
  const encoded='qa-person%40example.com';
  const report={journeys:[{id:identity,status:'untested',reason:`Routing for ${identity} is unavailable`},{id:encoded,status:'untested'},{id:'contact',status:'untested'}],visits:[{id:'visit-1',events:[{actionId:identity}]}],findings:[{actionId:identity}]};
  const digest=renderDigest(report);
  assert.match(digest.journeys[0].id,/^ref-[a-f0-9]{16}$/);
  assert.equal(digest.journeys[0].id,digest.visits[0].events[0].actionId);
  assert.equal(digest.journeys[0].id,digest.findings[0].actionId);
  assert.equal(digest.journeys[2].id,'contact');
  for(const output of [renderMarkdown(report),renderHtml(report),JSON.stringify(digest)]){
    assert.ok(!output.includes(identity));
    assert.ok(!output.includes(encoded));
    assert.ok(output.includes(digest.journeys[0].id));
  }
  assert.equal(report.journeys[0].id,identity,'rendering must preserve source IDs for comparison history');
});
