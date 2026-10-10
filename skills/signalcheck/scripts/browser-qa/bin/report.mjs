import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { redactPageUrl } from '../lib/tag-events.mjs';
import { buildActionPlan, renderActionMarkdown } from '../lib/action-plan.mjs';

const rank = { critical: 0, high: 1, error: 1, medium: 2, warning: 2, low: 3, info: 4 };
const text = value => String(value ?? '');
const escape = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = value => text(value).replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
const list = value => Array.isArray(value) ? value : value ? [value] : [];

// Reviewed profiles can still contain an identity in a custom journey/action ID.
// Keep stable opaque references in shareable reports without changing runner IDs.
export function safeReportValue(value, key = '') {
  if (typeof value === 'string') {
    if (/^(?:id|journeyId|actionId|visitId)$/.test(key) &&
        (!/^[a-z0-9][a-z0-9_:-]{0,127}$/i.test(value) || /\d{7,}/.test(value))) {
      return `ref-${createHash('sha256').update(value).digest('hex').slice(0,16)}`;
    }
    if (/^https?:\/\//i.test(value)) return redactPageUrl(value) ?? '[url-redacted]';
    return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
      .replace(/\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g, '[phone-redacted]');
  }
  if (Array.isArray(value)) return value.map(item => safeReportValue(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name,item]) => [name,safeReportValue(item,name)]));
  return value;
}

export function eventContractCoverage(report) {
  const visits = list(report.visits);
  const configured = visits.filter(visit => visit.eventContractsConfigured === true || (visit.eventContractsConfigured === undefined && !list(visit.findings).some(finding => finding.code === 'EVENT_EXPECTATIONS_UNCONFIGURED') && Boolean(visit.expectationSignature))).length;
  return { configured, observed: visits.length, unconfigured: visits.length - configured };
}
function contractBanner(report) {
  const coverage = eventContractCoverage(report);
  if (!coverage.configured) return `Inventory only: event contracts are untested. ${coverage.observed} observed visit(s) have no configured event-count verification. Observing tags is not a tracking pass.`;
  return `Event contracts configured for ${coverage.configured}/${coverage.observed} observed visit(s); ${coverage.unconfigured} visit(s) remain untested for event counts. Configured checks cover their specified events and destinations.`;
}

export function renderMarkdown(report) {
  report = safeReportValue(report);
  const coverage = report.coverage ?? {};
  const findings = list(report.findings).toSorted((a,b)=>(rank[a.severity]??4)-(rank[b.severity]??4));
  const lines = [
    '# SignalCheck website QA', '',
    `Run: ${clean(report.runId)} · ${clean(report.startedAt)} · ${clean(report.status)}`,
    '',
    `Page visits completed: ${coverage.pageVisitsCompleted ?? 0}/${coverage.pageVisitsPlanned ?? 0}. Submission journeys tested: ${coverage.journeysTested ?? 0}/${coverage.journeysPlanned ?? 0}.`,
    '',
    `**${contractBanner(report)}**`,
    '',
    '**Traffic:** all runner visits are synthetic QA. Storage marking and zero-event checks do not prove exclusion from production reports. Agent policy probes do not authenticate an agent.',
    '',
    ...list(report.visits).filter(v => v.traffic).map(v => `Traffic check: ${clean(v.id)} · ${clean(v.traffic.execution)} · marker ${clean(v.traffic.marker)}${v.agentAccess ? ` · target ${clean(v.agentAccess.status)} · authenticated agent untested` : ''}.`),
    '',
    '**Coverage matters:** browser observations establish what was emitted from the browser. They do not prove CRM receipt, server-side forwarding or a counted ad-platform conversion. Skipped submissions remain untested.',
    '',
    '| Severity | Finding | Page / condition | Suggested action |',
    '| --- | --- | --- | --- |',
  ];
  for (const f of findings) lines.push(`| ${clean(f.severity)} | ${clean(f.title ?? f.message ?? f.code)} | ${clean(f.url ?? f.pageUrl)} ${clean(f.device)} ${clean(f.consentState)} | ${clean(f.suggestion ?? f.suggestedFix ?? list(f.recommendations).join(' '))} |`);
  if (!findings.length) lines.push('| Info | No findings in observed scope | See coverage limitations | This is not verification of untested form submissions. |');
  lines.push('', '## Coverage limitations', '');
  for (const limitation of list(coverage.limitations)) lines.push(`- ${clean(limitation)}`);
  for (const j of list(report.journeys).filter(j=>['skipped','untested','partial','failed'].includes(j.status))) lines.push(`- ${clean(j.id)}: ${clean(j.reason ?? j.blockedReason ?? 'Not tested.')}`);
  const newFindings = list(report.history?.newFindings);
  const resolved = list(report.history?.resolvedFindings);
  lines.push('', `Compared with previous run: ${newFindings.length} new finding(s), ${resolved.length} no longer observed. Changed/failed coverage can affect these comparisons.`, '');
  return lines.join('\n');
}

