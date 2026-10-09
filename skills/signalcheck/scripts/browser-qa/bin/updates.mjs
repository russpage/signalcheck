#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = 'https://github.com/russpage/signalcheck';
export async function checkUpdates({ installedCommit = null, lastNotifiedCommit = null, fetcher = fetch } = {}) {
  const response = await fetcher('https://api.github.com/repos/russpage/signalcheck/commits/main', {
    headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Upstream check failed (HTTP ${response.status}); installation unchanged.`);
  const commit = await response.json();
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Upstream returned no valid commit.');
  if (installedCommit !== null && !/^[a-f0-9]{40}$/.test(installedCommit)) throw new Error('Installed commit must be a full SHA.');
  const status = installedCommit === null ? 'baseline-unknown' : commit.sha === installedCommit ? 'current' : 'upstream-changed';
  return { status, installedCommit, upstreamCommit: commit.sha,
    notify: status === 'upstream-changed' && commit.sha !== lastNotifiedCommit,
    changeUrl: installedCommit ? `${repo}/compare/${installedCommit}...${commit.sha}` : `${repo}/commits/main`,
    commitUrl: `${repo}/commit/${commit.sha}`, feedbackUrl: `${repo}/issues/new/choose`,
    nextAction: status === 'upstream-changed' ? 'Review the changes and local edits. Ask whether to integrate this pinned revision.' : status === 'baseline-unknown' ? 'Establish installed commit provenance before claiming an update is available.' : 'No upstream change detected.',
    integration: 'No files changed. Upstream difference is not proof of compatible or newer code; review ancestry and tests before integration.',
  };
}

export async function main(argv) {
  const args = {};
  if (argv.includes('--help')) { console.log('node bin/updates.mjs [--receipt PATH] [--last-notified FULL_SHA]\nChecks public main once; never installs, sends notifications or stores telemetry.'); return; }
  for (let i=0;i<argv.length;i+=2) {
    if (!['--receipt','--last-notified'].includes(argv[i]) || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error('Invalid update option.');
    args[argv[i]] = argv[i+1];
  }
  let receipt = {};
  try { receipt = JSON.parse(await fs.readFile(args['--receipt'] ?? new URL('../../../.signalcheck-install.json', import.meta.url), 'utf8')); }
  catch(error) { if(error.code !== 'ENOENT') throw new Error('Cannot read installation receipt; no changes made.'); }
  const result = await checkUpdates({installedCommit:receipt.installedCommit??null,lastNotifiedCommit:args['--last-notified']??null});
  console.log(JSON.stringify(result,null,2));
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
