import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { buildActionPlan, recordAction, verifyAction } from '../lib/action-plan.mjs';
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'signalcheck-traffic-browser-'));
const markers = []; const foreignMarkers = []; const headers = []; const foreignHeaders = [];
const listen = s => new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
const foreign = http.createServer((req, res) => {
  foreignHeaders.push(req.headers);
  if (req.url.startsWith('/marker-check')) { foreignMarkers.push(new URL(req.url, 'http://fixture').searchParams.get('value')); res.end('ok'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.end(`<script>fetch('/marker-check?value='+encodeURIComponent(localStorage.getItem('signalcheck_qa')))</script>`);
});
await listen(foreign);
let repaired = false;
let productionEmissions = 0;
const server = http.createServer((req, res) => {
  headers.push(req.headers);
  if (req.url.startsWith('/g/collect')) { productionEmissions++; res.writeHead(204); res.end(); return; }
  if (req.url.startsWith('/marker-check')) { markers.push(JSON.parse(new URL(req.url, 'http://fixture').searchParams.get('value'))); res.end('ok'); return; }
  if (req.url.startsWith('/blocked')) { assert.equal(req.headers['user-agent'], 'ReviewedAgent/1'); res.writeHead(403); res.end('Restricted'); return; }
  res.setHeader('Content-Type', 'text/html');
  res.end(`<form id="quote"><input aria-label="Name"></form>${req.url.startsWith('/challenge') ? '<div id="challenge">Challenge</div>' : ''}<iframe src="http://127.0.0.1:${foreign.address().port}"></iframe><script>
    const marker=JSON.parse(localStorage.getItem('signalcheck_qa'));
    fetch('/marker-check?value='+encodeURIComponent(JSON.stringify(marker)));
    if (!${repaired} || marker?.kind !== 'synthetic-qa') fetch('/g/collect?v=2&tid=G-PROD&en=generate_lead&cid=private-client');
  </script>`);
});
await listen(server);
const origin = `http://127.0.0.1:${server.address().port}`;
const probe = { kind: 'policy-probe', userAgent: 'ReviewedAgent/1', challengeSelectors: ['#challenge'] };
const config = {
  pages: [{ url: `${origin}/flow`, expectedForms: [{ selector: '#quote' }] }, ...['flow', 'blocked', 'challenge'].map(route => ({ url: `${origin}/${route}`, expectedForms: [{ selector: '#quote' }], agentAccess: probe }))],
  devices: ['desktop'], consentStates: ['unset'], settleMs: 500, networkIdleTimeoutMs: 500, screenshotDevices: [], collectorHosts: { '127.0.0.1': 'ga4' },
  traffic: { syntheticMarker: { siteIntegrationConfirmed: true, origins: [origin] }, excludedEvents: [{ vendor: 'ga4', destinationId: 'G-PROD', eventName: 'generate_lead' }] },
};
async function run(name) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/run.mjs', '--config', path.join(directory, 'config.json'), '--output', path.join(directory, name)], { cwd: path.resolve(import.meta.dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', c => output += c); child.stderr.on('data', c => output += c);
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Traffic fixture timed out')); }, 90000);
    child.on('error', reject); child.on('exit', code => { clearTimeout(timer); resolve({ code, output }); });
  });
  const report = JSON.parse(await fs.readFile(path.join(directory, name, 'report.json'), 'utf8'));
  assert.equal(report.executionComplete, true, result.output); assert.equal(report.visits.length, 4); return report;
}
try {
  await fs.writeFile(path.join(directory, 'config.json'), JSON.stringify(config));
  const before = await run('before');
  assert.ok(before.visits.every(v => v.traffic.category === 'synthetic-qa'));
  assert.ok(before.visits.every(v => v.traffic.marker === 'observed-browser-storage'));
  assert.equal(before.visits[1].agentAccess.status, 'target-accessible');
  assert.equal(before.visits[2].agentAccess.status, 'restricted');
  assert.equal(before.visits[3].agentAccess.status, 'challenged');
  assert.ok(before.visits.slice(1).every(v => v.agentAccess.authenticatedAgent === 'untested'));
  assert.ok(markers.length >= 3); assert.ok(markers.every(m => m.kind === 'synthetic-qa' && m.runId === before.traffic.runMarkerId));
  assert.ok(foreignMarkers.length >= 3); assert.ok(foreignMarkers.every(m => m === 'null'), 'QA storage must not be installed in third-party frames');
  assert.ok([...headers, ...foreignHeaders].every(h => !Object.keys(h).some(k => /signalcheck|website-qa/i.test(k))), 'No synthetic request headers');
  assert.ok(before.visits[0].findings.some(f => f.code === 'SYNTHETIC_CONVERSION_EMITTED'));
  assert.doesNotMatch(JSON.stringify(before), /private-client/);
  let plan = buildActionPlan(before, { mode: 'prepare-fixes' }); const target = plan.actions.find(a => a.code === 'SYNTHETIC_CONVERSION_EMITTED' && a.scope.url.endsWith('/flow') && a.scope.type === 'page');
  plan = recordAction(plan, target.id, { stage: 'investigated', evidenceRef: 'fixture:source', cause: 'QA marker not checked before production emission', causeConfidence: 'high' });
  plan = recordAction(plan, target.id, { stage: 'prepared', evidenceRef: 'fixture:patch', changeRef: 'fixture:exclude-qa', rollback: 'Restore fixture emission' });
  repaired = true;
  plan = recordAction(plan, target.id, { stage: 'applied', evidenceRef: 'fixture:source-changed', authorized: true, authorizationRef: 'fixture:local' });
  const emissionsBeforeRetest = productionEmissions;
  const after = await run('after');
  assert.equal(productionEmissions, emissionsBeforeRetest, 'Reviewed synthetic visits must stop emitting production conversions');
  assert.notEqual(after.traffic.runMarkerId, before.traffic.runMarkerId);
  assert.equal(after.visits[0].expectationSignature, before.visits[0].expectationSignature);
  assert.equal(after.findings.some(f => f.code === 'SYNTHETIC_CONVERSION_EMITTED'), false);
  const result = verifyAction(plan, target.id, after).actions.find(a => a.id === target.id);
  assert.equal(result.status, 'verified-browser-scope', JSON.stringify(result.verificationResult));
  assert.equal(result.verificationResult.downstreamReceipt, 'untested');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/flow`);
    await page.waitForTimeout(500);
    assert.equal(productionEmissions, emissionsBeforeRetest + 1, 'Unmarked visits must retain their legitimate conversion event');
  } finally { await browser.close(); }
  console.log('Traffic browser fixture passed: 9 visits, first-party marker isolation, unchanged requests, accessible/restricted/challenged policy probes, synthetic emission detection and original-contract repair verification.');
} finally {
  await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => foreign.close(resolve))]);
  await fs.rm(directory, { recursive: true, force: true });
}
