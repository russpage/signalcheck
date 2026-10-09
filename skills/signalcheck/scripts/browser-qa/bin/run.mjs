#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseNetworkRequests, analyzeTagEvents, redactPageUrl } from '../lib/tag-events.mjs';
import { consoleCategory, expectedFormResult, invalidValidationResult, backendWriteDecision, validateSteps } from '../lib/browser-checks.mjs';

const TAG_URL = /googletagmanager|google-analytics|analytics\.google|googleadservices|doubleclick|facebook\.(?:com|net)|connect\.facebook|klaviyo|tiktok|hotjar|clarity\.ms|segment\.(?:io|com)|customer(?:\.io|io)|adroll|pinterest|bing\.com|linkedin|snapchat|attentivemobile|yotpo/i;
const PII_KEY = /(?:email|phone|mobile_number|first.?name|last.?name|full.?name|address|password|passwd|secret|token|authorization|cookie|user_id|customer_id|visitor_id|client_id|session_id|gclid|fbclid|msclkid|ttclid|_fbp|_fbc|transaction_id|order_id)/i;
const HELP = `SignalCheck website forms and tracking QA\n\nUsage:\n  node bin/run.mjs --config config/site.json --output reports/current\n  node bin/run.mjs --config config/site.json --previous reports/prior/report.json\n\nOptions:\n  --config PATH       Site configuration JSON (default: config/example.json)\n  --output DIR        Reports and masked screenshots\n  --previous PATH     Previous comparable report\n  --allow-invalid     Run enabled invalid-validation journeys with write blocking\n  --allow-submit      Run enabled submission journeys with confirmed QA routing\n  --help              Print this help\n\nDefault: bounded configured pages, consent controls and reviewed navigation\nsteps; no form filling/submission. Browser page loads can emit real analytics.\nInvalid-input tests block backend writes and form action URLs. Successful\nsubmissions additionally require enabled=true, confirmed synthetic routing,\nverified success selector/URL and event contracts. Purchases and destructive\nactions are unsupported. Event claims require this actual browser run.\n`;

