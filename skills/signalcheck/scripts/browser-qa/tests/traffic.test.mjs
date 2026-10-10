import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeTrafficExport, agentAccessResult } from '../lib/traffic.mjs';
import { main as importTraffic } from '../bin/traffic.mjs';
import { validateConfig, contractSignature } from '../bin/run.mjs';
import { analyzeTagEvents } from '../lib/tag-events.mjs';
import { renderDigest, renderHtml, renderMarkdown } from '../bin/report.mjs';

const origin = 'https://example.com';
const base = { pages: [{ url: `${origin}/contact`, expectedForms: [{ selector: '#contact' }] }] };
const exclusion = { vendor: 'ga4', destinationId: 'G-PROD', eventName: 'generate_lead' };
const evidence = (kind, result) => ({ kind, result, ref: `private:${kind}:private@example.com` });
const dataset = records => ({ schemaVersion: 1, source: { kind: 'cdn', authenticated: true, evidenceRef: 'private-source-secret' }, coverage: { unit: 'request', sampling: 'sampled', start: '2026-10-01', end: '2026-10-02' }, records });

test('synthetic marking requires reviewed origins and an existing site integration', () => {
  assert.throws(() => validateConfig({ ...base, traffic: { syntheticMarker: { origins: [origin] } } }), /confirmed site integration/);
  for (const invalid of ['https://foreign.example', `${origin}/path`, `${origin}/`, 'ftp://example.com']) assert.throws(() => validateConfig({ ...base, traffic: { syntheticMarker: { siteIntegrationConfirmed: true, origins: [invalid] } } }), /approved HTTP origins/);
  validateConfig({ ...base, traffic: { syntheticMarker: { siteIntegrationConfirmed: true, origins: [origin] } } });
});

test('production conversion exclusions cannot overwrite a positive contract', () => {
  assert.throws(() => validateConfig({ ...base, traffic: { excludedEvents: [exclusion] }, expectedPageEvents: [{ ...exclusion, count: 1 }] }), /both required and excluded/);
  assert.throws(() => validateConfig({ ...base, traffic: { excludedEvents: [{ ...exclusion, count: 1 }] } }), /omit counts/);
  assert.throws(() => validateConfig({ ...base, traffic: { excludedEvents: [{ vendor: 'ga4', eventName: 'generate_lead' }] } }), /production destination/);
  validateConfig({ ...base, consentStates: ['declined'], pages: [{ ...base.pages[0], expectedEvents: [{ ...exclusion, count: 1, consentStates: ['accepted'] }] }], traffic: { excludedEvents: [exclusion] } });
  validateConfig({ ...base, traffic: { excludedEvents: [exclusion] }, expectedPageEvents: [{ ...exclusion, destinationId: 'G-QA', count: 1 }] });
});

test('agent probes require an explicit kind, target and clean user agent', () => {
  validateConfig({ pages: [{ ...base.pages[0], agentAccess: { kind: 'policy-probe', userAgent: 'AgentProbe/1' } }] });
  for (const probe of [{ kind: 'signed-agent', userAgent: 'Agent/1' }, { kind: 'policy-probe', userAgent: 'Agent\r\nheader: injected' }]) assert.throws(() => validateConfig({ pages: [{ ...base.pages[0], agentAccess: probe }] }), /reviewed userAgent/);
  assert.throws(() => validateConfig({ pages: [{ url: origin, agentAccess: { kind: 'policy-probe', userAgent: 'Agent/1' } }] }), /target form/);
});

test('changing traffic policy changes contract scope while random run identity does not', () => {
  const task = { id: 'page', type: 'page', url: origin };
  assert.equal(contractSignature({ ...base, qaRunId: 'first' }, task, []), contractSignature({ ...base, qaRunId: 'second' }, task, []));
  assert.notEqual(contractSignature(base, task, []), contractSignature({ ...base, traffic: { excludedEvents: [exclusion] } }, task, []));
  assert.notEqual(contractSignature(base, task, []), contractSignature(base, { ...task, agentAccess: { kind: 'policy-probe', userAgent: 'Agent/1' } }, []));
});

test('exclusion annotation survives parser output without becoming an event matching key', () => {
  const f = analyzeTagEvents([{ ...exclusion, timestamp: '2026-10-01', source: 'network', channel: 'browser' }], { expectations: [{ ...exclusion, count: 0, syntheticExclusion: true }] });
  assert.ok(f.some(f => f.rule?.syntheticExclusion === true && f.actual === 1));
});

test('probe results do not certify agent identity, customer intent or completed submissions', () => {
  const accessible = agentAccessResult({ status: 'completed', httpStatus: 200, assertions: [{ status: 'verified' }] });
  assert.equal(accessible.status, 'target-accessible');
  assert.equal(accessible.authenticatedAgent, 'untested');
  assert.equal(accessible.customerIntent, 'unknown');
  assert.equal(agentAccessResult({ status: 'failed', httpStatus: 403 }).status, 'restricted');
  assert.equal(agentAccessResult({ status: 'completed', httpStatus: 200, finalHttpStatus: 429 }).status, 'restricted');
  assert.equal(agentAccessResult({ status: 'completed', httpStatus: 200, agentChallengeObserved: true }).status, 'challenged');
  assert.equal(agentAccessResult({ status: 'completed', httpStatus: 200, assertions: [{ status: 'failed' }] }).status, 'target-unavailable');
  assert.equal(agentAccessResult({ type: 'journey', status: 'completed', httpStatus: 200, submission: { verified: false } }).status, 'inconclusive');
});

