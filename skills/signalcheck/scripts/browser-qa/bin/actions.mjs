#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildActionPlan, recordAction, verifyAction, renderActionMarkdown } from '../lib/action-plan.mjs';
import { safeReportValue } from './report.mjs';

const help = `SignalCheck agent handoff\n\nnode bin/actions.mjs plan REPORT --output PLAN [--mode investigate|prepare-fixes|maintain] [--capabilities JSON] [--previous PLAN]\nnode bin/actions.mjs record PLAN --id ACTION --record JSON\nnode bin/actions.mjs verify PLAN --id ACTION --report RETEST\n\nRecord JSON describes investigated, prepared, applied or blocked evidence.\nThis command records work; it never calls connectors, applies patches or publishes.\nSite evidence and action records remain private. See references/agent-workflow.md.\n`;
export function parseArgs(argv) {
  if (!argv.length || argv.includes('--help')) return { help: true };
  const [command, input, ...flags] = argv;
  if (!['plan','record','verify'].includes(command) || !input || input.startsWith('--')) throw new Error('Choose plan, record or verify and an input path.');
  const options = { command, input };
  const allowed = { plan: ['output','mode','capabilities','previous'], record: ['id','record'], verify: ['id','report'] }[command];
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i].slice(2);
    if (!flags[i].startsWith('--') || !allowed.includes(key) || !flags[i+1] || flags[i+1].startsWith('--') || options[key]) throw new Error('Invalid, missing or repeated action option.');
    options[key] = flags[i+1];
  }
  if (command === 'plan' && !options.output || command !== 'plan' && (!options.id || !options[command === 'record' ? 'record' : 'report'])) throw new Error('Required action options are missing.');
  return options;
}
const read = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
export async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) { console.log(help); return; }
  const input = await read(options.input);
  const plan = options.command === 'plan' ? buildActionPlan(input, {
    mode: options.mode, capabilities: options.capabilities ? await read(options.capabilities) : [],
    previousPlan: options.previous ? await read(options.previous) : null,
  }) : options.command === 'record' ? recordAction(input, options.id, await read(options.record)) : verifyAction(input, options.id, await read(options.report));
  const output = options.output ?? options.input;
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  // Private ledger keeps stable IDs for comparison. The human handoff is redacted.
  const temporary = `${output}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(plan, null, 2), { mode: 0o600 });
  await fs.rename(temporary, output);
  await fs.writeFile(`${output}.md`, renderActionMarkdown(safeReportValue(plan)), { mode: 0o600 });
  console.log('SignalCheck action plan saved. Inspect the private ledger and redacted handoff.');
  if (options.command === 'verify' && !plan.actions.find(a => a.id === options.id).verificationResult.verified) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
