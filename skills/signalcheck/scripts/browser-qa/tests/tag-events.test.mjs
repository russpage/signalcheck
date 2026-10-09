import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNetworkRequest, parseNetworkRequests, analyzeTagEvents, redactPageUrl, sanitizeProperties } from '../lib/tag-events.mjs';

const page = 'https://example.com/pages/contact';
const gaUrl = 'https://www.google-analytics.com/g/collect';
function ga(name = 'generate_lead', extra = {}, timestamp = 1000, context = {}) {
  const params = new URLSearchParams({ tid: 'G-TEST123', en: name, dl: page, ...extra });
  return { url: `${gaUrl}?${params}`, timestamp, pageUrl: page, actionId: 'contact:submit', ...context };
}
function meta(extra = {}, timestamp = 1000) {
  const params = new URLSearchParams({ id: '123456789', ev: 'Lead', dl: page, ...extra });
  return { url: `https://www.facebook.com/tr/?${params}`, timestamp, actionId: 'contact:submit' };
}

test('GA4 query event retains safe properties and hashes logical IDs', () => {
  const result = parseNetworkRequest(ga('purchase', { 'ep.transaction_id': 'order-123', 'epn.value': '499.95', 'ep.currency': 'usd' }));
  assert.equal(result.events.length, 1);
  const item = result.events[0];
  assert.equal(item.destinationId, 'G-TEST123');
  assert.equal(item.eventName, 'purchase');
  assert.equal(item.properties.value, 499.95);
  assert.equal(item.properties.currency, 'USD');
  assert.match(item.identity.transaction_id, /^sha256:[a-f0-9]{64}$/);
  assert.equal(item.isConversion, true);
  assert.equal(item.pageUrl, page);
});

test('GA4 POST newline batch yields independent events inheriting query fields', () => {
  const result = parseNetworkRequest({ url: `${gaUrl}?tid=G-BATCH&dl=${encodeURIComponent(page)}`, method: 'POST', postData: 'en=page_view\nen=generate_lead&ep.submission_id=lead-42&epn.value=5', timestamp: 1000 });
  assert.deepEqual(result.events.map((item) => item.eventName), ['page_view', 'generate_lead']);
  assert.equal(result.events[1].properties.value, 5);
  assert.equal(result.events[1].evidence.batchIndex, 1);
  assert.equal(result.events[1].destinationId, 'G-BATCH');
  assert.notEqual(result.events[0].id, result.events[1].id);
});

test('GA4 Measurement Protocol is a server transport and omits user IDs/secrets', () => {
  const result = parseNetworkRequest({ url: 'https://www.google-analytics.com/mp/collect?measurement_id=G-TEST123&api_secret=secret-value', method: 'POST', timestamp: 1000, postData: JSON.stringify({ client_id: 'private-client', user_id: 'person@example.com', events: [{ name: 'purchase', params: { transaction_id: 'ORDER-123', value: 12, currency: 'USD', page_location: `${page}?email=person@example.com` } }] }) });
  assert.equal(result.events[0].transport, 'server');
  assert.equal(result.events[0].pageUrl, page);
  assert.doesNotMatch(JSON.stringify(result), /secret-value|private-client|person@example.com|ORDER-123/);
});

test('Meta pixel parses encoded custom properties and event ID', () => {
  const item = parseNetworkRequest(meta({ eid: 'unique-42', 'cd[value]': '100', 'cd[currency]': 'USD', 'cd[email]': 'person@example.com' })).events[0];
  assert.equal(item.eventName, 'Lead');
  assert.equal(item.properties.value, 100);
  assert.match(item.identity.event_id, /^sha256:/);
  assert.doesNotMatch(JSON.stringify(item), /person@example.com|unique-42/);
});

