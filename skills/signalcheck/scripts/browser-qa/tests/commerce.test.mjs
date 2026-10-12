import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceShape,analyzeCommerce,validateCommerceRules} from '../lib/commerce.mjs';
import {safeDataLayer,validateConfig,contractSignature} from '../bin/run.mjs';
import {buildActionPlan,recordAction,verifyAction} from '../lib/action-plan.mjs';

const rule={id:'product',eventName:'view_item',minItems:1,requireValue:true,requireCurrency:true,requireItemIdentifier:true,requireItemPrice:true,requireItemQuantity:true};
const entry=commerce=>({actionId:'view',value:{eventName:'view_item',commerceShape:commerceShape(commerce)}});
const valid={value:0,currency:'USD',items:[{item_id:'private@example.com',item_name:'private-person',price:0,quantity:1}]};
test('commerce retains only shape, including zero-value fixtures',()=>{
  const data=safeDataLayer({event:'view_item',ecommerce:{...valid,transaction_id:'private-order'}});
  assert.equal(data.commerceShape.hasValue,true);
  assert.equal(data.commerceShape.itemsWithIdentifier,1);
  assert.doesNotMatch(JSON.stringify(data),/private@example|private-person|private-order/);
  const result=analyzeCommerce([entry(valid)],{rules:[rule],captureComplete:true});
  assert.equal(result.checks[0].status,'verified-data-layer-shape');
  assert.equal(result.findings.length,0);
});
test('shape defects cover every item, invalid numbers and missing currency/identity',()=>{
  const result=analyzeCommerce([entry({value:false,currency:'usd',items:[{price:-1,quantity:0},null]})],{rules:[{...rule,requireTransactionId:true}],captureComplete:true});
  assert.equal(result.checks[0].status,'failed');
  assert.deepEqual(result.checks[0].defects.toSorted(),['currency','item-identifier','item-price','item-quantity','transaction-identity','value']);
  assert.equal(result.findings[0].code,'COMMERCE_DATA_INVALID');
});
test('missing action and incomplete capture never become shape passes',()=>{
  assert.equal(analyzeCommerce([entry(valid)],{rules:[{...rule,actionId:'other'}],captureComplete:true}).findings[0].code,'COMMERCE_EVENT_MISSING');
  const r=analyzeCommerce([entry(valid)],{rules:[rule],captureComplete:false});
  assert.equal(r.checks[0].status,'inconclusive');assert.equal(r.findings[0].code,'COMMERCE_CAPTURE_INCOMPLETE');
  assert.equal(analyzeCommerce([entry(valid)],{rules:[{...rule,consentStates:['accepted']}],consentState:'declined',captureComplete:true}).checks[0].status,'not-applicable');
});
test('reject unsupported or inert rules and retain shape requirements in verification signatures',()=>{
  for(const r of [{...rule,rawPayload:true},{...rule,minItems:-1},{id:'product',eventName:'view_item'},{...rule,requireValue:'yes'}])assert.throws(()=>validateCommerceRules([r]));
  assert.throws(()=>validateCommerceRules([rule,rule]));
  const config={pages:[{url:'https://example.com',expectedCommerce:[rule]}]};
  assert.doesNotThrow(()=>validateConfig(config));
  assert.throws(()=>validateConfig({...config,expectedCommerce:[rule]}));
  assert.notEqual(contractSignature(config,config.pages[0],[]),contractSignature({...config,pages:[{...config.pages[0],expectedCommerce:[{...rule,minItems:0}]}]},config.pages[0],[]));
});
test('dataLayer truncation blocks repair preparation and verification',()=>{
  const visit={id:'v',url:'https://example.com',device:'desktop',consentState:'unset',type:'page',status:'completed',expectationSignature:'original',dataLayerCaptureTruncated:true};
  const report={runId:'before',startedAt:'2026-10-01T00:00:00Z',executionComplete:true,status:'completed',visits:[visit],findings:[{visitId:'v',code:'COMMERCE_DATA_INVALID',severity:'medium',evidence:[]}]};
  let plan=buildActionPlan(report,{mode:'prepare-fixes'});const id=plan.actions[0].id;
  plan=recordAction(plan,id,{stage:'investigated',cause:'Fixture',causeConfidence:'high',evidenceRef:'fixture'});
  assert.throws(()=>recordAction(plan,id,{stage:'prepared',changeRef:'fixture',rollback:'restore',evidenceRef:'fixture'}),/adequate capture/);
  plan.actions[0].status='applied';plan.actions[0].change={appliedAt:'2026-10-02T00:00:00Z'};
  const result=verifyAction(plan,id,{...report,runId:'after',startedAt:'2026-10-03T00:00:00Z',findings:[]});
  assert.equal(result.actions[0].verificationResult.verified,false);
});
