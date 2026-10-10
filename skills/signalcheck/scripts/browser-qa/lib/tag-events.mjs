import { createHash } from 'node:crypto';

/**
 * Tracking request normalization. Browser collector formats are deliberately
 * handled as observed wire formats, not as a promise of a vendor's public API.
 * Raw URLs, bodies, cookies, client IDs and user data never leave this module.
 * First-party/custom collector hosts require explicit collectorHosts mapping.
 */
const GA_CONVERSIONS = new Set(['purchase', 'generate_lead', 'form_submit', 'sign_up', 'submit_application', 'book_appointment', 'appointment_scheduled']);
const META_CONVERSIONS = new Set(['Purchase', 'Lead', 'CompleteRegistration', 'Subscribe', 'Schedule', 'SubmitApplication', 'Contact']);
const ID_KEYS = new Set(['transaction_id', 'event_id', 'submission_id', 'form_submission_id', 'order_id']);
const NUMERIC_KEYS = new Set(['value', 'tax', 'shipping', 'quantity', 'item_count', 'engagement_time_msec']);
const ENUM_KEYS = new Set(['currency', 'content_type', 'form_id', 'form_name', 'event_category']);
const ADS_COLLECTOR_HOSTS = new Set(['googleadservices.com', 'www.googleadservices.com', 'google.com', 'www.google.com', 'googleads.g.doubleclick.net', 'pagead2.googlesyndication.com']);
const PAIR_WINDOW_MS = 1500;

export function hashIdentity(value) {
  return `sha256:${createHash('sha256').update(`signalcheck:v1:${String(value)}`).digest('hex')}`;
}

function hasLikelyPii(value) {
  return /@|\b(?:\d[\s()+.-]*){7,}\b|(?:email|password|token|secret)=/i.test(String(value));
}

function safeToken(value, max = 100) {
  const text = String(value ?? '');
  return text && text.length <= max && /^[A-Za-z0-9_.:-]+$/.test(text) && !hasLikelyPii(text) ? text : undefined;
}

/** Strip all query/fragment/credentials, plus common identity-bearing path parts. */
export function redactPageUrl(value) {
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    const path = url.pathname.split('/').map((part, index, parts) => {
      let decoded;
      try { decoded = decodeURIComponent(part); } catch { return '[redacted]'; }
      const prior = parts[index - 1] ?? '';
      if (hasLikelyPii(decoded) || decoded.length > 120 || /^(?:token|email|phone|password|auth|session|customer|customers|account|accounts|user|users|order|orders|checkout|checkouts|address|addresses)$/i.test(prior)) return '[redacted]';
      return part;
    }).join('/');
    return `${url.origin}${path}`;
  } catch { return undefined; }
}

/** An explicit whitelist: marketing names or arbitrary payload fields are excluded. */
export function sanitizeProperties(input = {}) {
  const properties = {};
  const identity = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.replace(/^epn?\./, '');
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    if (ID_KEYS.has(key)) {
      identity[key] = hashIdentity(rawValue);
    } else if (NUMERIC_KEYS.has(key)) {
      const n = Number(rawValue);
      if (Number.isFinite(n)) properties[key] = n;
    } else if (key === 'currency') {
      if (/^[A-Z]{3}$/.test(String(rawValue).toUpperCase())) properties.currency = String(rawValue).toUpperCase();
    } else if (ENUM_KEYS.has(key)) {
      // Form names can accidentally be populated with submitted personal data.
      const token = safeToken(rawValue, 80);
      if (token) properties[key] = token;
    }
  }
  return { properties, identity };
}

function timestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (value.trim() && Number.isFinite(numeric)) return numeric;
    const date = Date.parse(value);
    if (Number.isFinite(date)) return date;
  }
  return null;
}

function transport(request, fallback = 'browser') {
  const value = String(request.transport ?? request.channel ?? request.source ?? fallback).toLowerCase();
  if (/^(server|server-side|capi|measurement_protocol)$/.test(value)) return 'server';
  if (/^(browser|client|client-side|pixel)$/.test(value)) return 'browser';
  return 'unknown';
}

function bodyText(request) {
  const data = request.postData ?? request.body;
  if (data === undefined || data === null) return '';
  if (typeof data === 'string') return data;
  if (data instanceof URLSearchParams || Buffer.isBuffer(data)) return data.toString();
  return JSON.stringify(data);
}

function bodyObject(text) {
  try { return JSON.parse(text); } catch { return undefined; }
}

function mergedParams(base, body) {
  const merged = new URLSearchParams(base);
  for (const [key, value] of new URLSearchParams(body)) merged.set(key, value);
  return merged;
}

