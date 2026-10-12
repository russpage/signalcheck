// Shape-only observation. Item/customer/order values are never retained.
const token = value => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$/.test(value);
const present = value => typeof value === 'string' ? value.trim().length > 0 : typeof value === 'number' && Number.isFinite(value);
const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
export function commerceShape(value) {
  const items = Array.isArray(value?.items) ? value.items : null;
  return {
    hasValue: number(value?.value), valueNonnegative: number(value?.value) && Number(value.value) >= 0,
    hasCurrency: typeof value?.currency === 'string' && /^[A-Z]{3}$/.test(value.currency),
    hasTransactionId: present(value?.transaction_id), itemCount: items?.length ?? null,
    itemsWithIdentifier: items?.filter(item => present(item?.item_id) || present(item?.item_name)).length ?? 0,
    itemsWithPrice: items?.filter(item => number(item?.price) && Number(item.price) >= 0).length ?? 0,
    itemsWithQuantity: items?.filter(item => number(item?.quantity) && Number(item.quantity) > 0).length ?? 0,
  };
}
export function validateCommerceRules(rules = []) {
  if (!Array.isArray(rules) || rules.length > 50) throw new Error('expectedCommerce must be an array of at most 50 rules.');
  const ids = new Set();
  for (const rule of rules) {
    if (!rule || Object.keys(rule).some(k => !['id','eventName','actionId','minItems','requireValue','requireCurrency','requireTransactionId','requireItemIdentifier','requireItemPrice','requireItemQuantity','devices','consentStates'].includes(k)) || !token(rule.id) || !token(rule.eventName) || ids.has(rule.id)) throw new Error('Commerce rules need unique safe id, eventName and documented keys.');
    ids.add(rule.id);
    if (rule.actionId !== undefined && !token(rule.actionId)) throw new Error('Commerce actionId must be a safe token.');
    if (rule.minItems !== undefined && (!Number.isInteger(rule.minItems) || rule.minItems < 0 || rule.minItems > 200)) throw new Error('Commerce minItems must be between 0 and 200.');
    const flags = ['requireValue','requireCurrency','requireTransactionId','requireItemIdentifier','requireItemPrice','requireItemQuantity'];
    if (flags.some(k => rule[k] !== undefined && typeof rule[k] !== 'boolean')) throw new Error('Commerce requirements must be booleans.');
    if (rule.minItems === undefined && !flags.some(k => rule[k] === true)) throw new Error('Commerce rules need at least one shape requirement.');
    for (const key of ['devices','consentStates']) if (rule[key] !== undefined && (!Array.isArray(rule[key]) || !rule[key].length || rule[key].some(v => !token(v)))) throw new Error('Commerce conditions must be nonempty token arrays.');
    if (rule.consentStates?.some(v => !['unset','accepted','declined'].includes(v))) throw new Error('Unsupported commerce consent state.');
  }
}
export function analyzeCommerce(entries, { rules = [], device, consentState, captureComplete = false } = {}) {
  validateCommerceRules(rules);
  const findings = [];
  const checks = rules.map(rule => {
    if ((rule.devices && !rule.devices.includes(device)) || (rule.consentStates && !rule.consentStates.includes(consentState))) return { id: rule.id, status: 'not-applicable' };
    const observed = entries.filter(e => e.value?.eventName === rule.eventName && (!rule.actionId || e.actionId === rule.actionId));
    const defects = new Set();
    for (const entry of observed) {
      const s = entry.value.commerceShape;
      if (!s) { defects.add('shape-unavailable'); continue; }
      if (rule.minItems !== undefined && (s.itemCount === null || s.itemCount < rule.minItems)) defects.add('items');
      if (rule.requireValue && (!s.hasValue || !s.valueNonnegative)) defects.add('value');
      if (rule.requireCurrency && !s.hasCurrency) defects.add('currency');
      if (rule.requireTransactionId && !s.hasTransactionId) defects.add('transaction-identity');
      for (const [requirement, count, label] of [['requireItemIdentifier','itemsWithIdentifier','item-identifier'],['requireItemPrice','itemsWithPrice','item-price'],['requireItemQuantity','itemsWithQuantity','item-quantity']]) {
        if (rule[requirement] && (s.itemCount === null || s.itemCount === 0 || s[count] !== s.itemCount)) defects.add(label);
      }
    }
    const status = !captureComplete || defects.has('shape-unavailable') ? 'inconclusive' : !observed.length || defects.size ? 'failed' : 'verified-data-layer-shape';
    const check = { id: rule.id, eventName: rule.eventName, actionId: rule.actionId ?? null, status, checkpoint: 'data-layer', observedEntries: observed.length, defects: [...defects], expected: rule };
    if (status === 'failed') findings.push({ code: observed.length ? 'COMMERCE_DATA_INVALID' : 'COMMERCE_EVENT_MISSING', severity: 'medium', title: observed.length ? 'Ecommerce data does not meet the configured shape' : 'The expected ecommerce dataLayer event was not observed', suggestion: 'Inspect the event source and correct the configured fields. Rerun the original action; dataLayer shape does not prove dispatch or receipt.', confidence: 1, actionId: rule.actionId, expected: rule, actual: { observedEntries: observed.length, defects: [...defects] }, evidence: [{ checkId: rule.id, checkpoint: 'data-layer' }] });
    if (status === 'inconclusive') findings.push({ code: 'COMMERCE_CAPTURE_INCOMPLETE', severity: 'low', title: 'Ecommerce shape check is inconclusive', suggestion: 'Restore complete dataLayer/action capture and repeat the unchanged check before judging the site.', confidence: 1, actionId: rule.actionId, evidence: [{ checkId: rule.id, checkpoint: 'data-layer' }] });
    return check;
  });
  return { checks, findings };
}