test('classification preserves verified agents as a subset of automation and keeps intent unknown', () => {
  const report = analyzeTrafficExport(dataset([
    { id: 'agent', identityEvidence: [evidence('signature', 'signed-agent'), evidence('edge', 'verified-bot')] },
    { id: 'bot', identityEvidence: [evidence('edge', 'verified-bot')] },
    { id: 'qa', identityEvidence: [evidence('runner', 'synthetic-qa')] },
    { id: 'human', identityEvidence: [evidence('behavior', 'likely-human')] },
    { id: 'suspect', identityEvidence: [evidence('behavior', 'suspected-automation')] },
    { id: 'unknown', userAgent: 'SignedAgent/1', signedAgent: true },
  ]));
  assert.deepEqual(report.counts, { 'synthetic-qa': 1, 'signed-agent': 1, 'verified-bot': 1, 'likely-human': 1, 'suspected-automation': 1, unknown: 1 });
  assert.ok(report.records.every(r => r.customerIntent === 'unknown'));
  assert.equal(report.coverage.unit, 'request');
  assert.equal(report.coverage.sampling, 'sampled');
  assert.match(report.identityVerification, /does not verify signatures/);
});

test('untrusted source assertions and conflicting identities cannot certify automation', () => {
  const data = dataset([{ id: 'agent', identityEvidence: [evidence('signature', 'signed-agent')] }]);
  data.source.authenticated = false;
  assert.equal(analyzeTrafficExport(data).counts.unknown, 1);
  const report = analyzeTrafficExport(dataset([{ id: 'conflict', identityEvidence: [evidence('runner', 'synthetic-qa'), evidence('signature', 'signed-agent')] }]));
  assert.equal(report.counts.unknown, 1);
  assert.equal(report.findings[0].code, 'TRAFFIC_IDENTITY_CONFLICT');
  assert.throws(() => analyzeTrafficExport(dataset([{ id: 'invalid', identityEvidence: [evidence('behavior', 'signed-agent')] }])), /does not verify/);
});

test('correlated counting and agent-access problems produce distinct evidence-scoped actions', () => {
  const report = analyzeTrafficExport(dataset([
    { id: 'test', identityEvidence: [evidence('runner', 'synthetic-qa')], outcome: { countedAsBusinessConversion: true, evidenceRef: 'private-counting-secret' } },
    { id: 'agent', identityEvidence: [evidence('signature', 'signed-agent')], access: { expectedPolicy: 'allow', httpStatus: 403, challengeObserved: false, journeyCompleted: false, evidenceRef: 'private-access-secret' } },
    { id: 'denied-as-intended', identityEvidence: [evidence('signature', 'signed-agent')], access: { expectedPolicy: 'deny', httpStatus: 403, challengeObserved: false, journeyCompleted: false, evidenceRef: 'private-denied-secret' } },
  ]));
  assert.deepEqual(report.findings.map(f => f.code), ['SYNTHETIC_CONVERSION_COUNTED', 'SIGNED_AGENT_ACCESS_RESTRICTED']);
  assert.ok(report.findings.every(f => f.checkpoint === 'imported-evidence'));
  assert.doesNotMatch(JSON.stringify(report), /private@example.com|private-source-secret|private-counting-secret|private-access-secret|private-denied-secret/);
});

test('exports reject misleading windows, units, duplicate observations and unsupported evidence', () => {
  const input = dataset([{ id: 'one' }]);
  assert.throws(() => analyzeTrafficExport({ ...input, records: [{ id: 'one' }, { id: 'one' }] }), /unique/);
  assert.throws(() => analyzeTrafficExport({ ...input, coverage: { ...input.coverage, unit: 'visitors' } }), /coverage/);
  assert.throws(() => analyzeTrafficExport({ ...input, coverage: { ...input.coverage, end: input.coverage.start } }), /coverage/);
  assert.throws(() => analyzeTrafficExport({ ...input, records: [{ id: 'one', identityEvidence: [evidence('user-agent', 'signed-agent')] }] }), /supported kind/);
});

test('import command runs, preserves source and replaces output with private permissions', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'signalcheck-traffic-'));
  try {
    const input = path.join(dir, 'input.json'); const output = path.join(dir, 'report.json');
    const text = JSON.stringify(dataset([{ id: 'one', identityEvidence: [evidence('signature', 'signed-agent')] }]));
    await fs.writeFile(input, text); await fs.writeFile(output, 'old', { mode: 0o644 });
    await importTraffic(['--input', input, '--output', output]);
    assert.equal(JSON.parse(await fs.readFile(output, 'utf8')).counts['signed-agent'], 1);
    assert.equal((await fs.stat(output)).mode & 0o777, 0o600);
    assert.equal(await fs.readFile(input, 'utf8'), text);
    await assert.rejects(importTraffic(['--input', input, '--output', input]), /source evidence separate/);
    const alias = path.join(dir, 'alias.json');
    await fs.symlink(input, alias);
    await assert.rejects(importTraffic(['--input', alias, '--output', input]), /source evidence separate/);
    assert.equal(await fs.readFile(input, 'utf8'), text);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('human-readable reports and host digest preserve traffic evidence boundaries', () => {
  const report = { visits: [{ id: 'page-1', traffic: { execution: 'agent-policy-probe', marker: 'observed-browser-storage' }, agentAccess: { status: 'target-accessible', authenticatedAgent: 'untested' } }] };
  assert.match(renderMarkdown(report), /authenticated agent untested/);
  assert.match(renderHtml(report), /target-accessible \(authenticated agent untested\)/);
  assert.equal(renderDigest(report).visits[0].agentAccess.authenticatedAgent, 'untested');
});
