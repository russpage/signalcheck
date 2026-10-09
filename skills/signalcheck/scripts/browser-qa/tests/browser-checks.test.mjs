import test from 'node:test';
import assert from 'node:assert/strict';
import { consoleCategory, expectedFormResult, invalidValidationResult, backendWriteDecision, validateSteps } from '../lib/browser-checks.mjs';
import { cli, skipReason, validateConfig, pageExpectations } from '../bin/run.mjs';

test('console failures have useful categories without exposing private message text', () => {
  assert.equal(consoleCategory('ReferenceError: privatePerson is not defined'), 'undefined-reference');
  assert.equal(consoleCategory('TypeError: Cannot read properties of undefined'), 'type-error');
  assert.equal(consoleCategory('Refused to execute because Content Security Policy'), 'content-security-policy');
  assert.equal(consoleCategory('CORS failed'), 'cross-origin-policy');
  assert.equal(consoleCategory('Failed to fetch'), 'network-error');
});

test('form contracts distinguish missing, invisible, required-field and labels problems', () => {
  assert.equal(expectedFormResult({}, { found: false }).code, 'EXPECTED_FORM_MISSING');
  assert.equal(expectedFormResult({}, { found: true, visible: false }).code, 'EXPECTED_FORM_HIDDEN');
  assert.equal(expectedFormResult({requiredFields:['#email']}, {found:true,visible:true,requiredFields:[{selector:'#email',found:true,required:false}]}).code,'FORM_REQUIRED_FIELDS_CHANGED');
  assert.equal(expectedFormResult({requireLabels:true}, {found:true,visible:true,unlabeledFields:1}).code,'FORM_FIELD_LABEL_MISSING');
  assert.equal(expectedFormResult({requiredFields:['#email']}, {found:true,visible:true,requiredFields:[{selector:'#email',found:true,required:true}]}),null);
});

test('invalid input cannot pass because the runner intercepted an attempted write', () => {
  assert.equal(invalidValidationResult({browserInvalid:true,nativeValidationEnabled:true,invalidEventCount:1,submitEventCount:0,blockedWrites:0}).verified,true);
  assert.equal(invalidValidationResult({validationVisible:true,blockedWrites:0}).verified,true);
  assert.equal(invalidValidationResult({browserInvalid:false,validationVisible:false,blockedWrites:0}).verified,false);
  const intercepted=invalidValidationResult({browserInvalid:true,validationVisible:true,blockedWrites:1,formDestinationWrites:1});
  assert.equal(intercepted.verified,false);
  assert.equal(intercepted.code,'FORM_INVALID_INPUT_WRITE_ATTEMPTED');
});

test('invalid fields alone do not prove native rejection when validation is bypassed', () => {
  const invalid = { browserInvalid:true, blockedWrites:0, invalidEventCount:0, submitEventCount:1 };
  assert.equal(invalidValidationResult({...invalid,nativeValidationEnabled:false}).verified,false,'novalidate and formnovalidate bypass native rejection');
  assert.equal(invalidValidationResult({...invalid,nativeValidationEnabled:true}).verified,false,'preventDefault submit handler without validation evidence is unverified');
  assert.equal(invalidValidationResult({...invalid,nativeValidationEnabled:true,invalidEventCount:1}).verified,false,'a submit event plus checkValidity does not establish native rejection');
  assert.equal(invalidValidationResult({...invalid,nativeValidationEnabled:true,invalidEventCount:1,submitEventCount:0}).verified,true);
});

test('intercepted background writes are inconclusive without a form-destination match', () => {
  const result=invalidValidationResult({browserInvalid:true,nativeValidationEnabled:true,invalidEventCount:1,submitEventCount:0,blockedWrites:1,formDestinationWrites:0});
  assert.equal(result.verified,false);
  assert.equal(result.code,'INVALID_TEST_WRITE_INTERCEPTED');
  assert.equal(result.severity,'medium');
  assert.match(result.suggestion,/does not prove a lead submission attempt/);
});

test('write guard blocks mutations and GET forms, permits known measurement only', () => {
  assert.equal(backendWriteDecision({url:'https://example.com/api/leads',method:'POST'}),'block-backend-write');
  assert.equal(backendWriteDecision({url:'https://example.com/contact?name=Private',method:'GET'},{formActions:['https://example.com/contact']}),'block-form-destination');
  assert.equal(backendWriteDecision({url:'https://example.com/contact',method:'POST'},{formActions:['https://example.com/contact'],recognizedMeasurement:true}),'block-form-destination');
  assert.equal(backendWriteDecision({url:'https://google-analytics.com/g/collect',method:'POST'},{recognizedMeasurement:true}),'allow-measurement');
  assert.equal(backendWriteDecision({url:'https://example.com/products',method:'GET'}),'allow-read');
});

test('invalid-input journeys need separate flag and explicit no-event contracts', () => {
  const journey={id:'contact-invalid',kind:'invalid-validation',enabled:true,expectedEvents:[{vendor:'ga4',eventName:'generate_lead',count:0}]};
  assert.equal(cli(['--allow-invalid']).allowInvalid,true);
  assert.match(skipReason(journey,true,{},false),/--allow-invalid/);
  assert.equal(skipReason(journey,false,{},true),null);
  assert.match(skipReason({...journey,expectedEvents:[{count:1}]},false,{},true),/count:0/);
});

test('page-load no-conversion expectations are configured contracts, never assumed', () => {
  assert.deepEqual(pageExpectations({},'unset','desktop'),[]);
  assert.equal(pageExpectations({},'unset','desktop',{expectedEvents:[{vendor:'ga4',eventName:'generate_lead',count:0}]})[0].count,0);
});

test('SPA steps require reviewed non-destructive actions and bounded work', () => {
  assert.throws(()=>validateSteps([{id:'open',type:'click',selector:'#menu'}]),/nonDestructive/);
  assert.throws(()=>validateSteps([{id:'purchase',type:'click',selector:'#buy',nonDestructive:true}]),/transactional/);
  assert.throws(()=>validateSteps([{id:'open',type:'evaluate',selector:'#menu'}]),/Unsupported/);
  validateSteps([{id:'open',type:'click',selector:'#menu',nonDestructive:true},{id:'loaded',type:'waitForUrl',urlPattern:'/contact'}]);
  assert.throws(()=>validateConfig({pages:[{url:'https://example.com'}],devices:['desktop','mobile'],consentStates:['unset','accepted'],maxVisits:2}),/maxVisits/);
  const config=validateConfig({pages:[{url:'https://example.com'}]});
  assert.deepEqual(config.devices,['desktop']);
  assert.deepEqual(config.consentStates,['unset']);
});
