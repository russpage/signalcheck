import { createHash } from 'node:crypto';

export const TRAFFIC_CATEGORIES = ['synthetic-qa', 'signed-agent', 'verified-bot', 'likely-human', 'suspected-automation', 'unknown'];
export const QA_STORAGE_KEY = 'signalcheck_qa';
const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 20);
const vendors = ['ga4', 'meta', 'google_ads'];
const pairs = { runner: 'synthetic-qa', signature: 'signed-agent', edge: 'verified-bot', behavior: null };

export function validateTrafficConfig(config, allowedOrigins) {
  const traffic = config.traffic;
  if (traffic !== undefined && (!traffic || typeof traffic !== 'object' || Array.isArray(traffic))) throw new Error('traffic must be an object.');
  const marker = traffic?.syntheticMarker;
  if (marker !== undefined) {
    if (marker?.siteIntegrationConfirmed !== true || !Array.isArray(marker.origins) || !marker.origins.length) throw new Error('Synthetic marking needs confirmed site integration and explicit origins.');
    for (const origin of marker.origins) {
      const url = new URL(origin);
      if (!['https:', 'http:'].includes(url.protocol) || origin !== url.origin || !allowedOrigins.has(origin)) throw new Error('Synthetic marker origins must be exact approved HTTP origins.');
    }
  }
  if (traffic?.excludedEvents !== undefined && !Array.isArray(traffic.excludedEvents)) throw new Error('traffic.excludedEvents must be an array.');
  for (const rule of traffic?.excludedEvents ?? []) {
    if (!vendors.includes(rule.vendor) || typeof rule.destinationId !== 'string' || !rule.destinationId || typeof rule.eventName !== 'string' || !rule.eventName) throw new Error('Synthetic exclusions need vendor, production destinationId and eventName.');
    for (const field of ['devices', 'consentStates']) if (rule[field] !== undefined && (!Array.isArray(rule[field]) || rule[field].some(v => typeof v !== 'string'))) throw new Error('Synthetic exclusion conditions must be arrays of strings.');
    if (['count', 'min', 'max', 'actionId'].some(key => Object.hasOwn(rule, key))) throw new Error('Synthetic exclusions are visit-wide zero-event rules; omit counts and actionId.');
  }
  for (const entry of [...config.pages ?? [], ...config.journeys ?? []]) {
    if (!entry.agentAccess) continue;
    const probe = entry.agentAccess;
    if (probe.kind !== 'policy-probe' || typeof probe.userAgent !== 'string' || !probe.userAgent.trim() || probe.userAgent.length > 512 || /[\r\n]/.test(probe.userAgent)) throw new Error('Agent access needs kind:policy-probe and a reviewed userAgent.');
    if (probe.challengeSelectors !== undefined && (!Array.isArray(probe.challengeSelectors) || probe.challengeSelectors.some(s => typeof s !== 'string' || !s))) throw new Error('challengeSelectors must be selectors.');
    if (!(entry.expectedForms?.length || entry.assertions?.length || entry.formSelector)) throw new Error('Agent policy probes need a target form or selector contract.');
  }
}

export function syntheticExpectations(config, consentState, device) {
  return (config.traffic?.excludedEvents ?? []).filter(rule => (!rule.consentStates || rule.consentStates.includes(consentState)) && (!rule.devices || rule.devices.includes(device)))
    .map(rule => ({ ...rule, count: 0, syntheticExclusion: true }));
}

export function rejectConflictingExclusions(expectations) {
  for (const exclusion of expectations.filter(e => e.syntheticExclusion)) {
    if (expectations.some(e => !e.syntheticExclusion && e.vendor === exclusion.vendor && e.eventName === exclusion.eventName && (!e.destinationId || e.destinationId === exclusion.destinationId) && ((e.count ?? e.min ?? 0) > 0))) {
      throw new Error('A production event cannot be both required and excluded in the same synthetic visit. Use separate QA destinations.');
    }
  }
}

// The marker is browser storage, not a forged network identity or server signal.
// No request headers, user consent state, or third-party frames are altered.
export async function installSyntheticMarker(context, traffic, runId, visitId) {
  if (!traffic?.syntheticMarker) return;
  await context.addInitScript(({ origins, key, runId, visitId }) => {
    if (!origins.includes(location.origin)) return;
    try { localStorage.setItem(key, JSON.stringify({ kind: 'synthetic-qa', runId, visitId })); } catch { /* Report unavailable storage after navigation. */ }
  }, { origins: traffic.syntheticMarker.origins, key: QA_STORAGE_KEY, runId, visitId });
}

export function agentAccessResult(visit) {
  const base = { identity: 'policy-probe', authenticatedAgent: 'untested', checkpoint: 'browser', customerIntent: 'unknown' };
  const status = visit.finalHttpStatus ?? visit.httpStatus;
  if ([401, 403, 429].includes(status)) return { ...base, status: 'restricted', cause: 'unknown' };
  if (visit.agentChallengeObserved) return { ...base, status: 'challenged', cause: 'unknown' };
  if (visit.status !== 'completed' || !status || status >= 400 || (visit.type === 'journey' && !visit.submission?.verified)) return { ...base, status: 'inconclusive' };
  if (visit.assertions?.some(a => a.status === 'failed')) return { ...base, status: 'target-unavailable' };
  return { ...base, status: 'target-accessible' };
}