test('GTM scripts are inventory, not conversion events', () => {
  const result = parseNetworkRequests([
    { url: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123&gtm_auth=private', pageUrl: `${page}?email=person@example.com`, timestamp: 0 },
    { url: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123', pageUrl: page, timestamp: 5 },
  ]);
  assert.equal(result.events.length, 0);
  assert.equal(result.containers.length, 1);
  assert.equal(result.containers[0].containerId, 'GTM-ABC123');
  assert.equal(result.containers[0].loadCount, 2);
  assert.doesNotMatch(JSON.stringify(result), /private|person@example.com/);
});

test('same logical conversion ID in one destination flags repeat emission', () => {
  const { events } = parseNetworkRequests([ga('purchase', { 'ep.transaction_id': 'ORDER-1' }, 1000), ga('purchase', { 'ep.transaction_id': 'ORDER-1' }, 40000)]);
  const findings = analyzeTagEvents(events);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'duplicate_conversion_emission');
  assert.equal(findings[0].confidence, 'high');
  assert.equal(findings[0].actual, 2);
  assert.match(findings[0].cause, /not double counting/);
});

test('same event sent to separate intended destinations is not a duplicate', () => {
  const { events } = parseNetworkRequests([
    ga('purchase', { 'ep.transaction_id': 'ORDER-1' }),
    ga('purchase', { tid: 'G-ANOTHER', 'ep.transaction_id': 'ORDER-1' }),
    meta({ ev: 'Purchase', eid: 'ORDER-1' }),
  ]);
  assert.equal(analyzeTagEvents(events).length, 0);
});

test('distinct action and transaction IDs are legitimate repeated actions', () => {
  const { events } = parseNetworkRequests([
    ga('purchase', { 'ep.transaction_id': 'ORDER-1' }),
    ga('purchase', { 'ep.transaction_id': 'ORDER-2' }, 1001),
    ga('generate_lead', {}, 1002, { actionId: 'submit-one' }),
    ga('generate_lead', {}, 1003, { actionId: 'submit-two' }),
    ga('page_view', {}, 1004),
    ga('page_view', {}, 1005),
  ]);
  assert.equal(analyzeTagEvents(events).length, 0);
});

test('fallback double firing is suspected and only within the time window', () => {
  const { events } = parseNetworkRequests([ga(), ga('generate_lead', {}, 1200), ga('generate_lead', {}, 10000)]);
  const findings = analyzeTagEvents(events);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'suspected_duplicate_conversion');
  assert.equal(findings[0].confidence, 'medium');
  assert.equal(findings[0].actual, 2);
});

test('missing timestamps do not invent temporal duplicate evidence', () => {
  const { events } = parseNetworkRequests([{ ...ga(), timestamp: undefined }, { ...ga(), timestamp: undefined }]);
  assert.equal(analyzeTagEvents(events).length, 0);
});

test('Google Ads primary + first-party companion is one logical conversion', () => {
  const query = `label=AbCdef&value=49&currency_code=USD&oid=ORDER-1&url=${encodeURIComponent(page)}`;
  const { events } = parseNetworkRequests([
    { url: `https://www.googleadservices.com/pagead/conversion/123456789/?${query}`, timestamp: 1000 },
    { url: `https://www.google.com/pagead/1p-conversion/123456789/?${query}`, timestamp: 1100 },
  ]);
  assert.equal(events[0].destinationId, 'AW-123456789');
  assert.equal(events[1].requestRole, 'first_party_conversion');
  assert.equal(analyzeTagEvents(events, { expectations: [{ vendor: 'google_ads', destinationId: 'AW-123456789', eventName: 'conversion', count: 1 }] }).length, 0);
});

test('two primary Google Ads requests still flag even with a companion', () => {
  const query = 'label=AbCdef&oid=ORDER-1';
  const { events } = parseNetworkRequests([
    { url: `https://www.googleadservices.com/pagead/conversion/123456789/?${query}`, timestamp: 1000 },
    { url: `https://www.google.com/pagead/1p-conversion/123456789/?${query}`, timestamp: 1100 },
    { url: `https://www.googleadservices.com/pagead/conversion/123456789/?${query}`, timestamp: 1200 },
  ]);
  const findings = analyzeTagEvents(events);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].actual, 2);
});

test('Ads remarketing request is not misclassified as a conversion', () => {
  const item = parseNetworkRequest({ url: 'https://www.google.com/pagead/viewthroughconversion/123456789/?remarketing_only=1', timestamp: 0 }).events[0];
  assert.equal(item.eventName, 'remarketing');
  assert.equal(item.isConversion, false);
});

test('Meta matched browser/server event IDs are dedup-ready, not a duplicate finding', () => {
  const { events } = parseNetworkRequests([
    meta({ eid: 'LEAD-42' }),
    { url: 'https://graph.facebook.com/v25.0/123456789/events?access_token=private', method: 'POST', timestamp: 1100, postData: JSON.stringify({ data: [{ event_name: 'Lead', event_id: 'LEAD-42', event_source_url: page, user_data: { em: ['private-hashed-email'] } }] }) },
  ]);
  const findings = analyzeTagEvents(events, { expectations: [{ vendor: 'meta', destinationId: '123456789', eventName: 'Lead', count: 1 }] });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'browser_server_dedup_ready');
  assert.equal(findings[0].actual, 1);
  assert.doesNotMatch(JSON.stringify(findings), /private|LEAD-42/);
});

test('Meta browser/server same transaction without matching event IDs needs correction', () => {
  const { events } = parseNetworkRequests([
    meta({ ev: 'Purchase', 'cd[transaction_id]': 'ORDER-1' }),
    { url: 'https://graph.facebook.com/v25.0/123456789/events', method: 'POST', timestamp: 1100, postData: JSON.stringify({ data: [{ event_name: 'Purchase', custom_data: { transaction_id: 'ORDER-1' } }] }) },
  ]);
  const findings = analyzeTagEvents(events);
  assert.equal(findings[0].code, 'duplicate_conversion_emission');
  assert.match(findings[0].suggestion, /transaction ID alone is insufficient/);
});