function publicDestination(vendor, value) {
  const raw = String(value ?? '');
  if (vendor === 'ga4' && /^G-[A-Z0-9]+$/i.test(raw)) return raw.toUpperCase();
  if (vendor === 'meta' && /^\d{5,30}$/.test(raw)) return raw;
  if (vendor === 'google_ads' && /^(?:AW-)?\d{4,30}$/.test(raw)) return `AW-${raw.replace(/^AW-/, '')}`;
  return 'unknown';
}

function contextFor(request) {
  const ctx = {};
  for (const key of ['actionId', 'visitId', 'frameId', 'device', 'consentState']) {
    const token = safeToken(request[key]);
    if (token) ctx[key] = token;
  }
  return ctx;
}

function event(request, url, fields, index) {
  const ctx = contextFor(request);
  const eventName = safeToken(fields.eventName, 80) ?? 'unknown';
  const value = {
    schemaVersion: 1,
    vendor: fields.vendor,
    destinationId: publicDestination(fields.vendor, fields.destinationId),
    eventName,
    timestamp: timestamp(request.timestamp ?? request.time),
    pageUrl: redactPageUrl(fields.pageUrl ?? request.pageUrl),
    frameUrl: redactPageUrl(request.frameUrl),
    transport: transport(request, fields.transport),
    properties: fields.properties ?? {},
    identity: fields.identity ?? {},
    isConversion: fields.isConversion ?? (fields.vendor === 'ga4' ? GA_CONVERSIONS.has(eventName) : META_CONVERSIONS.has(eventName)),
    requestRole: fields.requestRole ?? 'event',
    ...ctx,
    evidence: { endpoint: redactPageUrl(`${url.origin}${url.pathname}`), method: String(request.method ?? 'GET').toUpperCase(), batchIndex: index },
  };
  if (fields.conversionLabel) value.conversionLabel = safeToken(fields.conversionLabel, 120) ?? hashIdentity(fields.conversionLabel);
  value.id = `evt_${createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20)}`;
  return value;
}

function gaFields(params) {
  const input = Object.fromEntries(params);
  const sanitized = sanitizeProperties(input);
  return { vendor: 'ga4', destinationId: params.get('tid') ?? params.get('measurement_id'), eventName: params.get('en'), pageUrl: params.get('dl'), ...sanitized };
}

/**
 * request: { url, method, postData, timestamp, actionId, pageUrl, device,
 * consentState, transport }. collectorHosts maps custom hosts to ga4/meta/google_ads.
 * Returns {events, containers, warnings}; a GA4 batch can yield several events.
 */
