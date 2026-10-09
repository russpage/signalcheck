// Browser assertions are deliberately contract driven: an inventory is not a pass.
export function consoleCategory(message) {
  const value = String(message ?? '');
  if (/is not defined|ReferenceError/i.test(value)) return 'undefined-reference';
  if (/TypeError|cannot (?:read|set)|is not a function/i.test(value)) return 'type-error';
  if (/content security policy|\bCSP\b|refused to (?:load|execute|connect)/i.test(value)) return 'content-security-policy';
  if (/cross-origin|\bCORS\b/i.test(value)) return 'cross-origin-policy';
  if (/failed to fetch|networkerror|net::|failed to load resource/i.test(value)) return 'network-error';
  return 'browser-error';
}

export function expectedFormResult(contract, observation) {
  if (!observation.found) return { code: 'EXPECTED_FORM_MISSING', severity: 'high', title: 'A configured form was not found', suggestion: 'Restore the form or update its selector and frame configuration.' };
  if (!observation.visible) return { code: 'EXPECTED_FORM_HIDDEN', severity: 'high', title: 'A configured form was not visible', suggestion: 'Check display rules, the embed and page state before retesting.' };
  const absent = (contract.requiredFields ?? []).filter(selector => !observation.requiredFields?.some(field => field.selector === selector && field.found && field.required));
  if (absent.length) return { code: 'FORM_REQUIRED_FIELDS_CHANGED', severity: 'medium', title: 'A required-field contract was not met', suggestion: 'Check required attributes and the form selector against the intended validation rules.', expected: absent, actual: observation.requiredFields };
  if (contract.requireLabels === true && observation.unlabeledFields > 0) return { code: 'FORM_FIELD_LABEL_MISSING', severity: 'medium', title: 'A form has fields without detectable accessible labels', suggestion: 'Add associated labels or accessible names, then check the form with a screen reader.', actual: observation.unlabeledFields };
  return null;
}

export function invalidValidationResult(observation) {
  if (observation.formDestinationWrites > 0) return { verified: false, code: 'FORM_INVALID_INPUT_WRITE_ATTEMPTED', severity: 'high', title: 'The invalid-input test intercepted a form-destination write', suggestion: 'Inspect the endpoint and action timeline to determine whether validation allowed the submission. The runner intercepted the write; backend receipt and its causal source are untested.' };
  if (observation.blockedWrites > 0) return { verified: false, code: 'INVALID_TEST_WRITE_INTERCEPTED', severity: 'medium', title: 'A non-measurement write was intercepted during the invalid-input test', suggestion: 'Use the endpoint and action timeline to distinguish submission traffic from background service traffic. This interception makes invalid-input rejection inconclusive; it does not prove a lead submission attempt.' };
  const nativeRejected = observation.browserInvalid && observation.nativeValidationEnabled === true && observation.invalidEventCount > 0 && observation.submitEventCount === 0;
  if (nativeRejected || observation.validationVisible) return { verified: true, verification: nativeRejected ? 'native-constraint-validation' : 'validation-selector' };
  return { verified: false, code: 'FORM_INVALID_INPUT_UNVERIFIED', severity: 'medium', title: 'Invalid-input rejection was not verified', suggestion: 'Configure a visible validation error selector or restore client-side required-field validation. The runner blocked backend writes.' };
}

export function backendWriteDecision(request, { formActions = [], recognizedMeasurement = false } = {}) {
  const url = new URL(request.url);
  const endpoint = `${url.origin}${url.pathname}`;
  const isFormAction = formActions.some(action => {
    try { const form = new URL(action); return `${form.origin}${form.pathname}` === endpoint; } catch { return false; }
  });
  // Form destinations are blocked even for GET forms and even if misconfigured
  // to look like an analytics collector. An ordinary page GET remains readable.
  if (isFormAction) return 'block-form-destination';
  if (['GET', 'HEAD', 'OPTIONS'].includes(String(request.method).toUpperCase())) return 'allow-read';
  return recognizedMeasurement ? 'allow-measurement' : 'block-backend-write';
}

export function validateSteps(steps = []) {
  if (!Array.isArray(steps) || steps.length > 20) throw new Error('steps must be an array of at most 20 operations.');
  const ids = new Set();
  for (const step of steps) {
    if (!step.id || ids.has(step.id)) throw new Error('Every page step needs a unique id.');
    ids.add(step.id);
    if (!['click', 'waitForSelector', 'waitForUrl'].includes(step.type)) throw new Error(`Unsupported step type: ${step.type}`);
    if (step.type === 'waitForUrl' ? !step.urlPattern : !step.selector) throw new Error(`Step ${step.id} lacks a selector or URL pattern.`);
    if (step.type === 'click' && step.nonDestructive !== true) throw new Error(`Step ${step.id} must declare nonDestructive=true.`);
    if (step.type === 'click' && /purchase|checkout|place.?order|delete|unsubscribe|cancel.?order/i.test(`${step.id} ${step.selector}`)) throw new Error(`Step ${step.id} appears transactional or destructive.`);
  }
}