test('expected counts flag missing conversion and unwanted invalid-submit conversion', () => {
  const missing = analyzeTagEvents([], { expectations: [{ vendor: 'ga4', eventName: 'generate_lead', count: 1, actionId: 'valid-submit' }] });
  assert.equal(missing[0].code, 'missing_expected_event');
  assert.equal(missing[0].actual, 0);
  const invalid = parseNetworkRequest(ga('generate_lead', {}, 0, { actionId: 'invalid-submit' })).events;
  const unwanted = analyzeTagEvents(invalid, { expectations: [{ vendor: 'ga4', eventName: 'generate_lead', count: 0, actionId: 'invalid-submit' }] });
  assert.equal(unwanted[0].code, 'unexpected_event_count');
  assert.equal(unwanted[0].expected, 0);
});

test('all serialized evidence omits query PII, click IDs, credentials and raw payloads', () => {
  const privateValues = ['person@example.com', 'private-name', 'private-password', 'private-click', 'private-session', 'private-ref'];
  const { events } = parseNetworkRequests([ga('generate_lead', {
    dl: 'https://user:private-password@example.com/pages/contact?email=person@example.com&gclid=private-click#private-ref',
    dr: 'https://example.com/?session=private-session',
    'ep.email': 'person@example.com', 'ep.first_name': 'private-name', 'ep.form_name': 'person@example.com',
    cid: 'private-session', gclid: 'private-click',
  })]);
  const output = JSON.stringify({ events, findings: analyzeTagEvents(events) });
  for (const secret of privateValues) assert.equal(output.includes(secret), false, secret);
  assert.equal(events[0].pageUrl, page);
});

test('redaction handles personal path identifiers and excludes unsafe properties', () => {
  assert.equal(redactPageUrl('https://example.com/customers/123456/orders?token=abc'), 'https://example.com/customers/[redacted]/orders');
  assert.equal(redactPageUrl('https://example.com/user/person%40example.com'), 'https://example.com/user/[redacted]');
  assert.equal(redactPageUrl('javascript:alert(1)'), undefined);
  assert.deepEqual(sanitizeProperties({ email: 'person@example.com', value: 'abc', currency: 'USD', form_name: 'Contact_Form' }).properties, { currency: 'USD', form_name: 'Contact_Form' });
});

test('custom GA4 collectors require explicit host allowlist', () => {
  const request = { url: 'https://tags.example.com/g/collect?tid=G-TEST123&en=purchase', timestamp: 0 };
  assert.equal(parseNetworkRequest(request).events.length, 0);
  assert.equal(parseNetworkRequest(request, { collectorHosts: { 'tags.example.com': 'ga4' } }).events.length, 1);
});