export function parseNetworkRequest(request, options = {}) {
  const result = { events: [], containers: [], warnings: [] };
  let url;
  try { url = new URL(request.url); } catch { return result; }
  const host = url.hostname.toLowerCase();
  const customVendor = options.collectorHosts?.[host];
  const path = url.pathname.replace(/\/+$/, '');
  const query = url.searchParams;
  const body = bodyText(request);
  const add = (fields) => result.events.push(event(request, url, fields, result.events.length));

  if ((host === 'www.googletagmanager.com' || host === 'googletagmanager.com') && /\/(?:gtm\.js|ns\.html)$/.test(path)) {
    const containerId = query.get('id');
    if (/^GTM-[A-Z0-9]+$/i.test(containerId ?? '')) {
      result.containers.push({ vendor: 'gtm', containerId: containerId.toUpperCase(), timestamp: timestamp(request.timestamp), pageUrl: redactPageUrl(request.pageUrl), frameUrl: redactPageUrl(request.frameUrl), ...contextFor(request), endpoint: `${url.origin}${url.pathname}` });
    }
    return result;
  }

  if ((/(^|\.)google-analytics\.com$/.test(host) || host === 'analytics.google.com' || customVendor === 'ga4') && /\/(?:g|mp|debug\/mp)\/collect$/.test(path)) {
    if (/(?:^|\/)mp\/collect$/.test(path)) {
      const payload = bodyObject(body);
      for (const item of Array.isArray(payload?.events) ? payload.events : []) {
        const properties = item.params ?? {};
        add({ vendor: 'ga4', destinationId: query.get('measurement_id') ?? query.get('tid'), eventName: item.name, pageUrl: properties.page_location, transport: 'server', ...sanitizeProperties(properties) });
      }
      if (!result.events.length) result.warnings.push({ code: 'unparsed_ga4_measurement_protocol', vendor: 'ga4', message: 'No valid events array found in a Measurement Protocol request.' });
    } else {
      // GA4 POST bodies can contain newline-delimited URL-encoded events.
      const lines = body.trim() ? body.trim().split(/\r?\n/).filter(Boolean) : [''];
      for (const line of lines) add(gaFields(mergedParams(query, line)));
    }
  } else if ((/(^|\.)facebook\.com$/.test(host) || customVendor === 'meta') && /^\/tr$/.test(path)) {
    const params = mergedParams(query, body);
    const custom = bodyObject(params.get('cd') ?? '') ?? {};
    for (const [key, value] of params) {
      const match = /^cd\[(.+)\]$/.exec(key);
      if (match) custom[match[1]] = value;
    }
    if (params.get('eid')) custom.event_id = params.get('eid');
    add({ vendor: 'meta', destinationId: params.get('id'), eventName: params.get('ev'), pageUrl: params.get('dl'), ...sanitizeProperties(custom) });
  } else if (host === 'graph.facebook.com' && /\/\d+\/events$/.test(path)) {
    const payload = bodyObject(body) ?? bodyObject(new URLSearchParams(body).get('data'));
    const records = Array.isArray(payload) ? payload : payload?.data;
    const pixelId = /\/(\d+)\/events$/.exec(path)?.[1];
    for (const item of Array.isArray(records) ? records : []) {
      add({ vendor: 'meta', destinationId: pixelId, eventName: item.event_name, pageUrl: item.event_source_url, transport: 'server', ...sanitizeProperties({ ...(item.custom_data ?? {}), event_id: item.event_id }) });
    }
    if (!result.events.length) result.warnings.push({ code: 'unparsed_meta_capi', vendor: 'meta', message: 'No valid events array found in a Conversions API request.' });
  } else if ((ADS_COLLECTOR_HOSTS.has(host) || customVendor === 'google_ads') && /\/pagead\/(?:conversion|1p-conversion|viewthroughconversion)\/\d+$/.test(path)) {
    const params = mergedParams(query, body);
    const conversionId = /\/(\d+)$/.exec(path)?.[1];
    const remarketing = params.get('remarketing_only') === '1' || (/viewthroughconversion/.test(path) && !params.get('label'));
    add({
      vendor: 'google_ads', destinationId: conversionId, eventName: remarketing ? 'remarketing' : 'conversion', pageUrl: params.get('url'),
      isConversion: !remarketing,
      conversionLabel: params.get('label') ?? undefined,
      requestRole: remarketing ? 'remarketing' : /1p-conversion/.test(path) ? 'first_party_conversion' : 'conversion',
      ...sanitizeProperties({ value: params.get('value'), currency: params.get('currency_code') ?? params.get('currency'), transaction_id: params.get('oid') ?? params.get('transaction_id'), event_id: params.get('event_id') }),
    });
  }
  for (const item of result.events) {
    if (item.destinationId === 'unknown') result.warnings.push({ code: 'missing_destination', vendor: item.vendor, message: 'Tracking request has a missing or unrecognized destination ID.' });
    if (item.eventName === 'unknown') result.warnings.push({ code: 'missing_event_name', vendor: item.vendor, message: 'Tracking request has a missing or unrecognized event name.' });
  }
  return result;
}

export function parseNetworkRequests(requests, options = {}) {
  const result = { events: [], containers: [], warnings: [] };
  for (const [requestIndex, request] of requests.entries()) {
    const parsed = parseNetworkRequest(request, options);
    for (const item of parsed.events) {
      item.evidence.requestIndex = requestIndex;
      item.id = `${item.id}_${requestIndex}`;
    }
    for (const key of Object.keys(result)) result[key].push(...parsed[key]);
  }
  // Separate repeated container loads from the inventory, preserving load count.
  const containers = new Map();
  for (const container of result.containers) {
    const key = `${container.containerId}|${container.pageUrl ?? ''}|${container.frameUrl ?? ''}|${container.frameId ?? ''}|${container.visitId ?? ''}|${container.device ?? ''}|${container.consentState ?? ''}`;
    const prior = containers.get(key);
    if (prior) prior.loadCount += 1;
    else containers.set(key, { ...container, loadCount: 1 });
  }
  result.containers = [...containers.values()];
  return result;
}

function destinationKey(item) {
  return `${item.vendor}|${item.destinationId}|${item.eventName}|${item.conversionLabel ?? ''}`;
}

function inWindow(a, b, windowMs) {
  return Number.isFinite(a.timestamp) && Number.isFinite(b.timestamp) && Math.abs(a.timestamp - b.timestamp) <= windowMs;
}