function cli(argv) {
  const args = { config: 'config/example.json', output: null, previous: null, allowSubmit: false, allowInvalid: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') return { help: true };
    if (flag === '--allow-submit') { args.allowSubmit = true; continue; }
    if (flag === '--allow-invalid') { args.allowInvalid = true; continue; }
    const key = { '--config': 'config', '--output': 'output', '--previous': 'previous' }[flag];
    if (!key) throw new Error(`Unknown option: ${flag}`);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${flag}`);
    args[key] = argv[++i];
  }
  return args;
}

function scrubString(input) {
  return String(input).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
    .replace(/([?&](?:email|phone|api_key|access_token|token|secret|password|authorization|key)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g, '[phone-redacted]');
}

function safeUrl(input) {
  const sanitized = redactPageUrl(input);
  if (sanitized) return sanitized;
  try {
    const url = new URL(input);
    url.username = ''; url.password = ''; url.hash = ''; url.search = '';
    url.pathname = scrubString(decodeURI(url.pathname));
    return url.toString();
  } catch { return scrubString(input); }
}

function redact(value, depth = 0, key = '') {
  if (PII_KEY.test(key)) return '[redacted]';
  if (depth > 8) return '[depth-limit]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? safeUrl(value) : scrubString(value).slice(0, 8000);
  if (Array.isArray(value)) return value.slice(0, 300).map(item => redact(item, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 100).map(([k, v]) => [k, redact(v, depth + 1, k)]));
  return `[${typeof value}]`;
}

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16); }
function displayMetadata(value) {
  const text = String(value ?? '');
  return { hash: hash(text), length: text.length };
}
function contractSignature(config, task, expectations) {
  // Only this opaque signature is stored. A changed form, selector, step,
  // journey or observation window must never "resolve" an old contract failure.
  return hash({ version: 2, config, task, expectations });
}
function progressLine(task) {
  return `Testing ${task.type}: ${safeUrl(task.url)} (${scrubString(task.device)}, ${task.consentState})\n`;
}
function safeError(error) {
  return { name: String(error?.name ?? 'Error'), code: typeof error?.code === 'string' ? error.code : null,
    category: /timeout/i.test(error?.message ?? '') ? 'timeout' : /selector|locator/i.test(error?.message ?? '') ? 'selector-or-locator' : 'operation-failed',
    messageHash: hash(String(error?.message ?? error)) };
}
function safeDataLayer(payload) {
  if (!payload || typeof payload !== 'object') return { valueType: typeof payload };
  const command = ['config', 'event', 'consent', 'set', 'js'].includes(payload[0]) ? payload[0] : null;
  const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value) ? value : null;
  const parameters = command ? payload[2] : payload;
  const commerce = parameters?.ecommerce ?? parameters ?? {};
  const consent = {};
  for (const key of ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization', 'functionality_storage', 'personalization_storage', 'security_storage']) {
    if (['granted', 'denied'].includes(parameters?.[key])) consent[key] = parameters[key];
  }
  return { keyCount: Object.keys(payload).length, command,
    eventName: token(payload.event ?? (command === 'event' ? payload[1] : null)),
    destinationId: command === 'config' && /^(?:G-|GTM-|AW-)[A-Z0-9]+$/i.test(String(payload[1])) ? payload[1] : null,
    consentMode: command === 'consent' && ['default', 'update'].includes(payload[1]) ? payload[1] : null,
    consentSignals: consent,
    currency: typeof commerce.currency === 'string' && /^[A-Z]{3}$/.test(commerce.currency) ? commerce.currency : null,
    value: Number.isFinite(Number(commerce.value)) && commerce.value !== null && commerce.value !== '' ? Number(commerce.value) : null,
    itemCount: Array.isArray(commerce.items) ? commerce.items.length : null,
    transactionHash: commerce.transaction_id ? hash(String(commerce.transaction_id)) : null,
    hasUserData: Boolean(parameters?.user_data || parameters?.user_properties || parameters?.user_id),
  };
}
function normalizeFinding(entry) {
  const severity = { error: 'high', warning: 'medium', warn: 'medium' }[entry.severity] ?? entry.severity ?? 'info';
  return { ...entry, severity, ...(severity !== entry.severity ? { sourceSeverity: entry.severity } : {}) };
}
function fileSlug(value) { return String(value).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100); }
function numberOption(value, fallback, min, max) {
  return Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
}
function selectors(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string');
  if (value?.selector) return selectors(value.selector);
  return [];
}

function expectation(raw, actionId) {
  const aliases = { google_analytics: 'ga4', googleAnalytics: 'ga4', meta: 'meta', facebook: 'meta', google_ads: 'google_ads', googleAds: 'google_ads' };
  const vendor = raw.vendor ?? raw.provider;
  const result = { ...raw, vendor: aliases[vendor] ?? vendor, eventName: raw.eventName ?? raw.event };
  delete result.provider; delete result.event;
  if (actionId && !result.actionId) result.actionId = actionId;
  return result;
}

function pageExpectations(config, consentState, device, pageConfig = {}) {
  const source = [...(config.expectedPageviews ?? config.expectations?.pageviews ?? []), ...(config.expectedPageEvents ?? []), ...(pageConfig.expectedEvents ?? [])];
  const list = Array.isArray(source) ? source : [];
  return list.filter(item => (!item.consentStates || item.consentStates.includes(consentState)) && (!item.devices || item.devices.includes(device)))
    .map(item => expectation(item));
}

function finding(code, severity, title, suggestion, extra = {}) {
  return { code, severity, title, suggestion, confidence: 1, ...extra };
}

function validateConfig(config) {
  if (!Array.isArray(config.pages) || config.pages.length === 0) throw new Error('config.pages must contain at least one page.');
  if (config.pages.length > 50) throw new Error('At most 50 configured pages are allowed per run; split larger inventories into batches.');
  const pages = config.pages.map((p, index) => typeof p === 'string' ? { url: p, label: `Page ${index + 1}` } : p);
  const journeys = Array.isArray(config.journeys) ? config.journeys : [];
  if (journeys.length > 30) throw new Error('At most 30 journeys are allowed per run.');
  const origins = new Set();
  for (const page of pages) {
    const url = new URL(page.url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`Unsupported page protocol: ${url.protocol}`);
    origins.add(url.origin);
  }
  const allowedOrigins = new Set(config.allowedOrigins ?? [...origins]);
  for (const entry of [...pages, ...journeys]) {
    const url = new URL(entry.url);
    if (!allowedOrigins.has(url.origin)) throw new Error(`URL origin is outside allowedOrigins: ${url.origin}`);
  }
  const devices = config.devices ?? ['desktop'];
  const consentStates = config.consentStates ?? ['unset'];
  if (!Array.isArray(devices) || !devices.length) throw new Error('config.devices must be a nonempty array.');
  if (!Array.isArray(consentStates) || !consentStates.length || consentStates.some(s => !['unset', 'accepted', 'declined'].includes(s))) {
    throw new Error('config.consentStates must contain unset, accepted, and/or declined.');
  }
  const ids = new Set();
  for (const page of pages) {
    validateSteps(page.steps);
    for (const form of page.expectedForms ?? []) if (!form.selector) throw new Error('Every expected form needs selector.');
    for (const assertion of page.assertions ?? []) if (!assertion.selector) throw new Error('Every page assertion needs selector.');
  }
  for (const journey of journeys) {
    if (!journey.id || ids.has(journey.id)) throw new Error('Every journey needs a unique id.');
    ids.add(journey.id);
    if (journey.kind && !['submission', 'invalid-validation'].includes(journey.kind)) throw new Error(`Unsupported journey kind: ${journey.kind}`);
    if (journey.enabled && (!journey.formSelector || !Array.isArray(journey.fields))) throw new Error(`Journey ${journey.id} needs formSelector and fields.`);
    if (journey.enabled && /purchase|checkout|place.?order|delete|unsubscribe|cancel.?order/i.test(`${journey.id} ${journey.kind ?? ''} ${journey.submitSelector ?? ''}`)) {
      throw new Error(`Journey ${journey.id} appears transactional or destructive. This form tester does not execute it.`);
    }
  }
  const planned = pages.length * devices.length * consentStates.length + journeys.filter(j => j.enabled).reduce((sum, j) => sum + (j.devices ?? devices).length * (j.consentStates ?? consentStates).length, 0);
  if (planned > numberOption(config.maxVisits, 200, 1, 200)) throw new Error('Planned browser visits exceed maxVisits (maximum 200).');
  return { pages, journeys, devices, consentStates };
}

async function getInventory(page) {
  const frames = await Promise.all(page.frames().map(async (frame, frameIndex) => {
    const frameUrl = safeUrl(frame.url());
    try {
      const content = await frame.evaluate(() => {
    const forms = [...document.forms].map((form, index) => ({
      index, id: form.getAttribute('id') || null, name: form.getAttribute('name') || null,
      action: form.action, method: form.method,
      selector: form.getAttribute('id') ? `#${CSS.escape(form.getAttribute('id'))}` : null,
      visible: Boolean(form.getClientRects().length),
      fields: [...form.elements].map(el => ({ tag: el.tagName.toLowerCase(), type: el.type ?? null, name: el.name || null,
        id: el.id || null, required: Boolean(el.required), disabled: Boolean(el.disabled),
        hasAccessibleLabel: Boolean(el.labels?.length || el.getAttribute('aria-label')?.trim() || el.getAttribute('aria-labelledby')?.trim() || (['submit','button','reset'].includes(el.type) && el.value)),
        autocomplete: el.autocomplete || null, hidden: el.type === 'hidden' || !el.getClientRects().length })),
    }));
    const tags = /googletagmanager|google-analytics|connect\.facebook|facebook\.net|klaviyo|tiktok|hotjar|clarity|segment|customerio|adroll|pinterest|bing|linkedin|snapchat|attentivemobile|yotpo|gtag|GTM-|G-[A-Z0-9]+|AW-\d+/i;
    const tagScripts = [...document.scripts].filter(script => tags.test(script.src || script.textContent || '')).map(script => ({
      src: script.src || null, id: script.id || null, type: script.type || 'text/javascript', inline: !script.src,
      trackingIds: [...new Set((`${script.src} ${script.textContent}`).match(/\b(?:GTM-[A-Z0-9]+|G-[A-Z0-9]+|AW-\d+)\b/g) ?? [])],
    }));
    let dataLayer = [];
    try { dataLayer = JSON.parse(JSON.stringify(Array.isArray(window.dataLayer) ? window.dataLayer.slice(-300) : [])); } catch { /* Nonserializable entries are also captured by the push hook. */ }
        const text = document.body?.innerText ?? '';
        const providerFailures = [...new Set((text.match(/This form is currently unavailable!?|This form is disabled\.?|This form has been disabled\.?|Form not found\.?|This form has expired\.?/gi) ?? []))];
        return { forms, tagScripts, dataLayer, providerFailures, title: document.title,
          dataLayerHookPresent: Boolean(window.dataLayer?.push?.__websiteQAHook) };
      });
      return { frameIndex, frameUrl, frameName: frame.name(), isMainFrame: frame === page.mainFrame(), status: 'inspected', ...content };
    } catch (error) {
      return { frameIndex, frameUrl, frameName: frame.name(), isMainFrame: frame === page.mainFrame(), status: 'unavailable', error: safeError(error), forms: [], tagScripts: [], dataLayer: [], providerFailures: [] };
    }
  }));
  return {
    title: frames.find(f => f.isMainFrame)?.title ?? '',
    frames: frames.map(({ forms, tagScripts, dataLayer, providerFailures, ...metadata }) => metadata),
    forms: frames.flatMap(f => f.forms.map(form => ({ ...form, frameUrl: f.frameUrl, frameIndex: f.frameIndex }))),
    tagScripts: frames.flatMap(f => f.tagScripts.map(script => ({ ...script, frameUrl: f.frameUrl, frameIndex: f.frameIndex }))),
    dataLayer: frames.flatMap(f => f.dataLayer.map(value => ({ value, frameUrl: f.frameUrl, frameIndex: f.frameIndex }))),
    providerFailures: frames.flatMap(f => f.providerFailures.map(text => ({ text, frameUrl: f.frameUrl }))),
  };
}

