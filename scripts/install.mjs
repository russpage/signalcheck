#!/usr/bin/env node
import { constants } from 'node:fs';
import { lstat, mkdir, readdir, readFile, writeFile, rename, rm, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const SKILL_NAME = 'signalcheck';
export const PLATFORM_PATHS = Object.freeze({
  claude: { project: '.claude/skills', user: '.claude/skills' },
  copilot: { project: '.github/skills', user: '.copilot/skills' },
  gemini: { project: '.gemini/skills', user: '.gemini/skills' },
  codex: { project: '.agents/skills', user: '.agents/skills' },
});

const OMITTED = new Set(['node_modules', 'reports', '.git']);
const DEFAULT_SOURCE = fileURLToPath(new URL('../skills/signalcheck/', import.meta.url));

async function statIfPresent(target) {
  try { return await lstat(target); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Check every existing component, including the leaf: --force must never follow
// a symlink into another project or profile. Nonexistent suffixes are allowed.
export async function assertNoSymlinkComponents(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await statIfPresent(current);
    if (stat?.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${current}`);
    if (stat && current !== absolute && !stat.isDirectory()) {
      throw new Error(`A parent path is not a directory: ${current}`);
    }
  }
}

function overlaps(left, right) {
  const relative = path.relative(left, right);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function sourceEntries(source, prefix = '') {
  const entries = [];
  for (const item of (await readdir(path.join(source, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (OMITTED.has(item.name)) continue;
    const relative = path.join(prefix, item.name);
    const stat = await lstat(path.join(source, relative));
    if (stat.isSymbolicLink()) throw new Error(`The skill contains a symbolic link: ${relative}`);
    if (stat.isDirectory()) {
      entries.push({ relative, directory: true });
      entries.push(...await sourceEntries(source, relative));
    } else if (stat.isFile()) {
      entries.push({ relative, directory: false, mode: stat.mode & 0o777 });
    } else throw new Error(`The skill contains an unsupported file: ${relative}`);
  }
  return entries;
}

export function destinationPlan({ platform, scope = 'project', project = process.cwd(), userHome = homedir() }) {
  if (!Object.hasOwn(PLATFORM_PATHS, platform) && platform !== 'all') {
    throw new Error('Choose --platform claude, copilot, gemini, codex, or all.');
  }
  if (!['project', 'user'].includes(scope)) throw new Error('Choose --scope project or user.');
  const base = path.resolve(scope === 'user' ? userHome : project);
  return (platform === 'all' ? Object.keys(PLATFORM_PATHS) : [platform]).map(name => ({
    platform: name,
    scope,
    destination: path.join(base, PLATFORM_PATHS[name][scope], SKILL_NAME),
  }));
}

async function stageSkill(source, entries, stage) {
  await mkdir(stage, { mode: 0o700 });
  for (const entry of entries) {
    const output = path.join(stage, entry.relative);
    if (entry.directory) await mkdir(output, { recursive: true });
    else {
      // O_NOFOLLOW also rejects a leaf symlink changed after source preflight.
      const handle = await open(path.join(source, entry.relative), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        if (!(await handle.stat()).isFile()) throw new Error(`Source is no longer a regular file: ${entry.relative}`);
        await writeFile(output, await handle.readFile(), { mode: entry.mode, flag: 'wx' });
      } finally { await handle.close(); }
    }
  }
}

// Compare the actual staged bytes and file modes with the recorded commit.
// Ignored/untracked copied files count as edits; omitted caches do not.
async function verifiedSourceCommit(source, entries, stage) {
  try {
    const git = async args => (await promisify(execFile)('git', ['-C', source, ...args])).stdout;
    const sha = (await git(['rev-parse', 'HEAD'])).trim();
    const origin = await git(['remote', 'get-url', 'origin']);
    if (!/^[a-f0-9]{40}$/.test(sha) || !/^(?:https:\/\/github\.com\/|git@github\.com:)russpage\/signalcheck(?:\.git)?\s*$/.test(origin)) return null;
    const tree = (await git(['ls-tree', '-r', '-z', sha, '--', '.'])).split('\0').filter(Boolean).map(record => {
      const tab = record.indexOf('\t');
      const [mode, type, blob] = record.slice(0, tab).split(' ');
      return { mode, type, blob, relative: record.slice(tab + 1) };
    }).filter(entry => !entry.relative.split('/').some(segment => OMITTED.has(segment)));
    const files = entries.filter(entry => !entry.directory);
    if (tree.length !== files.length) return null;
    const tracked = new Map(tree.map(entry => [entry.relative, entry]));
    for (const entry of files) {
      const committed = tracked.get(entry.relative.split(path.sep).join('/'));
      if (!committed || committed.type !== 'blob' || committed.mode !== (entry.mode & 0o111 ? '100755' : '100644')) return null;
      const bytes = await readFile(path.join(stage, entry.relative));
      const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (blob !== committed.blob) return null;
    }
    return sha;
  } catch { return null; /* Archives and noncanonical sources have no verified commit provenance. */ }
}

export async function installSkill(options = {}) {
  const source = path.resolve(options.source ?? DEFAULT_SOURCE);
  const plan = destinationPlan(options);
  await assertNoSymlinkComponents(source);
  if (!(await statIfPresent(source))?.isDirectory()) throw new Error(`Skill source is missing: ${source}`);
  const entries = await sourceEntries(source);
  if (!entries.some(entry => entry.relative === 'SKILL.md' && !entry.directory)) {
    throw new Error('The source must contain SKILL.md at its root.');
  }
  const frontmatter = await readFile(path.join(source, 'SKILL.md'), 'utf8');
  const metadata = frontmatter.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!metadata || !/^name:\s*["']?signalcheck["']?\s*$/m.test(metadata)) {
    throw new Error(`SKILL.md must declare name: ${SKILL_NAME}.`);
  }
  for (const item of plan) {
    if (overlaps(source, item.destination) || overlaps(item.destination, source)) {
      throw new Error('The source and destination directories must not contain one another.');
    }
    await assertNoSymlinkComponents(item.destination);
    const existing = await statIfPresent(item.destination);
    if (existing && !existing.isDirectory()) throw new Error(`The destination is not a directory: ${item.destination}`);
    if (existing && !options.force) throw new Error(`Already installed: ${item.destination}. Use --force to replace it.`);
    item.replacing = Boolean(existing);
  }
  if (options.dryRun) return { dryRun: true, source, files: entries.filter(entry => !entry.directory).length, installations: plan };

  const changes = [];
  try {
    // Preflight all platforms before creating anything; stage all copies before
    // replacing an installation. Restore old copies if a later write fails.
    for (const item of plan) {
      const parent = path.dirname(item.destination);
      await assertNoSymlinkComponents(parent);
      await mkdir(parent, { recursive: true });
      const token = randomUUID();
      const change = { ...item, stage: path.join(parent, `.${SKILL_NAME}-stage-${token}`), backup: path.join(parent, `.${SKILL_NAME}-backup-${token}`), committed: false, backedUp: false };
      changes.push(change);
      await stageSkill(source, entries, change.stage);
      const installedCommit = await verifiedSourceCommit(source, entries, change.stage);
      await writeFile(path.join(change.stage, '.signalcheck-install.json'), JSON.stringify({
        schemaVersion: 1, repository: 'russpage/signalcheck', branch: 'main', installedCommit,
        installedAt: new Date().toISOString(), platform: item.platform,
      }, null, 2), { mode: 0o600 });
    }
    for (const change of changes) {
      await assertNoSymlinkComponents(change.destination);
      const existing = await statIfPresent(change.destination);
      if (existing && (!options.force || !existing.isDirectory())) throw new Error(`The destination changed during installation: ${change.destination}`);
      if (existing) {
        await rename(change.destination, change.backup);
        change.backedUp = true;
      }
      await rename(change.stage, change.destination);
      change.committed = true;
    }
  } catch (error) {
    for (const change of changes.reverse()) {
      if (change.committed) await rm(change.destination, { recursive: true, force: true });
      if (change.backedUp) await rename(change.backup, change.destination);
      await rm(change.stage, { recursive: true, force: true });
    }
    throw error;
  }
  for (const change of changes) if (change.backedUp) await rm(change.backup, { recursive: true, force: true });
  return { dryRun: false, source, files: entries.filter(entry => !entry.directory).length, installations: plan };
}

export function parseArgs(args) {
  const options = { scope: 'project', project: process.cwd() };
  const values = new Map([['--platform', 'platform'], ['--scope', 'scope'], ['--project', 'project'], ['--source', 'source']]);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (values.has(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}.`);
      options[values.get(arg)] = value;
    } else if (arg === '--global') options.scope = 'user';
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export const HELP = `Install the SignalCheck website QA skill (Node.js 22+).

  node scripts/install.mjs --platform claude --project /path/to/project
  node scripts/install.mjs --platform all --scope user --dry-run

Options:
  --platform claude|copilot|gemini|codex|all   Required
  --scope project|user                       Default: project
  --project PATH                             Default: current directory
  --global                                   Alias for --scope user
  --source PATH                              Alternative skill folder
  --dry-run                                  Validate and show paths without writing
  --force                                    Replace an existing skill installation

Copies instructions and bundled runtime files. It does not install browsers,
dependencies, grant permissions, run an audit, or create a daily schedule.
`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(HELP); return; }
  const result = await installSkill(options);
  for (const item of result.installations) {
    process.stdout.write(`${result.dryRun ? 'Would install' : 'Installed'} ${item.platform}: ${item.destination}${item.replacing ? ' (replace existing)' : ''}\n`);
  }
  process.stdout.write(`${result.files} bundled files. Open or reload the target agent, then ask it to use ${SKILL_NAME}.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`Installation failed: ${error.message}\n`); process.exitCode = 1; });
}
