import { createHash } from 'node:crypto';
import { redactPageUrl } from './tag-events.mjs';
const signature = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
const types = ['script', 'xhr', 'fetch', 'ping', 'image', 'document', 'other'];

export function validateTagRequests(rules) {
  if (rules === undefined) return;
  if (!Array.isArray(rules) || rules.length > 100) throw new Error('expectedTagRequests must contain at most 100 rules.');
  const ids = new Set();
  const allowedKeys = new Set(['id','host','path','pathPrefix','method','query','resourceTypes','actionId','devices','consentStates','count','min','max']);
  for (const rule of rules) {
    if (!rule || !/^[a-z][a-z0-9_-]{0,79}$/i.test(rule.id ?? '') || ids.has(rule.id)) throw new Error('Tag request checks need unique nonpersonal id labels.');
    ids.add(rule.id);
    if (Object.keys(rule).some(key => !allowedKeys.has(key))) throw new Error('Unsupported tag request field; payload decoding is not supplied by this request matcher.');
    let host;
    try { host = new URL(`https://${rule.host}`); } catch { throw new Error('Tag request checks need an exact host.'); }
    if (typeof rule.host !== 'string' || !rule.host || /[*\s]/.test(rule.host) || rule.host !== host.host || host.username || host.password || host.pathname !== '/' || host.search || host.hash) throw new Error('Tag request checks need an exact lowercase host, optionally with a port.');
    if (Number(Object.hasOwn(rule, 'path')) + Number(Object.hasOwn(rule, 'pathPrefix')) !== 1 || typeof (rule.path ?? rule.pathPrefix) !== 'string' || !(rule.path ?? rule.pathPrefix).startsWith('/') || /[?#]/.test(rule.path ?? rule.pathPrefix)) throw new Error('Configure exactly one path or pathPrefix without query or fragment.');
    if (rule.method !== undefined && !['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(rule.method)) throw new Error('Tag request method must be an uppercase HTTP method.');
    if (rule.query !== undefined && (!rule.query || Array.isArray(rule.query) || typeof rule.query !== 'object' || Object.keys(rule.query).length > 20 || Object.entries(rule.query).some(([k,v]) => !k || typeof v !== 'string'))) throw new Error('Tag request query matchers need at most 20 exact string values.');
    if (rule.resourceTypes !== undefined && (!Array.isArray(rule.resourceTypes) || !rule.resourceTypes.length || rule.resourceTypes.some(t => !types.includes(t)))) throw new Error('Unsupported tag request resource type.');
    for (const key of ['count', 'min', 'max']) if (rule[key] !== undefined && (!Number.isInteger(rule[key]) || rule[key] < 0 || rule[key] > 10000)) throw new Error('Tag request counts must be bounded nonnegative integers.');
    if (rule.count === undefined && rule.min === undefined && rule.max === undefined || rule.count !== undefined && (rule.min !== undefined || rule.max !== undefined) || (rule.min ?? 0) > (rule.max ?? Infinity)) throw new Error('Tag request rules need count or a valid min/max range.');
    for (const key of ['devices', 'consentStates']) if (rule[key] !== undefined && (!Array.isArray(rule[key]) || !rule[key].length || rule[key].some(v => typeof v !== 'string'))) throw new Error('Tag request conditions must be nonempty string arrays.');
    if (rule.consentStates?.some(s => !['unset', 'accepted', 'declined'].includes(s))) throw new Error('Unsupported tag request consent condition.');
    if (rule.actionId !== undefined && typeof rule.actionId !== 'string') throw new Error('Tag request actionId must be a string.');
  }
}

function matches(request, rule) {
  let url;
  try { url = new URL(request.url); } catch { return false; }
  return ['http:', 'https:'].includes(url.protocol) && url.host === rule.host &&
    (rule.path !== undefined ? url.pathname === rule.path : url.pathname.startsWith(rule.pathPrefix)) &&
    (rule.method === undefined || request.method === rule.method) &&
    (rule.actionId === undefined || request.actionId === rule.actionId) &&
    (!rule.resourceTypes || rule.resourceTypes.includes(request.resourceType)) &&
    (!rule.devices || rule.devices.includes(request.device)) &&
    (!rule.consentStates || rule.consentStates.includes(request.consentState)) &&
    Object.entries(rule.query ?? {}).every(([key, value]) => url.searchParams.getAll(key).includes(value));
}

export function analyzeTagRequests(requests, { rules = [], device, consentState, captureComplete = true } = {}) {
  validateTagRequests(rules);
  const checks = []; const findings = [];
  for (const rule of rules) {
    const identity = { id: rule.id, matcherSignature: signature(rule), checkpoint: 'browser-request', vendorReceipt: 'untested' };
    const applicable = (!rule.devices || rule.devices.includes(device)) && (!rule.consentStates || rule.consentStates.includes(consentState));
    if (!applicable) {
      checks.push({ ...identity, status: consentState === 'unverified' && rule.consentStates ? 'untested' : 'not-applicable' }); continue;
    }
    const matched = requests.filter(request => matches(request, rule));
    const minimum = rule.count ?? rule.min ?? 0; const maximum = rule.count ?? rule.max ?? Infinity;
    const unexpected = matched.length > maximum; const missing = matched.length < minimum;
    const failed = matched.filter(request => request.failureCategory || request.httpStatus >= 400);
    const pending = matched.some(request => !Number.isInteger(request.httpStatus));
    const actual = matched.length;
    const expected = rule.count ?? { min: minimum, max: Number.isFinite(maximum) ? maximum : null };
    const status = !captureComplete || pending ? 'inconclusive' : unexpected || missing || failed.length ? 'failed' : 'verified-browser-request';
    checks.push({ ...identity, status, expected, actual, failedRequests: failed.length });
    const common = { rule: { id: rule.id, matcherSignature: identity.matcherSignature }, expected, actual,
      evidence: matched.slice(0, 20).map(request => ({ endpoint: redactPageUrl(request.url), method: request.method, resourceType: request.resourceType, httpStatus: request.httpStatus, failed: Boolean(request.failureCategory) })) };
    if (unexpected || captureComplete && missing) findings.push({ ...common, code: unexpected ? 'TAG_REQUEST_COUNT_EXCEEDED' : 'TAG_REQUEST_MISSING', severity: unexpected ? 'medium' : 'high', title: unexpected ? 'A configured tag request fired more often than expected' : 'A configured tag request did not fire', suggestion: 'Inspect this tag and its configured trigger, action and consent condition. Request counts do not prove duplicate events or final platform counting.' });
    if (failed.length) findings.push({ ...common, code: 'TAG_REQUEST_DELIVERY_FAILED', severity: 'high', title: 'A configured tag request failed or returned an error', suggestion: 'Reproduce and trace the browser request failure or endpoint response; confirm platform receipt separately.' });
    if (!captureComplete || pending) findings.push({ ...common, code: 'TAG_REQUEST_CAPTURE_INCOMPLETE', severity: 'medium', title: 'A configured tag request check is inconclusive', suggestion: 'Repair capture or complete the observation window, then rerun the unchanged check. Missing responses or incomplete capture do not verify tag behavior.' });
  }
  return { checks, findings };
}
