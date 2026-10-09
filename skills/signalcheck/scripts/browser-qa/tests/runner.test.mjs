import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cli, skipReason, validateConfig, findingKey, computeHistory, pageExpectations, safeDataLayer, normalizeFinding,
  writeReportAtomic, checkpointReport, shouldCaptureScreenshot, displayMetadata, contractSignature, progressLine } from '../bin/run.mjs';

const url = 'https://example.com/pages/contact';
const base = { pages: [{ url }], devices: ['desktop'], consentStates: ['unset'], journeys: [] };
const ready = { id: 'contact-submit', enabled: true, url, formSelector: 'form', fields: [],
  syntheticRoutingConfirmed: true, successSelector: '#success',
  expectedEvents: [{ vendor: 'ga4', eventName: 'generate_lead', count: 1 }] };

test('importing runner has no side effect and CLI defaults to read-only', () => {
  assert.equal(cli([]).allowSubmit, false);
  assert.equal(cli(['--allow-submit']).allowSubmit, true);
  assert.throws(() => cli(['--config']), /Missing value/);
  assert.throws(() => cli(['--unknown']), /Unknown option/);
});

test('submission requires every enablement and receipt-check gate', () => {
  assert.equal(skipReason(ready, true, base), null);
  assert.match(skipReason({ ...ready, enabled: false }, true, base), /not enabled/);
  assert.match(skipReason(ready, false, base), /Read-only/);
  assert.match(skipReason({ ...ready, syntheticRoutingConfirmed: false }, true, base), /routing/);
  assert.match(skipReason({ ...ready, successSelector: undefined }, true, base), /success selector/);
  assert.match(skipReason({ ...ready, expectedEvents: [] }, true, base), /Expected conversion/);
  assert.equal(skipReason({ ...ready, syntheticRoutingConfirmed: false }, true, { ...base, syntheticRoutingConfirmed: true }), null);
});

test('config rejects unbounded origins, destructive journeys, duplicate IDs and invalid consent', () => {
  assert.throws(() => validateConfig({ ...base, journeys: [{ ...ready, url: 'https://unapproved.example/form' }] }), /outside allowedOrigins/);
  assert.throws(() => validateConfig({ ...base, journeys: [{ ...ready, id: 'purchase' }] }), /transactional or destructive/);
  assert.throws(() => validateConfig({ ...base, journeys: [ready, ready] }), /unique id/);
  assert.throws(() => validateConfig({ ...base, journeys: [{ ...ready, formSelector: undefined }] }), /formSelector and fields/);
  assert.throws(() => validateConfig({ ...base, consentStates: ['invented'] }), /consentStates/);
});

test('tracking parser severities map to runner failure severities', () => {
  assert.deepEqual(normalizeFinding({ code: 'missing_expected_event', severity: 'error' }), {
    code: 'missing_expected_event', severity: 'high', sourceSeverity: 'error',
  });
  assert.equal(normalizeFinding({ severity: 'warning' }).severity, 'medium');
  assert.equal(normalizeFinding({ severity: 'info' }).severity, 'info');
});

test('event expectations are limited by consent state and device', () => {
  const config = { expectedPageviews: [
    { provider: 'google_analytics', event: 'page_view', count: 1, consentStates: ['accepted'], devices: ['desktop'] },
  ] };
  assert.equal(pageExpectations(config, 'declined', 'desktop').length, 0);
  assert.equal(pageExpectations(config, 'unverified', 'desktop').length, 0);
  assert.equal(pageExpectations(config, 'accepted', 'mobile').length, 0);
  assert.equal(pageExpectations(config, 'accepted', 'desktop')[0].vendor, 'ga4');
});

test('different destination or event contracts produce different finding fingerprints', () => {
  const common = { code: 'missing_expected_event', title: 'Expected tracking event did not fire', url,
    device: 'desktop', consentState: 'accepted', journeyId: 'contact-submit', expected: 1 };
  assert.notEqual(findingKey({ ...common, rule: { vendor: 'ga4', destinationId: 'G-ONE', eventName: 'generate_lead' } }),
    findingKey({ ...common, rule: { vendor: 'ga4', destinationId: 'G-TWO', eventName: 'generate_lead' } }));
  assert.notEqual(findingKey({ ...common, rule: { vendor: 'ga4', eventName: 'generate_lead' } }),
    findingKey({ ...common, rule: { vendor: 'ga4', eventName: 'purchase' } }));
});