test('inventory preserves sandbox frames and distinct identical request evidence', () => {
  const main = { url: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123', pageUrl: page, frameUrl: page, timestamp: 0 };
  const sandbox = { ...main, frameUrl: 'https://example.com/web-pixels/sandbox?email=private@example.com' };
  const result = parseNetworkRequests([main, sandbox, ga(), ga()]);
  assert.equal(result.containers.length, 2);
  assert.equal(result.containers[1].frameUrl, 'https://example.com/web-pixels/sandbox');
  assert.notEqual(result.events[0].id, result.events[1].id);
  assert.doesNotMatch(JSON.stringify(result), /private@example.com/);
});

test('unrecognized destination is inventory advice, not an automatic error', () => {
  const { events } = parseNetworkRequests([ga('page_view', { tid: 'G-OTHER' })]);
  const findings = analyzeTagEvents(events, { knownDestinations: { ga4: ['G-TEST123'] } });
  assert.equal(findings[0].code, 'unrecognized_destination');
  assert.equal(findings[0].severity, 'info');
  assert.equal(findings[0].actual, 'G-OTHER');
  assert.deepEqual(findings[0].expected, ['G-TEST123']);
});

test('separate synthetic visits and devices do not merge reused fixture IDs', () => {
  const { events } = parseNetworkRequests([
    ga('purchase', { 'ep.transaction_id': 'FIXTURE-1' }, 1000, { visitId: 'visit-one', device: 'desktop' }),
    ga('purchase', { 'ep.transaction_id': 'FIXTURE-1' }, 1100, { visitId: 'visit-two', device: 'desktop' }),
    ga('purchase', { 'ep.transaction_id': 'FIXTURE-1' }, 1200, { visitId: 'visit-three', device: 'mobile' }),
  ]);
  const findings = analyzeTagEvents(events, { expectations: [
    { vendor: 'ga4', eventName: 'purchase', visitId: 'visit-one', count: 1 },
    { vendor: 'ga4', eventName: 'purchase', visitId: 'visit-two', count: 1 },
    { vendor: 'ga4', eventName: 'purchase', visitId: 'visit-three', count: 1 },
  ] });
  assert.equal(findings.length, 0);
});

test('a same-visit cross-frame conversion duplicate stays visible', () => {
  const { events } = parseNetworkRequests([
    ga('purchase', { 'ep.transaction_id': 'ORDER-1' }, 1000, { visitId: 'one', frameId: 'main', frameUrl: page }),
    ga('purchase', { 'ep.transaction_id': 'ORDER-1' }, 1100, { visitId: 'one', frameId: 'sandbox', frameUrl: 'https://example.com/web-pixels/sandbox' }),
  ]);
  const findings = analyzeTagEvents(events);
  assert.equal(findings[0].code, 'duplicate_conversion_emission');
  assert.deepEqual(findings[0].evidence.map((item) => item.frameId), ['main', 'sandbox']);
});

test('container inventory keeps independent visits separate', () => {
  const container = { url: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123', pageUrl: page, frameUrl: page, timestamp: 0 };
  const { containers } = parseNetworkRequests([{ ...container, visitId: 'one', device: 'desktop' }, { ...container, visitId: 'two', device: 'mobile' }]);
  assert.equal(containers.length, 2);
  assert.deepEqual(containers.map((item) => item.visitId), ['one', 'two']);
});

test('known Google Ads alternate collectors classify events and normalize companions', () => {
  const query = `label=AbCdef&value=49&currency_code=USD&oid=ORDER-1&url=${encodeURIComponent(page)}`;
  for (const [host, path] of [
    ['googleads.g.doubleclick.net', 'viewthroughconversion'],
    ['pagead2.googlesyndication.com', 'conversion'],
  ]) {
    const { events } = parseNetworkRequests([
      { url: `https://${host}/pagead/${path}/123456789/?${query}`, timestamp: 1000 },
      { url: `https://www.google.com/pagead/1p-conversion/123456789/?${query}`, timestamp: 1100 },
    ]);
    assert.equal(events.length, 2);
    assert.equal(events[0].vendor, 'google_ads');
    assert.equal(events[0].destinationId, 'AW-123456789');
    assert.equal(events[0].isConversion, true);
    assert.equal(analyzeTagEvents(events, { expectations: [{ vendor: 'google_ads', eventName: 'conversion', count: 1 }] }).length, 0);
  }
  const remarketing = parseNetworkRequest({ url: 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/?data=event%3Dpage_view', timestamp: 0 }).events[0];
  assert.equal(remarketing.isConversion, false);
  assert.equal(remarketing.eventName, 'remarketing');
});

test('Google Ads collector recognition uses exact known hosts or an explicit custom allowlist', () => {
  for (const host of ['arbitrary.doubleclick.net', 'googleads.g.doubleclick.net.evil.example', 'arbitrary.googlesyndication.com']) {
    assert.equal(parseNetworkRequest({ url: `https://${host}/pagead/conversion/123456789/?label=AbCdef`, timestamp: 0 }).events.length, 0, host);
  }
  const custom = { url: 'https://tags.example.com/pagead/conversion/123456789/?label=AbCdef', timestamp: 0 };
  assert.equal(parseNetworkRequest(custom).events.length, 0);
  assert.equal(parseNetworkRequest(custom, { collectorHosts: { 'tags.example.com': 'google_ads' } }).events[0].vendor, 'google_ads');
});

test('Shopify analytics.google.com GA4 collector decodes query and batched events', () => {
  const get = parseNetworkRequest({ url: `https://analytics.google.com/g/collect?tid=G-EXAMPLE&en=page_view&dl=${encodeURIComponent(page)}`, timestamp: 1000 });
  assert.equal(get.events[0].vendor, 'ga4');
  assert.equal(get.events[0].destinationId, 'G-EXAMPLE');
  assert.equal(get.events[0].eventName, 'page_view');
  const batch = parseNetworkRequest({ url: `https://analytics.google.com/g/collect?tid=G-EXAMPLE&dl=${encodeURIComponent(page)}`, method: 'POST', postData: 'en=page_view\nen=purchase&ep.transaction_id=ORDER-1&epn.value=99', timestamp: 2000 });
  assert.deepEqual(batch.events.map((item) => item.eventName), ['page_view', 'purchase']);
  assert.equal(batch.events[1].properties.value, 99);
  assert.match(batch.events[1].identity.transaction_id, /^sha256:/);
  for (const host of ['analytics.google.com.evil.example', 'arbitrary.google.com']) {
    assert.equal(parseNetworkRequest({ url: `https://${host}/g/collect?tid=G-EXAMPLE&en=page_view`, timestamp: 0 }).events.length, 0, host);
  }
});