function compatibleScope(a, b) {
  return ['visitId', 'device', 'consentState'].every((key) => (a[key] ?? '') === (b[key] ?? ''));
}

function compatibleContext(a, b) {
  return compatibleScope(a, b) && (a.actionId ?? '') === (b.actionId ?? '') && (a.pageUrl ?? '') === (b.pageUrl ?? '');
}

function identityMatch(a, b) {
  for (const key of ['submission_id', 'form_submission_id', 'transaction_id', 'order_id', 'event_id']) {
    if (a.identity?.[key] && a.identity[key] === b.identity?.[key]) return key;
  }
  return undefined;
}

function fingerprint(item) {
  return JSON.stringify({ pageUrl: item.pageUrl, properties: item.properties, actionId: item.actionId, visitId: item.visitId, device: item.device, consentState: item.consentState });
}

function evidenceFor(events) {
  return events.map((item) => ({ eventId: item.id, destinationId: item.destinationId, eventName: item.eventName, transport: item.transport, timestamp: item.timestamp, pageUrl: item.pageUrl, frameUrl: item.frameUrl, frameId: item.frameId, actionId: item.actionId, visitId: item.visitId, device: item.device, consentState: item.consentState, properties: item.properties, identity: item.identity, requestRole: item.requestRole, ...item.evidence }));
}

function finding(code, severity, title, items, fields = {}) {
  return { code, severity, title, expected: 1, actual: items.length, confidence: 'medium', eventIds: items.map((item) => item.id), evidence: evidenceFor(items), ...fields };
}

/**
 * Findings concern emission, not the vendor's final attributed conversion count.
 * Count expectations are optional; arbitrary custom events need configured rules.
 */