function priorJourney() {
  const visit = { id: 'old-journey', type: 'journey', url, device: 'desktop', consentState: 'accepted', journeyId: 'contact-submit',
    expectationSignature: 'same-contract', status: 'failed' };
  const finding = { code: 'BROWSER_JOURNEY_FAILED', title: 'Form journey could not finish', visitId: visit.id,
    visitType: 'journey', url, device: visit.device, consentState: visit.consentState, journeyId: visit.journeyId,
    expectationSignature: visit.expectationSignature };
  return { runId: 'prior-run', visits: [visit], findings: [finding] };
}

test('a successful page visit cannot resolve an untested form journey on the same URL', () => {
  const previous = priorJourney();
  const report = { visits: [{ ...previous.visits[0], id: 'new-page', type: 'page', journeyId: null, status: 'completed' }], findings: [] };
  assert.equal(computeHistory(report, previous).resolvedFindings.length, 0);
});

test('only a completed equivalent journey can establish resolution', () => {
  const previous = priorJourney();
  for (const status of ['failed', 'partial']) {
    const report = { visits: [{ ...previous.visits[0], id: 'new-journey', status }], findings: [] };
    assert.equal(computeHistory(report, previous).resolvedFindings.length, 0);
  }
  const changed = { visits: [{ ...previous.visits[0], id: 'new-journey', expectationSignature: 'changed-contract', status: 'completed' }], findings: [] };
  assert.equal(computeHistory(changed, previous).resolvedFindings.length, 0);
  const equivalent = { visits: [{ ...previous.visits[0], id: 'new-journey', status: 'completed' }], findings: [] };
  assert.equal(computeHistory(equivalent, previous).resolvedFindings.length, 1);
});

test('persisted dataLayer summaries discard user data and unknown values', () => {
  const payload = { event: 'purchase', first_name: 'Alice', email: 'alice@example.com', unknown: 'private-token',
    ecommerce: { transaction_id: 'private-order-id', currency: 'USD', value: 99, items: [{ item_name: 'private-customization' }] },
    user_data: { email: 'alice@example.com' } };
  const summary = safeDataLayer(payload);
  assert.equal(summary.eventName, 'purchase');
  assert.equal(summary.currency, 'USD');
  assert.equal(summary.value, 99);
  assert.equal(summary.itemCount, 1);
  assert.equal(summary.hasUserData, true);
  assert.match(summary.transactionHash, /^[a-f0-9]{16}$/);
  assert.doesNotMatch(JSON.stringify(summary), /Alice|alice@example.com|private-token|private-order-id|private-customization/);
});

test('gtag consent and event argument objects are summarized without storing raw parameters', () => {
  const consent = safeDataLayer({ 0: 'consent', 1: 'update', 2: { analytics_storage: 'granted', ad_storage: 'denied', unknown: 'private-token' } });
  assert.equal(consent.command, 'consent');
  assert.equal(consent.consentMode, 'update');
  assert.deepEqual(consent.consentSignals, { ad_storage: 'denied', analytics_storage: 'granted' });
  const event = safeDataLayer({ 0: 'event', 1: 'generate_lead', 2: { email: 'alice@example.com', form_name: 'Alice' } });
  assert.equal(event.eventName, 'generate_lead');
  assert.doesNotMatch(JSON.stringify({ consent, event }), /private-token|alice@example.com|Alice/);
});

