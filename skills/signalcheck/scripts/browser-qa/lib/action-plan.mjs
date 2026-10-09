import { createHash } from 'node:crypto';
import { findingKey } from '../bin/run.mjs';

const list = value => Array.isArray(value) ? value : [];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
const modes = ['investigate', 'prepare-fixes', 'maintain'];
const gapCodes = /UNCONFIGURED|UNTESTED|UNVERIFIED|INCOMPLETE|UNSUPPORTED|CAPTURE|RUNNER_FAILED|DATALAYER_HOOK|SCREENSHOT|BROWSER_JOURNEY_FAILED/;
const severityRank = { critical: 0, high: 1, error: 1, medium: 2, warning: 2, low: 3, info: 4 };
const incompleteCapture = /CAPTURE|CONSENT_STATE_UNTESTED|FRAME_INVENTORY_INCOMPLETE|DATALAYER_HOOK_REPLACED|POPUP_FLOW_UNSUPPORTED|BROWSER_JOURNEY_FAILED/;

export function scopeOf(entry, report) {
  const visit = list(report.visits).find(v => v.id === entry.visitId);
  return {
    url: entry.url ?? visit?.url, device: entry.device ?? visit?.device,
    consentState: entry.consentState ?? visit?.consentState,
    type: entry.visitType ?? entry.type ?? visit?.type,
    journeyId: entry.journeyId ?? visit?.journeyId ?? null,
    expectationSignature: entry.expectationSignature ?? visit?.expectationSignature ?? null,
  };
}

const scopeKey = scope => JSON.stringify(scope);
const fingerprint = finding => finding.fingerprint ?? findingKey({...finding,evidence:Array.isArray(finding.evidence)?finding.evidence:finding.evidence?[finding.evidence]:[]});
const scopedFindingKey = (finding, report) => JSON.stringify({ fingerprint: fingerprint(finding), scope: scopeOf(finding, report) });
const actionable = finding => finding.severity !== 'info' || finding.code === 'EVENT_EXPECTATIONS_UNCONFIGURED';

function requirements(finding) {
  const code = String(finding.code ?? '').toUpperCase();
  if (gapCodes.test(code)) return ['browser', 'site_profile'];
  if (/FORM|EMBED/.test(code)) return ['browser', 'source', 'form_provider'];
  if (/EVENT|TAG|DUPLICATE|DESTINATION|CONSENT/.test(code)) return ['browser', 'source', 'tag_manager'];
  return ['browser', 'source'];
}

export function validateCapabilities(capabilities) {
  for (const capability of list(capabilities)) {
    if (!capability || typeof capability.id !== 'string' || typeof capability.tool !== 'string' ||
        typeof capability.resource !== 'string' || typeof capability.verified !== 'boolean' ||
        !Array.isArray(capability.operations) || capability.operations.some(op => !['read','prepare','apply','publish','receipt'].includes(op))) {
      throw new Error('Capabilities need id, actual tool, scoped resource, verified and supported operations.');
    }
  }
  return list(capabilities);
}

