import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTagRequests, analyzeTagRequests } from '../lib/tag-requests.mjs';
import { validateConfig, contractSignature } from '../bin/run.mjs';
import { renderMarkdown, renderHtml, renderDigest } from '../bin/report.mjs';
const rule = { id: 'custom-pageview', host: 'collector.example', path: '/collect', method: 'GET', query: { event: 'ViewedProduct' }, count: 1 };
const request = { url: 'https://collector.example/collect?event=ViewedProduct&email=private@example.com', method: 'GET', resourceType: 'fetch', device: 'desktop', consentState: 'accepted', actionId: 'view-product', httpStatus: 204 };
const run = (requests, rules = [rule], extra = {}) => analyzeTagRequests(requests, { rules, device: 'desktop', consentState: 'accepted', ...extra });

test('generic checks match reviewed host, exact path, method and query without retaining payloads', () => {
  const result = run([request]);
  assert.equal(result.checks[0].status, 'verified-browser-request');
  assert.equal(result.checks[0].vendorReceipt, 'untested');
  const failure = run([request, request]);
  assert.equal(failure.findings[0].code, 'TAG_REQUEST_COUNT_EXCEEDED');
  assert.doesNotMatch(JSON.stringify(failure), /private@example.com|ViewedProduct/);
  assert.equal(failure.findings[0].evidence[0].endpoint, 'https://collector.example/collect');
});

test('lookalike hosts, different paths, methods and event parameters cannot satisfy a rule', () => {
  for (const changed of [{ url: 'https://collector.example.evil/collect?event=ViewedProduct' }, { url: 'https://collector.example/collect-more?event=ViewedProduct' }, { url: 'https://collector.example/collect?event=OtherEvent' }, { method: 'POST' }]) {
    assert.equal(run([{ ...request, ...changed }]).findings[0].code, 'TAG_REQUEST_MISSING');
  }
});

test('resource types keep SDK installation separate from event request checks', () => {
  const checks = [{ ...rule, id: 'sdk-script', query: {}, path: '/sdk.js', resourceTypes: ['script'] }];
  const script = { ...request, url: 'https://collector.example/sdk.js', resourceType: 'script' };
  assert.equal(run([script], checks).checks[0].status, 'verified-browser-request');
  assert.equal(run([{ ...script, resourceType: 'fetch' }], checks).findings[0].code, 'TAG_REQUEST_MISSING');
});

test('action and consent conditions isolate one actual browser phase', () => {
  const checks = [{ ...rule, actionId: 'view-product', consentStates: ['accepted'] }];
  assert.equal(run([{ ...request, actionId: 'page-load' }], checks).checks[0].status, 'failed');
  assert.equal(run([{ ...request, consentState: 'unset' }], checks).checks[0].status, 'failed');
  assert.equal(run([request], checks, { consentState: 'declined' }).checks[0].status, 'not-applicable');
  assert.equal(run([request], checks, { consentState: 'unverified' }).checks[0].status, 'untested');
});

test('zero-request contracts and min/max ranges check attempted requests, not counted conversions', () => {
  assert.equal(run([], [{ ...rule, count: 0 }]).checks[0].status, 'verified-browser-request');
  assert.equal(run([request], [{ ...rule, count: 0 }]).findings[0].code, 'TAG_REQUEST_COUNT_EXCEEDED');
  assert.equal(run([request], [{ ...rule, count: undefined, min: 1, max: 2 }]).checks[0].status, 'verified-browser-request');
});

test('failed responses and incomplete capture cannot certify request delivery', () => {
  assert.equal(run([{ ...request, httpStatus: 503 }]).findings[0].code, 'TAG_REQUEST_DELIVERY_FAILED');
  assert.equal(run([{ ...request, httpStatus: null, failureCategory: 'request-failed' }]).checks[0].status, 'inconclusive');
  const missing = run([], [rule], { captureComplete: false });
  assert.equal(missing.checks[0].status, 'inconclusive');
  assert.equal(missing.findings.some(f => f.code === 'TAG_REQUEST_MISSING'), false);
  assert.equal(missing.findings[0].code, 'TAG_REQUEST_CAPTURE_INCOMPLETE');
});

test('rules reject broad hosts, unbounded assertions, ambiguous paths and duplicate IDs', () => {
  for (const changed of [{ host: '*.example' }, { host: 'collector.example/path' }, { host: 'user:password@collector.example' }, { pathPrefix: '/' }, { count: -1 }, { count: 1, min: 1 }, { count: undefined }, { query: { event: 1 } }, { resourceTypes: ['made-up'] }, { body: { event: 'ViewedProduct' } }]) assert.throws(() => validateTagRequests([{ ...rule, ...changed }]));
  assert.throws(() => validateTagRequests([rule, rule]), /unique/);
  assert.throws(() => validateConfig({ pages: ['https://example.com'], expectedTagRequests: [{ ...rule, count: -1 }] }), /bounded/);
});

test('a changed tag request contract changes the repair verification scope', () => {
  const config = { pages: ['https://example.com'] }; const task = { url: 'https://example.com', type: 'page', expectedTagRequests: [rule] };
  assert.notEqual(contractSignature(config, task, []), contractSignature(config, { ...task, expectedTagRequests: [{ ...rule, query: { event: 'OtherEvent' } }] }, []));
  assert.notEqual(contractSignature(config, task, []), contractSignature({ ...config, expectedTagRequests: [{ ...rule, count: 0 }] }, task, []));
});

test('request verification cannot conceal missing decoded-event contracts in reports', () => {
  const checks = run([request]).checks;
  const report = { visits: [{ id: 'page', eventContractsConfigured: false, tagRequestChecks: checks }], findings: [] };
  for (const output of [renderMarkdown(report), renderHtml(report)]) {
    assert.match(output, /Inventory only: event contracts are untested/);
    assert.match(output, /1\/1 applicable configured checks verified in browser scope/);
    assert.match(output, /Request matches do not decode vendor events or confirm receipt/);
  }
  assert.deepEqual(renderDigest(report).visits[0].tagRequestChecks, checks);
});