export function renderHtml(report) {
  report = safeReportValue(report);
  const findings = list(report.findings).toSorted((a,b)=>(rank[a.severity]??4)-(rank[b.severity]??4));
  const coverage = report.coverage ?? {};
  const plan = buildActionPlan(report);
  const queue = `<h2>Fix queue</h2><p>Investigate with connected tools, prepare a reviewable change, then rerun the original checks. Establish tool access and authorization in your agent.</p>${plan.actions.map(a=>`<article><div class="severity">${escape(a.severity)} · ${escape(a.status)}</div><h2>${escape(a.title)}</h2><p>${escape(a.nextAction)}</p><p>${escape(a.suggestion)}</p><details><summary>Agent handoff and verification</summary><pre>${escape(JSON.stringify({id:a.id,scope:a.scope,requiredCapabilities:a.requiredCapabilities,verification:a.verification},null,2))}</pre></details></article>`).join('') || '<p>No actionable findings in the observed scope. Untested checks still require configuration.</p>'}`;
  const cards = findings.map(f=>`<article><div class="severity">${escape(f.severity)}</div><h2>${escape(f.title??f.message??f.code)}</h2><p>${escape(f.url??f.pageUrl)} ${escape(f.device)} ${escape(f.consentState)}</p><p>${escape(f.suggestion??f.suggestedFix??list(f.recommendations).join(' '))}</p><details><summary>Evidence and confidence</summary><pre>${escape(JSON.stringify({expected:f.expected,actual:f.actual,confidence:f.confidence,cause:f.cause??f.likelyCause,evidence:f.evidence},null,2))}</pre></details></article>`).join('');
  const rows = list(report.visits).map(v=>`<tr><td>${escape(v.label??v.url)}</td><td>${escape(v.device)}</td><td>${escape(v.consentState)}</td><td>${escape(v.status)}</td><td>${escape(v.traffic?.execution ?? 'unrecorded')} · ${escape(v.traffic?.marker ?? 'unrecorded')}${v.agentAccess ? ` · ${escape(v.agentAccess.status)} (authenticated agent untested)` : ''}</td><td>${list(v.forms).length}</td><td>${list(v.events).length}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SignalCheck website QA</title><style>body{font:16px system-ui,sans-serif;background:#f5f5f1;color:#202421;margin:0}main{max-width:1050px;margin:auto;padding:32px}h1{font-size:34px;margin-bottom:8px}h2{font-size:20px}.meta{color:#59645c}.coverage{background:#fff3d7;padding:18px;border-left:5px solid #b67a16;margin:24px 0}.cards{display:grid;gap:14px}article{background:white;border:1px solid #d5ddd5;border-radius:10px;padding:20px}.severity{text-transform:uppercase;font-size:12px;letter-spacing:.08em;font-weight:700;color:#8c3923}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}table{border-collapse:collapse;background:white;width:100%;margin-top:20px}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}.table{overflow:auto}li{margin:8px 0}</style></head><body><main><h1>SignalCheck website QA</h1><p class="meta">${escape(report.startedAt)} · ${escape(report.status)} · ${escape(report.runId)}</p><div class="coverage"><p><strong>${escape(contractBanner(report))}</strong></p><strong>${coverage.pageVisitsCompleted??0}/${coverage.pageVisitsPlanned??0} page visits. ${coverage.journeysTested??0}/${coverage.journeysPlanned??0} submission journeys tested.</strong><p>Browser emission is observed. CRM receipt, server-side delivery and final conversion counting require separate evidence. Skipped submissions are untested.</p><p>All runner visits are synthetic QA. Storage marking does not prove production exclusion. Agent policy probes do not authenticate an agent.</p></div>${queue}<h2>Observed findings</h2><div class="cards">${cards||'<article>No findings in observed scope. Check coverage before interpreting this result.</article>'}</div><h2>Coverage limitations</h2><ul>${list(coverage.limitations).map(x=>`<li>${escape(x)}</li>`).join('')}${list(report.journeys).filter(x=>['skipped','untested','partial','failed'].includes(x.status)).map(x=>`<li>${escape(x.id)}: ${escape(x.reason??x.blockedReason??'Not tested')}</li>`).join('')}</ul><h2>Observed visits</h2><div class="table"><table><thead><tr><th>Page</th><th>Device</th><th>Consent</th><th>Status</th><th>Traffic check</th><th>Forms found</th><th>Events observed</th></tr></thead><tbody>${rows}</tbody></table></div></main></body></html>`;
}

export function renderDigest(report) {
  return safeReportValue({
    runId: report.runId, startedAt: report.startedAt, finishedAt: report.finishedAt,
    status: report.status, executionComplete: report.executionComplete,
    coverage: report.coverage, traffic: report.traffic, summary: report.summary, journeys: report.journeys,
    findings: report.findings, history: report.history,
    visits: list(report.visits).map(v => ({
      id: v.id, url: v.url, device: v.device, consentState: v.consentState,
      traffic: v.traffic, agentAccess: v.agentAccess, effectiveConsentState: v.effectiveConsentState, status: v.status, dataLayerTimelineComplete:v.dataLayerTimelineComplete,
      formsFound: list(v.forms).length, containers: v.containers,
      events: list(v.events).map(e => ({vendor:e.vendor,destinationId:e.destinationId,eventName:e.eventName,channel:e.channel,httpStatus:e.httpStatus,actionId:e.actionId,consentState:e.consentState})),
      consoleErrors: v.consoleErrors, requestFailures: v.requestFailures,
    })),
  });
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const reportPath = process.argv[2];
  if (!reportPath) throw new Error('Usage: node bin/report.mjs PATH/report.json');
  const report = JSON.parse(await fs.readFile(reportPath,'utf8'));
  const markdown = renderMarkdown(report);
  await fs.writeFile(path.join(path.dirname(reportPath),'summary.md'),markdown);
  await fs.writeFile(path.join(path.dirname(reportPath),'report.html'),renderHtml(report));
  const plan = buildActionPlan(report);
  await fs.writeFile(path.join(path.dirname(reportPath),'action-plan.json'),JSON.stringify(plan,null,2),{mode:0o600});
  await fs.writeFile(path.join(path.dirname(reportPath),'action-plan.md'),renderActionMarkdown(safeReportValue(plan)),{mode:0o600});
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,markdown);
  console.log(`Report generated: ${path.dirname(reportPath)}`);
  console.log(`WEBSITE_QA_DIGEST:${JSON.stringify(renderDigest(report))}`);
}