test('an interrupted run retains a valid incomplete checkpoint with actionable findings', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'website-qa-checkpoint-'));
  try {
    const filename = path.join(directory, 'nested', 'report.json');
    const report = { runId: 'current-run', status: 'running', executionComplete: false, finishedAt: null,
      visits: [], findings: [], runProgress: { plannedVisits: 2, completedVisits: 0, currentVisitId: 'first', pendingVisits: [{ id: 'first' }, { id: 'second' }] } };
    await checkpointReport(filename, report, null);
    report.visits.push({ id: 'first', type: 'page', url, device: 'desktop', consentState: 'accepted', status: 'completed', expectationSignature: 'same-contract' });
    report.findings.push({ code: 'missing_expected_event', severity: 'high', title: 'Expected tracking event did not fire', visitId: 'first',
      visitType: 'page', url, device: 'desktop', consentState: 'accepted', expectationSignature: 'same-contract' });
    report.runProgress.completedVisits = 1;
    report.runProgress.currentVisitId = 'second';
    report.runProgress.pendingVisits = [{ id: 'second' }];
    await checkpointReport(filename, report, null);
    const persisted = JSON.parse(await fs.readFile(filename, 'utf8'));
    assert.equal(persisted.status, 'running');
    assert.equal(persisted.executionComplete, false);
    assert.equal(persisted.finishedAt, null);
    assert.equal(persisted.runProgress.completedVisits, 1);
    assert.equal(persisted.runProgress.currentVisitId, 'second');
    assert.equal(persisted.summary.high, 1);
    assert.equal(persisted.history.newFindings.length, 1);
    assert.ok(Number.isFinite(Date.parse(persisted.lastCheckpointAt)));
    assert.deepEqual(await fs.readdir(path.dirname(filename)), ['report.json']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('failed checkpoint serialization preserves the last complete JSON file', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'website-qa-atomic-'));
  try {
    const filename = path.join(directory, 'report.json');
    await writeReportAtomic(filename, { status: 'running', executionComplete: false, completedVisits: 1 });
    await assert.rejects(writeReportAtomic(filename, { status: 'running', invalid: 1n }), /BigInt/);
    assert.deepEqual(JSON.parse(await fs.readFile(filename, 'utf8')), { status: 'running', executionComplete: false, completedVisits: 1 });
    assert.deepEqual(await fs.readdir(directory), ['report.json']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('screenshot coverage filters preserve requested evidence while reducing duplicate captures', () => {
  const acceptedDesktop = { device: 'desktop', consentState: 'accepted' };
  assert.equal(shouldCaptureScreenshot(acceptedDesktop, {}), true);
  assert.equal(shouldCaptureScreenshot(acceptedDesktop, { screenshotDevices: ['desktop'], screenshotConsentStates: ['accepted'] }), true);
  assert.equal(shouldCaptureScreenshot({ device: 'mobile', consentState: 'accepted' }, { screenshotDevices: ['desktop'] }), false);
  assert.equal(shouldCaptureScreenshot({ device: 'desktop', consentState: 'declined' }, { screenshotConsentStates: ['accepted'] }), false);
  assert.equal(shouldCaptureScreenshot(acceptedDesktop, { screenshotDevices: [] }), false);
});


test('distinct failed endpoints retain distinct regression identities', () => {
  const base = {code:'TAG_REQUEST_FAILED',url:'https://example.com/',device:'desktop',consentState:'accepted'};
  assert.notEqual(findingKey({...base,evidence:['https://analytics.google.com/g/collect']}), findingKey({...base,evidence:['https://a.klaviyo.com/onsite/track-analytics']}));
  assert.equal(findingKey({...base,evidence:['https://analytics.google.com/g/collect?cid=abc']}), findingKey({...base,evidence:['https://analytics.google.com/g/collect?cid=def']}));
});

test('title and custom label metadata preserve change detection without source text', () => {
  const privateText='Welcome Private Person private@example.com token=private-secret 801-555-1234';
  const metadata=displayMetadata(privateText);
  assert.equal(metadata.length,privateText.length);
  assert.match(metadata.hash,/^[a-f0-9]{16}$/);
  assert.doesNotMatch(JSON.stringify(metadata),/Private Person|private@example.com|private-secret|801/);
  assert.notEqual(metadata.hash,displayMetadata('A changed page title').hash);
});

test('progress output strips credential, query and identity path information', () => {
  const output=progressLine({type:'page',url:'https://user:password@example.com/accounts/private-person?email=private@example.com&token=private-secret&phone=8015551234',device:'desktop',consentState:'unset'});
  assert.match(output,/https:\/\/example.com\/accounts\/\[redacted\]/);
  assert.doesNotMatch(output,/user:|password|private-person|private@example.com|private-secret|8015551234/);
});

test('changed form, assertion or navigation contracts cannot resolve prior failures', () => {
  const task={id:'page-1-desktop-unset',type:'page',url,device:'desktop',consentState:'unset',expectedForms:[{selector:'#old'}]};
  const priorSignature=contractSignature(base,task,[]);
  const visit={id:task.id,type:'page',url,device:'desktop',consentState:'unset',status:'completed',expectationSignature:priorSignature};
  const priorFinding={code:'EXPECTED_FORM_MISSING',title:'A configured form was not found',visitId:visit.id,visitType:'page',url,device:'desktop',consentState:'unset',expectationSignature:priorSignature};
  const previous={runId:'old',visits:[visit],findings:[priorFinding]};
  for (const changed of [{...task,expectedForms:[{selector:'#new'}]},{...task,assertions:[{selector:'#cta',visible:true}]},{...task,steps:[{id:'menu',type:'click',selector:'#menu',nonDestructive:true}]}]) {
    const newSignature=contractSignature(base,changed,[]);
    assert.notEqual(newSignature,priorSignature);
    assert.equal(computeHistory({visits:[{...visit,expectationSignature:newSignature}],findings:[]},previous).resolvedFindings.length,0);
  }
  assert.equal(computeHistory({visits:[visit],findings:[]},previous).resolvedFindings.length,1);
  assert.notEqual(contractSignature({...base,settleMs:1000},task,[]),contractSignature({...base,settleMs:5000},task,[]));
});
