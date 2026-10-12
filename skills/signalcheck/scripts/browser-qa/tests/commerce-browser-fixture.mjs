// Actual Chromium, local fixture only. No public customer data or transaction.
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {renderHtml,renderMarkdown,renderDigest} from '../bin/report.mjs';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'signalcheck-commerce-browser-'));
const server=http.createServer((request,response)=>{
  const mode=request.url.slice(1);
  const commerce={value:0,...(mode==='bad'?{}:{currency:'USD'}),items:[{item_id:'private-product',item_name:'private@example.com',price:0,quantity:1}]};
  response.writeHead(200,{'Content-Type':'text/html'});
  response.end(`<!doctype html><html><body><h1>Product fixture</h1><script>
    ${mode==='replaced' ? 'window.dataLayer=[];' : ''}
    ${mode==='truncated' ? 'for(let i=0;i<510;i++)window.dataLayer.push({event:"noise"});' : ''}
    window.dataLayer.push({event:'view_item',ecommerce:${JSON.stringify(commerce)}});
  </script></body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
try {
  const rule={id:'product-fields',eventName:'view_item',minItems:1,requireValue:true,requireCurrency:true,requireItemIdentifier:true,requireItemPrice:true,requireItemQuantity:true};
  await fs.writeFile(path.join(directory,'config.json'),JSON.stringify({site:'local-commerce',allowedOrigins:[origin],pages:['good','bad','replaced','truncated'].map(mode=>({url:`${origin}/${mode}`,label:mode,expectedCommerce:[rule]})),devices:['desktop'],consentStates:['unset'],settleMs:500,networkIdleTimeoutMs:500,screenshotDevices:[],journeys:[]}));
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['bin/run.mjs','--config',path.join(directory,'config.json'),'--output',path.join(directory,'run')],{cwd:path.resolve(import.meta.dirname,'..'),stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Commerce fixture timed out'));},60000);
    child.on('error',error=>{clearTimeout(timer);reject(error)});child.on('exit',code=>{clearTimeout(timer);resolve({code,output})});
  });
  const report=JSON.parse(await fs.readFile(path.join(directory,'run/report.json'),'utf8'));
  assert.equal(report.executionComplete,true,result.output);
  const visit=label=>report.visits.find(v=>v.url===`${origin}/${label}`);
  assert.equal(visit('good').commerceChecks[0].status,'verified-data-layer-shape');
  assert.equal(visit('bad').commerceChecks[0].status,'failed');assert.deepEqual(visit('bad').commerceChecks[0].defects,['currency']);
  assert.ok(visit('bad').findings.some(f=>f.code==='COMMERCE_DATA_INVALID'));
  for(const label of ['replaced','truncated'])assert.equal(visit(label).commerceChecks[0].status,'inconclusive');
  assert.equal(visit('truncated').dataLayerCaptureTruncated,true);
  for(const value of [JSON.stringify(report),renderHtml(report),renderMarkdown(report),JSON.stringify(renderDigest(report)),result.output])assert.doesNotMatch(value,/private-product|private@example/);
  assert.match(renderHtml(report),/Ecommerce dataLayer shape/);
  console.log('Commerce browser fixture passed: 4 visits, valid shape, missing currency, replaced hook, truncated history and private evidence.');
} finally {
  await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});
}