export function analyzeTagEvents(events, options = {}) {
  const findings = [];
  const duplicateWindowMs = options.duplicateWindowMs ?? 1500;
  const pairWindowMs = options.companionWindowMs ?? PAIR_WINDOW_MS;
  const expectations = options.expectations ?? [];
  const excluded = new Set();
  const grouped = new Map();
  const isConversion = (item) => item.isConversion || (options.conversionEventNames ?? []).includes(item.eventName);
  for (const item of events) {
    const key = destinationKey(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  for (const [vendor, known] of Object.entries(options.knownDestinations ?? {})) {
    const allowed = new Set(Array.isArray(known) ? known : [known]);
    const observed = new Map();
    for (const item of events.filter((entry) => entry.vendor === vendor && !allowed.has(entry.destinationId))) {
      if (!observed.has(item.destinationId)) observed.set(item.destinationId, []);
      observed.get(item.destinationId).push(item);
    }
    for (const [destinationId, items] of observed) findings.push(finding('unrecognized_destination', 'info', 'Tracking destination is absent from the configured inventory', items, {
      expected: [...allowed], actual: destinationId, confidence: 'high',
      cause: 'The request targets a destination not listed in the site inventory; that can be an intentional app or agency integration.',
      suggestion: 'Identify the owner in GTM, Shopify sales channels, app pixels or theme code, then add the intended destination to the inventory or remove a confirmed stale integration.',
    }));
  }

  // A Google Ads tag commonly issues both a primary and 1p companion request.
  // One-to-one matching keeps two independent primary emissions visible.
  for (const group of grouped.values()) {
    if (group[0]?.vendor !== 'google_ads') continue;
    const usedPrimary = new Set();
    for (const companion of group.filter((item) => item.requestRole === 'first_party_conversion')) {
      const primary = group.find((item) => item.requestRole === 'conversion' && !usedPrimary.has(item) && compatibleContext(item, companion) && inWindow(item, companion, pairWindowMs) && JSON.stringify(item.properties) === JSON.stringify(companion.properties) && JSON.stringify(item.identity) === JSON.stringify(companion.identity));
      if (primary) { excluded.add(companion); usedPrimary.add(primary); }
    }
  }

  // Matching browser + server Meta event IDs prepare the normal vendor dedup path.
  // This is not evidence that Meta accepted or successfully deduplicated them.
  for (const group of grouped.values()) {
    if (group[0]?.vendor !== 'meta') continue;
    const usedBrowser = new Set();
    for (const server of group.filter((item) => item.transport === 'server' && item.identity?.event_id)) {
      const browser = group.find((item) => item.transport === 'browser' && !usedBrowser.has(item) && compatibleScope(item, server) && item.identity?.event_id === server.identity.event_id && inWindow(item, server, 48 * 60 * 60 * 1000));
      if (browser) {
        usedBrowser.add(browser); excluded.add(server);
        findings.push(finding('browser_server_dedup_ready', 'info', 'Meta browser/server pair has matching deduplication keys', [browser, server], { actual: 1, confidence: 'high', cause: 'Matching destination, event name and event ID across browser and server.', suggestion: 'Confirm acceptance and deduplication in Meta Test Events; browser evidence alone cannot prove vendor receipt.' }));
      }
    }
  }

  const logicalEvents = events.filter((item) => !excluded.has(item));
  for (const group of grouped.values()) {
    const candidates = group.filter((item) => !excluded.has(item) && isConversion(item));
    const alreadyReported = new Set();
    for (let i = 0; i < candidates.length; i += 1) {
      const first = candidates[i];
      if (alreadyReported.has(first)) continue;
      const matches = [first];
      let matchKey;
      for (let j = i + 1; j < candidates.length; j += 1) {
        const next = candidates[j];
        if (alreadyReported.has(next)) continue;
        const shared = identityMatch(first, next);
        // A shared business identifier can prove repeat emission even after a refresh.
        // An event ID should be unique, while separate action IDs alone don't erase it.
        const sameIdentity = Boolean(shared) && compatibleScope(first, next);
        const sameFallback = !Object.keys(first.identity ?? {}).length && !Object.keys(next.identity ?? {}).length && compatibleContext(first, next) && fingerprint(first) === fingerprint(next) && inWindow(first, next, duplicateWindowMs);
        if (sameIdentity || sameFallback) { matches.push(next); matchKey ??= shared; alreadyReported.add(next); }
      }
      if (matches.length < 2) continue;
      const crossTransport = new Set(matches.map((item) => item.transport)).size > 1;
      if (matchKey) {
        findings.push(finding('duplicate_conversion_emission', 'warning', `${first.vendor} conversion emitted repeatedly with one logical ID`, matches, {
          confidence: 'high',
          cause: `Repeated ${matchKey} for the same destination and event${crossTransport ? ' across browser/server transports' : ' within one transport'}. This proves repeat emission, not double counting in vendor reports.`,
          suggestion: first.vendor === 'meta' && crossTransport
            ? 'Use the same event_id and event_name on the corresponding Pixel and CAPI events, and verify Meta deduplication. A transaction ID alone is insufficient.'
            : first.vendor === 'ga4' && matchKey === 'transaction_id'
              ? 'Inspect GTM, Shopify pixels and server routes for duplicate purchase emitters. Keep transaction_id stable and check GA4 deduplication before concluding revenue is doubled.'
              : 'Inspect competing GTM triggers, hardcoded tags, Shopify app pixels and success-page refresh behavior. Emit once per accepted action and preserve the logical ID.',
        }));
      } else {
        findings.push(finding('suspected_duplicate_conversion', 'warning', `${first.vendor} conversion may be firing twice`, matches, {
          confidence: 'medium', cause: `Identical safe payloads on the same page/action within ${duplicateWindowMs} ms; no logical ID is available.`,
          suggestion: 'Inspect click and successful-submission triggers for overlap. Add a stable submission_id or transaction_id and verify distinct user actions before removing a tag.',
        }));
      }
    }
  }

  for (const expectation of expectations) {
    const keys = ['vendor', 'destinationId', 'eventName', 'actionId', 'visitId', 'pageUrl', 'frameId', 'transport', 'device', 'consentState', 'conversionLabel'];
    const matched = logicalEvents.filter((item) => keys.every((key) => expectation[key] === undefined || item[key] === expectation[key]));
    const min = expectation.count ?? expectation.min ?? 0;
    const max = expectation.count ?? expectation.max ?? Infinity;
    if (matched.length < min || matched.length > max) {
      const missing = matched.length < min;
      findings.push(finding(missing ? 'missing_expected_event' : 'unexpected_event_count', missing ? 'error' : 'warning', missing ? 'Expected tracking event did not fire' : 'Tracking event exceeded the expected count', matched, {
        expected: expectation.count ?? { min, max: Number.isFinite(max) ? max : null }, actual: matched.length, confidence: 'high',
        rule: { ...Object.fromEntries(keys.filter((key) => expectation[key] !== undefined).map((key) => [key, expectation[key]])), ...(expectation.syntheticExclusion ? { syntheticExclusion: true } : {}) },
        cause: 'Observed logical event count differs from the configured journey contract.',
        suggestion: missing ? 'Check consent state, the relevant GTM trigger and destination ID, successful form completion, and blocked requests. Confirm the rule describes this journey.' : 'Check duplicate trigger paths and whether this journey intentionally includes repeated actions. Count requests only after known companion/dedup pairs are normalized.',
      }));
    }
  }
  return findings;
}
