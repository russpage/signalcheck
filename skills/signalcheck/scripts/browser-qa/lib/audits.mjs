import { createHash } from 'node:crypto';
import { redactPageUrl } from './tag-events.mjs';

export const AUDIT_MODULES = [
  ['gtm-health','GTM Container Health Check',['browser','configuration']],
  ['ga4-quality','GA4 Event Quality Audit',['browser','configuration','platform']],
  ['ads-conversions','Google Ads Conversion Tracking Audit',['browser','configuration','platform']],
  ['meta-signal','Meta Pixel + CAPI Signal Quality Audit',['browser','backend','platform']],
  ['consent-impact','Consent Mode Impact Review',['browser','configuration','reporting']],
  ['campaign-integrity','Click ID + UTM Sanitization Check',['browser','configuration']],
  ['duplicate-events','Duplicate Event Finder',['browser','configuration']],
  ['conversion-dedup','Conversion Deduplication Review',['browser','backend','platform']],
  ['offline-imports','Offline Conversion Import Audit',['backend','configuration','platform']],
  ['enhanced-readiness','Enhanced Conversions Readiness Check',['configuration','backend']],
  ['server-feasibility','Server-Side Tagging Feasibility Review',['configuration','reporting']],
  ['attribution-windows','Attribution Window Sanity Check',['configuration','reporting']],
  ['ecommerce-data','Ecommerce Data Layer Audit',['browser','configuration']],
  ['ios-signal','iOS Privacy Signal Loss Review',['browser','reporting']],
  ['weekly-readout','Weekly Tracking Signal Readout',['report']],
].map(([id,title,requiredEvidence]) => ({ id,title,requiredEvidence }));
const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0,20);
const checkpoints = ['browser','configuration','backend','platform','reporting','report'];
const statuses = ['untested','inconclusive','issue','reviewed-no-mismatch','recommendation'];
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Error(`${label} contains unsupported fields.`);
}
function string(value, label, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must be bounded nonempty text.`);
  return value;
}
// Input must already be a sanitized private review, not raw payloads/logs.
// Defense in depth removes URLs, likely credentials, click IDs and personal data.
function text(value) {
  return value.replace(/https?:\/\/[^\s<>"']+/gi, raw => redactPageUrl(raw) ?? '[url-redacted]')
    .replace(/\b(?:Bearer\s+\S+|(?:api[_-]?key|access[_-]?token|token|secret|password|authorization|gclid|dclid|gbraid|wbraid|fbclid|ttclid|msclkid|_fbc|_fbp)\s*[:=]\s*[^\s,;]+)/gi,'[sensitive-redacted]')
    .replace(/[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email-redacted]')
    .replace(/\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g,'[phone-redacted]');
}
export function buildAuditReview(input) {
  object(input,['schemaVersion','site','selected','reviews'],'Audit review');
  if (input.schemaVersion !== 1) throw new Error('Audit review schemaVersion must be 1.');
  string(input.site,'site',2048);
  const site = redactPageUrl(input.site);
  if (!site) throw new Error('site must be an HTTP(S) URL.');
  if (!Array.isArray(input.selected) || !input.selected.length || input.selected.length > 15 || new Set(input.selected).size !== input.selected.length || input.selected.some(id => !AUDIT_MODULES.some(m => m.id === id))) throw new Error('Select unique known audit IDs.');
  if (!Array.isArray(input.reviews) || input.reviews.length > 15) throw new Error('reviews must contain at most fifteen entries.');
  const reviews = new Map();
  for (const r of input.reviews) {
    object(r,['moduleId','status','pageUrl','scope','summary','expected','observed','causeConfidence','businessImpact','nextAction','owner','retest','confidence','severity','evidence'],'Review');
    if (!input.selected.includes(r.moduleId) || reviews.has(r.moduleId) || !statuses.includes(r.status)) throw new Error('Review needs a unique selected module and supported status.');
    for (const key of ['scope','summary','expected','observed','businessImpact','nextAction','owner','retest']) string(r[key],key);
    if (!['unknown','low','medium','high'].includes(r.confidence) || !['info','low','medium','high','critical'].includes(r.severity)) throw new Error('Review needs explicit confidence and severity.');
    if (!Array.isArray(r.evidence) || r.evidence.length > 50) throw new Error('Evidence must be a bounded array.');
    const evidence = r.evidence.map(e => {
      object(e,['ref','checkpoint','observedAt'],'Evidence');string(e.ref,'evidence ref');
      if (!checkpoints.includes(e.checkpoint) || !Number.isFinite(Date.parse(e.observedAt))) throw new Error('Evidence needs checkpoint and observedAt.');
      return { referenceHash:hash(e.ref), checkpoint:e.checkpoint, observedAt:new Date(e.observedAt).toISOString() };
    });
    if (!['untested','inconclusive'].includes(r.status) && !evidence.length) throw new Error('A review conclusion needs evidence.');
    const required = AUDIT_MODULES.find(m => m.id === r.moduleId).requiredEvidence;
    const missingEvidence = required.filter(c => !evidence.some(e => e.checkpoint === c));
    const status = r.status === 'reviewed-no-mismatch' && missingEvidence.length ? 'inconclusive' : r.status;
    if (r.causeConfidence !== undefined && !['unknown','low','medium','high'].includes(r.causeConfidence)) throw new Error('Unsupported cause confidence.');
    const pageUrl=r.pageUrl === undefined ? null : redactPageUrl(string(r.pageUrl,'pageUrl',2048));
    if (r.pageUrl !== undefined && !pageUrl) throw new Error('pageUrl must be HTTP(S).');
    const result = { moduleId:r.moduleId,pageUrl,status,requestedStatus:r.status,confidence:r.confidence,causeConfidence:r.causeConfidence ?? 'unknown',severity:r.severity,missingEvidence,evidence,verification:'host-supplied-review; not independently verified' };
    for (const key of ['scope','summary','expected','observed','businessImpact','nextAction','owner','retest']) result[key] = text(r[key]);
    reviews.set(r.moduleId,result);
  }
  return { schemaVersion:1,site,generatedAt:new Date().toISOString(),verification:'Imported review assertions. This compiler validates structure, not evidence authenticity, platform receipt or repair success.',
    modules:AUDIT_MODULES.map(m => ({ ...m,...(reviews.get(m.id) ?? { moduleId:m.id,status:input.selected.includes(m.id) ? 'untested' : 'not-selected',missingEvidence:[...m.requiredEvidence],nextAction:input.selected.includes(m.id) ? 'Collect the required evidence and run this module workflow.' : 'Select when relevant to the priority journey.' }) })),
    limitations:['No platform connectors or scheduler are provisioned by this compiler.','Missing evidence never becomes a passing review.','Imported reviews cannot close browser repairs as verified fixed.','Use a private sanitized ledger; do not supply raw payloads, identifiers or credentials.'] };
}
