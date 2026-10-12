#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAuditReview } from '../lib/audits.mjs';
import { renderHtml,renderMarkdown } from './report.mjs';

export async function main(argv) {
  if (argv.includes('--help')) { console.log('Usage: node bin/audits.mjs --input PRIVATE_REVIEW.json --output PRIVATE_DIRECTORY [--report BROWSER_REPORT.json]\nCompiles agent-supplied reviews; does not independently verify evidence or run platform audits.');return; }
  const args={};
  for(let i=0;i<argv.length;i++) {
    const key={'--input':'input','--output':'output','--report':'report'}[argv[i]];
    if(!key || args[key] || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error('Supply documented options once with values.');
    args[key]=argv[++i];
  }
  if(!args.input || !args.output) throw new Error('Supply --input and --output.');
  const auditReview=buildAuditReview(JSON.parse(await fs.readFile(args.input,'utf8')));
  const report=args.report ? JSON.parse(await fs.readFile(args.report,'utf8')) : {runId:'audit-review',startedAt:auditReview.generatedAt,status:'review-only',executionComplete:false,visits:[],findings:[],coverage:{limitations:['No browser run is attached. Runtime checks remain untested.']}};
  if (args.report) {
    const value=report.site ?? report.visits?.[0]?.url;
    const reportHost=value ? new URL(/^https?:\/\//.test(value) ? value : `https://${value}`).hostname : null;
    if (!reportHost || new URL(auditReview.site).hostname !== reportHost) throw new Error('Review site must match the browser report site.');
  }
  const combined={...report,auditReview};
  await fs.mkdir(args.output,{recursive:true,mode:0o700});
  for(const [name,contents] of [['audit-review.json',JSON.stringify(auditReview,null,2)+'\n'],['report.html',renderHtml(combined)],['summary.md',renderMarkdown(combined)]]) {
    const filename=path.join(args.output,name);
    await fs.writeFile(filename,contents,{mode:0o600});
    await fs.chmod(filename,0o600);
  }
  console.log('Audit dashboard generated. Imported conclusions remain host-supplied reviews.');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(()=>{console.error('Audit dashboard failed: check the review schema, site and private file paths.');process.exitCode=2;});