export function buildActionPlan(report, { mode = 'investigate', capabilities = [], previousPlan = null } = {}) {
  if (!modes.includes(mode)) throw new Error('Choose investigate, prepare-fixes or maintain.');
  validateCapabilities(capabilities);
  const prior = new Map(list(previousPlan?.actions).map(action => [action.id, action]));
  const actions = list(report.findings).filter(actionable).map(finding => {
    const scope = scopeOf(finding, report);
    const findingFingerprint = fingerprint(finding);
    const id = `sc-${hash({ findingFingerprint, scope })}`;
    const kind = gapCodes.test(String(finding.code ?? '').toUpperCase()) ? 'coverage-gap' : 'investigation';
    const required = requirements(finding);
    const available = required.filter(id => capabilities.some(c => c.id === id && c.verified && c.operations.includes('read')));
    const previous = prior.get(id);
    const old = previous?.status === 'verified-browser-scope' ? null : previous;
    const regressionScopes = list(report.visits).filter(v => v.status === 'completed' && v.url === scope.url).map(v => scopeOf(v, report));
    return {
      id, kind, findingFingerprint, code: finding.code, title: finding.title ?? finding.message ?? finding.code,
      severity: finding.severity, scope, observationConfidence: finding.confidence ?? null,
      causeConfidence: old?.causeConfidence ?? 'unknown',
      status: old && old.status !== 'verified-browser-scope' ? old.status : 'needs-investigation',
      baseline: old?.baseline ?? { runId: report.runId, startedAt: report.startedAt, scope, regressionScopes,
        captureAdequate: report.executionComplete === true && report.status !== 'failed' && list(report.visits).some(v => scopeKey(scopeOf(v, report)) === scopeKey(scope) && v.status === 'completed' && !v.networkCaptureTruncated && v.dataLayerTimelineComplete !== false && !list(v.findings).some(f => incompleteCapture.test(String(f.code)))),
        findingScopeKeys: list(report.findings).filter(actionable)
          .filter(f => regressionScopes.some(scope => scopeKey(scopeOf(f, report)) === scopeKey(scope)))
          .map(f => scopedFindingKey(f, report)) },
      suggestion: finding.suggestion ?? finding.suggestedFix ?? list(finding.recommendations).join(' '),
      expected: finding.expected, observed: finding.actual, evidence: finding.evidence ?? [],
      requiredCapabilities: required, availableCapabilities: available,
      missingCapabilities: required.filter(id => !available.includes(id)),
      nextAction: kind === 'coverage-gap' ? 'Repair the observation or configure the intended behavior; rerun before proposing a website change.' : 'Trace the observed symptom to source or configuration before preparing a specific change.',
      verification: {
        requiredCheckpoint: 'browser', downstreamReceipt: 'untested',
        criteria: ['Rerun after the recorded change.', 'Complete the same scope and unchanged contract.',
          'Remove the original failure without new findings in the recorded regression scopes.',
          'Keep downstream receipt untested until independently correlated backend evidence exists.'],
      },
      investigation: old?.investigation ?? null, change: old?.change ?? null,
      verificationResult: old?.verificationResult ?? null, activity: old?.activity ?? [],
    };
  }).toSorted((a, b) => (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4));
  // Disappearance is a request to verify, never evidence that an applied fix worked.
  for (const old of prior.values()) if (!actions.some(a => a.id === old.id)) actions.push(old);
  return { schemaVersion: 1, mode, sourceRunId: report.runId, generatedAt: new Date().toISOString(),
    executionComplete: report.executionComplete === true, capabilities,
    automation: 'Host-driven. This package does not execute connector writes or provision an autonomous service.', actions };
}

export function recordAction(plan, id, record) {
  const result = structuredClone(plan);
  const action = result.actions.find(a => a.id === id);
  if (!action) throw new Error('Unknown action ID.');
  if (!['investigated','prepared','applied','blocked'].includes(record.stage)) throw new Error('Unsupported action stage.');
  if (!record.evidenceRef || typeof record.evidenceRef !== 'string') throw new Error('Record an evidence reference.');
  const at = record.at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(at))) throw new Error('Record a valid timestamp.');
  if (record.stage === 'investigated') {
    if (!record.cause || !['low','medium','high'].includes(record.causeConfidence)) throw new Error('Record the traced cause and cause confidence.');
    if (!['needs-investigation','investigated','blocked'].includes(action.status)) throw new Error('Cannot replace investigation after preparing or applying a change.');
    action.investigation = { cause: record.cause, evidenceRef: record.evidenceRef, at };
    action.causeConfidence = record.causeConfidence;
  }
  if (record.stage === 'prepared') {
    if (plan.mode === 'investigate') throw new Error('Investigate mode does not prepare changes.');
    if (action.kind === 'coverage-gap') throw new Error('Repair coverage and collect a new baseline before preparing a website fix.');
    if (action.status !== 'investigated' || !record.changeRef || !record.rollback) throw new Error('Preparation needs an investigation, reviewable change reference and rollback plan.');
    if (!action.baseline.captureAdequate || !action.baseline.scope.expectationSignature || !action.baseline.regressionScopes.length) throw new Error('Preparation needs a complete baseline with adequate capture and a contract signature.');
    action.change = { ref: record.changeRef, rollback: record.rollback, preparedAt: at, appliedAt: null };
  }
  if (record.stage === 'applied') {
    if (action.status !== 'prepared' || !action.change || record.authorized !== true || !record.authorizationRef) throw new Error('Application needs a prepared change and a reference to explicit authorization.');
    if (Date.parse(at) < Date.parse(action.change.preparedAt) || Date.parse(at) < Date.parse(action.baseline.startedAt)) throw new Error('Application must follow baseline and preparation.');
    action.change.appliedAt = at;
    action.change.authorizationRef = record.authorizationRef;
  }
  action.status = record.stage;
  action.activity.push({ stage: record.stage, at, evidenceRef: record.evidenceRef });
  return result;
}

