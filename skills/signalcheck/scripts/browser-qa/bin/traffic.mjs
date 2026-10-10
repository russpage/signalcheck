#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeTrafficExport } from '../lib/traffic.mjs';

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) { console.log('Usage: node bin/traffic.mjs --input PRIVATE_EXPORT.json --output PRIVATE_REPORT.json\nRead a normalized evidence export. No vendor connections or traffic-policy changes are performed.'); return; }
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--input', '--output'].includes(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--') || args[argv[i]]) throw new Error('Provide --input and --output paths once each.');
    args[argv[i]] = argv[i + 1];
  }
  if (!args['--input'] || !args['--output']) throw new Error('Provide --input and --output paths.');
  const inputPath = path.resolve(args['--input']); const outputPath = path.resolve(args['--output']);
  if (inputPath === outputPath) throw new Error('Keep source evidence separate from the output report.');
  const inputRealPath = await fs.realpath(inputPath);
  const outputRealPath = await fs.realpath(outputPath).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (inputRealPath === outputRealPath) throw new Error('Keep source evidence separate from the output report.');
  const stat = await fs.stat(inputPath);
  if (stat.size > 20 * 1024 * 1024) throw new Error('Split evidence exports larger than 20 MiB.');
  const report = analyzeTrafficExport(JSON.parse(await fs.readFile(inputPath, 'utf8')));
  await fs.mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
  const temporary = `${outputPath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, outputPath);
  } finally { await fs.rm(temporary, { force: true }); }
  console.log(`Analyzed ${report.coverage.observations} ${report.coverage.unit} observations; ${report.unknownObservations} unknown; ${report.findings.length} findings. Report saved privately.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Traffic analysis failed. Validate the normalized export and private output path; no source payload is logged.'); process.exitCode = 2; });