function classify(record, authenticated) {
  const categories = new Set();
  for (const evidence of record.identityEvidence ?? []) {
    if (!evidence || !Object.hasOwn(pairs, evidence.kind) || typeof evidence.ref !== 'string' || !evidence.ref) throw new Error('Identity evidence needs a supported kind and private evidence ref.');
    if (!TRAFFIC_CATEGORIES.includes(evidence.result) || evidence.result === 'unknown') throw new Error('Unsupported identity evidence result.');
    if (evidence.kind === 'behavior') {
      if (!['likely-human', 'suspected-automation'].includes(evidence.result)) throw new Error('Behavior does not verify bot, agent or runner identity.');
    } else {
      if (pairs[evidence.kind] !== evidence.result) throw new Error('Identity result does not match verification method.');
      if (!authenticated) continue;
    }
    categories.add(evidence.result);
  }
  // Signed agents can also be in an edge vendor's verified-bot allowlist.
  if (categories.has('signed-agent')) categories.delete('verified-bot');
  const conflicted = categories.size > 1;
  return { category: categories.size === 1 ? [...categories][0] : 'unknown', conflicted };
}

export function analyzeTrafficExport(input) {
  const source = input?.source;
  const coverage = input?.coverage;
  if (input?.schemaVersion !== 1 || !source || !['cdn', 'server', 'analytics', 'crm', 'agent-trace'].includes(source.kind) || typeof source.authenticated !== 'boolean' || typeof source.evidenceRef !== 'string' || !source.evidenceRef) throw new Error('Use a version 1 normalized export with source kind, authenticated attestation and evidenceRef.');
  if (!coverage || !['request', 'session', 'event', 'record', 'journey'].includes(coverage.unit) || !['full', 'sampled', 'unknown'].includes(coverage.sampling) || !Number.isFinite(Date.parse(coverage.start)) || !Number.isFinite(Date.parse(coverage.end)) || Date.parse(coverage.end) <= Date.parse(coverage.start)) throw new Error('Export coverage needs unit, sampling and an increasing time window.');
  if (!Array.isArray(input.records) || input.records.length > 100000) throw new Error('records must be an array of at most 100000 observations.');
  const counts = Object.fromEntries(TRAFFIC_CATEGORIES.map(key => [key, 0]));
  const ids = new Set();
  const findings = [];
  const records = input.records.map(record => {
    if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw new Error('Every record needs a unique private id.');
    ids.add(record.id);
    if (record.identityEvidence !== undefined && !Array.isArray(record.identityEvidence)) throw new Error('identityEvidence must be an array.');
    const { category, conflicted } = classify(record, source.authenticated);
    counts[category]++;
    const recordHash = hash(record.id);
    const add = (code, severity, title, suggestion) => findings.push({ code, severity, title, suggestion, recordHash, checkpoint: 'imported-evidence', verification: 'host-attested; not independently verified by this importer' });
    if (conflicted) add('TRAFFIC_IDENTITY_CONFLICT', 'medium', 'Identity evidence conflicts', 'Review the source evidence and correlation before changing traffic policy.');
    const outcome = record.outcome;
    if (outcome !== undefined && (!outcome || typeof outcome.countedAsBusinessConversion !== 'boolean' || typeof outcome.evidenceRef !== 'string' || !outcome.evidenceRef)) throw new Error('Outcome evidence needs countedAsBusinessConversion and evidenceRef.');
    if (category === 'synthetic-qa' && source.authenticated && outcome?.countedAsBusinessConversion) add('SYNTHETIC_CONVERSION_COUNTED', 'high', 'A correlated QA observation was counted as a business conversion', 'Trace the configured QA exclusion at the counting destination, prepare a scoped fix and retest with correlated receipt evidence.');
    const access = record.access;
    if (access !== undefined) {
      if (!access || !['allow', 'deny', 'observe'].includes(access.expectedPolicy) || typeof access.evidenceRef !== 'string' || !access.evidenceRef || !Number.isInteger(access.httpStatus) || access.httpStatus < 100 || access.httpStatus > 599 || typeof access.challengeObserved !== 'boolean' || typeof access.journeyCompleted !== 'boolean') throw new Error('Access evidence needs policy, status, challenge/journey results and evidenceRef.');
      if (category === 'signed-agent' && source.authenticated && access.expectedPolicy === 'allow' && ([401, 403, 429].includes(access.httpStatus) || access.challengeObserved)) add('SIGNED_AGENT_ACCESS_RESTRICTED', 'high', 'A verified agent met a restriction on an intended allowed journey', 'Trace the challenge or access rule and agent permissions. Prepare a scoped change; rerun through the real authenticated agent without weakening unrelated protection.');
    }
    return { recordHash, category, conflicted, evidenceHashes: (record.identityEvidence ?? []).map(e => hash(e.ref)), customerIntent: 'unknown',
      businessOutcome: outcome ? { countedAsBusinessConversion: outcome.countedAsBusinessConversion, evidenceHash: hash(outcome.evidenceRef), verification: source.authenticated ? 'host-attested' : 'unverified' } : 'untested',
      access: access ? { expectedPolicy: access.expectedPolicy, httpStatus: access.httpStatus, challengeObserved: access.challengeObserved, journeyCompleted: access.journeyCompleted, evidenceHash: hash(access.evidenceRef) } : 'untested' };
  });
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), source: { kind: source.kind, authenticated: source.authenticated, evidenceHash: hash(source.evidenceRef) },
    coverage: { unit: coverage.unit, sampling: coverage.sampling, start: new Date(coverage.start).toISOString(), end: new Date(coverage.end).toISOString(), observations: records.length },
    identityVerification: 'Imported source assertions; this importer does not verify signatures or connect to vendors.', counts, unknownObservations: counts.unknown,
    limitations: ['Counts describe supplied observations in one unit and window, not all site visitors.', 'Missing JavaScript traffic and vendor exclusions may make analytics coverage incomplete.', 'Verified agent identity does not prove customer intent or transaction authority.', 'No calibrated probabilities, automatic blocking, allowlisting or connector writes are supplied.'], records, findings };
}