export function verifyAction(plan, id, report) {
  const result = structuredClone(plan);
  const action = result.actions.find(a => a.id === id);
  if (!action) throw new Error('Unknown action ID.');
  const blockers = [];
  const hasAppliedChange = ['applied','rollback-review','verified-browser-scope'].includes(action.status) && Boolean(action.change?.appliedAt);
  if (!hasAppliedChange) blockers.push('No applied change is recorded.');
  if (report.runId === action.baseline.runId || !Number.isFinite(Date.parse(report.startedAt)) ||
      Date.parse(report.startedAt) <= Date.parse(action.change?.appliedAt)) blockers.push('A new browser run must start after the change.');
  if (report.executionComplete !== true || report.status === 'failed') blockers.push('The retest did not complete.');
  const scopes = [action.baseline.scope, ...action.baseline.regressionScopes];
  for (const scope of scopes) {
    const matching = list(report.visits).filter(v => scopeKey(scopeOf(v, report)) === scopeKey(scope));
    if (!scope.expectationSignature || !matching.length || matching.some(v => v.status !== 'completed')) {
      blockers.push('An original or regression scope is missing, incomplete or has a changed contract.');
    } else if (matching.some(v => v.networkCaptureTruncated || v.dataLayerTimelineComplete === false || list(v.findings).some(f => incompleteCapture.test(String(f.code))))) {
      blockers.push('Capture is inadequate in an original or regression scope.');
    }
  }
  const related = list(report.findings).filter(f => scopes.some(scope => scopeKey(scopeOf(f, report)) === scopeKey(scope)));
  const remaining = related.some(f => fingerprint(f) === action.findingFingerprint ||
    (f.code === action.code && scopeKey(scopeOf(f, report)) === scopeKey(action.baseline.scope)));
  if (!Array.isArray(action.baseline.findingScopeKeys)) blockers.push('The baseline lacks scoped regression evidence; collect a reviewed complete baseline.');
  const regressions = related.filter(actionable).filter(f => !list(action.baseline.findingScopeKeys).includes(scopedFindingKey(f, report)));
  if (remaining) blockers.push('The original failure is still observed.');
  if (regressions.length) blockers.push('New findings appeared in the regression scopes.');
  const verified = !blockers.length;
  action.verificationResult = { runId: report.runId, verified, checkpoint: 'browser', blockers: [...new Set(blockers)],
    newFindingCodes: [...new Set(regressions.map(f => f.code))], downstreamReceipt: 'untested' };
  if (verified) action.status = 'verified-browser-scope';
  else if (hasAppliedChange) action.status = regressions.length ? 'rollback-review' : 'applied';
  action.activity.push({ stage: verified ? 'verified-browser-scope' : 'verification-blocked', at: new Date().toISOString(), evidenceRef: `run:${report.runId}` });
  return result;
}

export function renderActionMarkdown(plan) {
  const clean = value => String(value ?? '').replace(/[\r\n|]/g, ' ');
  return ['# SignalCheck fix queue', '', `Mode: ${clean(plan.mode)}. Browser run: ${clean(plan.sourceRunId)}.`, '',
    'Tools must be discovered and authorized in the host. An available tool does not grant permission to publish.', '',
    '| Action | Status | Finding | Next step | Missing read access |', '| --- | --- | --- | --- | --- |',
    ...plan.actions.map(a => `| ${clean(a.id)} | ${clean(a.status)} | ${clean(a.title)} | ${clean(a.nextAction)} | ${clean(a.missingCapabilities.join(', '))} |`), '',
    'Verified-browser-scope establishes only the recorded browser checks. Backend receipt remains untested.', ''].join('\n');
}