async function drain(pending) {
  // Event handlers may enqueue one more capture while an earlier one resolves.
  for (let round = 0; round < 5 && pending.size; round++) await Promise.allSettled([...pending]);
}

function screenshotMasks(page, config) {
  const selector = ['input:visible', 'textarea:visible', '[contenteditable]:visible', ...(config.privacySelectors ?? [])].join(',');
  return page.frames().map(frame => frame.locator(selector));
}

function shouldCaptureScreenshot(task, config) {
  return (!Array.isArray(config.screenshotDevices) || config.screenshotDevices.includes(task.device)) &&
    (!Array.isArray(config.screenshotConsentStates) || config.screenshotConsentStates.includes(task.consentState));
}

async function checkPageContracts(page, pageConfig, visit) {
  visit.assertions = [];
  for (const contract of pageConfig.expectedForms ?? []) {
    const root = contract.frameSelector ? page.frameLocator(contract.frameSelector) : page;
    const form = root.locator(contract.selector).first();
    const observation = { id: contract.id ?? contract.selector, selector: contract.selector, found: await form.count() > 0, visible: false, requiredFields: [], unlabeledFields: 0 };
    if (observation.found) {
      observation.visible = await form.isVisible();
      for (const selector of contract.requiredFields ?? []) {
        const field = form.locator(selector).first();
        const found = await field.count() > 0;
        observation.requiredFields.push({ selector, found, required: found && await field.evaluate(el => el.required === true || el.getAttribute('aria-required') === 'true') });
      }
      if (contract.requireLabels) observation.unlabeledFields = await form.evaluate(el => [...el.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea')].filter(field => !field.labels?.length && !field.getAttribute('aria-label')?.trim() && !field.getAttribute('aria-labelledby')?.trim()).length);
    }
    const result = expectedFormResult(contract, observation);
    visit.assertions.push({ type: 'expected-form', ...observation, status: result ? 'failed' : 'verified' });
    if (result) visit.findings.push(finding(result.code, result.severity, result.title, result.suggestion, { ...result, evidence: [observation] }));
  }
  for (const contract of pageConfig.assertions ?? []) {
    const root = contract.frameSelector ? page.frameLocator(contract.frameSelector) : page;
    const target = root.locator(contract.selector).first();
    const found = await target.count() > 0;
    const observed = { id: contract.id ?? contract.selector, selector: contract.selector, found, visible: found && await target.isVisible(), enabled: found && await target.isEnabled(), accessibleNameMatched: null };
    // Playwright's role locator uses the browser's accessible name computation;
    // only configured label matching is asserted, not overall WCAG compliance.
    if (contract.accessibleName !== undefined && found) {
      const snapshot = await target.ariaSnapshot();
      observed.accessibleNameMatched = snapshot.split('\n')[0].includes(`"${contract.accessibleName}"`);
    }
    const failed = !found || (contract.visible !== undefined && observed.visible !== contract.visible) || (contract.enabled !== undefined && observed.enabled !== contract.enabled) || observed.accessibleNameMatched === false;
    visit.assertions.push({ type: 'selector', ...observed, status: failed ? 'failed' : 'verified' });
    if (failed) visit.findings.push(finding('PAGE_SELECTOR_CONTRACT_FAILED', 'medium', 'A configured page control contract failed', 'Restore the control, correct visibility/enabled state or accessible name, or update a stale selector.', { expected: contract, actual: observed }));
  }
}

async function installWriteGuard(context, config, visit, formActions = [], currentAction = () => null) {
  visit.writeGuard = { active: true, blockedWrites: [] };
  await context.route('**/*', async route => {
    const request = route.request();
    const record = { url: request.url(), method: request.method(), postData: request.postData() };
    const measurement = parseNetworkRequests([record], { collectorHosts: config.collectorHosts ?? {} });
    const decision = backendWriteDecision(record, { formActions, recognizedMeasurement: measurement.events.length > 0 });
    if (decision.startsWith('block')) {
      if (visit.writeGuard.blockedWrites.length < 100) visit.writeGuard.blockedWrites.push({ url: safeUrl(record.url), method: record.method, reason: decision, actionId: currentAction(), timestamp: new Date().toISOString() });
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
}

async function captureVisit(browser, playwrightDevices, config, task, outputDir) {
  const startedAt = new Date().toISOString();
  const visit = { id: task.id, type: task.type, url: safeUrl(task.url), label: task.type === 'journey' ? 'Form journey' : safeUrl(task.url),
    labelMetadata: displayMetadata(task.label ?? task.journey?.id ?? task.url), journeyId: task.journey?.id ?? null,
    device: task.device, consentState: task.consentState, effectiveConsentState: task.consentState === 'unset' ? 'unset' : 'unverified',
    status: 'pending', startedAt, actions: [], forms: [], tagScripts: [], containers: [], dataLayer: [], events: [], findings: [], consoleErrors: [], requestFailures: [] };
  const profile = config.deviceProfiles?.[task.device] ?? (task.device === 'mobile' ? playwrightDevices['Pixel 7'] : { viewport: { width: 1440, height: 1000 } });
  const context = await browser.newContext({ ...profile, locale: config.locale ?? 'en-US', timezoneId: config.timezone ?? 'UTC',
    ignoreHTTPSErrors: false,
    ...(config.browserHeaders ? { extraHTTPHeaders: config.browserHeaders } : {}),
    ...(config.userAgent ? { userAgent: config.userAgent } : {}),
    ...(config.serviceWorkers === 'block' || task.steps?.length || task.journey?.kind === 'invalid-validation' ? { serviceWorkers: 'block' } : {}) });
  let page;
  let actionId = `${task.id}:page-load`;
  const requests = []; const pending = new Set(); const requestRecords = new WeakMap(); const dataLayerEntries = [];
  const stepExpectations = [];
  try {
    await context.exposeBinding('__websiteQAPush', (source, payload) => {
      if (dataLayerEntries.length < 500) dataLayerEntries.push({ timestamp: new Date().toISOString(), actionId, frameUrl: safeUrl(source.frame?.url() ?? ''), value: safeDataLayer(payload) });
    });
    await context.addInitScript(() => {
      const layer = window.dataLayer = window.dataLayer || [];
      if (!Array.isArray(layer)) return;
      const original = layer.push;
      layer.push = function (...entries) {
        for (const entry of entries) {
          try {
            const snapshot = JSON.parse(JSON.stringify(entry, (_key, value) => typeof value === 'function' ? '[function]' : value));
            const delivery = window.__websiteQAPush(snapshot);
            if (delivery?.catch) delivery.catch(() => {});
          } catch { /* Monitoring must not interfere with site execution. */ }
        }
        return original.apply(this, entries);
      };
      layer.push.__websiteQAHook = true;
    });
    page = await context.newPage();
    page.setDefaultTimeout(numberOption(config.actionTimeoutMs, 6000, 1000, 30000));
    context.on('request', request => {
      const capturedAt = new Date().toISOString(); const capturedActionId = actionId; const capturedConsent = visit.effectiveConsentState;
      const operation = Promise.resolve().then(() => {
        if (requests.length >= 10000) { visit.networkCaptureTruncated = true; return; }
        let frameUrl = null;
        try { frameUrl = request.frame().url(); } catch { /* Service worker requests may have no frame. */ }
        const record = { url: request.url(), method: request.method(), postData: request.postData(), timestamp: capturedAt,
          actionId: capturedActionId, visitId: task.id, pageUrl: page.url() === 'about:blank' ? task.url : page.url(), frameUrl,
          device: task.device, consentState: capturedConsent, channel: 'browser', source: 'playwright', httpStatus: null };
        requests.push(record); requestRecords.set(request, record);
      }).catch(error => visit.findings.push(finding('REQUEST_CAPTURE_ERROR', 'low', 'A network request could not be inspected', 'Review the runner and retry this visit.', { evidence: [safeError(error)] })));
      pending.add(operation); operation.finally(() => pending.delete(operation));
    });
    context.on('response', response => {
      const operation = Promise.resolve().then(() => {
        const record = requestRecords.get(response.request());
        if (record) record.httpStatus = response.status();
      });
      pending.add(operation); operation.finally(() => pending.delete(operation));
    });
    context.on('requestfailed', request => {
      if (visit.requestFailures.length < 100) visit.requestFailures.push({ url: safeUrl(request.url()), error: scrubString(request.failure()?.errorText ?? 'Unknown request failure'), actionId });
    });
    page.on('console', message => {
      if (String(message.location().url).startsWith('chrome-extension:')) return;
      if (message.type() === 'error' && visit.consoleErrors.length < 50) visit.consoleErrors.push({ source: 'console', category: consoleCategory(message.text()), messageHash: hash(message.text()), location: { url: safeUrl(message.location().url), lineNumber: message.location().lineNumber, columnNumber: message.location().columnNumber }, actionId });
    });
    page.on('pageerror', error => {
      if (visit.consoleErrors.length < 50) visit.consoleErrors.push({ source: 'pageerror', ...safeError(error), category: consoleCategory(error.message), actionId });
    });
    page.on('popup', popup => {
      visit.findings.push(finding('POPUP_FLOW_UNSUPPORTED', 'medium', 'A configured flow opened another browser page', 'Configure a direct journey for the destination. Popup interactions are not exercised by this runner.', { evidence: [safeUrl(popup.url())] }));
      popup.close().catch(() => {});
    });
    const navigation = await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: numberOption(config.navigationTimeoutMs, 30000, 5000, 120000) });
    visit.httpStatus = navigation?.status() ?? null;
    visit.finalUrl = safeUrl(page.url());
    visit.actions.push({ id: actionId, type: 'navigate', status: 'completed', timestamp: new Date().toISOString() });
    if (visit.httpStatus >= 400) visit.findings.push(finding('PAGE_HTTP_ERROR', 'high', `Page returned HTTP ${visit.httpStatus}`, 'Repair the page or update the configured test URL.', { actual: visit.httpStatus }));

    if (task.consentState !== 'unset') {
      const choices = selectors(task.consentState === 'accepted' ? (config.consent?.acceptSelector ?? config.consent?.accept) : (config.consent?.rejectSelector ?? config.consent?.reject));
      let clicked = false;
      for (const selector of choices) {
        try {
          const control = page.locator(selector).first();
          await control.waitFor({ state: 'visible', timeout: numberOption(config.consentTimeoutMs, 5000, 500, 15000) });
          if (await control.isVisible()) {
            actionId = `${task.id}:consent-${task.consentState}`;
            visit.effectiveConsentState = task.consentState;
            await control.click({ timeout: numberOption(config.actionTimeoutMs, 6000, 1000, 30000) });
            clicked = true;
            visit.actions.push({ id: actionId, type: 'consent', requestedState: task.consentState, status: 'control-clicked', timestamp: new Date().toISOString() });
            break;
          }
        } catch { visit.effectiveConsentState = 'unverified'; /* Try the next configured selector. */ }
      }
      if (!clicked) visit.findings.push(finding('CONSENT_STATE_UNTESTED', 'medium', `The ${task.consentState} consent state was not exercised`,
        choices.length ? 'Update the consent selector or check why the consent control was absent.' : 'Configure the site-specific consent controls before testing accepted and declined states.',
        { expected: task.consentState, actual: 'unverified', confidence: 1 }));
      else visit.findings.push(finding('CONSENT_CONTROL_CLICKED', 'info', `The ${task.consentState} consent control was clicked`,
        'Verify the consent manager state and observed consent signals before treating this as a consent compliance result.', { actual: 'control-clicked; manager state not independently verified' }));
    }

    await page.waitForLoadState('networkidle', { timeout: numberOption(config.networkIdleTimeoutMs, 2500, 500, 15000) }).catch(() => {});
    await page.waitForTimeout(numberOption(config.settleMs, 4000, 500, 30000));
    let inventory = await getInventory(page);
    if (task.steps?.length) {
      await installWriteGuard(context, config, visit, inventory.forms.map(form => form.action), () => actionId);
      for (const step of task.steps) {
        actionId = `${task.id}:step-${step.id}`;
        const root = step.frameSelector ? page.frameLocator(step.frameSelector) : page;
        if (step.type === 'click') {
          const control = root.locator(step.selector).first();
          const isSubmit = await control.evaluate(el => Boolean(el.closest('form') && (el.type === 'submit' || el.tagName === 'BUTTON' && !el.getAttribute('type'))));
          if (isSubmit) throw new Error('Navigation steps cannot click form submission controls; use a gated journey.');
          await control.click();
        } else if (step.type === 'waitForSelector') await root.locator(step.selector).first().waitFor({ state: step.state ?? 'visible' });
        else await page.waitForURL(new RegExp(step.urlPattern));
        await page.waitForTimeout(numberOption(step.settleMs, 500, 0, 10000));
        stepExpectations.push(...(step.expectedEvents ?? []).map(item => expectation(item, actionId)));
        visit.actions.push({ id: actionId, type: step.type, status: 'completed', timestamp: new Date().toISOString() });
      }
      inventory = await getInventory(page);
      if (visit.writeGuard.blockedWrites.length) visit.findings.push(finding('NAVIGATION_WRITE_BLOCKED', 'medium', 'A navigation step attempted a backend write', 'Review the action plan. Writes were blocked; use an explicitly authorized synthetic journey for actions that change backend state.', { actual: visit.writeGuard.blockedWrites }));
    }
    visit.finalUrl = safeUrl(page.url());
    await checkPageContracts(page, task, visit);
    Object.assign(visit, { titleMetadata: displayMetadata(inventory.title), frames: redact(inventory.frames.map(({title, ...frame}) => ({...frame, titleMetadata: displayMetadata(title)}))), forms: redact(inventory.forms), tagScripts: redact(inventory.tagScripts) });
    visit.dataLayer = [...dataLayerEntries, ...inventory.dataLayer.map(entry => ({ timestamp: null, actionId: null, source: 'final-snapshot', frameUrl: entry.frameUrl, frameIndex: entry.frameIndex, value: safeDataLayer(entry.value) }))];
    for (const failure of inventory.providerFailures) visit.findings.push(finding('EMBEDDED_FORM_UNAVAILABLE', 'high', 'An embedded form reports that it is unavailable',
      'Restore or replace the provider form, verify the embed ID and publishing state, and retest.', { evidence: [failure.text, failure.frameUrl] }));
    for (const frame of inventory.frames.filter(f => f.status !== 'inspected')) visit.findings.push(finding('FRAME_INVENTORY_INCOMPLETE', 'low', 'A frame could not be inspected',
      'Repeat the visit and check whether the frame detached or failed to load.', { evidence: [frame.frameUrl] }));
    for (const frame of inventory.frames.filter(f => f.status === 'inspected' && !f.dataLayerHookPresent)) visit.findings.push(finding('DATALAYER_HOOK_REPLACED', 'low', 'The page or frame replaced the monitored dataLayer push function',
      'Use network evidence for this run; adapt the hook if a complete dataLayer timeline is required.', { evidence: [frame.frameUrl] }));

    if (task.type === 'journey') {
      const journey = task.journey;
      const formRoot = journey.frameSelector ? page.frameLocator(journey.frameSelector) : page;
      const form = formRoot.locator(journey.formSelector).first();
      await form.waitFor({ state: 'visible' });
      const invalid = journey.kind === 'invalid-validation';
      if (invalid) await installWriteGuard(context, config, visit, inventory.forms.map(form => form.action), () => actionId);
      actionId = `${journey.id}:fill`;
      for (const field of journey.fields) {
        if (!field.selector || (!Object.hasOwn(field, 'value') && !field.valueEnv)) throw new Error(`Journey ${journey.id} has a field without selector/value or valueEnv.`);
        const value = field.valueEnv ? process.env[field.valueEnv] : field.value;
        if (value === undefined || value === '' && !invalid) throw new Error(`Journey ${journey.id} has an unset synthetic test value.`);
        const locator = form.locator(field.selector).first();
        if (field.type === 'select') await locator.selectOption(String(value));
        else if (field.type === 'checkbox' || field.type === 'radio') await locator.setChecked(Boolean(value));
        else await locator.fill(String(value));
      }
      visit.actions.push({ id: actionId, type: 'fill', fieldCount: journey.fields.length, status: 'completed', timestamp: new Date().toISOString() });
      actionId = journey.id;
      const button = form.locator(journey.submitSelector ?? 'button[type="submit"], input[type="submit"]').first();
      if (invalid) {
        await form.evaluate(el => {
          el.__websiteQAValidationState = { invalidEventCount: 0, submitEventCount: 0 };
          el.addEventListener('invalid', () => { el.__websiteQAValidationState.invalidEventCount++; }, true);
          el.addEventListener('submit', () => { el.__websiteQAValidationState.submitEventCount++; }, true);
        });
      }
      const nativeValidationEnabled = invalid ? await button.evaluate(el => Boolean(el.form) && !el.form.noValidate && !el.formNoValidate) : null;
      visit.submission = { attempted: true, verified: false };
      await button.click();
      visit.actions.push({ id: actionId, type: 'submit', status: 'clicked', timestamp: new Date().toISOString() });
      if (invalid) {
        await page.waitForTimeout(numberOption(journey.settleMs ?? config.settleMs, 2000, 500, 30000));
        const browserInvalid = await form.evaluate(el => [...el.elements].some(field => field.willValidate && !field.validity.valid));
        const validationEvents = await form.evaluate(el => el.__websiteQAValidationState ?? { invalidEventCount: 0, submitEventCount: 0 });
        const validationVisible = journey.validationSelector ? await formRoot.locator(journey.validationSelector).first().isVisible() : false;
        const blockedWrites = visit.writeGuard.blockedWrites.length;
        const formDestinationWrites = visit.writeGuard.blockedWrites.filter(write => write.reason === 'block-form-destination').length;
        const observation = { browserInvalid, nativeValidationEnabled, ...validationEvents, validationVisible, blockedWrites, formDestinationWrites };
        const result = invalidValidationResult(observation);
        visit.submission = { attempted: true, verified: result.verified, kind: 'invalid-validation', verification: result.verification ?? null, ...observation };
        if (!result.verified) visit.findings.push(finding(result.code, result.severity, result.title, result.suggestion, { actual: observation, evidence: visit.writeGuard.blockedWrites }));
      } else if (journey.successSelector) {
        const successRoot = journey.successFrameSelector ? page.frameLocator(journey.successFrameSelector) : journey.successInTopFrame ? page : formRoot;
        await successRoot.locator(journey.successSelector).first().waitFor({ state: 'visible', timeout: numberOption(journey.successTimeoutMs, 15000, 1000, 60000) });
        visit.submission = { attempted: true, verified: true, verification: 'success-selector' };
      } else if (journey.successUrlPattern) {
        await page.waitForURL(new RegExp(journey.successUrlPattern), { timeout: numberOption(journey.successTimeoutMs, 15000, 1000, 60000) });
        visit.submission = { attempted: true, verified: true, verification: 'success-url' };
      } else {
        visit.submission = { attempted: true, verified: false };
        visit.findings.push(finding('FORM_SUCCESS_UNVERIFIED', 'medium', 'Form submission success was not verified', 'Configure a visible success selector or success URL; a click alone does not prove the form was accepted.'));
      }
      await page.waitForTimeout(numberOption(journey.settleMs ?? config.settleMs, 4000, 500, 30000));
      const after = await getInventory(page);
      visit.finalUrl = safeUrl(page.url());
      visit.dataLayer = [...dataLayerEntries, ...after.dataLayer.map(entry => ({ timestamp: null, actionId: null, source: 'final-snapshot', frameUrl: entry.frameUrl, frameIndex: entry.frameIndex, value: safeDataLayer(entry.value) }))];
    }

    const screenshot = path.join('screenshots', `${fileSlug(task.id)}.jpg`);
    if (shouldCaptureScreenshot(task, config)) try {
      if (visit.submission?.attempted && !(config.captureJourneyScreenshots === true && Array.isArray(config.privacySelectors) && config.privacySelectors.length)) throw Object.assign(new Error('Confirmation-output privacy masks are not configured.'), { code: 'SCREENSHOT_PRIVACY_SUPPRESSED' });
      await page.screenshot({ path: path.join(outputDir, screenshot), type: 'jpeg', quality: 55, fullPage: config.fullPageScreenshots === true, timeout: 15000, mask: screenshotMasks(page, config) });
      visit.screenshot = screenshot;
    } catch (error) {
      visit.findings.push(finding(error.code === 'SCREENSHOT_PRIVACY_SUPPRESSED' ? 'SCREENSHOT_PRIVACY_SUPPRESSED' : 'SCREENSHOT_UNAVAILABLE', error.code === 'SCREENSHOT_PRIVACY_SUPPRESSED' ? 'info' : 'low', 'Screenshot capture was unavailable or suppressed', 'For submitted forms, configure confirmation-output privacy selectors before enabling screenshots.', { evidence: [safeError(error)] }));
    } else visit.screenshotSkippedReason = 'Outside configured screenshot devices or consent states.';
    await drain(pending);
    const parsed = parseNetworkRequests(requests, { collectorHosts: config.collectorHosts ?? {} });
    visit.events = parsed.events ?? []; visit.containers = parsed.containers ?? [];
    visit.networkRequestsObserved = requests.length;
    if (visit.networkCaptureTruncated) visit.findings.push(finding('REQUEST_CAPTURE_LIMIT', 'medium', 'Network capture reached its bounded request limit', 'Split or shorten the journey. Missing-event and no-event checks are inconclusive beyond the observed window.', { actual: 10000 }));
    visit.parserWarnings = redact(parsed.warnings ?? []);
    const expectations = [...pageExpectations(config, visit.effectiveConsentState, task.device, task.type === 'page' ? task : {}), ...stepExpectations];
    if (task.journey) expectations.push(...(task.journey.expectedEvents ?? []).map(item => expectation(item, task.journey.kind === 'invalid-validation' ? null : task.journey.id)));
    visit.eventContractsConfigured = expectations.length > 0;
    visit.expectationSignature = contractSignature(config, task, expectations);
    visit.findings.push(...analyzeTagEvents(parsed.events ?? [], { expectations, duplicateWindowMs: config.duplicateWindowMs ?? 2000, knownDestinations: config.knownDestinations ?? {} }).map(normalizeFinding));
    for (const error of visit.consoleErrors.filter(error => error.source === 'pageerror' || config.reportConsoleErrors === true)) visit.findings.push(finding('BROWSER_SCRIPT_ERROR', error.source === 'pageerror' ? 'medium' : 'low', `Browser ${error.category} observed`, 'Inspect the reported script location and reproduce the affected interaction. A script error alone does not prove conversion loss.', { confidence: 1, evidence: [error] }));
    for (const request of requests.filter(r => TAG_URL.test(r.url) && r.httpStatus >= 400).slice(0, 20)) {
      visit.findings.push(finding('TAG_HTTP_ERROR', 'high', `Tracking endpoint returned HTTP ${request.httpStatus}`, 'Inspect the destination ID, endpoint, required parameters, and vendor response.',
        { actual: request.httpStatus, actionId: request.actionId, evidence: [safeUrl(request.url)] }));
    }
    for (const failure of visit.requestFailures.filter(r => TAG_URL.test(r.url)).slice(0, 20)) {
      visit.findings.push(finding('TAG_REQUEST_FAILED', 'medium', 'A tracking request failed in this browser run', 'Check the failed endpoint and repeat the test; determine whether browser blocking, consent, or vendor availability caused it.', { confidence: 0.9, evidence: [failure.url, failure.error] }));
    }
    if (!expectations.length) visit.findings.push(finding('EVENT_EXPECTATIONS_UNCONFIGURED', 'info', 'Required event counts are not configured for this visit', 'Define expected events and destinations from the measurement plan before treating missing-tag checks as complete.'));
    visit.dataLayerTimelineComplete = !visit.findings.some(f => f.code === 'DATALAYER_HOOK_REPLACED');
    visit.status = visit.findings.some(f => ['CONSENT_STATE_UNTESTED', 'FORM_SUCCESS_UNVERIFIED', 'FORM_INVALID_INPUT_UNVERIFIED', 'INVALID_TEST_WRITE_INTERCEPTED', 'FRAME_INVENTORY_INCOMPLETE', 'REQUEST_CAPTURE_ERROR', 'REQUEST_CAPTURE_LIMIT', 'NAVIGATION_WRITE_BLOCKED', 'POPUP_FLOW_UNSUPPORTED'].includes(f.code)) ? 'partial' : 'completed';
  } catch (error) {
    visit.status = 'failed';
    visit.findings.push(finding('BROWSER_JOURNEY_FAILED', 'high', `${task.type === 'journey' ? 'Form journey' : 'Page visit'} could not finish`,
      'Inspect the screenshot and error category, repair selectors or the page, and rerun this visit.', { actionId, evidence: [safeError(error)] }));
    await drain(pending);
    try {
      const parsed = parseNetworkRequests(requests, { collectorHosts: config.collectorHosts ?? {} });
      visit.events = parsed.events ?? []; visit.containers = parsed.containers ?? []; visit.networkRequestsObserved = requests.length;
    } catch { /* Preserve the primary browser failure. */ }
    if (page && !page.isClosed() && !visit.submission?.attempted && shouldCaptureScreenshot(task, config)) {
      const screenshot = path.join('screenshots', `${fileSlug(task.id)}-failed.jpg`);
      try { await page.screenshot({ path: path.join(outputDir, screenshot), type: 'jpeg', quality: 55, fullPage: config.fullPageScreenshots === true, timeout: 10000, mask: screenshotMasks(page, config) }); visit.screenshot = screenshot; } catch { /* Optional evidence. */ }
    }
  } finally {
    await drain(pending);
    await context.close().catch(() => {});
    visit.finishedAt = new Date().toISOString();
  }
  return visit;
}

function skipReason(journey, allowSubmit, config, allowInvalid = false) {
  if (journey.enabled !== true) return journey.blockedReason ?? 'Journey is not enabled; selectors and synthetic routing must be reviewed.';
  if (journey.kind === 'invalid-validation') {
    if (!allowInvalid) return 'Invalid validation was not enabled with --allow-invalid.';
    if (!Array.isArray(journey.expectedEvents) || !journey.expectedEvents.length || !journey.expectedEvents.every(event => event.count === 0)) return 'Invalid-input journeys require scoped count:0 event contracts.';
    return null;
  }
  if (!allowSubmit) return 'Read-only mode: --allow-submit was not supplied.';
  if (!(journey.syntheticRoutingConfirmed === true || config.syntheticRoutingConfirmed === true)) return 'Synthetic lead routing has not been explicitly confirmed.';
  if (!journey.successSelector && !journey.successUrlPattern) return 'A verified success selector or URL must be configured before submission.';
  if (!Array.isArray(journey.expectedEvents) || !journey.expectedEvents.length) return 'Expected conversion events must be configured before submission.';
  return null;
}

function findingKey(item) {
  const targets = [...new Set((item.evidence ?? []).flatMap(entry => {
    if (typeof entry === 'string' && /^https?:\/\//.test(entry)) return [safeUrl(entry)];
    if (entry && typeof entry === 'object') return [`${entry.destinationId ?? ''}|${entry.eventName ?? ''}|${entry.frameUrl ?? ''}`];
    return [];
  }))].sort();
  return hash({ code: item.code, url: item.url, device: item.device, consentState: item.consentState, journeyId: item.journeyId,
    title: item.title, rule: item.rule ?? null, targets, destinationId: item.destinationId ?? null, expected: item.expected ?? null });
}

function computeHistory(report, previous) {
  const priorKeys = new Set((previous?.findings ?? []).map(f => f.fingerprint ?? findingKey(f)));
  const currentKeys = new Set(report.findings.map(f => f.fingerprint ?? findingKey(f)));
  const scope = (findingEntry, owner) => {
    const visit = owner?.visits?.find(v => v.id === findingEntry.visitId);
    return `${findingEntry.url}|${findingEntry.device}|${findingEntry.consentState}|${findingEntry.visitType ?? visit?.type ?? 'unknown'}|${findingEntry.journeyId ?? ''}|${findingEntry.expectationSignature ?? visit?.expectationSignature ?? 'unknown'}`;
  };
  const comparable = new Set(report.visits.filter(v => v.status === 'completed').map(v => `${v.url}|${v.device}|${v.consentState}|${v.type}|${v.journeyId ?? ''}|${v.expectationSignature ?? 'unknown'}`));
  const newFindings = report.findings.filter(f => !priorKeys.has(f.fingerprint ?? findingKey(f)));
  const resolvedFindings = (previous?.findings ?? []).filter(f => comparable.has(scope(f, previous)) && !currentKeys.has(f.fingerprint ?? findingKey(f)));
  return { previousRunId: previous?.runId ?? null, hasBaseline: Boolean(previous), newFindings, resolvedFindings };
}

function refreshSummary(report, previous) {
  report.history = computeHistory(report, previous);
  report.summary = { totalFindings: report.findings.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const entry of report.findings) report.summary[entry.severity] = (report.summary[entry.severity] ?? 0) + 1;
}

async function writeReportAtomic(filename, report) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

async function checkpointReport(filename, report, previous) {
  report.lastCheckpointAt = new Date().toISOString();
  refreshSummary(report, previous);
  await writeReportAtomic(filename, report);
}

async function previousReport(filename) {
  try { return JSON.parse(await fs.readFile(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error(`Unable to read previous report: ${error.message}`); }
}

async function main() {
  const args = cli(process.argv.slice(2));
  if (args.help) { process.stdout.write(HELP); return; }
  const configPath = path.resolve(args.config);
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const { pages, journeys, devices, consentStates } = validateConfig(config);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(args.output ?? path.join('runs', runId));
  const latestPath = path.resolve(config.latestReportPath ?? path.join(path.dirname(outputDir), 'latest-report.json'));
  const previous = await previousReport(path.resolve(args.previous ?? latestPath));
  await fs.mkdir(path.join(outputDir, 'screenshots'), { recursive: true });
  const report = { schemaVersion: '1.1', runId, startedAt: new Date().toISOString(), mode: args.allowSubmit ? 'submission-enabled' : args.allowInvalid ? 'invalid-validation-enabled' : 'read-only',
    site: config.site ?? new URL(pages[0].url).hostname, status: 'running', executionComplete: false, finishedAt: null, configPath,
    coverage: { pageVisitsPlanned: pages.length * devices.length * consentStates.length, pageVisitsCompleted: 0, journeysPlanned: journeys.length, journeysTested: 0,
      journeysSkipped: 0, limitations: ['Browser requests prove an attempted dispatch, not vendor ingestion or server-side delivery.', 'Actual backend receipt, CRM records, and browser/server deduplication require separate authenticated checks.', 'Consent controls are clicked where configured; legal compliance and manager state are not certified.', 'An absent configured expectation is reported as untested, not as a pass.', 'dataLayerTimelineComplete=false marks incomplete dataLayer history; network and inspected-form checks can still complete.'] },
    visits: [], journeys: [], findings: [] };
  const tasks = [];
  for (const [index, entry] of pages.entries()) for (const device of devices) for (const consentState of consentStates) {
    tasks.push({ ...entry, id: `page-${index + 1}-${device}-${consentState}`, type: 'page', device, consentState });
  }
  for (const journey of journeys) {
    const reason = skipReason(journey, args.allowSubmit, config, args.allowInvalid);
    if (reason) { report.journeys.push({ id: journey.id, url: safeUrl(journey.url), status: 'untested', reason }); report.coverage.journeysSkipped++; continue; }
    for (const device of journey.devices ?? devices) for (const consentState of journey.consentStates ?? consentStates) {
      tasks.push({ id: `journey-${fileSlug(journey.id)}-${device}-${consentState}`, type: 'journey', url: journey.url, journey, device, consentState });
    }
    report.journeys.push({ id: journey.id, url: safeUrl(journey.url), status: 'planned' });
  }
  const reportPath = path.join(outputDir, 'report.json');
  report.runProgress = { plannedVisits: tasks.length, completedVisits: 0, currentVisitId: null,
    pendingVisits: tasks.map(task => ({ id: task.id, type: task.type, url: safeUrl(task.url), device: task.device, consentState: task.consentState })) };
  await checkpointReport(reportPath, report, previous);
  let browser;
  try {
    const { chromium, devices: playwrightDevices } = await import('playwright');
    browser = await chromium.launch({ headless: config.headless !== false, ...(config.browserChannel ? { channel: config.browserChannel } : {}) });
    for (const task of tasks) {
      report.runProgress.currentVisitId = task.id;
      await checkpointReport(reportPath, report, previous);
      process.stdout.write(progressLine(task));
      const visit = await captureVisit(browser, playwrightDevices, config, task, outputDir);
      visit.journeyId = task.journey?.id ?? null;
      report.visits.push(visit);
      for (const entry of visit.findings) {
        const scoped = { ...entry, visitId: visit.id, visitType: visit.type, expectationSignature: visit.expectationSignature,
          url: visit.url, device: visit.device, consentState: visit.consentState, journeyId: task.journey?.id ?? null };
        scoped.fingerprint = findingKey(scoped); report.findings.push(scoped);
      }
      if (visit.type === 'page' && visit.status !== 'failed') report.coverage.pageVisitsCompleted++;
      report.runProgress.completedVisits = report.visits.length;
      report.runProgress.pendingVisits = report.runProgress.pendingVisits.filter(entry => entry.id !== task.id);
      report.runProgress.currentVisitId = null;
      await checkpointReport(reportPath, report, previous);
    }
    for (const journey of report.journeys.filter(j => j.status === 'planned')) {
      const visits = report.visits.filter(v => v.type === 'journey' && v.actions.some(a => a.id === journey.id));
      const attempted = report.visits.filter(v => v.type === 'journey' && v.journeyId === journey.id);
      journey.status = visits.length && visits.every(v => v.submission?.verified && v.status === 'completed') && visits.length === attempted.length ? 'tested' : 'partial';
      journey.visits = attempted.map(v => v.id);
      if (journey.status === 'tested') report.coverage.journeysTested++;
    }
    report.status = report.visits.every(v => v.status === 'failed') ? 'failed' : report.visits.some(v => v.status !== 'completed') || report.coverage.journeysSkipped > 0 ? 'partial' : 'completed';
  } catch (error) {
    report.status = 'failed';
    report.findings.push(finding('RUNNER_FAILED', 'high', 'The browser runner failed', 'Install Playwright and its Chromium browser, validate configuration, and rerun.', { evidence: [safeError(error)] }));
  } finally {
    if (browser) await browser.close().catch(() => {});
    report.finishedAt = new Date().toISOString();
    report.executionComplete = report.visits.length === tasks.length && report.status !== 'failed';
    report.runProgress.currentVisitId = null;
    await checkpointReport(reportPath, report, previous);
    // A failed or interrupted run must not replace the prior comparison baseline.
    if (report.executionComplete) await writeReportAtomic(latestPath, report);
    process.stdout.write(`Report: ${path.join(outputDir, 'report.json')}\nStatus: ${report.status}; findings: ${report.summary.totalFindings}\n`);
    if (report.status === 'failed') process.exitCode = 2;
    else if (report.summary.critical || report.summary.high || (config.failOnSeverity ?? 'medium') === 'medium' && report.summary.medium) process.exitCode = 1;
  }
}

export { cli, skipReason, validateConfig, findingKey, computeHistory, pageExpectations, safeDataLayer, normalizeFinding, writeReportAtomic, checkpointReport, shouldCaptureScreenshot, displayMetadata, contractSignature, progressLine };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${JSON.stringify(safeError(error))}\n`); process.exitCode = 2; });
}
